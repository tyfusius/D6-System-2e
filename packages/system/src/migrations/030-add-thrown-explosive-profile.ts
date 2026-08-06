import type { ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addThrownExplosiveProfile(source: ItemSource): void {
  if (source.type !== "weapon") return;
  source.system.weaponKind =
    source.system.weaponKind === "thrown-explosive"
      ? "thrown-explosive"
      : "standard";
  const range = record(source.system.range) ?? {};
  range.shortMinimum = Number.isFinite(Number(range.shortMinimum))
    ? Math.max(0, Number(range.shortMinimum))
    : 0;
  source.system.range = range;
}

export const addThrownExplosiveProfileMigration: Migration = Object.freeze({
  name: "Add thrown-explosive weapon profile",
  updateItem: addThrownExplosiveProfile,
  version: 30,
});
