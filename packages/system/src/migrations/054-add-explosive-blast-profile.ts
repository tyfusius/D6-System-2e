import type { ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const EMPTY_ZONES = Object.freeze(
  [1, 2, 3, 4].map((index) =>
    Object.freeze({ damageScore: 0, index, radiusMeters: 0 }),
  ),
);

export function addExplosiveBlastProfile(source: ItemSource): void {
  if (source.type !== "weapon") return;
  const current = record(source.system.blast);
  const zones = Array.isArray(current?.zones)
    ? current.zones
    : structuredClone(EMPTY_ZONES);
  source.system.blast = {
    activeZoneCount: current?.activeZoneCount === 4 ? 4 : 3,
    damageKind: current?.damageKind === "stun" ? "stun" : "physical",
    damageMode: current?.damageMode === "per-zone" ? "per-zone" : "falloff",
    detonationTiming:
      current?.detonationTiming === "end-of-round"
        ? "end-of-round"
        : "immediate",
    zones,
  };
}

export const addExplosiveBlastProfileMigration: Migration = Object.freeze({
  name: "Add authored thrown-explosive blast profile",
  updateItem: addExplosiveBlastProfile,
  version: 54,
});
