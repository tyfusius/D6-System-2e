export const D6_EQUIPMENT_ITEM_TYPES = Object.freeze([
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

const EQUIPMENT_ITEM_TYPES = new Set<string>(D6_EQUIPMENT_ITEM_TYPES);

export function isD6EquipmentItemType(itemType: string): boolean {
  return EQUIPMENT_ITEM_TYPES.has(itemType);
}
