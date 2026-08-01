import { describe, expect, it } from "vitest";
import {
  basicInitiativeDeclarationOrder,
  firstEditionInitiativeFormula,
  nextNarrativeInitiativeOrder,
  orderedInitiativeIds,
  secondEditionInitiativeStrategy,
} from "./initiative";

describe("Second Edition alternate initiative", () => {
  it("normalizes the mutually exclusive campaign strategy", () => {
    expect(secondEditionInitiativeStrategy("simple")).toBe("simple");
    expect(secondEditionInitiativeStrategy("basic")).toBe("basic");
    expect(secondEditionInitiativeStrategy("narrative")).toBe("narrative");
    expect(secondEditionInitiativeStrategy("unknown")).toBe("standard");
  });

  it("orders high to low and settles unprinted ties with stable Combat order", () => {
    const resolution = orderedInitiativeIds(
      { alpha: 9, bravo: 12, charlie: 12 },
      ["alpha", "charlie", "bravo"],
    );
    expect(resolution).toEqual(["charlie", "bravo", "alpha"]);
    expect(basicInitiativeDeclarationOrder(resolution)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
  });

  it("starts the next Narrative round with the previous last declarer", () => {
    expect(nextNarrativeInitiativeOrder(["alpha", "bravo", "charlie"])).toEqual(
      ["charlie", "alpha", "bravo"],
    );
  });
});

describe("First Edition initiative", () => {
  it("creates a Perception roll with one distinct Wild Die and a stable tiebreaker", () => {
    expect(
      firstEditionInitiativeFormula({
        agilityScore: 9,
        perceptionScore: 11,
      }),
    ).toEqual({
      formula: "2d6[Base]+1dw[Wild]+2+0.2",
      score: 11,
      tiebreaker: 0.2,
    });
  });

  it("retains a one-die initiative pool as the Wild Die", () => {
    expect(
      firstEditionInitiativeFormula({
        agilityScore: 0,
        perceptionScore: 3,
      }),
    ).toEqual({
      formula: "0d6[Base]+1dw[Wild]+0.03",
      score: 3,
      tiebreaker: 0.03,
    });
  });
});
