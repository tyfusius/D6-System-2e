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
      pipsModule: true,
      perksFlawsTalents: true,
      skillSpecializationAdvancedSkills: true,
      troublesAssets: true,
    });
    expect(profile.moduleIds).toContain("features.perks-flaws-talents");
    expect(profile.moduleIds).toContain("features.troubles-assets");
    expect([...campaignOptionalAttributeIds(profile)]).toEqual([
      "mechanical",
      "magic",
    ]);
  });
});
