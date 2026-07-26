import { describe, expect, it } from "vitest";
import {
  addDieCodes,
  addPipScores,
  dieCode,
  dieCodeFromPipScore,
  formatDieCode,
  formatPipScore,
  normalizeDieCode,
  pipScoreFromDieCode,
} from "./die-code";

describe("die code values", () => {
  it("uses one integer pip score as the lossless source of truth", () => {
    expect(pipScoreFromDieCode(dieCode(3, 2))).toBe(11);
    expect(dieCodeFromPipScore(11)).toEqual({ dice: 3, pips: 2 });
    expect(dieCodeFromPipScore(12)).toEqual({ dice: 4, pips: 0 });
  });

  it("adds contributors in pips without Foundry state", () => {
    expect(addPipScores(9, 7)).toBe(16);
    expect(formatPipScore(addPipScores(9, 7))).toBe("5D+1");
    expect(addDieCodes(dieCode(3), dieCode(2, 1))).toEqual({
      dice: 5,
      pips: 1,
    });
  });

  it.each([
    [2, 0, "2D"],
    [2, 1, "2D+1"],
    [3, 2, "3D+2"],
    [2, 4, "3D+1"],
  ])("formats %s dice and %s pips as %s", (dice, pips, expected) => {
    expect(formatDieCode(dieCode(dice, pips))).toBe(expected);
  });

  it("normalizes each complete set of three pips into one die", () => {
    expect(normalizeDieCode(dieCode(2, 7))).toEqual({ dice: 4, pips: 1 });
  });

  it.each([
    [-1, 0],
    [1.5, 0],
    [1, -1],
  ])("rejects invalid source values (%sD, %s pips)", (dice, pips) => {
    expect(() => dieCode(dice, pips)).toThrow(RangeError);
  });

  it.each([-1, 1.5])("rejects invalid persistent pip score %s", (score) => {
    expect(() => dieCodeFromPipScore(score)).toThrow(RangeError);
  });
});
