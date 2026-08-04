import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addFirstEditionAdventureActorData(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const system = record(source.system);
  const attributes = record(system.attributes);
  for (const id of ["reflexes", "presence"] as const) {
    if (!(id in attributes)) attributes[id] = { score: 0 };
  }
  source.system = { ...system, attributes };
}

export function addFirstEditionAdventureItemData(source: ItemSource): void {
  if (source.type !== "manifestation") return;
  if (source.system.magicSystem !== "first-edition-adventure") return;
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
    firstEdition.tradition === "psionics" ? "psionics" : "magic";
  source.system.firstEdition = firstEdition;
}

export const addFirstEditionAdventureDataMigration: Migration = Object.freeze({
  name: "Add First Edition Adventure Attributes and manifestations",
  updateActor: addFirstEditionAdventureActorData,
  updateItem: addFirstEditionAdventureItemData,
  version: 47,
});
