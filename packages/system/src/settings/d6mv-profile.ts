import type { D6SettingSkillV1 } from "@d6-system-2e/core";
import { DEFAULT_SKILL_IMAGE } from "../document-default-images";

export const D6MV_SOURCE_BOOK = "D6 Magnetic Variant Core Reference";

export const D6MV_STRATEGY_COMPOSITION = Object.freeze({
  actionEconomy: "d6mv.action-economy.quick-basic-slow",
  activeDefenses: "d6mv.defenses.srp",
  advancement: "d6mv.advancement.skill-and-hero-points",
  attributes: "d6e2.attributes.campaign-profile",
  health: "d6mv.health.injury-track",
  initiative: "d6mv.initiative.side-readiness",
  movement: "d6mv.movement.action-distance",
  metaCurrency: "d6mv.meta-currency.hero-and-skill-points",
  pips: "d6e2.pips.module",
  retries: "d6mv.retries.hero-reroll",
  scale: "d6mv.scale.three-rank",
  successEvaluator: "d6mv.success.six-degrees",
  wildDie: "d6mv.wild-die.advantage-complication",
});

export function profileUsesD6MvRules(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const strategies = (value as { readonly strategies?: unknown }).strategies;
  if (typeof strategies !== "object" || strategies === null) return false;
  const entries = strategies as Readonly<Record<string, unknown>>;
  return Object.entries(D6MV_STRATEGY_COMPOSITION).every(
    ([slot, strategy]) => entries[slot] === strategy,
  );
}

/** Storage IDs remain engine-neutral; the Setting Profile supplies D6MV labels. */
export const D6MV_ATTRIBUTES = Object.freeze([
  Object.freeze({ id: "agility", label: "Dexterity" }),
  Object.freeze({ id: "knowledge", label: "Knowledge" }),
  Object.freeze({ id: "mechanical", label: "Mechanical" }),
  Object.freeze({ id: "perception", label: "Perception" }),
  Object.freeze({ id: "brawn", label: "Strength" }),
  Object.freeze({ id: "charm", label: "Willpower" }),
] as const);

type D6MvAttributeId = (typeof D6MV_ATTRIBUTES)[number]["id"];

export interface D6MvSkillDefinition {
  readonly attributeId: D6MvAttributeId;
  readonly key: string;
  readonly name: string;
  readonly sourcePage: 31;
}

function skill(
  attributeId: D6MvAttributeId,
  key: string,
  name: string,
): D6MvSkillDefinition {
  return Object.freeze({ attributeId, key, name, sourcePage: 31 });
}

/** Six neutral skills for each of the six D6MV Attributes. */
export const D6MV_SKILL_DEFINITIONS: readonly D6MvSkillDefinition[] =
  Object.freeze([
    skill("agility", "acrobatics", "Acrobatics"),
    skill("agility", "melee", "Melee"),
    skill("agility", "reflex", "Reflex"),
    skill("agility", "ride", "Ride"),
    skill("agility", "sleight-of-hand", "Sleight of Hand"),
    skill("agility", "stealth", "Stealth"),

    skill("knowledge", "espionage", "Espionage"),
    skill("knowledge", "medical", "Medical"),
    skill("knowledge", "scholar", "Scholar"),
    skill("knowledge", "sciences", "Sciences"),
    skill("knowledge", "survival", "Survival"),
    skill("knowledge", "technical", "Technical"),

    skill("mechanical", "demolitions", "Demolitions"),
    skill("mechanical", "drive", "Drive"),
    skill("mechanical", "engineer", "Engineer"),
    skill("mechanical", "gunner", "Gunner"),
    skill("mechanical", "pilot", "Pilot"),
    skill("mechanical", "repair-disable", "Repair / Disable"),

    skill("perception", "evaluate", "Evaluate"),
    skill("perception", "gambling", "Gambling"),
    skill("perception", "instinct", "Instinct"),
    skill("perception", "investigate", "Investigate"),
    skill("perception", "marksmanship", "Marksmanship"),
    skill("perception", "streetwise", "Streetwise"),

    skill("brawn", "brawl", "Brawl"),
    skill("brawn", "climb-jump", "Climb / Jump"),
    skill("brawn", "lifting", "Lifting"),
    skill("brawn", "stamina", "Stamina"),
    skill("brawn", "swimming", "Swimming"),
    skill("brawn", "throwing", "Throwing"),

    skill("charm", "bargain", "Bargain"),
    skill("charm", "charm", "Charm"),
    skill("charm", "command", "Command"),
    skill("charm", "con", "Con"),
    skill("charm", "grit", "Grit"),
    skill("charm", "intimidation", "Intimidation"),
  ]);

export const D6MV_SETTING_SKILLS: readonly D6SettingSkillV1[] = Object.freeze(
  D6MV_SKILL_DEFINITIONS.map((entry) =>
    Object.freeze({
      attributeId: entry.attributeId,
      description: "",
      img: DEFAULT_SKILL_IMAGE,
      key: entry.key,
      name: entry.name,
      training: "standard" as const,
    }),
  ),
);

export function missingD6MvSkillSources(
  existingKeys: ReadonlySet<string>,
): readonly Record<string, unknown>[] {
  return Object.freeze(
    D6MV_SKILL_DEFINITIONS.filter(({ key }) => !existingKeys.has(key)).map(
      (entry) => ({
        img: DEFAULT_SKILL_IMAGE,
        name: entry.name,
        system: {
          attributeId: entry.attributeId,
          description: "",
          key: entry.key,
          score: 0,
          source: {
            book: D6MV_SOURCE_BOOK,
            module: "d6mv",
            page: entry.sourcePage,
          },
          training: "standard",
        },
        type: "skill",
      }),
    ),
  );
}
