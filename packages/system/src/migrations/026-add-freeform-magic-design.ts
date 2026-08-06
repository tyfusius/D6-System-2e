import type { ItemSource, Migration } from "@d6-system-2e/core";

const textChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T =>
  typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : fallback;

export function addFreeformMagicDesign(source: ItemSource): void {
  if (source.type !== "manifestation") return;
  source.system = {
    ...source.system,
    castingTime: textChoice(
      source.system.castingTime,
      [
        "action",
        "two-turns",
        "four-turns",
        "hour",
        "day",
        "week",
        "month",
        "year",
      ],
      "action",
    ),
    duration: textChoice(
      source.system.duration,
      [
        "instant",
        "round",
        "ten-minutes",
        "hour",
        "day",
        "week",
        "month",
        "year",
        "century",
        "permanent",
      ],
      "instant",
    ),
    power: Number.isSafeInteger(Number(source.system.power))
      ? Math.max(1, Number(source.system.power))
      : 1,
    range: textChoice(
      source.system.range,
      ["melee", "senses", "mile", "locale", "hundred-miles", "unlimited"],
      "melee",
    ),
    resistance: textChoice(
      source.system.resistance,
      ["none", "partial", "complete"],
      "partial",
    ),
    school: textChoice(
      source.system.school,
      ["alteration", "apportation", "conjuration", "divination"],
      "alteration",
    ),
    target: textChoice(
      source.system.target,
      [
        "self",
        "one",
        "two-three",
        "four-six",
        "small-crowd",
        "large-crowd",
        "object",
        "large-object",
        "environment",
        "large-environment",
      ],
      "one",
    ),
  };
}

export const addFreeformMagicDesignMigration: Migration = Object.freeze({
  name: "Add Second Edition freeform magic design",
  updateItem: addFreeformMagicDesign,
  version: 26,
});
