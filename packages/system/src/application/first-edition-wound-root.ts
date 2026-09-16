import {
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionNaturalHealingResolution,
  firstEditionNaturalHealingRule,
  firstEditionMortalityResolution,
  isFirstEditionWoundLevel,
  medicalTreatmentDifficulty,
  type FirstEditionWoundLevel,
  type D6DifficultyLadderEntryV2,
  type D6MedicalTreatmentDifficultyV1,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActorBinding,
  FirstEditionClockBinding,
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

export type WoundOperation =
  "natural" | "assisted" | "manual-mortality" | "round-mortality";
export interface FirstEditionWoundRoot {
  readonly version: 1;
  readonly matchingResult?: D6RollResultV1;
  readonly followUps?: Readonly<Record<string, string>>;
  readonly operation: WoundOperation;
  readonly initiatorUserId: string;
  readonly wound: FirstEditionWoundLevel;
  readonly minutes?: number;
  readonly treatmentAudit?: D6MedicalTreatmentDifficultyV1;
  readonly action: FirstEditionActionRoot;
}
export function woundRootOutcome(value: FirstEditionWoundRoot) {
  const receipt = value.action.stages[0]?.receipt;
  if (value.operation === "natural" && value.wound === "stunned")
    return firstEditionNaturalHealingResolution(value.wound, 0);
  if (receipt?.kind !== "d6-roll") return null;
  if (value.operation === "natural")
    return firstEditionNaturalHealingResolution(
      value.wound,
      receipt.result.total,
      receipt.result.wildOutcome === "complication",
    );
  if (value.operation === "assisted")
    return firstEditionAssistedHealingResolution(
      value.wound,
      receipt.result.total,
    );
  const outcome = firstEditionMortalityResolution(
    value.minutes ?? 0,
    receipt.result.total,
  );
  return {
    previousWound: value.wound,
    nextWound: outcome === "dead" ? ("dead" as const) : value.wound,
    outcome,
  };
}
function effectSpec(value: FirstEditionWoundRoot): FirstEditionStageSpec {
  const patient = value.action.subjects.find(
    (s) => s.role === "patient",
  )?.actor;
  const outcome = woundRootOutcome(value);
  if (!patient || !outcome) throw new FirstEditionActionError("invalid");
  const rest =
    value.operation === "natural"
      ? firstEditionNaturalHealingRule(value.wound)
      : null;
  return {
    kind: "effect",
    subject: patient,
    controllerUserId: value.action.coordinatorUserId,
    plan: {
      kind: "health-change",
      actorUuid: patient.actorUuid,
      healthModelId: value.action.runtime.healthModelId ?? "",
      before: { kind: "wounds", stateId: value.wound },
      after: { kind: "wounds", stateId: outcome.nextWound },
      ...(value.action.clock ? { clock: value.action.clock } : {}),
      ...(rest
        ? {
            rest: {
              value: rest.restAmount,
              unit: rest.restUnit === "minute" ? "minutes" : rest.restUnit,
            },
          }
        : {}),
    },
  };
}
export function createFirstEditionWoundRoot(input: {
  rootMessageId: string;
  controllerUserId: string;
  coordinatorUserId: string;
  initiatorUserId?: string;
  patient: FirstEditionActorBinding;
  healer?: FirstEditionActorBinding;
  source: { attributeId: string; itemId?: string };
  runtime: FirstEditionActionRoot["runtime"];
  operation: WoundOperation;
  wound: FirstEditionWoundLevel;
  minutes?: number;
  clock?: FirstEditionClockBinding;
  difficultyLadder?: readonly D6DifficultyLadderEntryV2[];
  selfTreatment?: boolean;
  treatmentAudit?: D6MedicalTreatmentDifficultyV1;
}): FirstEditionWoundRoot {
  const printedDifficulty =
    input.operation === "natural"
      ? undefined
      : input.operation === "assisted"
        ? firstEditionAssistedHealingDifficulty(input.wound)
        : input.minutes;
  let treatmentAudit: D6MedicalTreatmentDifficultyV1 | undefined;
  if (input.operation === "assisted" && typeof printedDifficulty === "number") {
    treatmentAudit =
      input.treatmentAudit ??
      medicalTreatmentDifficulty({
        family: "open-d6-space",
        ladder: input.difficultyLadder ?? [],
        printedBaseValue: printedDifficulty,
        selfTreatment: input.selfTreatment === true,
        wound: input.wound,
      });
    const expectedBase = medicalTreatmentDifficulty({
      family: "open-d6-space",
      ladder: [],
      printedBaseValue: printedDifficulty,
      selfTreatment: false,
      wound: input.wound,
    });
    if (
      treatmentAudit.treatmentFamily !== "open-d6-space" ||
      treatmentAudit.baseCategory !== expectedBase.baseCategory ||
      treatmentAudit.baseValue !== printedDifficulty ||
      !Number.isSafeInteger(treatmentAudit.finalValue) ||
      treatmentAudit.finalValue < 0
    )
      throw new FirstEditionActionError("invalid");
    if (treatmentAudit.selfTreatment) {
      if (
        !treatmentAudit.finalCategory ||
        treatmentAudit.finalCategory === treatmentAudit.baseCategory ||
        treatmentAudit.finalValue <= printedDifficulty
      )
        throw new FirstEditionActionError("invalid");
    } else if (canonical(treatmentAudit) !== canonical(expectedBase))
      throw new FirstEditionActionError("invalid");
  }
  const difficulty = treatmentAudit?.finalValue ?? printedDifficulty;
  if (
    difficulty === null ||
    (input.operation === "natural" &&
      !firstEditionNaturalHealingRule(input.wound)) ||
    ((input.operation === "manual-mortality" ||
      input.operation === "round-mortality") &&
      (input.wound !== "mortally-wounded" ||
        !Number.isSafeInteger(input.minutes) ||
        (input.minutes ?? -1) <
          (input.operation === "manual-mortality" ? 1 : 0)))
  )
    throw new FirstEditionActionError("invalid");
  const draft: FirstEditionWoundRoot = {
    version: 1,
    operation: input.operation,
    wound: input.wound,
    initiatorUserId: input.initiatorUserId ?? input.controllerUserId,
    ...(input.minutes === undefined ? {} : { minutes: input.minutes }),
    ...(treatmentAudit ? { treatmentAudit } : {}),
    action: {
      version: 1,
      rootMessageId: input.rootMessageId,
      operationId: input.rootMessageId,
      coordinatorUserId: input.coordinatorUserId,
      initiation:
        input.operation === "natural" || input.operation === "assisted"
          ? "healing"
          : input.operation,
      runtime: input.runtime,
      subjects: [
        { role: "patient", actor: input.patient },
        ...(input.healer
          ? [{ role: "healer" as const, actor: input.healer }]
          : []),
      ],
      ...(input.clock ? { clock: input.clock } : {}),
      status: "open",
      revision: 0,
      stages: [],
    },
  };
  const automatic = input.operation === "natural" && input.wound === "stunned";
  const spec: FirstEditionStageSpec = automatic
    ? effectSpec(draft)
    : {
        kind: "d6-roll",
        subject: input.healer ?? input.patient,
        controllerUserId: input.controllerUserId,
        purpose:
          input.operation === "natural"
            ? "natural-healing"
            : input.operation === "assisted"
              ? "medicine"
              : "survival",
        unit: "check",
        source: input.source,
        ...(difficulty === undefined ? {} : { fixedDifficulty: difficulty }),
      };
  return {
    ...draft,
    action: createFirstEditionActionRoot({
      ...draft.action,
      stages: [
        {
          id: `${input.rootMessageId}:${automatic ? "health" : "check"}`,
          spec,
        },
      ],
    }),
  };
}
export function advanceFirstEditionWoundRoot(
  value: FirstEditionWoundRoot,
): FirstEditionWoundRoot {
  if (
    value.action.status !== "open" ||
    value.action.stages.some((s) => s.state !== "recorded")
  )
    return value;
  if (value.action.stages.some((s) => s.spec.kind === "effect"))
    return { ...value, action: completeFirstEditionAction(value.action) };
  return {
    ...value,
    action: appendFirstEditionActionStages(value.action, [
      { id: `${value.action.operationId}:health`, spec: effectSpec(value) },
    ]),
  };
}
export function parseFirstEditionWoundRoot(
  raw: unknown,
): FirstEditionWoundRoot | null {
  try {
    const v = object(raw),
      action = parseFirstEditionActionRoot(v?.action);
    if (
      !v ||
      !keys(v, [
        "version",
        "matchingResult",
        "followUps",
        "initiatorUserId",
        "operation",
        "wound",
        "minutes",
        "treatmentAudit",
        "action",
      ]) ||
      v.version !== 1 ||
      typeof v.initiatorUserId !== "string" ||
      !v.initiatorUserId ||
      !action ||
      !isFirstEditionWoundLevel(v.wound) ||
      !["natural", "assisted", "manual-mortality", "round-mortality"].includes(
        String(v.operation),
      )
    )
      return null;
    const value = { ...v, action } as unknown as FirstEditionWoundRoot;
    const patient = action.subjects.find((s) => s.role === "patient")?.actor,
      healer = action.subjects.find((s) => s.role === "healer")?.actor;
    const first = action.stages[0];
    if (
      !patient ||
      !first ||
      (value.operation === "assisted" ? !healer : healer !== undefined) ||
      (value.operation === "round-mortality"
        ? !action.clock || action.clock.elapsedMinutes.value !== value.minutes
        : action.clock !== undefined) ||
      ((value.operation === "natural" || value.operation === "assisted") &&
        value.minutes !== undefined)
    )
      return null;
    const expected = createFirstEditionWoundRoot({
      initiatorUserId: value.initiatorUserId,
      rootMessageId: action.rootMessageId,
      controllerUserId: first.spec.controllerUserId,
      coordinatorUserId: action.coordinatorUserId,
      patient,
      ...(healer ? { healer } : {}),
      source:
        first.spec.kind === "d6-roll"
          ? first.spec.source
          : { attributeId: "unused" },
      runtime: action.runtime,
      operation: value.operation,
      wound: value.wound,
      ...(value.minutes === undefined ? {} : { minutes: value.minutes }),
      ...(action.clock ? { clock: action.clock } : {}),
      ...(value.treatmentAudit ? { treatmentAudit: value.treatmentAudit } : {}),
    });
    if (
      action.operationId !== action.rootMessageId ||
      action.initiation !== expected.action.initiation ||
      action.stages.length > 2 ||
      first.id !== expected.action.stages[0]?.id ||
      canonical(first.spec) !== canonical(expected.action.stages[0].spec)
    )
      return null;
    if (v.followUps !== undefined) {
      const follows = object(v.followUps);
      if (
        !follows ||
        Object.entries(follows).some(
          ([id, controller]) =>
            first.receipt?.kind !== "d6-roll" ||
            id !== first.id ||
            controller !== first.spec.controllerUserId,
        )
      )
        return null;
    }
    if (v.matchingResult !== undefined) {
      const matching = object(v.matchingResult);
      if (
        first.receipt?.kind !== "d6-roll" ||
        !matching ||
        canonical({ ...matching, matchingObservation: undefined }) !==
          canonical({ ...first.receipt.result, matchingObservation: undefined })
      )
        return null;
    }
    const effect = action.stages[1];
    if (
      effect &&
      (first.state !== "recorded" ||
        first.spec.kind !== "d6-roll" ||
        effect.id !== `${action.operationId}:health` ||
        canonical(effect.spec) !== canonical(effectSpec(value)))
    )
      return null;
    if (
      action.status === "complete" &&
      !action.stages.some(
        (s) => s.spec.kind === "effect" && s.state === "recorded",
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
