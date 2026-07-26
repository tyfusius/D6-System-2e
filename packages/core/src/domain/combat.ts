import { PIPS_PER_DIE, pipScore } from "./die-code";

export type SecondEditionCondition =
  | "healthy"
  | "staggered"
  | "stunned"
  | "wounded"
  | "incapacitated"
  | "mortally-wounded"
  | "dead";

export function secondEditionStaticDefense(attributeScore: number): number {
  return Math.floor(pipScore(attributeScore) / PIPS_PER_DIE) * 5;
}

export function multipleActionPenaltyScore(actionCount: number): number {
  if (!Number.isSafeInteger(actionCount) || actionCount < 1) {
    throw new RangeError("Action count must be a positive safe integer.");
  }
  return (actionCount - 1) * PIPS_PER_DIE;
}
