import { describe, expect, it } from "vitest";
import {
  planSecondEditionExperienceAdvancement,
  planSecondEditionSpecializationAcquisition,
} from "./plan-second-edition-experience-advancement";

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

  it("doubles the complete regular-Skill cost for an Advanced Skill", () => {
    expect(
      planSecondEditionExperienceAdvancement("skill", 6, 10, false, true),
    ).toEqual({
      affordable: true,
      cost: 4,
      currentExperiencePoints: 10,
      currentScore: 6,
      kind: "skill",
      nextExperiencePoints: 6,
      nextScore: 9,
      scoreIncrease: 3,
    });
  });

  it("plans post-creation specialization acquisition without Attribute dice", () => {
    expect(planSecondEditionSpecializationAcquisition(9, 2, 8)).toEqual({
      affordable: true,
      atLimit: false,
      cost: 5,
      currentExperiencePoints: 8,
      currentSpecializations: 2,
      maximumSpecializations: 3,
      nextExperiencePoints: 3,
      skillRating: 3,
    });
  });
});
