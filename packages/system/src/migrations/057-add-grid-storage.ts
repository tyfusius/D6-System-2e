import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

const STORAGE_ACTOR_TYPES = new Set([
  "character",
  "creature",
  "npc",
  "starship",
  "vehicle",
  "storage-location",
]);

const STORAGE_ITEM_TYPES = new Set([
  "armor",
  "cybernetic",
  "gear",
  "starship-gear",
  "starship-weapon",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addGridStorageActorDefaults(source: ActorSource): void {
  if (!STORAGE_ACTOR_TYPES.has(source.type)) return;
  const current = record(source.system.storage);
  source.system.storage = {
    version: 1,
    configured: false,
    publicSummary: "none",
    ...current,
  };
}

export function addGridStorageItemDefaults(source: ItemSource): void {
  if (!STORAGE_ITEM_TYPES.has(source.type)) return;
  const currentPhysical = record(source.system.storagePhysical);
  const currentStack = record(currentPhysical.stack);
  const currentInterior = record(source.system.storageInterior);
  source.system.storageInstanceId =
    typeof source.system.storageInstanceId === "string"
      ? source.system.storageInstanceId
      : "";
  source.system.storagePhysical = {
    version: 1,
    provenance: "unknown",
    presetId: "",
    widthMm: null,
    depthMm: null,
    heightMm: null,
    unitTareWeightGrams: null,
    unitExteriorVolumeMillilitres: null,
    rotatable: true,
    footprintsByScale: {},
    ...currentPhysical,
    stack: {
      mode: "single",
      maxQuantityPerPlacement: 1,
      ...currentStack,
    },
  };
  source.system.storageInterior = {
    version: 1,
    configured: false,
    label: "",
    scaleId: "",
    scaleLabel: "",
    columns: 1,
    rows: 1,
    cellWidthMm: 100,
    cellDepthMm: 100,
    maxAggregateWeightGrams: null,
    maxOccupiedVolumeMillilitres: null,
    maxDirectChildren: null,
    access: "open",
    ...currentInterior,
  };
}

export const addGridStorageMigration: Migration = Object.freeze({
  name: "Add explicit grid storage metadata without placing legacy inventory",
  updateActor: addGridStorageActorDefaults,
  updateItem: addGridStorageItemDefaults,
  version: 57,
});
