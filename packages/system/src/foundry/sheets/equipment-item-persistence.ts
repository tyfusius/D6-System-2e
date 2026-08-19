const IMMEDIATE_EQUIPMENT_ITEM_TYPES = new Set([
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

export function persistsEquipmentFieldsImmediately(itemType: string): boolean {
  return IMMEDIATE_EQUIPMENT_ITEM_TYPES.has(itemType);
}

export function equipmentFieldRequiresRerender(fieldName: string): boolean {
  return (
    fieldName === "system.superheroicEquipmentKind" ||
    fieldName === "system.damageBasis" ||
    fieldName === "system.weaponKind"
  );
}
