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
import type { D6System2eChaseApi } from "./chase";

export const D6_SYSTEM_2E_API_VERSION = 1 as const;

export type D6System2eCapability =
  | "foundation.identity"
  | "advancement.command"
  | "campaign.profile"
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
  | "registry.discipline"
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
  readonly capabilities: D6System2eCapabilitySet;
  readonly health: D6System2eHealthApi;
  readonly features: D6System2eFeatureApi;
  readonly campaign: {
    current(): SecondEditionCampaignProfileV1;
  };
  readonly combat: D6System2eCombatApi;
  readonly chase: D6System2eChaseApi;
  readonly migrations: {
    readonly latestSchemaVersion: number;
  };
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
  readonly systemId: "d6-system-2e";
}

export function isD6System2eApiV1(value: unknown): value is D6System2eApiV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiVersion" in value &&
    value.apiVersion === D6_SYSTEM_2E_API_VERSION &&
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
    typeof value.equipment.register === "function"
  );
}
