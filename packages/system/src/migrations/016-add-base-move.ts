import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addBaseMove(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const movement = record(source.system.movement) ?? {};
  const base = movement.base;
  source.system.movement = {
    ...movement,
    base: Number.isSafeInteger(base) && Number(base) >= 1 ? Number(base) : 10,
  };
}

export const addBaseMoveMigration: Migration = Object.freeze({
  name: "Add personal base Move",
  updateActor: addBaseMove,
  version: 16,
});
