import type { D6SettingSkillV1 } from "@d6-system-2e/core";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";
import { missingD6MvSkillSources, profileUsesD6MvRules } from "./d6mv-profile";

export const FREE_D6_SOURCE_BOOK = "FreeD6 Player Book and GM Guide";

const FREE_D6_STRATEGY_COMPOSITION = Object.freeze({
  actionEconomy: "open-d6.action-economy.flexible",
  activeDefenses: "open-d6.defenses.active",
  advancement: "open-d6.advancement.character-points",
  attributes: "d6e2.attributes.campaign-profile",
  health: "open-d6.health.wounds-or-body-points",
  initiative: "open-d6.initiative.perception",
  movement: "open-d6.movement.relative",
  metaCurrency: "open-d6.meta-currency.character-and-fate-points",
  pips: "open-d6.pips.classic",
  retries: "open-d6.retries.no-general-reroll",
  scale: "open-d6.scale.scalar",
  successEvaluator: "open-d6.success.meets-or-exceeds",
  wildDie: "open-d6.wild-die.critical-one",
});

export function profileUsesFreeD6AttributeVocabulary(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const strategies = (value as { readonly strategies?: unknown }).strategies;
  if (typeof strategies !== "object" || strategies === null) return false;
  const entries = strategies as Readonly<Record<string, unknown>>;
  return Object.entries(FREE_D6_STRATEGY_COMPOSITION).every(
    ([slot, strategy]) => entries[slot] === strategy,
  );
}

export const FREE_D6_ATTRIBUTE_IDS = Object.freeze([
  "agility",
  "coordination",
  "strength",
  "knowledge",
  "perception",
  "charisma",
  "technical",
] as const);

export interface FreeD6SkillDefinition {
  readonly attributeId: (typeof FREE_D6_ATTRIBUTE_IDS)[number];
  readonly key: string;
  readonly name: string;
  readonly sourcePage: 16 | 17;
  readonly training: "advanced" | "standard";
}

function definition(
  attributeId: FreeD6SkillDefinition["attributeId"],
  key: string,
  name: string,
  sourcePage: FreeD6SkillDefinition["sourcePage"],
  training: FreeD6SkillDefinition["training"] = "standard",
): FreeD6SkillDefinition {
  return Object.freeze({ attributeId, key, name, sourcePage, training });
}

/**
 * The generic, non-exhaustive skill vocabulary printed with the seven FreeD6
 * attributes. Setting-specific specializations and protected setting content
 * are intentionally not bundled.
 */
