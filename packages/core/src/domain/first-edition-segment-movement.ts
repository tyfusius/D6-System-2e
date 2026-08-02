export interface FirstEditionSegmentMovementInput {
  readonly baseMove: number;
  readonly effectiveScores: readonly number[];
  readonly plannedActionCount: number;
  readonly running?: boolean;
}

export interface FirstEditionSegmentMovementPlan {
  readonly calculable: boolean;
  readonly diceAllowance: number;
  readonly lowestEffectiveScore: number | null;
  readonly maximumDistance: number;
  readonly normalDistance: number;
  readonly plannedActionCount: number;
  readonly running: boolean;
  readonly runningDifficulty: number;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
  return value;
}

export function firstEditionSegmentMovementPlan(
  input: FirstEditionSegmentMovementInput,
): FirstEditionSegmentMovementPlan {
  const baseMove = positiveInteger(input.baseMove, "Base Move");
  const plannedActionCount = positiveInteger(
    input.plannedActionCount,
    "Planned action count",
  );
  const effectiveScores = input.effectiveScores.map((score) => {
    if (!Number.isSafeInteger(score) || score < 3) {
      throw new RangeError("Effective action pools must be at least 1D.");
    }
    return score;
  });
  const lowestEffectiveScore = effectiveScores.length
    ? Math.min(...effectiveScores)
    : null;
  const diceAllowance =
    lowestEffectiveScore === null ? 0 : Math.floor(lowestEffectiveScore / 3);
  const normalDistance = Math.min(diceAllowance, baseMove / plannedActionCount);
  const running = input.running === true;
  return Object.freeze({
    calculable: lowestEffectiveScore !== null,
    diceAllowance,
    lowestEffectiveScore,
    maximumDistance: normalDistance * (running ? 2 : 1),
    normalDistance,
    plannedActionCount,
    running,
    runningDifficulty: plannedActionCount * 5,
  });
}
