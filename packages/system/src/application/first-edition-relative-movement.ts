import {
  parseRunningBinding,
  runningMovementPlan,
  movementTranslationAllowed,
  type FirstEditionRunningBinding,
} from "./first-edition-segmented-running";
import {
  firstEditionMovementPlan,
  type FirstEditionMovementPlan,
  type D6RollResultV1,
  type FirstEditionMovementPlanInput,
} from "@d6-system-2e/core";
import type {
  FirstEditionActionRoot,
  FirstEditionActorBinding,
  FirstEditionEffectPlan,
  FirstEditionStageSpec,
} from "./first-edition-action-contract";
import {
  appendFirstEditionActionStages,
  completeFirstEditionAction,
  createFirstEditionActionRoot,
  FirstEditionActionError,
  parseFirstEditionActionRoot,
} from "./first-edition-action-root";
import {
  canonical,
  effectPlan,
  keys,
  object,
  text,
} from "./first-edition-action-validation";

/** Only the existing confidential Combat/action-commitment authority admits this
 * consumer. Other contexts keep their complete existing movement workflow. */
export interface FirstEditionRelativeMovement {
  readonly version: 1 | 2;
  readonly segment?: FirstEditionRunningBinding;
  readonly action: FirstEditionActionRoot;
  readonly combat: {
    readonly uuid: string;
    readonly combatantUuid: string;
    readonly revision: number;
  };
  readonly matchingResult?: D6RollResultV1;
  readonly followUps?: Readonly<Record<string, string>>;
  readonly planInput: FirstEditionMovementPlanInput;
  readonly plan: FirstEditionMovementPlan;
  readonly translation: Extract<
    FirstEditionEffectPlan,
    { kind: "token-translation" }
  >;
  readonly spend?: Extract<
    FirstEditionEffectPlan,
    { kind: "action-spend" | "segment-movement" | "ordered-completion" }
  >;
}
const id = (root: FirstEditionActionRoot, purpose: string) =>
  `${root.operationId}:${purpose}`;
