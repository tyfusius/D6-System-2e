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
      activeResponsiveCombat: false,
      additionalSkillModuleCount: 0,
      chases: false,
      cyberpunk: false,
      creation: {
        attributeBudgetScore: 36,
        skillBudgetScore: 21,
      },
      environments: false,
      fantasySkills: false,
      freeformSkillBasedMagic: false,
      magicPointsCasting: false,
      equipmentEra: "none",
      heroPointStrategy: "heroic",
      initiativeStrategy: "standard",
      hyperLethalCombat: false,
      id: "core-default",
      moduleIds: [
        "core.second-edition",
        "rules.hero-points.heroic",
        "rules.initiative.standard",
      ],
      noDodgeDefense: false,
      perksFlawsTalents: false,
      profileVersion: D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
      pipsModule: false,
      psionics: false,
      scienceFictionSkills: false,
      secretIdentities: false,
      skillSpecializationAdvancedSkills: false,
      superheroicDieCodeCap: "none",
      superheroicHeroPoints: false,
      superheroicSkills: false,
      superpowerCreationDice: 0,
      superpowerLevel: "standard",
      superpowers: false,
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
      activeResponsiveCombat: false,
      additionalSkillModuleCount: 2,
      chases: false,
      cyberpunk: false,
      creation: {
        attributeBudgetScore: 54,
        skillBudgetScore: 33,
      },
      environments: false,
      fantasySkills: false,
      freeformSkillBasedMagic: false,
      magicPointsCasting: false,
      equipmentEra: "none",
      heroPointStrategy: "heroic",
      initiativeStrategy: "standard",
      hyperLethalCombat: false,
      id: "custom",
      moduleIds: [
        "core.second-edition",
        "attribute.mechanical",
        "attribute.magic",
        "skill.specialization-advanced-skills",
        "rules.pips",
        "rules.hero-points.heroic",
        "rules.initiative.standard",
      ],
      noDodgeDefense: false,
      pipsModule: true,
      perksFlawsTalents: false,
      profileVersion: 1,
      psionics: false,
      scienceFictionSkills: false,
      secretIdentities: false,
      skillSpecializationAdvancedSkills: true,
      superheroicDieCodeCap: "none",
      superheroicHeroPoints: false,
      superheroicSkills: false,
      superpowerCreationDice: 0,
      superpowerLevel: "standard",
      superpowers: false,
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

  it("publishes Science Fiction Skills as campaign provenance", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      optionalAttributeIds: [],
      pipsModule: false,
      scienceFictionSkills: true,
      skillSpecializationAdvancedSkills: false,
    });
    expect(profile.id).toBe("custom");
    expect(profile.scienceFictionSkills).toBe(true);
    expect(profile.moduleIds).toContain("skills.science-fiction");
  });

  it("publishes superheroic foundations and the printed Skill budget", () => {
    const profile = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      optionalAttributeIds: [],
      pipsModule: false,
      secretIdentities: true,
      skillSpecializationAdvancedSkills: false,
      superheroicDieCodeCap: "standard",
      superheroicHeroPoints: true,
      superheroicSkills: true,
    });
    expect(profile.creation.skillBudgetScore).toBe(24);
    expect(profile.moduleIds).toEqual(
      expect.arrayContaining([
        "skills.superheroic",
        "rules.hero-points.superheroic",
        "rules.die-code-cap.standard",
        "rules.secret-identities",
      ]),
    );
  });

  it("publishes a separate Superpower budget only with its Talent dependency", () => {
    const active = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      optionalAttributeIds: [],
      perksFlawsTalents: true,
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
      superpowerLevel: "worldwide",
      superpowers: true,
    });
    expect(active.superpowerCreationDice).toBe(20);
    expect(active.moduleIds).toContain("rules.superpowers.worldwide");
    const blocked = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
      superpowers: true,
    });
    expect(blocked.superpowers).toBe(false);
  });

  it("fails Cyberpunk closed until Technical and Science Fiction Skills are active", () => {
    const blocked = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      cyberpunk: true,
      optionalAttributeIds: ["technical"],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(blocked.cyberpunk).toBe(false);

    const active = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      cyberpunk: true,
      optionalAttributeIds: ["technical"],
      pipsModule: false,
      scienceFictionSkills: true,
      skillSpecializationAdvancedSkills: false,
    });
    expect(active.cyberpunk).toBe(true);
    expect(active.moduleIds).toContain("rules.cyberpunk");
  });

  it("fails freeform magic closed until both printed dependencies are active", () => {
    const blocked = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      freeformSkillBasedMagic: true,
      optionalAttributeIds: [],
      pipsModule: false,
      skillSpecializationAdvancedSkills: false,
    });
    expect(blocked.freeformSkillBasedMagic).toBe(false);
    expect(blocked.moduleIds).not.toContain("magic.freeform-skill-based");

    const active = resolveSecondEditionCampaignProfile({
      additionalSkillModuleCount: 0,
      fantasySkills: true,
      freeformSkillBasedMagic: true,
      optionalAttributeIds: ["magic"],
      pipsModule: false,
      skillSpecializationAdvancedSkills: true,
    });
    expect(active.freeformSkillBasedMagic).toBe(true);
    expect(active.moduleIds).toContain("skills.fantasy");
    expect(active.moduleIds).toContain("magic.freeform-skill-based");
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
    expect(profile.moduleIds).toEqual([
      "core.second-edition",
      "rules.hero-points.heroic",
      "rules.initiative.standard",
    ]);
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
