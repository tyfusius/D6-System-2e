function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function heroPointBalanceAfter(
  current: number,
  spent: 0 | 1,
  awarded: 0 | 1 | 2,
): number {
  const balance = nonNegativeInteger(current, "Hero Point balance");
  const expenditure = nonNegativeInteger(spent, "Hero Points spent");
  const award = nonNegativeInteger(awarded, "Hero Points awarded");
  if (expenditure > balance) {
    throw new RangeError("The Hero Point expenditure exceeds the balance.");
  }
  return balance - expenditure + award;
}
