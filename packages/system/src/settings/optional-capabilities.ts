import { currentAttributeRuntimeStrategy } from "./attributes";
import { currentPipsRuntimeStrategy } from "./pip-rules";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { booleanSetting } from "./setting-values";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "./settings-catalog";

export const D6_OPTIONAL_CAPABILITY_RUNTIME_VERSION = 1 as const;

export type D6OptionalCapabilityId =
  | "advanced-skills"
  | "chases"
  | "environments"
  | "narrative-features"
  | "ranked-features";

export type D6OptionalCapabilityState = "active" | "inactive-preserved";

export interface D6OptionalCapabilityDecision {
  readonly blockedBy: readonly string[];
  readonly id: D6OptionalCapabilityId;
  readonly owner: "second-edition";
  readonly state: D6OptionalCapabilityState;
  readonly strategy: string;
}

export interface D6OptionalCapabilityRuntimeV1 {
  readonly advancedSkills: D6OptionalCapabilityDecision;
  readonly chases: D6OptionalCapabilityDecision;
  readonly contractVersion: typeof D6_OPTIONAL_CAPABILITY_RUNTIME_VERSION;
  readonly decisions: readonly D6OptionalCapabilityDecision[];
  readonly environments: D6OptionalCapabilityDecision;
  readonly narrativeFeatures: D6OptionalCapabilityDecision;
  readonly rankedFeatures: D6OptionalCapabilityDecision;
  readonly rulesProfileId: string;
}

export interface D6OptionalCapabilityRuntimeOptions {
  readonly advancedSkillsModule: boolean;
  readonly allowAdvancedSkillsImport: boolean;
  readonly attributeFamily: "open-d6" | "second-edition";
  readonly chasesModule: boolean;
  readonly environmentsModule: boolean;
  readonly narrativeFeaturesModule: boolean;
  readonly pipsDependency: "requires-active-pips" | "satisfied";
  readonly rankedFeaturesModule: boolean;
  readonly rulesProfileId: string;
}

function decision(
  id: D6OptionalCapabilityId,
  active: boolean,
  strategy: string,
  blockedBy: readonly string[],
): D6OptionalCapabilityDecision {
  return Object.freeze({
    blockedBy: Object.freeze(active ? [] : [...blockedBy]),
    id,
    owner: "second-edition",
    state: active ? "active" : "inactive-preserved",
    strategy: active ? strategy : "stored-inactive",
  });
}

export function resolveOptionalCapabilityRuntime(
  options: D6OptionalCapabilityRuntimeOptions,
): D6OptionalCapabilityRuntimeV1 {
  const nativeAttributes = options.attributeFamily === "second-edition";
  const advancedSkillsActive =
    options.advancedSkillsModule &&
    (nativeAttributes || options.allowAdvancedSkillsImport);
  const advancedSkills = decision(
    "advanced-skills",
    advancedSkillsActive,
    nativeAttributes
      ? "second-edition-contextual"
      : "second-edition-contextual-extension",
    [
      ...(options.advancedSkillsModule ? [] : ["advanced-skills-module"]),
      ...(nativeAttributes || options.allowAdvancedSkillsImport
        ? []
        : ["advanced-skills-import"]),
    ],
  );
  const chasesActive = nativeAttributes && options.chasesModule;
  const chases = decision(
    "chases",
    chasesActive,
    "second-edition-distance-track",
    [
      ...(nativeAttributes ? [] : ["second-edition-attributes"]),
      ...(options.chasesModule ? [] : ["chases-module"]),
    ],
  );
  const environmentsActive = nativeAttributes && options.environmentsModule;
  const environments = decision(
    "environments",
    environmentsActive,
    "second-edition-environment-hazards",
    [
      ...(nativeAttributes ? [] : ["second-edition-attributes"]),
      ...(options.environmentsModule ? [] : ["environments-module"]),
    ],
  );
  const pipsSatisfied = options.pipsDependency === "satisfied";
  const rankedFeaturesActive =
    nativeAttributes && options.rankedFeaturesModule && pipsSatisfied;
  const rankedFeatures = decision(
    "ranked-features",
    rankedFeaturesActive,
    "second-edition-perks-flaws-talents",
    [
      ...(nativeAttributes ? [] : ["second-edition-attributes"]),
      ...(options.rankedFeaturesModule ? [] : ["ranked-features-module"]),
      ...(pipsSatisfied ? [] : ["active-pips"]),
    ],
  );
  const narrativeFeaturesActive =
    nativeAttributes && options.narrativeFeaturesModule;
  const narrativeFeatures = decision(
    "narrative-features",
    narrativeFeaturesActive,
    "second-edition-troubles-assets",
    [
      ...(nativeAttributes ? [] : ["second-edition-attributes"]),
      ...(options.narrativeFeaturesModule ? [] : ["narrative-features-module"]),
    ],
  );
  const decisions = Object.freeze([
    advancedSkills,
    chases,
    environments,
    rankedFeatures,
    narrativeFeatures,
  ]);
  return Object.freeze({
    advancedSkills,
    chases,
    contractVersion: D6_OPTIONAL_CAPABILITY_RUNTIME_VERSION,
    decisions,
    environments,
    narrativeFeatures,
    rankedFeatures,
    rulesProfileId: options.rulesProfileId,
  });
}

export function currentOptionalCapabilityRuntime(): D6OptionalCapabilityRuntimeV1 {
  const attributes = currentAttributeRuntimeStrategy();
  const pips = currentPipsRuntimeStrategy();
  return resolveOptionalCapabilityRuntime({
    advancedSkillsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.skillSpecializationModule,
      false,
    ),
    allowAdvancedSkillsImport: booleanSetting(
      FIRST_EDITION_OPTION_KEYS.allowSecondEditionAdvancedSkills,
      false,
    ),
    attributeFamily: attributes.family,
    chasesModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.chasesModule,
      false,
    ),
    environmentsModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.environmentsModule,
      false,
    ),
    narrativeFeaturesModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.troublesAssetsModule,
      false,
    ),
    pipsDependency: pips.dependencies.rankedFeatures,
    rankedFeaturesModule: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
      false,
    ),
    rulesProfileId: currentConfiguredRulesProfile().id,
  });
}
