import { describe, expect, it } from "vitest";
import type { D6FeatureBenefitDefinitionV1 } from "../contracts/feature-economy";
import {
  approveFeatureTransaction,
  freeD6FeatureTransactionCost,
  freeD6FlawCreditLimit,
  planFreeD6FeatureTransaction,
  validateFeaturePointValue,
} from "./feature-economy";

function definition(role: "flaw" | "merit"): D6FeatureBenefitDefinitionV1 {
  return Object.freeze({
    actorTypes: Object.freeze(["character"]),
    conflicts: Object.freeze([]),
    effects: Object.freeze([
      {
        id: "effect",
        kind: "roll-modifier" as const,
        scope: "skill:test",
        value: 3,
      },
    ]),
    id: `world/${role}`,
    label: role === "merit" ? "Merit" : "Flaw",
    pointValue: Object.freeze({ kind: "range", minimum: 1, maximum: 4 }),
    prerequisites: Object.freeze([]),
    role,
    source: Object.freeze({ kind: "world" }),
    version: 1,
  });
}

describe("neutral FreeD6 feature economy", () => {
  it("supports exact, range, minimum, and discrete source values", () => {
    expect(validateFeaturePointValue({ kind: "exact", value: 2 }, 2)).toBe(2);
    expect(
      validateFeaturePointValue({ kind: "range", minimum: 1, maximum: 3 }, 3),
    ).toBe(3);
    expect(validateFeaturePointValue({ kind: "minimum", minimum: 2 }, 5)).toBe(
      5,
    );
    expect(
      validateFeaturePointValue({ kind: "choices", values: [1, 3, 6] }, 3),
    ).toBe(3);
    expect(() =>
      validateFeaturePointValue({ kind: "choices", values: [1, 3] }, 2),
    ).toThrow();
  });

  it("uses creation value and four-times value during advancement", () => {
    expect(
      freeD6FeatureTransactionCost(
        definition("merit"),
        3,
        "creation",
        "acquire",
      ),
    ).toBe(3);
    expect(
      freeD6FeatureTransactionCost(
        definition("merit"),
        3,
        "advancement",
        "acquire",
      ),
    ).toBe(12);
    expect(
      freeD6FeatureTransactionCost(
        definition("flaw"),
        3,
        "creation",
        "acquire",
      ),
    ).toBe(-3);
    expect(
      freeD6FeatureTransactionCost(
        definition("flaw"),
        3,
        "advancement",
        "payoff",
      ),
    ).toBe(12);
    expect(() =>
      freeD6FeatureTransactionCost(
        definition("flaw"),
        3,
        "advancement",
        "acquire",
      ),
    ).toThrow("D6E2.Features.Error.AdvancementFlawAcquisition");
  });

  it("plans a GM-approved atomic balance transition and approves idempotently", () => {
    const pending = planFreeD6FeatureTransaction({
      actorId: "actor",
      balance: 20,
      definition: definition("merit"),
      id: "transaction",
      operation: "acquire",
      phase: "advancement",
      selectedValue: 3,
    });
    expect(pending).toMatchObject({
      balanceAfter: 8,
      cost: 12,
      status: "pending",
    });
    const approved = approveFeatureTransaction(pending);
    expect(approved.status).toBe("approved");
    expect(approveFeatureTransaction(approved)).toBe(approved);
  });

  it("limits suggested creation Flaw credit to one third of starting CP", () => {
    expect(freeD6FlawCreditLimit(30)).toBe(10);
    expect(freeD6FlawCreditLimit(45)).toBe(15);
  });
});
