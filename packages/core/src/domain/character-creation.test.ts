import { describe, expect, it } from "vitest";
import {
  advancedSkillAugmentedScore,
  secondEditionCreationProgress,
  specializationScore,
  validateAdvancedSkill,
} from "./character-creation";

describe("Second Edition character creation", () => {
  it("accepts the core 12D attribute and up-to-7D skill budgets", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      skills: [
        { kind: "standard", score: 6 },
        { kind: "standard", score: 6 },
        { kind: "standard", score: 6 },
        { kind: "standard", score: 3 },
      ],
    });
    expect(progress.attributes).toEqual({
      budget: 36,
      remaining: 0,
      used: 36,
    });
    expect(progress.skills).toEqual({
      budget: 21,
      remaining: 0,
      used: 21,
    });
    expect(progress.canFinalize).toBe(true);
    expect(progress.issues).toEqual([]);
  });

  it("adds 3D per optional attribute and 2D per optional skill module", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9, 9],
      optionalSkillModules: 1,
      skills: [{ kind: "standard", score: 6 }],
    });
    expect(progress.attributes.budget).toBe(45);
    expect(progress.skills.budget).toBe(27);
    expect(progress.canFinalize).toBe(true);
  });

  it("charges one skill die for up to three fixed +1D specializations", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      skills: [
        { kind: "standard", score: 6 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
      ],
    });
    expect(progress.skills.used).toBe(9);
    expect(progress.specializations).toEqual({
      count: 3,
      maximumCount: 3,
      purchaseCost: 3,
    });
    expect(progress.canFinalize).toBe(true);
  });

  it("rejects invalid attribute, advanced-skill, and specialization limits", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [2, 16, 9, 9],
      optionalSkillModules: 0,
      skills: [
        { kind: "advanced", score: 7 },
        { kind: "specialization", score: 2 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
      ],
    });
    expect(progress.canFinalize).toBe(false);
    expect(progress.issues).toEqual(
      expect.arrayContaining([
        "attribute-minimum",
        "attribute-maximum",
        "advanced-skill-budget",
        "specialization-count",
        "specialization-score",
      ]),
    );
  });
});

describe("advanced skills and specializations", () => {
  it("adds one contextual Advanced Skill rating to its prerequisite pool", () => {
    expect(advancedSkillAugmentedScore(18, 6)).toBe(24);
  });

  it("requires two 3D prerequisites and caps the advanced rating", () => {
    expect(
      validateAdvancedSkill({ prerequisiteScores: [9, 12], score: 9 }),
    ).toEqual([]);
    expect(
      validateAdvancedSkill({ prerequisiteScores: [9], score: 10 }),
    ).toEqual(
      expect.arrayContaining([
        "advanced-skill-prerequisite-count",
        "advanced-skill-exceeds-prerequisite",
      ]),
    );
    expect(
      validateAdvancedSkill({ prerequisiteScores: [8, 12], score: 3 }),
    ).toContain("advanced-skill-prerequisite-rating");
  });

  it("adds the specialization's fixed bonus to its parent skill pool", () => {
    expect(specializationScore(12, 3)).toBe(15);
  });
});
