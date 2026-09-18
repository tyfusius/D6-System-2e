import { isD6EquipmentItemType } from "./equipment-item-types.js";

export function itemStorageCapability(item: {
  readonly type: string;
  readonly system: Readonly<Record<string, unknown>>;
}): { supported: boolean; inherent: boolean; enabled: boolean } {
  const supported = isD6EquipmentItemType(item.type);
  const inherent =
    supported &&
    item.type === "gear" &&
    item.system.gearCategory === "container";
  const interior = item.system.storageInterior as
    { configured?: boolean } | undefined;
  return {
    supported,
    inherent,
    enabled:
      supported &&
      (inherent ||
        item.system.hasStorage === true ||
        interior?.configured === true),
  };
}
