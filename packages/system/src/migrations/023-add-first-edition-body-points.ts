import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function integer(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

export function addFirstEditionBodyPoints(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health) ?? {};
  const legacy =
    record(health.firstEditionBodyPoints) ??
    record(health.bodyPoints) ??
    record(health.body_points) ??
    {};
  const maximum = Math.max(0, integer(legacy.maximum ?? legacy.max));
  const current = Math.min(maximum, integer(legacy.current));
  source.system.health = {
    ...health,
    firstEditionBodyPoints: {
      current,
      maximum,
    },
  };
}

export const addFirstEditionBodyPointsMigration: Migration = Object.freeze({
  name: "Add First Edition Body Points",
  updateActor: addFirstEditionBodyPoints,
  version: 23,
});
