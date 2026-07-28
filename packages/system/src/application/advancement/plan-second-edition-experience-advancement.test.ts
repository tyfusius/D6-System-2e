import { describe, expect, it } from "vitest";
import { planSecondEditionExperienceAdvancement } from "./plan-second-edition-experience-advancement";

describe("Second Edition Experience Point advancement plan", () => {
  it("plans an affordable whole-die skill increase", () => {
    expect(
      planSecondEditionExperienceAdvancement("skill", 9, 7, false),
    ).toEqual({
      affordable: true,
      cost: 3,
      currentExperiencePoints: 7,
      currentScore: 9,
      kind: "skill",
      nextExperiencePoints: 4,
      nextScore: 12,
      scoreIncrease: 3,
    });
  });

  it("does not allow the resource balance to become negative", () => {
    const plan = planSecondEditionExperienceAdvancement(
      "attribute",
      9,
      2,
      true,
    );
    expect(plan.affordable).toBe(false);
    expect(plan.nextExperiencePoints).toBe(0);
  });
});
