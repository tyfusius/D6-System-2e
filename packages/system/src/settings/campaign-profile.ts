import {
  resolveSecondEditionCampaignProfile,
  type SecondEditionCampaignProfileV1,
} from "@d6-system-2e/core";
import {
  booleanSetting,
  numberSetting,
  secondEditionOptionalAttributes,
} from "./setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export function currentSecondEditionCampaignProfile(): SecondEditionCampaignProfileV1 {
  return resolveSecondEditionCampaignProfile({
    additionalSkillModuleCount: numberSetting(
      SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount,
      0,
    ),
    optionalAttributeIds: [...secondEditionOptionalAttributes()],
    skillSpecializationAdvancedSkills: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.skillSpecializationModule,
      false,
    ),
  });
}

export function campaignOptionalAttributeIds(
  profile = currentSecondEditionCampaignProfile(),
): ReadonlySet<string> {
  return new Set(profile.activeAttributeIds.slice(4));
}
