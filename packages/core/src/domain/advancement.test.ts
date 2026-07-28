import { describe, expect, it } from "vitest";
import {
  advancementCost,
  secondEditionExperienceAdvancement,
} from "./advancement";

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

describe("Second Edition Experience Point advancement", () => {
  it("raises whole dice by default and charges the current rating", () => {
    expect(secondEditionExperienceAdvancement("skill", 12, false)).toEqual({
      cost: 4,
      increase: 3,
      nextScore: 15,
    });
    expect(secondEditionExperienceAdvancement("attribute", 9, false)).toEqual({
      cost: 30,
      increase: 3,
      nextScore: 12,
    });
  });

  it("purchases pips sequentially and discounts pips on the new die", () => {
    expect(secondEditionExperienceAdvancement("skill", 9, true)).toEqual({
      cost: 3,
      increase: 1,
      nextScore: 10,
    });
    expect(secondEditionExperienceAdvancement("skill", 11, true)).toEqual({
      cost: 1,
      increase: 1,
      nextScore: 12,
    });
  });

  it("doubles Advanced Skill costs after the normal calculation", () => {
    expect(secondEditionExperienceAdvancement("skill", 11, true, true)).toEqual(
      { cost: 2, increase: 1, nextScore: 12 },
    );
  });
});
