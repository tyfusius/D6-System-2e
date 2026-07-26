export interface DifficultyEvaluation {
  readonly difficulty: number;
  readonly margin: number;
  readonly score: number;
  readonly success: boolean;
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
  return value;
}

/**
 * Evaluate a core D6 System: Second Edition difficulty check.
 *
 * The score must be strictly greater than the difficulty. Equality is failure.
 * Source: D6 System: Second Edition v1.1, printed page 26.
 */
export function evaluateDifficulty(
  score: number,
  difficulty: number,
): DifficultyEvaluation {
  const validScore = finiteNumber(score, "Score");
  const validDifficulty = finiteNumber(difficulty, "Difficulty");
  return Object.freeze({
    difficulty: validDifficulty,
    margin: validScore - validDifficulty,
    score: validScore,
    success: validScore > validDifficulty,
  });
}
