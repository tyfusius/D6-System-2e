import { isD6EquipmentItemType } from "../../equipment-item-types";

export function persistsEquipmentFieldsImmediately(itemType: string): boolean {
  return isD6EquipmentItemType(itemType);
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
): Record<string, unknown> {
  return {
    [fieldName]: value,
    ...(fieldName === "system.damageBasis"
      ? { "flags.d6-system-2e.damageBasisAuthored": true }
      : {}),
  };
}
