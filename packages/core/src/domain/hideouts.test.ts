import { describe, expect, it } from "vitest";
import { hideoutRelocationPlan } from "./hideouts";

describe("hideout relocation", () => {
  it("uses one month per feature and clamps progress", () => {
    expect(hideoutRelocationPlan(4, 2)).toEqual({
      complete: false,
      featureCount: 4,
      monthsCompleted: 2,
      monthsRemaining: 2,
      monthsRequired: 4,
    });
    expect(hideoutRelocationPlan(3, 9).complete).toBe(true);
  });

  it("accepts a GM-authored override without inventing a check", () => {
    expect(hideoutRelocationPlan(6, 1, 2)).toMatchObject({
      monthsCompleted: 1,
      monthsRemaining: 1,
      monthsRequired: 2,
    });
  });
});
