import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addDodgeBasis(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const defenses = record(source.system.defenses) ?? {};
  defenses.dodgeBasis =
    defenses.dodgeBasis === "flying" ? "flying" : "perception";
  source.system.defenses = defenses;
}

export const addDodgeBasisMigration: Migration = Object.freeze({
  name: "Add Second Edition Dodge basis",
  updateActor: addDodgeBasis,
  version: 29,
});
