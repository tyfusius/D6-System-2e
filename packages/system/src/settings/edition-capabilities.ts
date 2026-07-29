import {
  resolveEditionCapabilityProfile,
  type EditionCapabilityProfileV1,
} from "@d6-system-2e/core";
import { booleanSetting, stringSetting } from "./setting-values";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "./settings-catalog";
import { currentRulesProfile } from "./rules-compatibility";

export function currentEditionCapabilityProfile(): EditionCapabilityProfileV1 {
  return resolveEditionCapabilityProfile(currentRulesProfile(), {
    secondEditionAdvancementStrategy: stringSetting(
      SECOND_EDITION_OPTION_KEYS.advancementStrategy,
      "unselected",
    ) as "unselected" | "experience-points" | "milestone" | "narrative",
    allowSecondEditionAdvancedSkillsInOpenD6: booleanSetting(
      FIRST_EDITION_OPTION_KEYS.allowSecondEditionAdvancedSkills,
      false,
    ),
    secondEditionAdvancedSkillsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.skillSpecializationModule,
      false,
    ),
    secondEditionPerksFlawsTalentsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
      false,
    ),
    secondEditionPipsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.pipsModule,
      false,
    ),
    secondEditionTroublesAssetsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.troublesAssetsModule,
      false,
    ),
  });
}
