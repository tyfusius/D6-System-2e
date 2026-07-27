import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
  type D6RollResultV1,
} from "../contracts/roll";
import { pipScoreFromDieCode } from "./die-code";

export function canDoubleDown(result: D6RollResultV1): boolean {
  return (
    result.success === false &&
    result.pendingChoices.length === 0 &&
    result.request.context?.doublingDown === undefined &&
    result.request.context?.actionEconomy === undefined &&
    (result.request.kind === "attribute" || result.request.kind === "skill")
  );
}

export function doublingDownRequest(
  result: D6RollResultV1,
  narration?: string,
): D6RollRequestV1 {
  if (!canDoubleDown(result)) {
    throw new RangeError(
      "Doubling Down requires a completed failed non-combat Attribute or Skill roll.",
    );
  }
  const trimmedNarration = narration?.trim();
  return Object.freeze({
    ...result.request,
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    context: Object.freeze({
      ...result.request.context,
      doublingDown: Object.freeze({
        ...(trimmedNarration ? { narration: trimmedNarration } : {}),
        originalTotal: result.total,
        sourcePage: 25 as const,
      }),
    }),
    heroPointUse: "none",
    score: pipScoreFromDieCode(result.pool.code),
  });
}
