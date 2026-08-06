import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function addFirstEditionMortalityClock(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health) ?? {};
  const state = record(health.firstEditionState) ?? {};
  source.system.health = {
    ...health,
    firstEditionState: {
      ...state,
      mortalityCheckId:
        typeof state.mortalityCheckId === "string"
          ? state.mortalityCheckId
          : "",
      mortalityRounds: nonNegativeInteger(state.mortalityRounds),
    },
  };
}

export const addFirstEditionMortalityClockMigration: Migration = Object.freeze({
  name: "Add First Edition mortality clock",
  updateActor: addFirstEditionMortalityClock,
  version: 19,
});
