import type { ActorSource, Migration } from "@d6-system-2e/core";

const FANTASY_ATTRIBUTES = [
  "coordination",
  "physique",
  "intellect",
  "acumen",
  "charisma",
  "extranormal",
] as const;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addFirstEditionGenreAttributes(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const system = record(source.system);
  const attributes = record(system.attributes);
  for (const id of FANTASY_ATTRIBUTES) {
    if (!(id in attributes)) attributes[id] = { score: 0 };
  }
  source.system = { ...system, attributes };
}

export const addFirstEditionGenreAttributesMigration: Migration = Object.freeze(
  {
    name: "Add First Edition genre Attribute storage",
    updateActor: addFirstEditionGenreAttributes,
    version: 41,
  },
);
