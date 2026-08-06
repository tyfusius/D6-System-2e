import { describe, expect, it } from "vitest";
import {
  advancedSkillAugmentedScore,
  nextSecondEditionCreationScore,
  secondEditionCreationProgress,
  specializationScore,
  validateAdvancedSkill,
} from "./character-creation";

describe("Second Edition character creation", () => {
  it("halves whole starting dice for a sidekick before ordinary flaw credit", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [3, 3, 3, 3],
      features: [{ rank: 1, type: "flaw" }],
      optionalSkillModules: 0,
      pipsEnabled: false,
      sidekick: true,
      skills: [],
    });
    expect(progress.attributes.budget).toBe(18);
    expect(progress.skills.budget).toBe(12);
    expect(progress.features.flawCredit).toBe(3);
  });
  it("accounts for Perks, Flaws, and printed Talent costs in the Skill budget", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      features: [
        { rank: 2, type: "perk" },
        { rank: 1, type: "flaw" },
        { cost: 2, rank: 1, type: "talent" },
      ],
      optionalSkillModules: 0,
      pipsEnabled: false,
      skills: [{ kind: "standard", score: 12 }],
    });

    expect(progress.features).toEqual({
      flawCredit: 3,
      perkCost: 6,
      talentCost: 6,
      total: 9,
    });
    expect(progress.skills).toEqual({
      budget: 24,
      remaining: 0,
      used: 24,
    });
  });

  it("keeps Superpower Talents out of the ordinary Skill budget", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      features: [{ cost: 12, rank: 2, superpower: true, type: "talent" }],
      optionalSkillModules: 0,
      pipsEnabled: false,
      skills: [],
    });
    expect(progress.features.talentCost).toBe(0);
    expect(progress.skills.budget).toBe(21);
  });

  it("accepts the core 12D attribute and up-to-7D skill budgets", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: false,
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
    expect(progress.specializations).toEqual({
      canConvertFromSkills: false,
      canReturnToSkills: false,
      count: 0,
      maximumCount: 0,
      purchaseCost: 0,
      remaining: 0,
    });
  });

  it("accepts explicit genre-package creation budgets", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeBounds: [
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 0 },
      ],
      activeAttributeScores: [9, 9, 9, 9, 9, 9, 0],
      attributeBudgetScore: 54,
      optionalSkillModules: 0,
      pipsEnabled: true,
      skillBudgetScore: 21,
      skills: [
        { kind: "standard", score: 6 },
        { kind: "standard", score: 6 },
        { kind: "standard", score: 6 },
        { kind: "standard", score: 3 },
      ],
    });
    expect(progress.attributes).toEqual({ budget: 54, remaining: 0, used: 54 });
    expect(progress.skills).toEqual({ budget: 21, remaining: 0, used: 21 });
    expect(progress.canFinalize).toBe(true);
  });

  it("uses an applied species template's explicit creation bounds", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeBounds: [
        { maximum: 18, minimum: 18 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
        { maximum: 15, minimum: 3 },
      ],
      activeAttributeScores: [18, 6, 6, 6],
      optionalSkillModules: 0,
      pipsEnabled: false,
      skills: [],
    });
    expect(progress.canFinalize).toBe(true);
    expect(progress.issues).not.toContain("attribute-maximum");
  });

  it("adds 3D per optional attribute and 2D per optional skill module", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9, 9],
      optionalSkillModules: 1,
      pipsEnabled: false,
      skills: [{ kind: "standard", score: 6 }],
    });
    expect(progress.attributes.budget).toBe(45);
    expect(progress.skills.budget).toBe(27);
    expect(progress.canFinalize).toBe(true);
  });

  it("exchanges one Skill die for three fixed +1D Specialization slots", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: false,
      specializationSlots: 3,
      skills: [
        { kind: "standard", score: 6 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
        { kind: "specialization", score: 3 },
      ],
    });
    expect(progress.skills).toEqual({
      budget: 18,
      remaining: 12,
      used: 6,
    });
    expect(progress.specializations).toEqual({
      canConvertFromSkills: false,
      canReturnToSkills: false,
      count: 3,
      maximumCount: 3,
      purchaseCost: 3,
      remaining: 0,
    });
    expect(progress.canFinalize).toBe(true);
  });

  it("returns three wholly unspent Specialization slots to the Skill budget", () => {
    const allocated = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: false,
      specializationSlots: 3,
      skills: [],
    });
    expect(allocated.skills.budget).toBe(18);
    expect(allocated.specializations).toMatchObject({
      canConvertFromSkills: false,
      canReturnToSkills: true,
      count: 0,
      maximumCount: 3,
      remaining: 3,
    });

    const partiallySpent = secondEditionCreationProgress({
      activeAttributeScores: [9, 9, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: false,
      specializationSlots: 3,
      skills: [{ kind: "specialization", score: 3 }],
    });
    expect(partiallySpent.specializations).toMatchObject({
      canReturnToSkills: false,
      count: 1,
      remaining: 2,
    });
  });

  it("rejects invalid attribute, advanced-skill, and specialization limits", () => {
    const progress = secondEditionCreationProgress({
      activeAttributeScores: [2, 16, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: true,
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

  it("requires the Pips module for +1/+2 scores and limits split dice", () => {
    const withoutModule = secondEditionCreationProgress({
      activeAttributeScores: [10, 8, 9, 9],
      optionalSkillModules: 0,
      pipsEnabled: false,
      skills: [],
    });
    expect(withoutModule.issues).toContain("pips-module-required");

    const overSplitLimit = secondEditionCreationProgress({
      activeAttributeScores: [11, 11, 11, 10],
      optionalSkillModules: 0,
      pipsEnabled: true,
      skills: [],
    });
    expect(overSplitLimit.pips.attributeModifierPips).toBe(7);
    expect(overSplitLimit.issues).toContain("pips-split-limit");
  });

  it("steps by whole dice or pips and normalizes dormant remainders", () => {
    expect(nextSecondEditionCreationScore(9, 1, false)).toBe(12);
    expect(nextSecondEditionCreationScore(9, 1, true)).toBe(10);
    expect(nextSecondEditionCreationScore(10, 1, false)).toBe(12);
    expect(nextSecondEditionCreationScore(10, -1, false)).toBe(9);
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
