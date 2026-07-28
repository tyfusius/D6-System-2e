import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addSecondEditionAdvancementFields(source: ActorSource): void {
  if (source.type !== "character") return;
  const resources = record(source.system.resources) ?? {};
  const experiencePoints = record(resources.experiencePoints);
  if (!experiencePoints || !Number.isSafeInteger(experiencePoints.value)) {
    resources.experiencePoints = {
      ...(experiencePoints ?? {}),
      value: 0,
    };
  }
  if (!record(source.system.resources)) source.system.resources = resources;
}

export const addSecondEditionAdvancementMigration: Migration = Object.freeze({
  name: "Add latent Second Edition advancement resources",
  updateActor: addSecondEditionAdvancementFields,
  version: 9,
});