function effectSpec(
  root: FirstEditionActionRoot,
  plan: FirstEditionEffectPlan,
): FirstEditionStageSpec {
  const subject = root.subjects[0]?.actor;
  if (!subject) throw new FirstEditionActionError("invalid");
  return {
    kind: "effect",
    subject,
    controllerUserId: root.stages[0]?.spec.controllerUserId ?? "",
    plan,
  };
}
export function createFirstEditionRelativeMovement(input: {
  rootMessageId: string;
  operationId: string;
  controllerUserId: string;
  coordinatorUserId: string;
  subject: FirstEditionActorBinding;
  runtime: FirstEditionActionRoot["runtime"];
  combat: FirstEditionRelativeMovement["combat"];
  planInput: FirstEditionMovementPlanInput;
  translation: FirstEditionRelativeMovement["translation"];
  spend?: FirstEditionRelativeMovement["spend"];
  source: { attributeId: string; itemId?: string };
  segment?: FirstEditionRunningBinding;
}): FirstEditionRelativeMovement {
  const plan = input.segment
    ? runningMovementPlan(input.segment, input.planInput.distance)
    : firstEditionMovementPlan(input.planInput);
  const initial: FirstEditionStageSpec = plan.rollRequired
    ? {
        kind: "d6-roll",
        purpose: input.segment ? "segment-running" : "movement",
        unit: "check",
        subject: input.subject,
        controllerUserId: input.controllerUserId,
        source: input.source,
        fixedDifficulty: plan.difficulty,
      }
    : {
        kind: "effect",
        subject: input.subject,
        controllerUserId: input.controllerUserId,
        plan: input.spend ?? input.translation,
      };
  const action = createFirstEditionActionRoot({
    rootMessageId: input.rootMessageId,
    operationId: input.operationId,
    coordinatorUserId: input.coordinatorUserId,
    initiation: "movement",
    runtime: input.runtime,
    subjects: [{ role: "mover", actor: input.subject }],
    stages: [
      {
        id: `${input.operationId}:${plan.rollRequired ? "check" : input.spend ? "spend" : "translate"}`,
        spec: initial,
      },
    ],
  });
  const value = {
    version: input.segment ? (2 as const) : (1 as const),
    ...(input.segment ? { segment: input.segment } : {}),
    action,
    combat: input.combat,
    plan,
    planInput: input.planInput,
    translation: input.translation,
    ...(input.spend ? { spend: input.spend } : {}),
  };
  const parsed = parseFirstEditionRelativeMovement(value);
  if (!parsed) throw new FirstEditionActionError("invalid");
  return parsed;
}
export function parseFirstEditionRelativeMovement(
  value: unknown,
): FirstEditionRelativeMovement | null {
  try {
    const v = object(value),
      action = parseFirstEditionActionRoot(v?.action);
    if (
      !v ||
      !keys(v, [
        "version",
        "segment",
        "action",
        "combat",
        "followUps",
        "matchingResult",
        "planInput",
        "plan",
        "translation",
        "spend",
      ]) ||
      (v.version !== 1 && v.version !== 2) ||
      (v.version === 1 ? v.segment !== undefined : v.segment === undefined) ||
      action?.initiation !== "movement"
    )
      return null;
    const combat = object(v.combat);
    if (
      !combat ||
      !keys(combat, ["uuid", "combatantUuid", "revision"]) ||
      !text(combat.uuid) ||
      !text(combat.combatantUuid) ||
      !Number.isSafeInteger(combat.revision) ||
      Number(combat.revision) < 0
    )
      return null;
    if (v.followUps !== undefined) {
      const followUps = object(v.followUps);
      if (
        !followUps ||
        Object.entries(followUps).some(
          ([key, user]) => key !== `${action.operationId}:check` || !text(user),
        )
      )
        return null;
    }
    const rawInput = object(v.planInput);
    if (
      !rawInput ||
      !keys(rawInput, [
        "baseMove",
        "distance",
        "hasMovementSkill",
        "terrainModifier",
        "type",
      ]) ||
      !["land", "fly", "swim", "climb"].includes(String(rawInput.type)) ||
      (rawInput.hasMovementSkill !== undefined &&
        typeof rawInput.hasMovementSkill !== "boolean")
    )
      return null;
    const planInput = rawInput as unknown as FirstEditionMovementPlanInput;
    firstEditionMovementPlan(planInput); // Validate the existing input contract in both versions.
    const segment =
      v.version === 2
        ? parseRunningBinding(v.segment, planInput.baseMove)
        : null;
    if (v.version === 2 && (!segment || planInput.type !== "land")) return null;
    const plan = segment
      ? runningMovementPlan(segment, planInput.distance)
      : firstEditionMovementPlan(planInput);
    if (
      canonical(plan) !== canonical(v.plan) ||
      !effectPlan(v.translation) ||
      v.translation.kind !== "token-translation" ||
      v.translation.distance.value !== plan.distance
    )
      return null;
    const subject = action.subjects[0]?.actor;
    if (
      v.translation.actorUuid !== subject?.actorUuid ||
      v.translation.tokenUuid !== subject.tokenUuid ||
      v.translation.sceneId !== subject.sceneId
    )
      return null;
    if (
      v.spend !== undefined &&
      (!plan.actionRequired ||
        !effectPlan(v.spend) ||
        v.spend.kind !== (segment ? "segment-movement" : "action-spend") ||
        (segment &&
          canonical(v.spend.distance) !==
            canonical({ value: plan.distance, unit: "meters" })) ||
        v.spend.actions.value !== 1 ||
        v.spend.actorUuid !== subject.actorUuid ||
        v.spend.combatUuid !== combat.uuid ||
        v.spend.combatantUuid !== combat.combatantUuid ||
        v.spend.expectedRevision !== combat.revision)
    )
      return null;
    if (segment && v.spend === undefined) return null;
    const result = {
      ...v,
      action,
      plan,
      planInput,
    } as unknown as FirstEditionRelativeMovement;
    const expected = [
      ...(plan.rollRequired ? ["check"] : []),
      ...(result.spend ? ["spend"] : []),
      "translate",
    ];
    if (action.stages.length > expected.length) return null;
    for (const [index, stage] of action.stages.entries()) {
      if (
        canonical(stage.spec.subject) !== canonical(subject) ||
        stage.spec.controllerUserId !== action.stages[0]?.spec.controllerUserId
      )
        return null;
      const purpose = expected[index];
      if (!purpose || stage.id !== id(action, purpose)) return null;
      if (purpose === "check") {
        if (
          stage.spec.kind !== "d6-roll" ||
          stage.spec.purpose !== (segment ? "segment-running" : "movement") ||
          stage.spec.fixedDifficulty !== plan.difficulty
        )
          return null;
      } else if (
        stage.spec.kind !== "effect" ||
        canonical(stage.spec.plan) !==
          canonical(purpose === "spend" ? result.spend : result.translation)
      )
        return null;
      if (
        purpose === "translate" &&
        plan.rollRequired &&
        !movementTranslationAllowed(result)
      )
        return null;
    }
    if (
      !text(action.runtime.movementStrategyId) ||
      action.runtime.movementStrategyId !==
        (segment ? "open-d6.movement.segmented" : "open-d6.movement.relative")
    )
      return null;
    const needsTranslation = movementTranslationAllowed(result);
    const terminalLength = expected.length - (needsTranslation ? 0 : 1);
    if (action.status === "complete" && action.stages.length !== terminalLength)
      return null;
    if (v.matchingResult !== undefined) {
      const original = action.stages[0]?.receipt;
      const matching = object(v.matchingResult);
      if (
        original?.kind !== "d6-roll" ||
        !matching ||
        canonical({ ...matching, matchingObservation: undefined }) !==
          canonical({ ...original.result, matchingObservation: undefined })
      )
        return null;
    }
    return structuredClone(result);
  } catch {
    return null;
  }
}
export function movementCheckSucceeded(root: FirstEditionActionRoot): boolean {
  const receipt = root.stages.find((s) => s.id === id(root, "check"))?.receipt;
  return receipt?.kind === "d6-roll" && receipt.result.success === true;
}
/** Advance only from saved evidence. A failed check still spends a committed
 * action exactly as the old resolver did; it never translates the Token. */
export function advanceFirstEditionRelativeMovement(
  value: FirstEditionRelativeMovement,
): FirstEditionRelativeMovement {
  const parsed = parseFirstEditionRelativeMovement(value);
  if (!parsed) throw new FirstEditionActionError("invalid");
  const root = parsed.action;
  if (root.status !== "open" || root.stages.some((s) => s.state !== "recorded"))
    return parsed;
  const spendDone = root.stages.some((s) => s.id === id(root, "spend"));
  const translated = root.stages.some((s) => s.id === id(root, "translate"));
  const next =
    parsed.spend && !spendDone
      ? { id: id(root, "spend"), spec: effectSpec(root, parsed.spend) }
      : !translated && movementTranslationAllowed(parsed)
        ? {
            id: id(root, "translate"),
            spec: effectSpec(root, parsed.translation),
          }
        : undefined;
  return {
    ...parsed,
    action: next
      ? appendFirstEditionActionStages(root, [next])
      : completeFirstEditionAction(root),
  };
}
