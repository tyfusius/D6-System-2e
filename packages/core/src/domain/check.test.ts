import { describe, expect, it } from "vitest";
import { evaluateDifficulty } from "./check";

describe("Second Edition difficulty checks", () => {
  it("fails below the difficulty", () => {
    expect(evaluateDifficulty(9, 10)).toEqual({
      difficulty: 10,
      margin: -1,
      score: 9,
      success: false,
    });
  });

  it("fails when the score equals the difficulty", () => {
    expect(evaluateDifficulty(10, 10).success).toBe(false);
  });

  it("succeeds only above the difficulty", () => {
    expect(evaluateDifficulty(11, 10)).toEqual({
      difficulty: 10,
      margin: 1,
      score: 11,
      success: true,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a non-finite score: %s",
    (score) => {
      expect(() => evaluateDifficulty(score, 10)).toThrow(RangeError);
    },
  );

  it("rejects a non-finite difficulty", () => {
    expect(() => evaluateDifficulty(10, Number.NaN)).toThrow(RangeError);
  });
});
