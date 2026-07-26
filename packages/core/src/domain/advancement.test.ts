import { describe, expect, it } from "vitest";
import { advancementCost } from "./advancement";

const multipliers = {
  attribute: 10,
  skill: 1,
  specialization: 0.5,
};

describe("OpenD6 advancement cost", () => {
  it("uses the current full dice before the one-pip increase", () => {
    expect(advancementCost("attribute", 10, { multipliers })).toBe(30);
    expect(advancementCost("skill", 10, { multipliers })).toBe(3);
    expect(advancementCost("specialization", 10, { multipliers })).toBe(2);
  });

  it("doubles the cost of advanced skills", () => {
    expect(
      advancementCost("skill", 10, {
        advanced: true,
        multipliers,
      }),
    ).toBe(6);
  });

  it("normalizes invalid configuration safely", () => {
    expect(
      advancementCost("skill", Number.NaN, {
        multipliers: { ...multipliers, skill: -1 },
        pipsPerDie: 0,
      }),
    ).toBe(0);
  });
});
