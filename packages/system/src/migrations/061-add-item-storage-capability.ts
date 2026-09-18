import type { ItemSource, Migration } from "@d6-system-2e/core";
import { itemStorageCapability } from "../item-storage-capability.js";

export function addItemStorageCapability(source: ItemSource): void {
  const capability = itemStorageCapability(source);
  if (!capability.supported) return;
  const migration = source.system._migration as { schema?: number } | undefined;
  // Foundry may hydrate the new false default before a pre-61 source is migrated.
  const oldHydratedContainer =
    capability.enabled &&
    typeof migration?.schema === "number" &&
    migration.schema < 61;
  if (Object.hasOwn(source.system, "hasStorage") && !oldHydratedContainer)
    return;
  source.system.hasStorage = capability.enabled;
}

export const addItemStorageCapabilityMigration: Migration = Object.freeze({
  name: "Add explicit item storage capability without changing existing interiors",
  version: 61,
  updateItem: addItemStorageCapability,
});
