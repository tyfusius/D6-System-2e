export interface DieCode {
  readonly dice: number;
  readonly pips: number;
}

export const PIPS_PER_DIE = 3;

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function dieCode(dice: number, pips = 0): DieCode {
  return Object.freeze({
    dice: nonNegativeInteger(dice, "Dice"),
    pips: nonNegativeInteger(pips, "Pips"),
  });
}

export function addDieCodes(...codes: readonly DieCode[]): DieCode {
  return dieCodeFromPipScore(
    codes.reduce((total, code) => total + pipScoreFromDieCode(code), 0),
  );
}

export function normalizeDieCode(code: DieCode): DieCode {
  return dieCodeFromPipScore(pipScoreFromDieCode(code));
}

export function formatDieCode(code: DieCode): string {
  const normalized = normalizeDieCode(code);
  return `${normalized.dice}D${normalized.pips > 0 ? `+${normalized.pips}` : ""}`;
}

/** Validate the canonical persistent representation: one integer pip score. */
export function pipScore(score: number): number {
  return nonNegativeInteger(score, "Pip score");
}

/** Convert a presentation die code into its lossless integer pip score. */
export function pipScoreFromDieCode(code: DieCode): number {
  return pipScore(
    nonNegativeInteger(code.dice, "Dice") * PIPS_PER_DIE +
      nonNegativeInteger(code.pips, "Pips"),
  );
}

/** Convert a persistent pip score into canonical dice-and-pips presentation. */
export function dieCodeFromPipScore(score: number): DieCode {
  const normalizedScore = pipScore(score);
  return dieCode(
    Math.floor(normalizedScore / PIPS_PER_DIE),
    normalizedScore % PIPS_PER_DIE,
  );
}

export function addPipScores(...scores: readonly number[]): number {
  return pipScore(scores.reduce((total, score) => total + pipScore(score), 0));
}

export function formatPipScore(score: number): string {
  return formatDieCode(dieCodeFromPipScore(score));
}
