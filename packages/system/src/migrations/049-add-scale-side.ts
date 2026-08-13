import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

export type PersistedScaleSide = "human" | "larger" | "smaller" | "unresolved";

const SIDES = new Set<PersistedScaleSide>([
  "human",
  "larger",
  "smaller",
  "unresolved",
]);

function magnitude(source: ActorSource | ItemSource): number {
  const value = source.system.scale;
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

function existingSide(value: unknown): PersistedScaleSide | undefined {
  return typeof value === "string" && SIDES.has(value as PersistedScaleSide)
    ? (value as PersistedScaleSide)
    : undefined;
}

export function addActorScaleSide(source: ActorSource): void {
  const value = magnitude(source);
  const existing = existingSide(source.system.scaleSide);
  if (value === 0) {
    source.system.scaleSide = "human";
    return;
  }
  if (existing && existing !== "human") return;
  if (source.type === "vehicle" || source.type === "starship")
    source.system.scaleSide = "larger";
  else source.system.scaleSide = "unresolved";
}

export function addItemScaleSide(source: ItemSource): void {
  const value = magnitude(source);
  const existing = existingSide(source.system.scaleSide);
  if (value === 0) {
    source.system.scaleSide = "human";
    return;
  }
  if (existing && existing !== "human") return;
  if (source.type === "vehicle-weapon" || source.type === "starship-weapon")
    source.system.scaleSide = "larger";
  else source.system.scaleSide = "unresolved";
}

export const addScaleSideMigration: Migration = Object.freeze({
  name: "Add Open D6 scalar scale side",
  updateActor: addActorScaleSide,
  updateItem: addItemScaleSide,
  version: 49,
});
