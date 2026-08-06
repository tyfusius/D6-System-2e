import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addCharacterCreationState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const existing = record(source.system.creation);
  if (existing && typeof existing.active === "boolean") return;
  source.system.creation = { ...(existing ?? {}), active: false };
}

export function addSkillRelationshipFields(source: ItemSource): void {
  if (source.type === "skill") {
    if (!Array.isArray(source.system.prerequisiteSkillKeys)) {
      source.system.prerequisiteSkillKeys = [];
    }
    return;
  }
  if (source.type !== "specialization") return;
  if (!record(source.system.source)) {
    source.system.source = { book: "", module: "", page: 0 };
  }
}

export const addCharacterCreationAndSkillLinksMigration: Migration =
  Object.freeze({
    name: "Add character creation state and advanced skill relationships",
    updateActor: addCharacterCreationState,
    updateItem: addSkillRelationshipFields,
    version: 8,
  });
