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
        pipsModule: false,
        skillSpecializationAdvancedSkills: false,
      }),
    ).toEqual({
      activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
      additionalSkillModuleCount: 0,
      chases: false,
      creation: {
        attributeBudgetScore: 36,
        skillBudgetScore: 21,
      },
      environments: false,
      equipmentEra: "none",
      hyperLethalCombat: false,
      id: "core-default",
      moduleIds: ["core.second-edition"],
      noDodgeDefense: false,
      perksFlawsTalents: false,
      profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
      troublesAssets: false,
    });
  });

  it("normalizes custom modules in canonical order and exposes their budgets", () => {
    expect(
      resolveSecondEditionCampaignProfile({
        additionalSkillModuleCount: 2.9,
        optionalAttributeIds: ["magic", "mechanical", "unknown", "magic"],
        pipsModule: true,
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
      chases: false,
      creation: {
        attributeBudgetScore: 54,
        skillBudgetScore: 33,
      },
      environments: false,
      equipmentEra: "none",
      hyperLethalCombat: false,
      id: "custom",
      moduleIds: [
        "core.second-edition",
        "attribute.mechanical",
        "attribute.magic",
        "skill.specialization-advanced-skills",
        "rules.pips",
      ],
      noDodgeDefense: false,
      pipsModule: true,
      perksFlawsTalents: false,
      profileVersion: 1,
      skillSpecializationAdvancedSkills: true,
      troublesAssets: false,
    });
  });

  it("publishes No Dodge Defense as campaign provenance", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      noDodgeDefense: true,
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.id).toBe("custom");
    expect(profile.noDodgeDefense).toBe(true);
    expect(profile.moduleIds).toContain("rules.no-dodge-defense");
  });

  it("publishes Hyper-lethal Combat as campaign provenance", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      hyperLethalCombat: true,
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.id).toBe("custom");
    expect(profile.hyperLethalCombat).toBe(true);
    expect(profile.moduleIds).toContain("rules.hyper-lethal-combat");
  });

  it("does not invent persistent IDs for unnamed additional Skill modules", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 3,
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.additionalSkillModuleCount).toBe(3);
    expect(profile.moduleIds).toEqual(["core.second-edition"]);
    expect(Object.isFrozen(profile.moduleIds)).toBe(true);
  });

  it("selects exactly one equipment era and exposes it as campaign provenance", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      equipmentEra: "science-fiction",
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.equipmentEra).toBe("science-fiction");
    expect(profile.moduleIds).toContain("rules.equipment.science-fiction");
    expect(profile.id).toBe("custom");
  });
});
