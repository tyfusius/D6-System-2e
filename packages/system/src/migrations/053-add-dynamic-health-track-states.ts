import {
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  healthTrackStorageKey,
  type ActorSource,
  type Migration,
} from "@d6-system-2e/core";

export const CONDITION_MODEL_ID = "d6e2.health.condition-track" as const;
export const WOUND_MODEL_ID = "open-d6.health.wound-track" as const;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addDynamicHealthTrackStates(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health);
  const tracks = structuredClone(record(health.tracks));
  const conditionStorageKey = healthTrackStorageKey(CONDITION_MODEL_ID);
  if (
    !record(tracks[conditionStorageKey] ?? tracks[CONDITION_MODEL_ID]).stateId
  ) {
    tracks[conditionStorageKey] = {
      stateId: isSecondEditionCondition(health.condition)
        ? health.condition
        : "healthy",
    };
  }
  const woundStorageKey = healthTrackStorageKey(WOUND_MODEL_ID);
  if (!record(tracks[woundStorageKey] ?? tracks[WOUND_MODEL_ID]).stateId) {
    tracks[woundStorageKey] = {
      stateId: isFirstEditionWoundLevel(health.firstEditionWound)
        ? health.firstEditionWound
        : "healthy",
    };
  }
  source.system.health = { ...health, tracks };
}

export const addDynamicHealthTrackStatesMigration: Migration = Object.freeze({
  name: "Add per-model personal health track states",
  updateActor: addDynamicHealthTrackStates,
  version: 53,
});
