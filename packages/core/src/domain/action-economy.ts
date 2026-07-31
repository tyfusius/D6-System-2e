import { PIPS_PER_DIE } from "./die-code";

export const ACTION_DECLARATION_ASSISTANCE_MODES = Object.freeze([
  "optional",
  "enforced",
  "manual",
] as const);

export type ActionDeclarationAssistanceMode =
  (typeof ACTION_DECLARATION_ASSISTANCE_MODES)[number];

export type ActionPenaltySource = "none" | "tracked" | "manual";

export interface ActionEconomyRollPlanInput {
  readonly assistance: ActionDeclarationAssistanceMode;
  readonly baseScore: number;
  readonly conditionPenaltyScore?: number;
  readonly environmentPenaltyScore?: number;
  readonly manualMapDice?: number;
  readonly movementPenaltyScore?: number;
  readonly rollCostsAction: boolean;
  readonly trackedMapPenaltyScore?: number;
}

export interface ActionEconomyRollPlan {
  readonly conditionPenaltyScore: number;
  readonly environmentPenaltyScore: number;
  readonly effectiveScore: number;
  readonly legal: boolean;
  readonly mapPenaltyScore: number;
  readonly mapPenaltySource: ActionPenaltySource;
  readonly movementPenaltyScore: number;
  readonly totalPenaltyScore: number;
  readonly trackedMapPenaltyScore: number;
}

function nonNegativeSafeInteger(value: number | undefined): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

export function actionEconomyRollPlan(
  input: ActionEconomyRollPlanInput,
): ActionEconomyRollPlan {
  if (!Number.isSafeInteger(input.baseScore) || input.baseScore < 0) {
    throw new RangeError("A roll base score must be a non-negative pip score.");
  }
  const trackedMapPenaltyScore = input.rollCostsAction
    ? nonNegativeSafeInteger(input.trackedMapPenaltyScore)
    : 0;
  const manualMapDice = nonNegativeSafeInteger(input.manualMapDice);
  const selectedMapPenaltyScore = input.rollCostsAction
    ? manualMapDice * PIPS_PER_DIE
    : 0;
  const usesTrackedSuggestion =
    input.assistance !== "manual" &&
    (input.manualMapDice === undefined ||
      selectedMapPenaltyScore === trackedMapPenaltyScore);
  const mapPenaltyScore =
    input.manualMapDice === undefined
      ? input.assistance === "manual"
        ? 0
        : trackedMapPenaltyScore
      : selectedMapPenaltyScore;
  const mapPenaltySource: ActionPenaltySource =
    mapPenaltyScore === 0
      ? "none"
      : usesTrackedSuggestion
        ? "tracked"
        : "manual";
  const conditionPenaltyScore = input.rollCostsAction
    ? nonNegativeSafeInteger(input.conditionPenaltyScore)
    : 0;
  const movementPenaltyScore = input.rollCostsAction
    ? nonNegativeSafeInteger(input.movementPenaltyScore)
    : 0;
  const environmentPenaltyScore = nonNegativeSafeInteger(
    input.environmentPenaltyScore,
  );
  const totalPenaltyScore =
    mapPenaltyScore +
    conditionPenaltyScore +
    movementPenaltyScore +
    environmentPenaltyScore;
  const effectiveScore = input.baseScore - totalPenaltyScore;
  return Object.freeze({
    conditionPenaltyScore,
    environmentPenaltyScore,
    effectiveScore,
    legal:
      (!input.rollCostsAction && environmentPenaltyScore === 0) ||
      effectiveScore >= PIPS_PER_DIE,
    mapPenaltyScore,
    mapPenaltySource,
    movementPenaltyScore,
    totalPenaltyScore,
    trackedMapPenaltyScore,
  });
}

export type FirstEditionDefenseCommitment =
  "none" | "partial-defense" | "full-defense";

export interface FirstEditionActionCommitment {
  readonly actionAllotment: number;
  readonly defense: FirstEditionDefenseCommitment;
  readonly penaltyScore: number;
  readonly plannedActionCount: number;
  readonly remainingActionCount: number;
  readonly spentActionCount: number;
}

export function firstEditionActionCommitment(
  plannedActionCount: number,
  actionAllotment = 1,
  defense: FirstEditionDefenseCommitment = "none",
  spentActionCount = 0,
): FirstEditionActionCommitment {
  if (!Number.isSafeInteger(plannedActionCount) || plannedActionCount < 1) {
    throw new RangeError("At least one First Edition action must be planned.");
  }
  if (!Number.isSafeInteger(actionAllotment) || actionAllotment < 1) {
    throw new RangeError("Action allotment must be a positive safe integer.");
  }
  if (
    !Number.isSafeInteger(spentActionCount) ||
    spentActionCount < 0 ||
    spentActionCount > plannedActionCount
  ) {
    throw new RangeError("Spent actions must fit the planned action count.");
  }
  if (defense === "full-defense" && plannedActionCount !== 1) {
    throw new RangeError("Full Defense is exclusive for the combat round.");
  }
  const penaltyDice =
    defense === "full-defense"
      ? 0
      : Math.max(0, plannedActionCount - actionAllotment);
  return Object.freeze({
    actionAllotment,
    defense,
    penaltyScore: penaltyDice * PIPS_PER_DIE,
    plannedActionCount,
    remainingActionCount: plannedActionCount - spentActionCount,
    spentActionCount,
  });
}

export function spendFirstEditionCommittedAction(
  commitment: FirstEditionActionCommitment,
): FirstEditionActionCommitment {
  if (commitment.remainingActionCount < 1) {
    throw new RangeError("No planned First Edition actions remain.");
  }
  return firstEditionActionCommitment(
    commitment.plannedActionCount,
    commitment.actionAllotment,
    commitment.defense,
    commitment.spentActionCount + 1,
  );
}
