import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addCompanionProfileFields(source: ActorSource): void {
  const system = record(source.system);
  if (["character", "creature", "npc"].includes(source.type)) {
    const profile = record(system.profile);
    profile.allegiance =
      typeof profile.allegiance === "string" ? profile.allegiance : "";
    profile.currency = Number.isSafeInteger(Number(profile.currency))
      ? Math.max(0, Number(profile.currency))
      : 0;
    source.system = { ...system, profile };
    return;
  }
  if (source.type !== "starship") return;
  system.interstellarDrive = Number.isFinite(Number(system.interstellarDrive))
    ? Math.max(0, Number(system.interstellarDrive))
    : 0;
  source.system = system;
}

export const addCompanionProfileFieldsMigration: Migration = Object.freeze({
  name: "Add generic companion profile fields",
  updateActor: addCompanionProfileFields,
  version: 43,
});
