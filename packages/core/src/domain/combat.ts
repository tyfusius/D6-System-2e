import { PIPS_PER_DIE, pipScore } from "./die-code";

export type SecondEditionCondition =
  | "healthy"
  | "staggered"
  | "stunned"
  | "wounded"
  | "incapacitated"
  | "mortally-wounded"
  | "dead";

export const SECOND_EDITION_CONDITIONS: readonly SecondEditionCondition[] =
  Object.freeze([
    "healthy",
    "staggered",
    "stunned",
    "wounded",
    "incapacitated",
    "mortally-wounded",
    "dead",
  ]);

export function isSecondEditionCondition(
  value: unknown,
): value is SecondEditionCondition {
  return (
    typeof value === "string" &&
    SECOND_EDITION_CONDITIONS.includes(value as SecondEditionCondition)
  );
}

export function secondEditionStaticDefense(attributeScore: number): number {
  return Math.floor(pipScore(attributeScore) / PIPS_PER_DIE) * 5;
}

export function multipleActionPenaltyScore(actionCount: number): number {
  if (!Number.isSafeInteger(actionCount) || actionCount < 1) {
    throw new RangeError("Action count must be a positive safe integer.");
  }
  return (actionCount - 1) * PIPS_PER_DIE;
}
