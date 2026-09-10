import type {
  D6ProfilePresetDefinitionV1,
  D6RulesProfileV5,
  D6SettingProfileV5,
} from "@d6-system-2e/core";
import { DISPLAY_FONT_REF } from "./font";
import { WESTERN1876_SKILLS } from "./catalog";
import {
  LOGO_PATH,
  MODULE_ID,
  PRESET_ID,
  RULES_PROFILE_ID,
  SETTING_PROFILE_ID,
} from "./module";

type Localize = (key: string) => string;

/** Existing engine choices, not adoption of the full candidate 1876 rulebook. */
export function create1876RulesProfile(localize: Localize): D6RulesProfileV5 {
  return Object.freeze({
    version: 5,
    id: RULES_PROFILE_ID,
    label: localize("WESTERN1876.RulesName"),
    description: localize("WESTERN1876.RulesDescription"),
    source: Object.freeze({ kind: "module", ownerId: MODULE_ID }),
    firstEditionGenreProfile: Object.freeze({
      version: 1 as const,
      id: MODULE_ID,
    }),
    constraints: Object.freeze([]),
    difficultyLadder: Object.freeze([
      Object.freeze({ id: "very-easy", label: "Very Easy", value: 5 }),
      Object.freeze({ id: "easy", label: "Easy", value: 10 }),
      Object.freeze({ id: "moderate", label: "Moderate", value: 15 }),
      Object.freeze({ id: "difficult", label: "Difficult", value: 20 }),
      Object.freeze({
        id: "very-difficult",
        label: "Very Difficult",
        value: 25,
      }),
      Object.freeze({ id: "heroic", label: "Exceptional", value: 30 }),
    ]),
    healthModels: Object.freeze([]),
    matchingEvaluators: Object.freeze([]),
    homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
    strategies: Object.freeze({
      actionEconomy: "open-d6.action-economy.segmented",
      activeDefenses: "open-d6.defenses.active",
      advancement: "open-d6.advancement.character-points",
      attributes: "open-d6.attributes.six-attribute",
      health: "open-d6.health.wounds-or-body-points",
      initiative: "open-d6.initiative.perception-reflexes",
      movement: "open-d6.movement.relative",
      metaCurrency: "open-d6.meta-currency.character-and-fate-points",
      pips: "open-d6.pips.classic",
      retries: "open-d6.retries.no-general-reroll",
      scale: "open-d6.scale.scalar",
      successEvaluator: "open-d6.success.meets-or-exceeds",
      wildDie: "open-d6.wild-die.critical-one",
      consequenceSuite: "open-d6.consequences.physical-only",
      creation: "open-d6.creation.attribute-skill-dice",
      featureEconomy: "open-d6.features.none",
    }),
    terminology: Object.freeze({}),
  });
}

// Preserve the system normalizer's full vocabulary. The bound Rules genre owns
// the six active attributes and their order; Setting presentation cannot activate them.
const ATTRIBUTES = [
  ["agility", "Agility"],
  ["brawn", "Brawn"],
  ["knowledge", "Knowledge"],
  ["perception", "Perception"],
  ["charm", "Charm"],
  ["magic", "Magic"],
  ["mechanical", "Mechanical"],
  ["mysticism", "Mysticism"],
  ["technical", "Technical"],
  ["acumen", "Acumen"],
  ["charisma", "Charisma"],
  ["coordination", "Coordination"],
  ["extranormal", "Extranormal"],
  ["intellect", "Intellect"],
  ["physique", "Physique"],
  ["presence", "Presence"],
  ["reflexes", "Reflexes"],
] as const;

export function create1876SettingProfile(
  localize: Localize,
): D6SettingProfileV5 {
  return Object.freeze({
    version: 5,
    id: SETTING_PROFILE_ID,
    label: localize("WESTERN1876.SettingName"),
    description: localize("WESTERN1876.SettingDescription"),
    originRulesFamily: "open-d6-first-edition",
    attributes: Object.freeze(
      ATTRIBUTES.map(([id, label]) => Object.freeze({ id, label })),
    ),
    skills: WESTERN1876_SKILLS,
    healthLabels: Object.freeze({}),
    terminology: Object.freeze({}),
    logo: LOGO_PATH,
    logoAsWatermark: false,
    typography: Object.freeze({
      display: DISPLAY_FONT_REF,
      body: "system/d6-interface",
    }),
    palette: Object.freeze({
      background: "#0b0b0a",
      text: "#e8dcc6",
      accent: "#c7a264",
      accentBright: "#e8dcc6",
      muted: "#c0aa85",
    }),
    wildDie: Object.freeze({
      one: Object.freeze({ kind: "text", value: "1" }),
      oneSound: "systems/d6-system-2e/assets/audio/wild-one.mp3",
      six: Object.freeze({
        kind: "image",
        value: "systems/d6-system-2e/assets/dice/wild-six.png",
      }),
      sixSound: "systems/d6-system-2e/assets/audio/wild-six.mp3",
    }),
  });
}

export function create1876Preset(
  localize: Localize,
): D6ProfilePresetDefinitionV1 {
  return Object.freeze({
    version: 1,
    id: PRESET_ID,
    label: localize("WESTERN1876.PresetName"),
    description: localize("WESTERN1876.PresetDescription"),
    selection: Object.freeze({
      version: 1,
      rulesProfileId: RULES_PROFILE_ID,
      settingProfileId: SETTING_PROFILE_ID,
    }),
  });
}
