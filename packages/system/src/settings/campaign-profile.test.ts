import { afterEach, describe, expect, it, vi } from "vitest";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "./campaign-profile";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Second Edition campaign settings adapter", () => {
  it("resolves world settings into the typed campaign profile", () => {
    const values = new Map<string, unknown>([
      [SECOND_EDITION_OPTION_KEYS.optionalMechanical, true],
      [SECOND_EDITION_OPTION_KEYS.optionalMagic, true],
      [SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount, 2],
      [SECOND_EDITION_OPTION_KEYS.pipsModule, true],
      [SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, true],
      [SECOND_EDITION_OPTION_KEYS.skillSpecializationModule, true],
      [SECOND_EDITION_OPTION_KEYS.troublesAssetsModule, true],
      [SECOND_EDITION_OPTION_KEYS.equipmentEra, "modern"],
      [SECOND_EDITION_OPTION_KEYS.noDodgeDefenseModule, true],
      [SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows, true],
      [SECOND_EDITION_OPTION_KEYS.scienceFictionSkillsModule, true],
    ]);
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) => values.get(key),
      },
    });

    const profile = currentSecondEditionCampaignProfile();
    expect(profile).toMatchObject({
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
      noDodgeDefense: true,
      hyperLethalCombat: true,
      equipmentEra: "modern",
      pipsModule: true,
      perksFlawsTalents: true,
      scienceFictionSkills: true,
      skillSpecializationAdvancedSkills: true,
      troublesAssets: true,
    });
    expect(profile.moduleIds).toContain("features.perks-flaws-talents");
    expect(profile.moduleIds).toContain("features.troubles-assets");
    expect(profile.moduleIds).toContain("rules.equipment.modern");
    expect(profile.moduleIds).toContain("rules.no-dodge-defense");
    expect(profile.moduleIds).toContain("rules.hyper-lethal-combat");
    expect(profile.moduleIds).toContain("skills.science-fiction");
    expect([...campaignOptionalAttributeIds(profile)]).toEqual([
      "mechanical",
      "magic",
    ]);
  });

  it("activates Hideouts only when its rules component and prerequisite are both enabled", () => {
    const values = new Map<string, unknown>();
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) => values.get(key),
      },
    });

    values.set(SECOND_EDITION_OPTION_KEYS.hiddenBasesModule, true);
    values.set(SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, false);
    expect(currentSecondEditionCampaignProfile().hiddenBases).toBe(false);

    values.set(SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, true);
    expect(currentSecondEditionCampaignProfile().hiddenBases).toBe(true);

    values.set(SECOND_EDITION_OPTION_KEYS.hiddenBasesModule, false);
    expect(currentSecondEditionCampaignProfile().hiddenBases).toBe(false);
  });
});
