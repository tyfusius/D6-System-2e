import {
  resolveSecondEditionCampaignProfile,
  type SecondEditionCampaignProfileV1,
} from "@d6-system-2e/core";
import {
  booleanSetting,
  numberSetting,
  stringSetting,
  secondEditionOptionalAttributes,
} from "./setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export function currentSecondEditionCampaignProfile(): SecondEditionCampaignProfileV1 {
  return resolveSecondEditionCampaignProfile({
    chases: booleanSetting(SECOND_EDITION_OPTION_KEYS.chasesModule, false),
    environments: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.environmentsModule,
      false,
    ),
    equipmentEra: stringSetting(
      SECOND_EDITION_OPTION_KEYS.equipmentEra,
      "none",
    ) as "none" | "medieval" | "modern" | "science-fiction",
    additionalSkillModuleCount: numberSetting(
      SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount,
      0,
    ),
    optionalAttributeIds: [...secondEditionOptionalAttributes()],
    perksFlawsTalents: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
      false,
    ),
    pipsModule: booleanSetting(SECOND_EDITION_OPTION_KEYS.pipsModule, false),
    skillSpecializationAdvancedSkills: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.skillSpecializationModule,
      false,
    ),
    troublesAssets: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.troublesAssetsModule,
      false,
    ),
  });
}

export function campaignOptionalAttributeIds(
  profile = currentSecondEditionCampaignProfile(),
): ReadonlySet<string> {
  return new Set(profile.activeAttributeIds.slice(4));
}
