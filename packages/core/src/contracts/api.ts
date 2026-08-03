import type { RulesProfile, RulesProfileId } from "../domain/rules-profile";
import type { EditionCapabilityProfileV1 } from "../domain/edition-capabilities";
import type { SecondEditionCampaignProfileV1 } from "../domain/campaign-profile";
import type { D6System2eAdvancementApi } from "./advancement";
import type { D6System2eHealthApi } from "./health";
import type {
  D6System2eEquipmentCatalogRegistry,
  D6System2eTerminologyRegistry,
  D6System2eThemeRegistry,
} from "./contributions";
import type { D6System2eRollApi } from "./roll";
import type { D6System2eReadApi } from "./actor-read-model";
import type { D6System2eCombatApi } from "./combat";
import type { D6System2eFeatureApi } from "./features";
import type {
  D6System2eFeatureCatalogApi,
  D6System2eFeatureCatalogRegistry,
} from "./feature-catalogs";
import type { D6System2eChaseApi } from "./chase";
import type {
  D6System2eCharacterTemplateApi,
  D6System2eCharacterTemplateRegistry,
} from "./character-templates";
import type { D6System2eMagicApi } from "./magic";
import type {
  D6System2ePsionicPowerRegistry,
  D6System2ePsionicsApi,
} from "./psionics";
import type {
  D6System2eBestiaryApi,
  D6System2eBestiaryRegistry,
} from "./bestiary";
import type { D6System2eHideoutFeatureRegistry } from "./hideouts";
import type { D6System2eCampaignPackageRegistry } from "./campaign-packages";
import type { D6System2eFirstEditionGenreProfileRegistry } from "./first-edition-genre-profiles";

export const D6_SYSTEM_2E_API_VERSION = 1 as const;

export type D6System2eCapability =
  | "foundation.identity"
  | "advancement.command"
  | "campaign.profile"
  | "creation.template"
  | "health.condition"
  | "health.wound"
  | "feature.command"
  | "feature.read"
  | "rules.capabilities"
  | "rules.profile"
  | "read.actor"
  | "roll.check"
  | "roll.double-down"
  | "roll.defense"
  | "roll.attribute"
  | "roll.item"
  | "roll.resistance"
  | "roll.reroll"
  | "roll.skill"
  | "registry.terminology"
  | "registry.theme"
  | "registry.equipment"
  | "registry.templates"
  | "registry.bestiary"
  | "registry.features"
  | "magic.freeform"
  | "magic.points"
  | "registry.discipline"
  | "registry.hideout-features"
  | "registry.campaign-packages"
  | "registry.first-edition-genre-profiles"
  | "combat.read"
  | "combat.command"
  | "chase.read"
  | "chase.command";

export interface D6System2eCapabilitySet {
  has(capability: D6System2eCapability): boolean;
  values(): readonly D6System2eCapability[];
}

export interface D6System2eRulesPresetResult {
  readonly applied: readonly string[];
  readonly failed: readonly { readonly error: string; readonly key: string }[];
  readonly profile: RulesProfile;
  readonly unchanged: readonly string[];
}

export interface D6System2eApiV1 {
  readonly advancement: D6System2eAdvancementApi;
  readonly apiVersion: typeof D6_SYSTEM_2E_API_VERSION;
  readonly bestiary: D6System2eBestiaryApi;
  readonly bestiaryRegistry: D6System2eBestiaryRegistry;
  readonly capabilities: D6System2eCapabilitySet;
  readonly health: D6System2eHealthApi;
  readonly features: D6System2eFeatureApi;
  readonly featureCatalogs: D6System2eFeatureCatalogApi;
  readonly featureCatalogRegistry: D6System2eFeatureCatalogRegistry;
  readonly campaign: {
    current(): SecondEditionCampaignProfileV1;
  };
  readonly campaignPackages: D6System2eCampaignPackageRegistry;
  readonly firstEditionGenreProfiles: D6System2eFirstEditionGenreProfileRegistry;
  readonly combat: D6System2eCombatApi;
  readonly chase: D6System2eChaseApi;
  readonly characterTemplates: D6System2eCharacterTemplateApi;
  readonly migrations: {
    readonly latestSchemaVersion: number;
  };
  readonly magic: D6System2eMagicApi;
  readonly psionics: D6System2ePsionicsApi;
  readonly psionicPowerRegistry: D6System2ePsionicPowerRegistry;
  readonly hideoutFeatureRegistry: D6System2eHideoutFeatureRegistry;
  readonly read: D6System2eReadApi;
  readonly rules: {
    applyPreset(
      profileId: Exclude<RulesProfileId, "custom">,
    ): Promise<D6System2eRulesPresetResult>;
    capabilities(): EditionCapabilityProfileV1;
    current(): RulesProfile;
  };
  readonly roll: D6System2eRollApi;
  readonly terminology: D6System2eTerminologyRegistry;
  readonly themes: D6System2eThemeRegistry;
  readonly equipment: D6System2eEquipmentCatalogRegistry;
  readonly templates: D6System2eCharacterTemplateRegistry;
  readonly systemId: "d6-system-2e";
}

