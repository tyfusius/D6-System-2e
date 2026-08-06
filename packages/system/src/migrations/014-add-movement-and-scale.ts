import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addMovementAndScale(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const movement = record(source.system.movement) ?? {};
  source.system.movement = {
    ...movement,
    posture: movement.posture === "prone" ? "prone" : "standing",
  };
  const scale = source.system.scale;
  source.system.scale =
    Number.isSafeInteger(scale) && Number(scale) >= 0 && Number(scale) <= 6
      ? Number(scale)
      : 0;
}

export const addMovementAndScaleMigration: Migration = Object.freeze({
  name: "Add personal movement posture and Second Edition scale rank",
  updateActor: addMovementAndScale,
  version: 14,
});
