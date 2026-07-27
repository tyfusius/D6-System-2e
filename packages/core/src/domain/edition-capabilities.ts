import type { RulesProfile } from "./rules-profile";

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
  readonly secondEditionPipsModule: boolean;
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
  readonly metaCurrency: EditionCapabilityDecision;
  readonly pips: EditionCapabilityDecision;
  readonly rulesProfileId: RulesProfile["id"];
  readonly successEvaluator: EditionCapabilityDecision;
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
    compatibility.firstEditionAdvancement ? "active" : "planned",
    compatibility.firstEditionAdvancement
      ? "character-point-advancement"
      : "second-edition-module-unselected",
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
  const decisions = Object.freeze([
    actionEconomy,
    successEvaluator,
    wildDie,
    metaCurrency,
    defenses,
    damage,
    advancement,
    attributes,
    pips,
    advancedSkills,
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
    metaCurrency,
    pips,
    rulesProfileId: profile.id,
    successEvaluator,
    wildDie,
  });
}
