import type { RulesProfile } from "./rules-profile";
import type { SecondEditionAdvancementStrategy } from "./advancement";

export const EDITION_CAPABILITY_PROFILE_VERSION = 1 as const;

export type EditionCapabilityState =
  "active" | "inactive-preserved" | "planned";

export type EditionCapabilityOwner = "shared" | "second-edition" | "open-d6";

export interface EditionCapabilityDecision {
  readonly id: string;
  readonly owner: EditionCapabilityOwner;
  readonly state: EditionCapabilityState;
  readonly strategy: string;
}

export interface EditionCapabilityOptions {
  readonly allowSecondEditionAdvancedSkillsInOpenD6: boolean;
  readonly secondEditionAdvancedSkillsModule: boolean;
  readonly secondEditionPerksFlawsTalentsModule?: boolean;
  readonly secondEditionPipsModule: boolean;
  readonly secondEditionTroublesAssetsModule?: boolean;
  readonly secondEditionAdvancementStrategy?: SecondEditionAdvancementStrategy;
}

export interface EditionCapabilityProfileV1 {
  readonly actionEconomy: EditionCapabilityDecision;
  readonly advancedSkills: EditionCapabilityDecision;
  readonly advancement: EditionCapabilityDecision;
  readonly attributes: EditionCapabilityDecision;
  readonly contractVersion: typeof EDITION_CAPABILITY_PROFILE_VERSION;
  readonly damage: EditionCapabilityDecision;
  readonly decisions: readonly EditionCapabilityDecision[];
  readonly defenses: EditionCapabilityDecision;
  readonly initiative: EditionCapabilityDecision;
  readonly metaCurrency: EditionCapabilityDecision;
  readonly pips: EditionCapabilityDecision;
  readonly rankedFeatures: EditionCapabilityDecision;
  readonly retries: EditionCapabilityDecision;
  readonly rulesProfileId: RulesProfile["id"];
  readonly successEvaluator: EditionCapabilityDecision;
  readonly narrativeFeatures: EditionCapabilityDecision;
  readonly wildDie: EditionCapabilityDecision;
}

function decision(
  id: string,
  owner: EditionCapabilityOwner,
  state: EditionCapabilityState,
  strategy: string,
): EditionCapabilityDecision {
  return Object.freeze({ id, owner, state, strategy });
}