export function isD6System2eApiV1(value: unknown): value is D6System2eApiV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiVersion" in value &&
    value.apiVersion === D6_SYSTEM_2E_API_VERSION &&
    "bestiary" in value &&
    typeof value.bestiary === "object" &&
    value.bestiary !== null &&
    "create" in value.bestiary &&
    typeof value.bestiary.create === "function" &&
    "preview" in value.bestiary &&
    typeof value.bestiary.preview === "function" &&
    "bestiaryRegistry" in value &&
    typeof value.bestiaryRegistry === "object" &&
    value.bestiaryRegistry !== null &&
    "register" in value.bestiaryRegistry &&
    typeof value.bestiaryRegistry.register === "function" &&
    "advancement" in value &&
    typeof value.advancement === "object" &&
    value.advancement !== null &&
    "attribute" in value.advancement &&
    typeof value.advancement.attribute === "function" &&
    "item" in value.advancement &&
    typeof value.advancement.item === "function" &&
    "specialization" in value.advancement &&
    typeof value.advancement.specialization === "function" &&
    "milestone" in value.advancement &&
    typeof value.advancement.milestone === "object" &&
    value.advancement.milestone !== null &&
    "award" in value.advancement.milestone &&
    typeof value.advancement.milestone.award === "function" &&
    "exchangeForPerk" in value.advancement.milestone &&
    typeof value.advancement.milestone.exchangeForPerk === "function" &&
    "read" in value.advancement.milestone &&
    typeof value.advancement.milestone.read === "function" &&
    "narrative" in value.advancement &&
    typeof value.advancement.narrative === "object" &&
    value.advancement.narrative !== null &&
    "approve" in value.advancement.narrative &&
    typeof value.advancement.narrative.approve === "function" &&
    "complete" in value.advancement.narrative &&
    typeof value.advancement.narrative.complete === "function" &&
    "propose" in value.advancement.narrative &&
    typeof value.advancement.narrative.propose === "function" &&
    "read" in value.advancement.narrative &&
    typeof value.advancement.narrative.read === "function" &&
    "remove" in value.advancement.narrative &&
    typeof value.advancement.narrative.remove === "function" &&
    "toggleStep" in value.advancement.narrative &&
    typeof value.advancement.narrative.toggleStep === "function" &&
    "campaign" in value &&
    typeof value.campaign === "object" &&
    value.campaign !== null &&
    "current" in value.campaign &&
    typeof value.campaign.current === "function" &&
    "campaignPackages" in value &&
    typeof value.campaignPackages === "object" &&
    value.campaignPackages !== null &&
    "register" in value.campaignPackages &&
    typeof value.campaignPackages.register === "function" &&
    "resolve" in value.campaignPackages &&
    typeof value.campaignPackages.resolve === "function" &&
    "firstEditionGenreProfiles" in value &&
    typeof value.firstEditionGenreProfiles === "object" &&
    value.firstEditionGenreProfiles !== null &&
    "register" in value.firstEditionGenreProfiles &&
    typeof value.firstEditionGenreProfiles.register === "function" &&
    "characterTemplates" in value &&
    typeof value.characterTemplates === "object" &&
    value.characterTemplates !== null &&
    "apply" in value.characterTemplates &&
    typeof value.characterTemplates.apply === "function" &&
    "preview" in value.characterTemplates &&
    typeof value.characterTemplates.preview === "function" &&
    "magic" in value &&
    typeof value.magic === "object" &&
    value.magic !== null &&
    "cast" in value.magic &&
    typeof value.magic.cast === "function" &&
    "difficulty" in value.magic &&
    typeof value.magic.difficulty === "function" &&
    "psionics" in value &&
    typeof value.psionics === "object" &&
    value.psionics !== null &&
    "read" in value.psionics &&
    typeof value.psionics.read === "function" &&
    "roll" in value.psionics &&
    typeof value.psionics.roll === "function" &&
    "train" in value.psionics &&
    typeof value.psionics.train === "function" &&
    "psionicPowerRegistry" in value &&
    typeof value.psionicPowerRegistry === "object" &&
    value.psionicPowerRegistry !== null &&
    "register" in value.psionicPowerRegistry &&
    typeof value.psionicPowerRegistry.register === "function" &&
    "hideoutFeatureRegistry" in value &&
    typeof value.hideoutFeatureRegistry === "object" &&
    value.hideoutFeatureRegistry !== null &&
    "register" in value.hideoutFeatureRegistry &&
    typeof value.hideoutFeatureRegistry.register === "function" &&
    "combat" in value &&
    typeof value.combat === "object" &&
    value.combat !== null &&
    "read" in value.combat &&
    typeof value.combat.read === "function" &&
    "declare" in value.combat &&
    typeof value.combat.declare === "function" &&
    "completeNext" in value.combat &&
    typeof value.combat.completeNext === "function" &&
    "reset" in value.combat &&
    typeof value.combat.reset === "function" &&
    "chase" in value &&
    typeof value.chase === "object" &&
    value.chase !== null &&
    "read" in value.chase &&
    typeof value.chase.read === "function" &&
    "roll" in value.chase &&
    typeof value.chase.roll === "function" &&
    "start" in value.chase &&
    typeof value.chase.start === "function" &&
    "resolve" in value.chase &&
    typeof value.chase.resolve === "function" &&
    "end" in value.chase &&
    typeof value.chase.end === "function" &&
    "systemId" in value &&
    value.systemId === "d6-system-2e" &&
    "health" in value &&
    typeof value.health === "object" &&
    value.health !== null &&
    "condition" in value.health &&
    typeof value.health.condition === "function" &&
    "wound" in value.health &&
    typeof value.health.wound === "function" &&
    "posture" in value.health &&
    typeof value.health.posture === "function" &&
    "features" in value &&
    typeof value.features === "object" &&
    value.features !== null &&
    "invoke" in value.features &&
    typeof value.features.invoke === "function" &&
    "read" in value.features &&
    typeof value.features.read === "function" &&
    "reset" in value.features &&
    typeof value.features.reset === "function" &&
    "featureCatalogs" in value &&
    typeof value.featureCatalogs === "object" &&
    value.featureCatalogs !== null &&
    "apply" in value.featureCatalogs &&
    typeof value.featureCatalogs.apply === "function" &&
    "preview" in value.featureCatalogs &&
    typeof value.featureCatalogs.preview === "function" &&
    "featureCatalogRegistry" in value &&
    typeof value.featureCatalogRegistry === "object" &&
    value.featureCatalogRegistry !== null &&
    "register" in value.featureCatalogRegistry &&
    typeof value.featureCatalogRegistry.register === "function" &&
    "rules" in value &&
    typeof value.rules === "object" &&
    value.rules !== null &&
    "applyPreset" in value.rules &&
    typeof value.rules.applyPreset === "function" &&
    "capabilities" in value.rules &&
    typeof value.rules.capabilities === "function" &&
    "current" in value.rules &&
    typeof value.rules.current === "function" &&
    "roll" in value &&
    typeof value.roll === "object" &&
    value.roll !== null &&
    "attribute" in value.roll &&
    typeof value.roll.attribute === "function" &&
    "doubleDown" in value.roll &&
    typeof value.roll.doubleDown === "function" &&
    "defense" in value.roll &&
    typeof value.roll.defense === "function" &&
    "skill" in value.roll &&
    typeof value.roll.skill === "function" &&
    "item" in value.roll &&
    typeof value.roll.item === "function" &&
    "resistance" in value.roll &&
    typeof value.roll.resistance === "function" &&
    "reroll" in value.roll &&
    typeof value.roll.reroll === "function" &&
    "read" in value &&
    typeof value.read === "object" &&
    value.read !== null &&
    "actor" in value.read &&
    typeof value.read.actor === "function" &&
    "terminology" in value &&
    typeof value.terminology === "object" &&
    value.terminology !== null &&
    "register" in value.terminology &&
    typeof value.terminology.register === "function" &&
    "themes" in value &&
    typeof value.themes === "object" &&
    value.themes !== null &&
    "register" in value.themes &&
    typeof value.themes.register === "function" &&
    "equipment" in value &&
    typeof value.equipment === "object" &&
    value.equipment !== null &&
    "register" in value.equipment &&
    typeof value.equipment.register === "function" &&
    "templates" in value &&
    typeof value.templates === "object" &&
    value.templates !== null &&
    "register" in value.templates &&
    typeof value.templates.register === "function"
  );
}
