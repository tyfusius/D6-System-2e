import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positiveInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function addBestiaryProvenance(source: ActorSource): void {
  if (source.type !== "creature") return;
  const bestiary = record(source.system.bestiary) ?? {};
  source.system.bestiary = {
    applied: bestiary.applied === true,
    catalogId: text(bestiary.catalogId),
    entryId: text(bestiary.entryId),
    label: text(bestiary.label),
    ownerId: text(bestiary.ownerId),
    sourceBook: text(bestiary.sourceBook),
    sourcePage: positiveInteger(bestiary.sourcePage),
    version: positiveInteger(bestiary.version),
  };
}

export const addBestiaryProvenanceMigration: Migration = Object.freeze({
  name: "Add creature bestiary provenance",
  updateActor: addBestiaryProvenance,
  version: 28,
});
