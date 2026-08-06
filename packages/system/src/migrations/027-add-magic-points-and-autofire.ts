import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addMagicPointsResource(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const resources = record(source.system.resources) ?? {};
  const existing = record(resources.magicPoints);
  if (!existing || !Number.isSafeInteger(existing.value)) {
    resources.magicPoints = {
      ...(existing ?? {}),
      initialized: false,
      value: 0,
    };
  } else if (typeof existing.initialized !== "boolean") {
    existing.initialized = false;
  }
  source.system.resources = resources;
}

export function addAutofireRating(source: ItemSource): void {
  if (!["weapon", "vehicle-weapon", "starship-weapon"].includes(source.type)) {
    return;
  }
  source.system.autofireRating = Number.isSafeInteger(
    source.system.autofireRating,
  )
    ? Math.max(0, Number(source.system.autofireRating))
    : 0;
}

export const addMagicPointsAndAutofireMigration: Migration = Object.freeze({
  name: "Add Magic Points and autofire facts",
  updateActor: addMagicPointsResource,
  updateItem: addAutofireRating,
  version: 27,
});
