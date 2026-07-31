import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const WOUNDS = new Set<string>([
  "healthy",
  "stunned",
  "wounded",
  "severely-wounded",
  "incapacitated",
  "mortally-wounded",
  "dead",
]);

export function addFirstEditionWounds(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health) ?? {};
  const wound = health.firstEditionWound;
  source.system.health = {
    ...health,
    firstEditionWound:
      typeof wound === "string" && WOUNDS.has(wound) ? wound : "healthy",
  };
}

export const addFirstEditionWoundsMigration: Migration = Object.freeze({
  name: "Add independent First Edition wound level",
  updateActor: addFirstEditionWounds,
  version: 17,
});
