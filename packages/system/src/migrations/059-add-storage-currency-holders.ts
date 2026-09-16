import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";
import { isD6EquipmentItemType } from "../equipment-item-types";

const ROOT_HOLDER_TYPES = new Set(["vehicle", "starship", "storage-location"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addStorageRootCurrencyHolder(source: ActorSource): void {
  if (!ROOT_HOLDER_TYPES.has(source.type)) return;
  if (Object.hasOwn(source.system, "currencyWallet")) return;
  source.system.currencyWallet = {};
}

export function addContainerCurrencyHolder(source: ItemSource): void {
  if (
    !isD6EquipmentItemType(source.type) ||
    record(source.system.storageInterior).configured !== true ||
    Object.hasOwn(source.system, "currencyWallet")
  )
    return;
  source.system.currencyWallet = {};
}

export const addStorageCurrencyHoldersMigration: Migration = Object.freeze({
  name: "Add currency holders to configured storage roots and containers",
  updateActor: addStorageRootCurrencyHolder,
  updateItem: addContainerCurrencyHolder,
  version: 59,
});
