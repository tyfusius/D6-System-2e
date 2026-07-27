import { describe, expect, it } from "vitest";
import {
  D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
  resolveSecondEditionCampaignProfile,
} from "./campaign-profile";

describe("Second Edition campaign profile", () => {
  it("resolves the versioned core-default profile", () => {
    expect(
      resolveSecondEditionCampaignProfile({
        additionalSkillModuleCount: 0,
        optionalAttributeIds: [],
        skillSpecializationAdvancedSkills: false,
      }),
    ).toEqual({
      activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
      additionalSkillModuleCount: 0,
      creation: {
        attributeBudgetScore: 36,
        skillBudgetScore: 21,
      },
      id: "core-default",
      moduleIds: ["core.second-edition"],
      profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
      skillSpecializationAdvancedSkills: false,
    });
  });

  it("normalizes custom modules in canonical order and exposes their budgets", () => {
    expect(
      resolveSecondEditionCampaignProfile({
        additionalSkillModuleCount: 2.9,
        optionalAttributeIds: ["magic", "mechanical", "unknown", "magic"],
        skillSpecializationAdvancedSkills: true,
      }),
    ).toEqual({
      activeAttributeIds: [
        "agility",
        "brawn",
        "knowledge",
        "perception",
        "mechanical",
        "magic",
      ],
      additionalSkillModuleCount: 2,
      creation: {
        attributeBudgetScore: 54,
        skillBudgetScore: 33,
      },
      id: "custom",
      moduleIds: [
        "core.second-edition",
        "attribute.mechanical",
        "attribute.magic",
        "skill.specialization-advanced-skills",
      ],
      profileVersion: 1,
      skillSpecializationAdvancedSkills: true,
    });
  });

  it("does not invent persistent IDs for unnamed additional Skill modules", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 3,
      optionalAttributeIds: [],
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.additionalSkillModuleCount).toBe(3);
    expect(profile.moduleIds).toEqual(["core.second-edition"]);
    expect(Object.isFrozen(profile.moduleIds)).toBe(true);
  });
});
