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

/**
 * Preserve whether the current Damage basis came from explicit system
 * authoring. Legacy import evidence remains immutable, so a later edit needs a
 * separate marker instead of rewriting or guessing from that source record.
 */
export function equipmentFieldUpdate(
  fieldName: string,
  value: unknown,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    [fieldName]: value,
    ...(fieldName === "system.damageBasis"
      ? { "flags.d6-system-2e.damageBasisAuthored": true }
      : {}),
  });
}