export const FREE_D6_SKILL_DEFINITIONS: readonly FreeD6SkillDefinition[] =
  Object.freeze([
    definition("agility", "acrobatics", "Acrobatics", 16),
    definition("agility", "brawling", "Brawling", 16),
    definition("agility", "dodge", "Dodge", 16),
    definition("agility", "martial-arts", "Martial Arts", 16, "advanced"),
    definition(
      "agility",
      "melee-combat-category",
      "Melee Combat (Category)",
      16,
    ),
    definition("agility", "melee-combat", "Melee Combat", 16),
    definition("agility", "melee-mastery", "Melee Mastery", 16, "advanced"),
    definition(
      "agility",
      "powered-armor-operations",
      "Powered Armor Operations",
      16,
    ),
    definition("agility", "riding-land", "Riding — Land", 16),
    definition("agility", "riding-air", "Riding — Air", 16),
    definition("agility", "sport-agility", "Sport (Agility)", 16),
    definition("agility", "zero-g-operations", "Zero-G Operations", 16),

    definition("coordination", "ambidexterity", "Ambidexterity", 16),
    definition("coordination", "boating", "Boating", 16),
    definition(
      "coordination",
      "driving-land-vehicles",
      "Driving — Land Vehicles",
      16,
    ),
    definition(
      "coordination",
      "energy-ranged-weapons",
      "Energy Ranged Weapons",
      16,
    ),
    definition("coordination", "fast-draw", "Fast Draw", 16, "advanced"),
    definition("coordination", "firearms", "Firearms", 16),
    definition("coordination", "heavy-weapons", "Heavy Weapons", 16),
    definition(
      "coordination",
      "missile-weapons-category",
      "Missile Weapons (Category)",
      16,
    ),
    definition("coordination", "missile-weapons", "Missile Weapons", 16),
    definition("coordination", "mounted-weaponry", "Mounted Weaponry", 16),
    definition(
      "coordination",
      "piloting-air-vehicles",
      "Piloting — Air Vehicles",
      16,
    ),
    definition(
      "coordination",
      "piloting-space-vehicles",
      "Piloting — Space Vehicles",
      16,
    ),
    definition("coordination", "play-instrument", "Play Instrument", 16),
    definition("coordination", "sleight-of-hand", "Sleight of Hand", 16),
    definition(
      "coordination",
      "sport-coordination",
      "Sport (Coordination)",
      16,
    ),
    definition(
      "coordination",
      "thrown-weapons-category",
      "Thrown Weapons (Category)",
      16,
    ),
    definition("coordination", "thrown-weapons", "Thrown Weapons", 16),

    definition("strength", "climbing", "Climbing", 16),
    definition("strength", "heavy-melee-combat", "Heavy Melee Combat", 16),
    definition("strength", "jumping", "Jumping", 16),
    definition("strength", "lifting-throwing", "Lifting / Throwing", 16),
    definition("strength", "running", "Running", 16),
    definition("strength", "sport-strength", "Sport (Strength)", 16),
    definition("strength", "stamina", "Stamina", 16),
    definition("strength", "swimming", "Swimming", 16),

    definition("perception", "acting", "Acting", 16),
    definition("perception", "arts", "Arts", 16),
    definition("perception", "bargain", "Bargain", 16),
    definition("perception", "blind-combat", "Blind Combat", 16, "advanced"),
    definition("perception", "con", "Con", 16),
    definition("perception", "disguise", "Disguise", 16),
    definition("perception", "empathy", "Empathy", 16),
    definition("perception", "etiquette", "Etiquette", 16),
    definition("perception", "forgery", "Forgery", 16),
    definition("perception", "gambling", "Gambling", 16),
    definition("perception", "hide", "Hide", 16),
    definition("perception", "search", "Search", 16),
    definition("perception", "seduction", "Seduction", 16),
    definition("perception", "stealth", "Stealth", 16),
    definition("perception", "tracking", "Tracking", 16),

    definition("charisma", "animal-handling", "Animal Handling", 17),
    definition("charisma", "command", "Command", 17),
    definition("charisma", "diplomacy", "Diplomacy", 17),
    definition("charisma", "interrogation", "Interrogation", 17),
    definition("charisma", "intimidation", "Intimidation", 17),
    definition("charisma", "meditation", "Meditation", 17),
    definition("charisma", "performing", "Performing", 17, "advanced"),
    definition("charisma", "persuasion", "Persuasion", 17),
    definition("charisma", "singing", "Singing", 17),
    definition("charisma", "storytelling", "Storytelling", 17),
    definition("charisma", "teaching", "Teaching", 17),
    definition("charisma", "willpower", "Willpower", 17),

    definition("knowledge", "astrogation", "Astrogation", 17),
    definition("knowledge", "bureaucracy", "Bureaucracy", 17),
    definition("knowledge", "business", "Business", 17),
    definition("knowledge", "cryptography", "Cryptography", 17),
    definition("knowledge", "culture", "Culture", 17),
    definition("knowledge", "gaming", "Gaming", 17),
    definition("knowledge", "gunnery", "Gunnery", 17),
    definition("knowledge", "heraldry", "Heraldry", 17),
    definition("knowledge", "history", "History", 17),
    definition("knowledge", "humanities", "Humanities", 17),
    definition("knowledge", "investigation", "Investigation", 17),
    definition("knowledge", "languages", "Languages", 17),
    definition("knowledge", "law-enforcement", "Law Enforcement", 17),
    definition("knowledge", "legwork", "Legwork", 17),
    definition("knowledge", "linguistics", "Linguistics", 17),
    definition("knowledge", "medicine", "Medicine", 17, "advanced"),
    definition("knowledge", "navigation", "Navigation", 17),
    definition("knowledge", "occultism", "Occultism", 17),
    definition("knowledge", "poisons", "Poisons", 17),
    definition("knowledge", "psychology", "Psychology", 17),
    definition("knowledge", "religion", "Religion", 17),
    definition("knowledge", "scholar", "Scholar", 17),
    definition("knowledge", "sciences", "Sciences", 17),
    definition("knowledge", "strategy-tactics", "Strategy and Tactics", 17),
    definition("knowledge", "survival", "Survival", 17),
    definition("knowledge", "value", "Value", 17),
    definition("knowledge", "xenology", "Xenology", 17),

    definition("technical", "build-repair", "Build and Repair", 17),
    definition(
      "technical",
      "capital-ship-operations",
      "Capital Ship Operations",
      17,
    ),
    definition("technical", "communications", "Communications", 17),
    definition("technical", "computers", "Computers", 17),
    definition("technical", "design", "Design", 17, "advanced"),
    definition("technical", "explosives", "Explosives", 17),
    definition("technical", "first-aid", "First Aid", 17),
    definition("technical", "hacking", "Hacking", 17),
    definition("technical", "heavy-gunnery", "Heavy Gunnery", 17),
    definition(
      "technical",
      "heavy-machinery-operations",
      "Heavy Machinery Operations",
      17,
    ),
    definition("technical", "lock-picking", "Lock Picking", 17),
    definition("technical", "photography", "Photography", 17),
    definition("technical", "sailing", "Sailing", 17),
    definition("technical", "security", "Security", 17),
    definition("technical", "sensors", "Sensors", 17),
    definition("technical", "traps", "Traps", 17),
  ]);

export const FREE_D6_SETTING_SKILLS: readonly D6SettingSkillV1[] =
  Object.freeze(
    FREE_D6_SKILL_DEFINITIONS.map((skill) =>
      Object.freeze({
        attributeId: skill.attributeId,
        description: "",
        img: DEFAULT_SKILL_IMAGE,
        key: skill.key,
        name: skill.name,
        training: skill.training,
      }),
    ),
  );

export function freeD6SkillDefinition(
  key: string,
): FreeD6SkillDefinition | undefined {
  return FREE_D6_SKILL_DEFINITIONS.find((skill) => skill.key === key);
}

export function missingFreeD6SkillSources(
  existingKeys: ReadonlySet<string>,
): readonly Record<string, unknown>[] {
  return Object.freeze(
    FREE_D6_SKILL_DEFINITIONS.filter(({ key }) => !existingKeys.has(key)).map(
      (skill) => ({
        img: DEFAULT_SKILL_IMAGE,
        name: skill.name,
        system: {
          attributeId: skill.attributeId,
          description: "",
          key: skill.key,
          score: 0,
          source: {
            book: FREE_D6_SOURCE_BOOK,
            module: "free-d6",
            page: skill.sourcePage,
          },
          training: skill.training,
        },
        type: "skill",
      }),
    ),
  );
}

export function skillSourcesForRulesProfile(
  profile: unknown,
  existingKeys: ReadonlySet<string>,
  fallback: () => readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  if (profileUsesFreeD6AttributeVocabulary(profile)) {
    return missingFreeD6SkillSources(existingKeys);
  }
  if (profileUsesD6MvRules(profile)) {
    return missingD6MvSkillSources(existingKeys);
  }
  return fallback();
}
