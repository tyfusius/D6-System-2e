import {
  firstEditionBodyPointHealingPlan,
  firstEditionBodyPointRescueMinimum,
  firstEditionBodyPointSkillLossDice,
  firstEditionBodyPointWound,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActorBinding,
  FirstEditionStageSpec,
} from "./first-edition-action-contract";
import {
  appendFirstEditionActionStages,
  completeFirstEditionAction,
  createFirstEditionActionRoot,
  FirstEditionActionError,
  parseFirstEditionActionRoot,
} from "./first-edition-action-root";
import { canonical, keys, object } from "./first-edition-action-validation";

export interface FirstEditionBodyPointRoot {
  readonly version: 1;
  readonly matchingResults?: Readonly<Record<string, D6RollResultV1>>;
  readonly followUps?: Readonly<Record<string, string>>;
  readonly operation: "natural" | "assisted";
  readonly initiatorUserId: string;
  readonly patientControllerUserId: string;
  readonly before: { readonly current: number; readonly maximum: number };
  readonly minutes: number;
  readonly restModifierScore: -3 | 0 | 3;
  readonly survivalSource: {
    readonly attributeId: string;
    readonly itemId?: string;
  };
  /** Fixed table result is saved without inventing dice. */
  readonly fixedAmount?: {
    readonly kind: "fixed";
    readonly points: number;
    readonly checkStageId: string;
  };
  readonly action: FirstEditionActionRoot;
}
function invalid(): never {
  throw new FirstEditionActionError("invalid");
}
export function bodyPointAmount(
  value: FirstEditionBodyPointRoot,
): number | null {
  if (value.fixedAmount) return value.fixedAmount.points;
  const receipt = value.action.stages.find(
    (s) => s.spec.kind === "plain-d6",
  )?.receipt;
  return receipt?.kind === "plain-d6" ? receipt.total : null;
}
export function bodyPointTreatmentOutcome(value: FirstEditionBodyPointRoot) {
  const amount = bodyPointAmount(value);
  if (amount === null) return null;
  const current = Math.min(value.before.maximum, value.before.current + amount);
  const rescue =
    value.operation === "assisted" &&
    firstEditionBodyPointWound(value.before.current, value.before.maximum) ===
      "mortally-wounded" &&
    current >= firstEditionBodyPointRescueMinimum(value.before.maximum);
  const loss = rescue ? firstEditionBodyPointSkillLossDice(value.minutes) : 0;
  const survival = value.action.stages.find(
    (s) => s.spec.kind === "d6-roll" && s.spec.purpose === "survival",
  )?.receipt;
  if (
    rescue &&
    loss !== null &&
    value.minutes > 4 &&
    survival?.kind !== "d6-roll"
  )
    return null;
  const dead =
    rescue &&
    (loss === null ||
      (survival?.kind === "d6-roll" && survival.result.total < value.minutes));
  const after = dead ? -value.before.maximum : current;
  return {
    amount,
    current: after,
    maximum: value.before.maximum,
    gain: dead ? 0 : after - value.before.current,
    rescue: dead
      ? ("dead" as const)
      : rescue
        ? ("rescued" as const)
        : ("not-needed" as const),
    skillLossDice: dead ? (0 as const) : (loss ?? 0),
    wound: firstEditionBodyPointWound(after, value.before.maximum),
  };
}
function patient(value: FirstEditionBodyPointRoot) {
  return (
    value.action.subjects.find((s) => s.role === "patient")?.actor ?? invalid()
  );
}
function nextSpec(
  value: FirstEditionBodyPointRoot,
): { id: string; spec: FirstEditionStageSpec } | null {
  const id = value.action.rootMessageId;
  const check = value.action.stages[0];
  if (check?.receipt?.kind !== "d6-roll") return null;
  const plan = firstEditionBodyPointHealingPlan(check.receipt.result.total);
  if (
    plan.dice > 0 &&
    !value.action.stages.some((s) => s.spec.kind === "plain-d6")
  )
    return {
      id: `${id}:amount`,
      spec: {
        kind: "plain-d6",
        purpose: "body-point-amount",
        unit: "points",
        dice: plan.dice,
        subject: check.spec.subject,
        controllerUserId: check.spec.controllerUserId,
      },
    };
  const amount = bodyPointAmount(value);
  if (amount === null) return null;
  const rescue =
    value.operation === "assisted" &&
    firstEditionBodyPointWound(value.before.current, value.before.maximum) ===
      "mortally-wounded" &&
    Math.min(value.before.maximum, value.before.current + amount) >=
      firstEditionBodyPointRescueMinimum(value.before.maximum);
  if (
    rescue &&
    value.minutes > 4 &&
    value.minutes <= 15 &&
    !value.action.stages.some(
      (s) => s.spec.kind === "d6-roll" && s.spec.purpose === "survival",
    )
  )
    return {
      id: `${id}:survival`,
      spec: {
        kind: "d6-roll",
        purpose: "survival",
        unit: "check",
        subject: patient(value),
        controllerUserId: value.patientControllerUserId,
        source: value.survivalSource,
        fixedDifficulty: value.minutes,
      },
    };
  const outcome = bodyPointTreatmentOutcome(value);
  if (!outcome) return null;
  if (!value.action.stages.some((s) => s.id === `${id}:pool`))
    return {
      id: `${id}:pool`,
      spec: {
        kind: "effect",
        subject: patient(value),
        controllerUserId: value.action.coordinatorUserId,
        plan: {
          kind: "health-change",
          actorUuid: patient(value).actorUuid,
          healthModelId: value.action.runtime.healthModelId ?? "",
          before: {
            kind: "body-points",
            current: { value: value.before.current, unit: "points" },
            maximum: { value: value.before.maximum, unit: "points" },
          },
          after: {
            kind: "body-points",
            current: { value: outcome.current, unit: "points" },
            maximum: { value: outcome.maximum, unit: "points" },
            derivedWoundStateId: outcome.wound,
          },
        },
      },
    };
  if (
    outcome.skillLossDice > 0 &&
    !value.action.stages.some((s) => s.id === `${id}:skills`)
  )
    return {
      id: `${id}:skills`,
      spec: {
        kind: "effect",
        subject: patient(value),
        controllerUserId: value.action.coordinatorUserId,
        plan: {
          kind: "body-point-skill-loss",
          actorUuid: patient(value).actorUuid,
          lossScore: outcome.skillLossDice === 1 ? 3 : 6,
        },
      },
    };
  return null;
}
export function createFirstEditionBodyPointRoot(input: {
  rootMessageId: string;
  initiatorUserId: string;
  coordinatorUserId: string;
  patientControllerUserId: string;
  patient: FirstEditionActorBinding;
  healer?: FirstEditionActorBinding;
  operation: "natural" | "assisted";
  before: FirstEditionBodyPointRoot["before"];
  minutes: number;
  restModifierScore: -3 | 0 | 3;
  source: FirstEditionBodyPointRoot["survivalSource"];
  survivalSource: FirstEditionBodyPointRoot["survivalSource"];
  fixedScore?: number;
  runtime: FirstEditionActionRoot["runtime"];
}): FirstEditionBodyPointRoot {
  if (
    !Number.isSafeInteger(input.before.maximum) ||
    input.before.maximum <= 0 ||
    !Number.isSafeInteger(input.before.current) ||
    input.before.current > input.before.maximum ||
    firstEditionBodyPointWound(input.before.current, input.before.maximum) ===
      "dead" ||
    !Number.isSafeInteger(input.minutes) ||
    input.minutes < 0 ||
    ![-3, 0, 3].includes(input.restModifierScore)
  )
    invalid();
  return {
    version: 1,
    operation: input.operation,
    initiatorUserId: input.initiatorUserId,
    patientControllerUserId: input.patientControllerUserId,
    before: input.before,
    minutes: input.minutes,
    restModifierScore: input.restModifierScore,
    survivalSource: input.survivalSource,
    action: createFirstEditionActionRoot({
      rootMessageId: input.rootMessageId,
      operationId: input.rootMessageId,
      coordinatorUserId: input.coordinatorUserId,
      initiation: "healing",
      runtime: input.runtime,
      subjects: [
        { role: "patient", actor: input.patient },
        ...(input.healer
          ? [{ role: "healer" as const, actor: input.healer }]
          : []),
      ],
      stages: [
        {
          id: `${input.rootMessageId}:check`,
          spec: {
            kind: "d6-roll",
            purpose:
              input.operation === "natural" ? "natural-healing" : "medicine",
            subject: input.healer ?? input.patient,
            controllerUserId: input.initiatorUserId,
            unit: "check",
            source: input.source,
            ...(input.fixedScore === undefined
              ? {}
              : { fixedScore: input.fixedScore }),
          },
        },
      ],
    }),
  };
}
export function advanceFirstEditionBodyPointRoot(
  value: FirstEditionBodyPointRoot,
): FirstEditionBodyPointRoot {
  if (
    value.action.status !== "open" ||
    value.action.stages.some((s) => s.state !== "recorded")
  )
    return value;
  const receipt = value.action.stages[0]?.receipt;
  if (receipt?.kind !== "d6-roll") invalid();
  const plan = firstEditionBodyPointHealingPlan(receipt.result.total);
  const next =
    plan.dice === 0
      ? {
          ...value,
          fixedAmount: {
            kind: "fixed" as const,
            points: plan.fixed,
            checkStageId: value.action.stages[0]?.id ?? "",
          },
        }
      : value;
  const spec = nextSpec(next);
  return {
    ...next,
    action: spec
      ? appendFirstEditionActionStages(next.action, [spec])
      : completeFirstEditionAction(next.action),
  };
}
/** Strictly reconstruct every consumer stage from saved prior receipts. */
export function parseFirstEditionBodyPointRoot(
  raw: unknown,
): FirstEditionBodyPointRoot | null {
  try {
    const v = object(raw),
      action = parseFirstEditionActionRoot(v?.action);
    if (
      !v ||
      !action ||
      !keys(v, [
        "version",
        "matchingResults",
        "followUps",
        "operation",
        "initiatorUserId",
        "patientControllerUserId",
        "before",
        "minutes",
        "restModifierScore",
        "survivalSource",
        "fixedAmount",
        "action",
      ]) ||
      v.version !== 1 ||
      !["natural", "assisted"].includes(String(v.operation)) ||
      typeof v.initiatorUserId !== "string" ||
      !v.initiatorUserId ||
      typeof v.patientControllerUserId !== "string" ||
      !v.patientControllerUserId
    )
      return null;
    const value = { ...v, action } as unknown as FirstEditionBodyPointRoot;
    for (const [field, rawEntries] of [
      ["matchingResults", v.matchingResults],
      ["followUps", v.followUps],
    ] as const) {
      if (rawEntries === undefined) continue;
      const entries = object(rawEntries);
      if (!entries) return null;
      for (const [id, entry] of Object.entries(entries)) {
        const stage = action.stages.find((s) => s.id === id);
        if (stage?.receipt?.kind !== "d6-roll") return null;
        if (field === "followUps") {
          if (entry !== stage.spec.controllerUserId) return null;
        } else if (
          !object(entry) ||
          canonical({ ...object(entry), matchingObservation: undefined }) !==
            canonical({
              ...stage.receipt.result,
              matchingObservation: undefined,
            })
        )
          return null;
      }
    }
    const first = action.stages[0];
    if (first?.spec.kind !== "d6-roll") return null;
    let expected = createFirstEditionBodyPointRoot({
      rootMessageId: action.rootMessageId,
      initiatorUserId: value.initiatorUserId,
      coordinatorUserId: action.coordinatorUserId,
      patientControllerUserId: value.patientControllerUserId,
      patient: patient(value),
      ...(value.operation === "assisted"
        ? {
            healer:
              action.subjects.find((s) => s.role === "healer")?.actor ??
              invalid(),
          }
        : {}),
      operation: value.operation,
      before: value.before,
      minutes: value.minutes,
      restModifierScore: value.restModifierScore,
      source: first.spec.source,
      survivalSource: value.survivalSource,
      ...(first.spec.fixedScore === undefined
        ? {}
        : { fixedScore: first.spec.fixedScore }),
      runtime: action.runtime,
    });
    for (let i = 0; i < action.stages.length; i++) {
      const actual = action.stages[i],
        wanted = expected.action.stages[i];
      const wantedSpec =
        actual?.spec.kind === "effect" && actual.state === "recorded" && wanted
          ? { ...wanted.spec, controllerUserId: actual.spec.controllerUserId }
          : wanted?.spec;
      if (
        !actual ||
        actual.id !== wanted?.id ||
        canonical(actual.spec) !== canonical(wantedSpec)
      )
        return null;
      expected = {
        ...expected,
        action: {
          ...expected.action,
          stages: [...expected.action.stages.slice(0, i), actual],
          revision: action.revision,
        },
      };
      if (actual.state === "recorded")
        expected = advanceFirstEditionBodyPointRoot(expected);
    }
    if (
      canonical(value.fixedAmount ?? null) !==
      canonical(expected.fixedAmount ?? null)
    ) {
      // A just-recorded initial check precedes the explicit advance operation.
      if (!(
        value.fixedAmount === undefined &&
        action.stages.length === 1 &&
        action.status === "open"
      ))
        return null;
    }
    if (action.status === "complete" && expected.action.status !== "complete")
      return null;
    return value;
  } catch {
    return null;
  }
}
