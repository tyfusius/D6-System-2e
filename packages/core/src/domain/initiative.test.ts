import { describe, expect, it } from "vitest";
import { firstEditionInitiativeFormula } from "./initiative";

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
