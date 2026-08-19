import type { ItemSource, Migration } from "@d6-system-2e/core";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function addConfigurableWeaponDamageBase(source: ItemSource): void {
  if (source.type !== "weapon") return;
  source.system.damageAttributeId = text(source.system.damageAttributeId);
  source.system.damageSkillKey = text(source.system.damageSkillKey);
  source.system.damageBasis = [
    "attribute-skill",
    "fixed",
    "strength-damage",
  ].includes(text(source.system.damageBasis))
    ? source.system.damageBasis
    : "fixed";
}

export const addConfigurableWeaponDamageBaseMigration: Migration =
  Object.freeze({
    name: "Add configurable personal Weapon damage base",
    updateItem: addConfigurableWeaponDamageBase,
    version: 52,
  });
