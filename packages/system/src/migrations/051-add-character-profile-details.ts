import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function addCharacterProfileDetails(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const system = record(source.system);
  const profile = record(system.profile);
  source.system = {
    ...system,
    profile: {
      ...profile,
      age: text(profile.age),
      background: text(profile.background) || text(system.biography),
      gender: text(profile.gender),
      height: text(profile.height),
      personality: text(profile.personality),
      physicalDescription: text(profile.physicalDescription),
      weight: text(profile.weight),
    },
  };
}

export const addCharacterProfileDetailsMigration: Migration = Object.freeze({
  name: "Add character profile details",
  updateActor: addCharacterProfileDetails,
  version: 51,
});
