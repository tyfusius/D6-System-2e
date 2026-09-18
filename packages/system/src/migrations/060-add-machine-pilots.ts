import type { ActorSource, Migration } from "@d6-system-2e/core";

/** Never infer a pilot from roster order or duplicate an existing crew member. */
export function addMachinePilot(source: ActorSource): void {
  if (!["vehicle", "starship"].includes(source.type)) return;
  const value = source.system.crew;
  const crew =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  source.system.crew = crew;
  for (const key of ["pilotActorId", "pilotSkillId", "pilotAttributeId"]) {
    if (!Object.hasOwn(crew, key)) crew[key] = "";
  }
}

export const addMachinePilotMigration: Migration = Object.freeze({
  name: "Add explicit machine pilot and skill or attribute selection",
  version: 60,
  updateActor: addMachinePilot,
});
