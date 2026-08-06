import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addSpecializationAllocation(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const creation = record(source.system.creation) ?? {};
  if (
    creation.specializationSlots === 0 ||
    creation.specializationSlots === 3
  ) {
    return;
  }
  const items = Array.isArray(source.items) ? source.items : [];
  const hasSpecialization = items.some(
    (item) => record(item)?.type === "specialization",
  );
  source.system.creation = {
    ...creation,
    specializationSlots: hasSpecialization ? 3 : 0,
  };
}

export const addSpecializationAllocationMigration: Migration = Object.freeze({
  name: "Add explicit character-creation Specialization allocation",
  updateActor: addSpecializationAllocation,
  version: 12,
});
