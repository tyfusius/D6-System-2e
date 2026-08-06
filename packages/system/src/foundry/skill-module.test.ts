import { describe, expect, it, vi } from "vitest";

vi.mock("../settings/pip-rules", () => ({
  currentEffectivePipScore: (score: number) => score,
}));

import {
  advancedSkillIssues,
  advancedSkillKey,
  advancedSkillPrerequisiteScores,
  specializationKey,
} from "./skill-module";

function skill(
  key: string,
  score: number,
  training: "advanced" | "standard" = "standard",
): FoundryItemDocument {
  return {
    id: key,
    name: key,
    system: { key, score, training },
    type: "skill",
  } as unknown as FoundryItemDocument;
}

describe("Second Edition Skill Specialization and Advanced Skills module", () => {
  it("uses unique standard Skill ratings without adding Attributes", () => {
    const medicine = skill("medicine", 9);
    const sciences = skill("sciences", 12);
    const surgery = {
      ...skill("surgery", 6, "advanced"),
      system: {
        key: "surgery",
        prerequisiteSkillKeys: ["medicine", "medicine", "sciences"],
        score: 6,
        training: "advanced",
      },
    } as unknown as FoundryItemDocument;
    const actor = {
      items: { contents: [medicine, sciences, surgery] },
      system: { attributes: { knowledge: { score: 15 } } },
    } as unknown as FoundryActorDocument;

    expect(advancedSkillPrerequisiteScores(actor, surgery)).toEqual([9, 12]);
    expect(advancedSkillIssues(actor, surgery)).toEqual([]);
  });

  it("does not allow another Advanced Skill to satisfy a prerequisite", () => {
    const medicine = skill("medicine", 9);
    const sciences = skill("sciences", 12, "advanced");
    const surgery = {
      ...skill("surgery", 6, "advanced"),
      system: {
        key: "surgery",
        prerequisiteSkillKeys: ["medicine", "sciences"],
        score: 6,
        training: "advanced",
      },
    } as unknown as FoundryItemDocument;
    const actor = {
      items: { contents: [medicine, sciences, surgery] },
    } as unknown as FoundryActorDocument;

    expect(advancedSkillPrerequisiteScores(actor, surgery)).toEqual([9, 0]);
    expect(advancedSkillIssues(actor, surgery)).toContain(
      "advanced-skill-prerequisite-rating",
    );
  });

  it("builds distinct readable keys from the actual narrower names", () => {
    const parent = {
      system: { key: "acrobatics" },
    } as unknown as FoundryItemDocument;

    expect(specializationKey(parent, "Parkour")).toBe(
      "specialization-acrobatics-parkour",
    );
    expect(specializationKey(parent, "Gymnastics")).toBe(
      "specialization-acrobatics-gymnastics",
    );
    expect(advancedSkillKey("Nuclear Engineering")).toBe(
      "advanced-nuclear-engineering",
    );
  });
});
