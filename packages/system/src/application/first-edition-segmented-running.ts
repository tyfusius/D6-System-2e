import {
  firstEditionSegmentMovementPlan,
  type FirstEditionMovementPlan,
  type FirstEditionSegmentMovementPlan,
} from "@d6-system-2e/core";
import {
  canonical,
  keys,
  object,
  text,
} from "./first-edition-action-validation";
import type { FirstEditionRelativeMovement } from "./first-edition-relative-movement";

/** Immutable queue context for a new Running root; ordinary segment movement
 * and remaining-distance movement continue through the existing no-roll path. */
export interface FirstEditionRunningBinding {
  readonly round: number;
  readonly actionId: string;
  readonly spentActionCount: number;
  readonly plannedActionCount: number;
  readonly effectiveScores: readonly number[];
  readonly reactive: boolean;
  readonly plan: FirstEditionSegmentMovementPlan;
}
export function parseRunningBinding(
  value: unknown,
  baseMove: number,
): FirstEditionRunningBinding | null {
  try {
    const v = object(value);
    if (
      !v ||
      !keys(v, [
        "round",
        "actionId",
        "spentActionCount",
        "plannedActionCount",
        "effectiveScores",
        "reactive",
        "plan",
      ]) ||
      !Number.isSafeInteger(v.round) ||
      Number(v.round) < 0 ||
      !text(v.actionId) ||
      !Number.isSafeInteger(v.spentActionCount) ||
      Number(v.spentActionCount) < 0 ||
      !Number.isSafeInteger(v.plannedActionCount) ||
      Number(v.plannedActionCount) < 1 ||
      Number(v.spentActionCount) >= Number(v.plannedActionCount) ||
      !Array.isArray(v.effectiveScores) ||
      v.effectiveScores.length > Number(v.plannedActionCount) ||
      typeof v.reactive !== "boolean"
    )
      return null;
    const plan = firstEditionSegmentMovementPlan({
      baseMove,
      plannedActionCount: Number(v.plannedActionCount),
      effectiveScores: v.effectiveScores,
      running: true,
    });
    if (!plan.calculable || canonical(plan) !== canonical(v.plan)) return null;
    return structuredClone(v) as unknown as FirstEditionRunningBinding;
  } catch {
    return null;
  }
}
export function runningMovementPlan(
  binding: FirstEditionRunningBinding,
  distance: number,
): FirstEditionMovementPlan {
  if (
    !Number.isFinite(distance) ||
    distance < 0 ||
    distance > binding.plan.maximumDistance
  )
    throw new RangeError("Invalid Running distance");
  return {
    actionRequired: true,
    difficulty: binding.plan.runningDifficulty,
    distance,
    freeDistance: 0,
    maximumDistance: binding.plan.maximumDistance,
    movementRate: binding.plan.normalDistance,
    rollRequired: true,
    type: "land",
  };
}
/** Preserve the established first-face complication rule, independently of
 * which Wild Die resolution option the ordinary builder recorded. */
export function runningOutcome(value: FirstEditionRelativeMovement) {
  const receipt = value.action.stages[0]?.receipt;
  if (!value.segment || receipt?.kind !== "d6-roll") return null;
  const complication = receipt.result.wildFaces[0] === 1;
  const runningFailure = !complication && receipt.result.success !== true;
  const successful =
    (!complication && !runningFailure) ||
    value.plan.distance <= value.segment.plan.normalDistance;
  return {
    complication,
    runningFailure,
    successful,
    distance: value.plan.distance,
    normalDistance: value.segment.plan.normalDistance,
    consumeAction: true,
    reactive: value.segment.reactive,
    remainingDistance: successful ? 0 : value.segment.plan.normalDistance,
    forfeitedActions: complication
      ? value.segment.plannedActionCount - value.segment.spentActionCount - 1
      : 0,
  };
}
export function movementTranslationAllowed(
  value: FirstEditionRelativeMovement,
): boolean {
  if (value.segment) return runningOutcome(value)?.successful === true;
  const receipt = value.action.stages[0]?.receipt;
  return (
    !value.plan.rollRequired ||
    (receipt?.kind === "d6-roll" && receipt.result.success === true)
  );
}
