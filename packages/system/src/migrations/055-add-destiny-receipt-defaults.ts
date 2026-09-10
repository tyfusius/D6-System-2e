import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function flags(source: ActorSource | ItemSource): Record<string, unknown> {
  const flags = record(source.flags);
  const system = record(flags["d6-system-2e"]);
  flags["d6-system-2e"] = system;
  source.flags = flags;
  return system;
}
export function addDestinyActorDefaults(source: ActorSource): void {
  const system = flags(source);
  // Existing or future receipts are never discarded by migration.
  system.destinyConsequences ??= {};
  system.destinyDamage ??= {};
  system.destinyFrameworkEdits ??= {};
}
export function addDestinyTalentDefaults(source: ItemSource): void {
  if (source.type !== "talent") return;
  const system = flags(source);
  system.destinyCost ??= { version: 1, enabled: false, cost: 1 };
}
export const addDestinyReceiptDefaultsMigration: Migration = Object.freeze({
  version: 55,
  name: "Initialize optional Destiny Talent cost and consequence receipt defaults",
  updateActor: addDestinyActorDefaults,
  updateItem: addDestinyTalentDefaults,
});
