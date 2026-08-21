import {
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WildDiePolicy,
} from "@d6-system-2e/core";

export function completedUnrollableExtraordinaryPowerResult(
  request: D6RollRequestV1,
  profileId: string,
  wildPolicy: D6WildDiePolicy,
): D6RollResultV1 {
  if (request.context?.extraordinaryPower === undefined) {
    throw new Error("D6E2.ExtraordinaryPower.RollContextRequired");
  }
  const failedRequest = Object.freeze({
    ...request,
    heroPointUse: "none" as const,
    score: Math.max(0, request.score),
  });
  return Object.freeze({
    baseFaces: Object.freeze([]),
    contractVersion: failedRequest.contractVersion,
    ...(failedRequest.difficulty === undefined
      ? {}
      : {
          difficulty: Object.freeze({
            difficulty: failedRequest.difficulty,
            margin: -failedRequest.difficulty,
            score: 0,
            success: false,
          }),
        }),
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: Object.freeze([]),
    pool: Object.freeze({
      baseDice: 0,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: Object.freeze({ dice: 0, pips: 0 }),
      resultModifier: failedRequest.resultModifier,
      wildDice: 0,
    }),
    profileId,
    request: failedRequest,
    requiresWildExplosion: false,
    success: false,
    total: 0,
    wildFaces: Object.freeze([]),
    wildPolicy,
    wildOutcome: "failure",
  });
}
