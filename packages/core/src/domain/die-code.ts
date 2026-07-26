export interface DieCode {
  readonly dice: number;
  readonly pips: number;
}

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
  return dieCode(
    codes.reduce(
      (total, code) => total + nonNegativeInteger(code.dice, "Dice"),
      0,
    ),
    codes.reduce(
      (total, code) => total + nonNegativeInteger(code.pips, "Pips"),
      0,
    ),
  );
}
