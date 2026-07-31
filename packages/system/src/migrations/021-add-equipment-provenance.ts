import type { ItemSource, Migration } from "@d6-system-2e/core";

const EQUIPMENT_TYPES = new Set([
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

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addEquipmentProvenance(source: ItemSource): void {
  if (!EQUIPMENT_TYPES.has(source.type)) return;
  const existing = record(source.system.equipmentProvenance) ?? {};
  const era = ["none", "medieval", "modern", "science-fiction"].includes(
    String(existing.era),
  )
    ? String(existing.era)
    : "none";
  source.system.equipmentProvenance = {
    ...existing,
    catalogId: typeof existing.catalogId === "string" ? existing.catalogId : "",
    catalogVersion: Number.isSafeInteger(existing.catalogVersion)
      ? Math.max(0, Number(existing.catalogVersion))
      : 0,
    entryId: typeof existing.entryId === "string" ? existing.entryId : "",
    era,
    ownerId: typeof existing.ownerId === "string" ? existing.ownerId : "",
    sourceBook:
      typeof existing.sourceBook === "string" ? existing.sourceBook : "",
    sourcePage: Number.isSafeInteger(existing.sourcePage)
      ? Math.max(0, Number(existing.sourcePage))
      : 0,
  };
}

export const addEquipmentProvenanceMigration: Migration = Object.freeze({
  name: "Add equipment era and catalog provenance",
  updateItem: addEquipmentProvenance,
  version: 21,
});
