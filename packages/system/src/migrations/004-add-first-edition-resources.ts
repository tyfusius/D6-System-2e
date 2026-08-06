import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function resource(
  resources: Record<string, unknown>,
  key: string,
  initial: number,
): void {
  const existing = record(resources[key]);
  if (existing && Number.isSafeInteger(existing.value)) return;
  resources[key] = { ...(existing ?? {}), value: initial };
}

export function addFirstEditionResourceFields(source: ActorSource): void {
  if (source.type !== "character") return;
  const existing = record(source.system.resources);
  const resources = existing ?? {};
  resource(resources, "characterPoints", 5);
  resource(resources, "fatePoints", 1);
  if (!existing) source.system.resources = resources;
}

export const addFirstEditionResourcesMigration: Migration = Object.freeze({
  name: "Add latent First Edition meta-currency resource fields",
  updateActor: addFirstEditionResourceFields,
  version: 4,
});
