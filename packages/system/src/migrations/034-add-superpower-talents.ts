import type { ItemSource, Migration } from "@d6-system-2e/core";

function whole(value: unknown): number {
  return Number.isSafeInteger(value) ? Math.max(0, Number(value)) : 0;
}

export function addSuperpowerTalentFields(source: ItemSource): void {
  if (source.type !== "talent") return;
  source.system.superpower = source.system.superpower === true;
  source.system.superpowerAutomatic =
    source.system.superpowerAutomatic === true;
  source.system.superpowerEnhancementCost = whole(
    source.system.superpowerEnhancementCost,
  );
  source.system.superpowerLimitationCredit = whole(
    source.system.superpowerLimitationCredit,
  );
}

export const addSuperpowerTalentsMigration: Migration = Object.freeze({
  name: "Add custom Superpower Talent accounting",
  updateItem: addSuperpowerTalentFields,
  version: 34,
});
