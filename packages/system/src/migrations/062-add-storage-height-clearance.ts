import type { ItemSource, Migration } from "@d6-system-2e/core";
import { D6_EQUIPMENT_ITEM_TYPES } from "../equipment-item-types.js";

export function addStorageHeightClearance(source: ItemSource): void {
  if (!D6_EQUIPMENT_ITEM_TYPES.includes(source.type)) return;
  const interior = source.system.storageInterior;
  if (!interior || typeof interior !== "object" || Array.isArray(interior))
    return;
  if (!Object.hasOwn(interior, "interiorHeightMm"))
    (interior as Record<string, unknown>).interiorHeightMm = null;
}

export const addStorageHeightClearanceMigration: Migration = Object.freeze({
  name: "Add optional interior height clearance without changing existing packing",
  version: 62,
  updateItem: addStorageHeightClearance,
});
