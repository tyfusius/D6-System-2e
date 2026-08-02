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
import { currentSecondEditionHeroPointStrategy } from "./hero-points";
import { currentSecondEditionInitiativeStrategy } from "./initiative";

export function currentSecondEditionCampaignProfile(): SecondEditionCampaignProfileV1 {
  return resolveSecondEditionCampaignProfile({
    chases: booleanSetting(SECOND_EDITION_OPTION_KEYS.chasesModule, false),
    cyberpunk: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.cyberpunkModule,
      false,
    ),
    environments: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.environmentsModule,
      false,
    ),
    fantasySkills: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.fantasySkillsModule,
      false,
    ),
    scienceFictionSkills: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.scienceFictionSkillsModule,
      false,
    ),
    superheroicSkills: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.superheroicSkillsModule,
      false,
    ),
    superheroicHeroPoints: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.superheroicHeroPointsModule,
      false,
    ),
    superheroicDieCodeCap: stringSetting(
      SECOND_EDITION_OPTION_KEYS.superheroicDieCodeCap,
      "none",
    ) as
      | "none"
      | "young"
      | "street"
      | "standard"
      | "national"
      | "worldwide"
      | "cosmic",
    secretIdentities: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.secretIdentitiesModule,
      false,
    ),
    superpowers: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.superpowersModule,
      false,
    ),
    gadgetsGear: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.gadgetsGearModule,
      false,
    ),
    hiddenBases: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.hiddenBasesModule,
      false,
    ),
    superpowerLevel: stringSetting(
      SECOND_EDITION_OPTION_KEYS.superpowerLevel,
      "standard",
    ) as "young" | "street" | "standard" | "national" | "worldwide" | "cosmic",
    psionics: booleanSetting(SECOND_EDITION_OPTION_KEYS.psionicsModule, false),
    freeformSkillBasedMagic: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.freeformMagicModule,
      false,
    ),
    magicPointsCasting: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.magicPointsCastingModule,
      false,
    ),
    activeResponsiveCombat: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.activeResponsiveCombatModule,
      false,
    ),
    hyperLethalCombat: [
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveStunned,
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveWounded,
      SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows,
      SECOND_EDITION_OPTION_KEYS.hyperLethalMaximumArmor,
    ].some((key) => booleanSetting(key, false)),
    heroPointStrategy: currentSecondEditionHeroPointStrategy(),
    initiativeStrategy: currentSecondEditionInitiativeStrategy(),
    noDodgeDefense: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.noDodgeDefenseModule,
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
