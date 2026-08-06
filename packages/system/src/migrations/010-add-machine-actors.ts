import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function integer(value: unknown, fallback: number, minimum = 0): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
    ? Number(value)
    : fallback;
}

function score(
  parent: Record<string, unknown>,
  key: string,
  fallback: number,
): void {
  const current = record(parent[key]) ?? {};
  current.score = integer(current.score, fallback);
  parent[key] = current;
}

function addCondition(system: Record<string, unknown>): void {
  const health = record(system.health) ?? {};
  if (typeof health.condition !== "string") health.condition = "healthy";
  system.health = health;
}

export function addMachineActorFields(source: ActorSource): void {
  if (source.type === "creature") {
    const defenses = record(source.system.defenses) ?? {};
    defenses.dodgeOverride = integer(defenses.dodgeOverride, 0);
    defenses.parryOverride = integer(defenses.parryOverride, 0);
    source.system.defenses = defenses;
    return;
  }
  if (!["starship", "vehicle"].includes(source.type)) return;

  const attributes = record(source.system.attributes) ?? {};
  score(attributes, "hull", 3);
  score(attributes, "maneuverability", 3);
  if (source.type === "starship") {
    score(attributes, "engines", 3);
    score(attributes, "navicomp", 3);
    const crew = record(source.system.crew) ?? {};
    crew.minimum = integer(crew.minimum, 1, 1);
    source.system.crew = crew;
    const shields = record(source.system.shields) ?? {};
    shields.score = integer(shields.score, 0);
    source.system.shields = shields;
  } else {
    const armor = record(source.system.armor) ?? {};
    armor.score = integer(armor.score, 0);
    source.system.armor = armor;
    source.system.passengers = integer(source.system.passengers, 0);
  }
  source.system.attributes = attributes;
  source.system.biography =
    typeof source.system.biography === "string" ? source.system.biography : "";
  source.system.scale = integer(source.system.scale, 0);
  addCondition(source.system);
}

export function addMachineWeaponFields(source: ItemSource): void {
  if (!["starship-weapon", "vehicle-weapon"].includes(source.type)) return;
  source.system.attackBonus = integer(source.system.attackBonus, 0);
}

export const addMachineActorsMigration: Migration = Object.freeze({
  name: "Add vehicle, starship, and creature defense data",
  updateActor: addMachineActorFields,
  updateItem: addMachineWeaponFields,
  version: 10,
});
