import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
  type D6RollResultV1,
} from "../contracts/roll";
import type { SecondEditionCondition } from "./combat";

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function canRerollFailedRoll(result: D6RollResultV1): boolean {
  return result.success === false && result.heroPointSpent === 0;
}

export function heroPointRerollRequest(
  result: D6RollResultV1,
): D6RollRequestV1 {
  if (!canRerollFailedRoll(result)) {
    throw new RangeError(
      "A Hero Point reroll requires a failed roll with no prior Hero Point expenditure.",
    );
  }
  return Object.freeze({
    ...result.request,
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointUse: "reroll-failed",
  });
}

export function canPreventBecomingStunned(
  current: SecondEditionCondition,
  proposed: SecondEditionCondition,
): boolean {
  return current !== "stunned" && proposed === "stunned";
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
