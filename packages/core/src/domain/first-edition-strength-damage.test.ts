import { describe, expect, it } from "vitest";
import { firstEditionStrengthDamageScore } from "./first-edition-strength-damage";

describe("First Edition Strength Damage", () => {
  it.each([
    [0, 0],
    [5, 3],
    [6, 3],
    [8, 3],
    [9, 6],
    [14, 6],
    [15, 9],
  ])("converts %i pips to %i", (score, expected) => {
    expect(firstEditionStrengthDamageScore(score)).toBe(expected);
  });
});