export function resolveEditionCapabilityProfile(
  profile: RulesProfile,
  options: EditionCapabilityOptions,
): EditionCapabilityProfileV1 {
  const compatibility = profile.compatibility;
  const requestedAdvancementStrategy =
    options.secondEditionAdvancementStrategy ?? "unselected";
  const secondEditionAdvancementStrategy: SecondEditionAdvancementStrategy = (
    ["unselected", "experience-points", "milestone", "narrative"] as const
  ).includes(requestedAdvancementStrategy)
    ? requestedAdvancementStrategy
    : "unselected";
  const successEvaluator = decision(
    "success-evaluator",
    compatibility.firstEditionSuccessEvaluator ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionSuccessEvaluator
      ? "meets-or-exceeds"
      : "strictly-greater",
  );
  const wildDie = decision(
    "wild-die",
    compatibility.firstEditionWildDie ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionWildDie
      ? "open-d6-critical-one"
      : "second-edition-advantage-complication",
  );
  const metaCurrency = decision(
    "meta-currency",
    compatibility.firstEditionMetaCurrency ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionMetaCurrency
      ? "character-points-fate-points"
      : "hero-points",
  );
  const defenses = decision(
    "defenses",
    compatibility.firstEditionActiveDefenses ? "open-d6" : "second-edition",
    compatibility.firstEditionActiveDefenses ? "planned" : "active",
    compatibility.firstEditionActiveDefenses
      ? "active-defense-scheduler"
      : "static-defenses",
  );
  const initiative = decision(
    "initiative",
    compatibility.firstEditionInitiative ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionInitiative
      ? "open-d6-perception-roll"
      : "second-edition-contextual-initiative",
  );
  const actionEconomy = decision(
    "action-economy",
    compatibility.firstEditionActiveDefenses ? "open-d6" : "second-edition",
    compatibility.firstEditionActiveDefenses ? "planned" : "active",
    compatibility.firstEditionActiveDefenses
      ? "open-d6-flexible-action-allotment"
      : "second-edition-action-segments",
  );
  const damage = decision(
    "damage",
    compatibility.firstEditionDamage ? "open-d6" : "second-edition",
    compatibility.firstEditionDamage ? "planned" : "active",
    compatibility.firstEditionDamage
      ? "open-d6-wounds-or-body-points"
      : "second-edition-condition-track",
  );
  const advancement = decision(
    "advancement",
    compatibility.firstEditionAdvancement ? "open-d6" : "second-edition",
    compatibility.firstEditionAdvancement ||
      secondEditionAdvancementStrategy !== "unselected"
      ? "active"
      : "planned",
    compatibility.firstEditionAdvancement
      ? "character-point-advancement"
      : `second-edition-${secondEditionAdvancementStrategy}`,
  );
  const attributes = decision(
    "attributes",
    compatibility.firstEditionAttributes ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionAttributes
      ? "open-d6-six-attribute"
      : "second-edition-campaign-profile",
  );
  const pips = decision(
    "pips",
    compatibility.firstEditionPips ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionPips
      ? "open-d6-classic-pips"
      : options.secondEditionPipsModule
        ? "second-edition-pips-module"
        : "second-edition-whole-dice",
  );
  const advancedSkillsActive =
    options.secondEditionAdvancedSkillsModule &&
    (!compatibility.firstEditionAttributes ||
      options.allowSecondEditionAdvancedSkillsInOpenD6);
  const advancedSkills = decision(
    "advanced-skills",
    "second-edition",
    advancedSkillsActive ? "active" : "inactive-preserved",
    advancedSkillsActive
      ? compatibility.firstEditionAttributes
        ? "second-edition-contextual-extension"
        : "second-edition-contextual"
      : "stored-inactive",
  );
  const secondEditionNativeFeatures =
    !profile.compatibility.firstEditionAttributes;
  const rankedFeaturesActive =
    secondEditionNativeFeatures && options.secondEditionPerksFlawsTalentsModule;
  const rankedFeatures = decision(
    "ranked-features",
    "second-edition",
    rankedFeaturesActive ? "active" : "inactive-preserved",
    rankedFeaturesActive
      ? "second-edition-perks-flaws-talents"
      : "stored-inactive",
  );
  const narrativeFeaturesActive =
    secondEditionNativeFeatures && options.secondEditionTroublesAssetsModule;
  const narrativeFeatures = decision(
    "narrative-features",
    "second-edition",
    narrativeFeaturesActive ? "active" : "inactive-preserved",
    narrativeFeaturesActive
      ? "second-edition-troubles-assets"
      : "stored-inactive",
  );
  const retries = decision(
    "retries",
    compatibility.firstEditionRetries ? "open-d6" : "second-edition",
    "active",
    compatibility.firstEditionRetries
      ? "open-d6-no-general-double-down"
      : "second-edition-doubling-down",
  );
  const decisions = Object.freeze([
    actionEconomy,
    successEvaluator,
    wildDie,
    metaCurrency,
    defenses,
    initiative,
    damage,
    advancement,
    attributes,
    pips,
    advancedSkills,
    rankedFeatures,
    narrativeFeatures,
    retries,
  ]);

  return Object.freeze({
    actionEconomy,
    advancedSkills,
    advancement,
    attributes,
    contractVersion: EDITION_CAPABILITY_PROFILE_VERSION,
    damage,
    decisions,
    defenses,
    initiative,
    metaCurrency,
    pips,
    rankedFeatures,
    retries,
    rulesProfileId: profile.id,
    successEvaluator,
    narrativeFeatures,
    wildDie,
  });
}
