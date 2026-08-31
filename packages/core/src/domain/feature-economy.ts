import type {
  D6FeatureBenefitDefinitionV1,
  D6FeatureEconomyPhase,
  D6FeatureEconomyTransactionV1,
  D6FeaturePointValueV1,
} from "../contracts/feature-economy";

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

export function validateFeaturePointValue(
  policy: D6FeaturePointValueV1,
  selectedValue: number,
): number {
  const value = nonNegativeInteger(selectedValue, "Feature value");
  switch (policy.kind) {
    case "exact":
      if (value !== policy.value)
        throw new RangeError("Feature value is not available.");
      break;
    case "minimum":
      if (value < policy.minimum)
        throw new RangeError("Feature value is below the minimum.");
      break;
    case "range":
      if (value < policy.minimum || value > policy.maximum) {
        throw new RangeError("Feature value is outside the allowed range.");
      }
      break;
    case "choices":
      if (!policy.values.includes(value)) {
        throw new RangeError("Feature value is not an available level.");
      }
      break;
  }
  return value;
}

export function freeD6FeatureTransactionCost(
  definition: D6FeatureBenefitDefinitionV1,
  selectedValue: number,
  phase: D6FeatureEconomyPhase,
  operation: "acquire" | "payoff" | "remove",
): number {
  const value = validateFeaturePointValue(definition.pointValue, selectedValue);
  if (
    definition.role === "flaw" &&
    phase === "advancement" &&
    operation === "acquire"
  ) {
    throw new Error("D6E2.Features.Error.AdvancementFlawAcquisition");
  }
  const multiplier = phase === "advancement" ? 4 : 1;
  if (definition.role === "merit") {
    return operation === "remove" ? -value : value * multiplier;
  }
  return operation === "acquire" ? -value : value * multiplier;
}

export function planFreeD6FeatureTransaction(
  input: Readonly<{
    actorId: string;
    balance: number;
    definition: D6FeatureBenefitDefinitionV1;
    id: string;
    operation: "acquire" | "payoff" | "remove";
    phase: D6FeatureEconomyPhase;
    selectedValue: number;
  }>,
): D6FeatureEconomyTransactionV1 {
  const balanceBefore = nonNegativeInteger(
    input.balance,
    "Character Point balance",
  );
  if (!input.id.trim()) throw new RangeError("Transaction ID is required.");
  if (!input.actorId.trim()) throw new RangeError("Actor ID is required.");
  const cost = freeD6FeatureTransactionCost(
    input.definition,
    input.selectedValue,
    input.phase,
    input.operation,
  );
  const balanceAfter = balanceBefore - cost;
  if (balanceAfter < 0)
    throw new Error("D6E2.Features.Error.InsufficientPoints");
  return Object.freeze({
    actorId: input.actorId,
    balanceAfter,
    balanceBefore,
    cost,
    definitionId: input.definition.id,
    id: input.id,
    operation: input.operation,
    phase: input.phase,
    requiresGmApproval: true,
    role: input.definition.role,
    status: "pending",
    version: 1,
  });
}

export function approveFeatureTransaction(
  transaction: D6FeatureEconomyTransactionV1,
): D6FeatureEconomyTransactionV1 {
  if (transaction.status === "approved") return transaction;
  if (transaction.status === "rejected") {
    throw new Error("D6E2.Features.Error.TransactionRejected");
  }
  return Object.freeze({ ...transaction, status: "approved" });
}

export function freeD6FlawCreditLimit(startingCreationPoints: number): number {
  return Math.floor(
    nonNegativeInteger(startingCreationPoints, "Creation Points") / 3,
  );
}
