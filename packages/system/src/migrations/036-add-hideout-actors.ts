import type { ActorSource, Migration } from "@d6-system-2e/core";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function whole(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) ? Math.max(0, Number(value)) : fallback;
}

function members(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as Record<string, unknown>;
    const actorId = text(source.actorId).trim();
    if (!actorId) return [];
    return [{ actorId, name: text(source.name).trim() }];
  });
}

function features(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as Record<string, unknown>;
    const label = text(source.label).trim();
    if (!label) return [];
    return [
      {
        catalogId: text(source.catalogId).trim(),
        catalogVersion: whole(source.catalogVersion),
        description: text(source.description).trim(),
        featureId:
          text(source.featureId).trim() || `custom-${String(index + 1)}`,
        instanceId:
          text(source.instanceId).trim() || `feature-${String(index + 1)}`,
        label,
        sourceBook: text(source.sourceBook).trim(),
        sourcePage: whole(source.sourcePage),
      },
    ];
  });
}

export function addHideoutActorFields(source: ActorSource): void {
  if (source.type !== "hideout") return;
  const system = source.system;
  system.biography = text(system.biography);
  system.locationType = ["urban", "country", "wild", "custom"].includes(
    text(system.locationType),
  )
    ? system.locationType
    : "urban";
  system.locationDetails = text(system.locationDetails);
  system.ownershipKind =
    system.ownershipKind === "group" ? "group" : "individual";
  system.acquisition = ["gm-granted", "talent-purchased", "pooled"].includes(
    text(system.acquisition),
  )
    ? system.acquisition
    : "gm-granted";
  system.featureLimit = whole(system.featureLimit, 4);
  system.features = features(system.features);
  system.members = members(system.members);
  const relocation =
    system.relocation && typeof system.relocation === "object"
      ? (system.relocation as Record<string, unknown>)
      : {};
  system.relocation = {
    monthsCompleted: whole(relocation.monthsCompleted),
    monthsOverride: whole(relocation.monthsOverride),
    notes: text(relocation.notes),
    state: [
      "ready",
      "compromised",
      "destroyed",
      "relocating",
      "rebuilding",
    ].includes(text(relocation.state))
      ? relocation.state
      : "ready",
  };
}

export const addHideoutActorsMigration: Migration = Object.freeze({
  name: "Add Hidden Bases and Hideouts actors",
  updateActor: addHideoutActorFields,
  version: 36,
});
