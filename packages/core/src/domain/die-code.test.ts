import { describe, expect, it } from "vitest";
import { addDieCodes, dieCode } from "./die-code";

describe("die code values", () => {
  it("stores dice and pips separately", () => {
    expect(dieCode(3, 2)).toEqual({ dice: 3, pips: 2 });
  });

  it("adds contributors without formatting or Foundry state", () => {
    expect(addDieCodes(dieCode(3), dieCode(2, 1))).toEqual({
      dice: 5,
      pips: 1,
    });
  });

  it.each([
    [-1, 0],
    [1.5, 0],
    [1, -1],
  ])("rejects invalid source values (%sD, %s pips)", (dice, pips) => {
    expect(() => dieCode(dice, pips)).toThrow(RangeError);
  });
});
