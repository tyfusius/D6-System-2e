import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function whole(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(0, number) : 0;
}

export function addSuperheroicRelationships(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const creation = record(source.system.creation);
  source.system.creation = {
    ...creation,
    sidekick: creation.sidekick === true,
  };
  const superheroic = record(source.system.superheroic);
  const relationships = record(superheroic.relationships);
  source.system.superheroic = {
    ...superheroic,
    relationships: {
      companionName: text(relationships.companionName),
      companionNotes: text(relationships.companionNotes),
      heroActorId: text(relationships.heroActorId),
      mentorActorId: text(relationships.mentorActorId),
      nemesisActive: relationships.nemesisActive === true,
      nemesisEncounter: whole(relationships.nemesisEncounter),
      nemesisExperience: whole(relationships.nemesisExperience),
      nemesisPoints: whole(relationships.nemesisPoints),
      nemesisScope:
        relationships.nemesisScope === "group" ? "group" : "individual",
      notes: text(relationships.notes),
      sidekickActive: relationships.sidekickActive === true,
      sidekickRequirementsConfirmed:
        relationships.sidekickRequirementsConfirmed === true,
      sidekickStatus: ["active", "independent", "removed"].includes(
        text(relationships.sidekickStatus),
      )
        ? text(relationships.sidekickStatus)
        : "active",
    },
  };
}

export const addSuperheroicRelationshipsMigration: Migration = Object.freeze({
  name: "Add Nemesis, Companion, and Sidekick relationships",
  updateActor: addSuperheroicRelationships,
  version: 37,
});
