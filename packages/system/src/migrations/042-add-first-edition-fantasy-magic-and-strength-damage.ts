import type { ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addFirstEditionFantasyMagicAndStrengthDamage(
  source: ItemSource,
): void {
  if (source.type === "weapon") {
    source.system.damageBasis =
      source.system.damageBasis === "strength-damage"
        ? "strength-damage"
        : "fixed";
    return;
  }
  if (source.type === "species-template") {
    source.system.moveModifier = Number.isSafeInteger(
      Number(source.system.moveModifier),
    )
      ? Number(source.system.moveModifier)
      : 0;
    source.system.scale = Number.isSafeInteger(Number(source.system.scale))
      ? Number(source.system.scale)
      : 0;
    return;
  }
  if (source.type !== "manifestation") return;
  // Later First Edition genre packages own their own normalization migrations.
  // Do not coerce their typed data back to the Second Edition default while
  // replaying the complete migration chain for a newly embedded document.
  if (source.system.magicSystem === "first-edition-adventure") return;
  source.system.magicSystem =
    source.system.magicSystem === "first-edition-fantasy"
      ? "first-edition-fantasy"
      : "second-edition-freeform";
  const firstEdition = record(source.system.firstEdition);
  firstEdition.difficulty = Number.isSafeInteger(
    Number(firstEdition.difficulty),
  )
    ? Math.max(2, Number(firstEdition.difficulty))
    : 5;
  firstEdition.skillKey =
    typeof firstEdition.skillKey === "string"
      ? firstEdition.skillKey
      : "magic-alteration";
  firstEdition.sourcePage = Number.isSafeInteger(
    Number(firstEdition.sourcePage),
  )
    ? Math.max(0, Number(firstEdition.sourcePage))
    : 83;
  firstEdition.tradition =
    firstEdition.tradition === "miracles" ? "miracles" : "magic";
  source.system.firstEdition = firstEdition;
}

export const addFirstEditionFantasyMagicAndStrengthDamageMigration: Migration =
  Object.freeze({
    name: "Add First Edition Fantasy magic and Strength Damage",
    updateItem: addFirstEditionFantasyMagicAndStrengthDamage,
    version: 42,
  });
