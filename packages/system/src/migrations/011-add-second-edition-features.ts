import type { ItemSource, Migration } from "@d6-system-2e/core";

const RANKED_FEATURE_TYPES = new Set(["flaw", "perk", "talent"]);
const NARRATIVE_FEATURE_TYPES = new Set(["asset", "trouble"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function integer(value: unknown, fallback: number, minimum = 0): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
    ? Number(value)
    : fallback;
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function addSource(
  system: Record<string, unknown>,
  module: string,
  page: number,
): void {
  const source = record(system.source) ?? {};
  source.book = string(source.book, "D6 System: Second Edition");
  source.module = string(source.module, module);
  source.page = integer(source.page, page);
  system.source = source;
}

export function addSecondEditionFeatureFields(source: ItemSource): void {
  if (RANKED_FEATURE_TYPES.has(source.type)) {
    source.system.focus = string(source.system.focus);
    source.system.rank = integer(source.system.rank, 1, 1);
    addSource(source.system, "Perks, Flaws & Talents", 101);
    if (source.type === "talent") {
      source.system.cost = integer(source.system.cost, 0);
      source.system.repeatable =
        typeof source.system.repeatable === "boolean"
          ? source.system.repeatable
          : false;
    }
    return;
  }
  if (!NARRATIVE_FEATURE_TYPES.has(source.type)) return;
  source.system.trigger = string(source.system.trigger);
  addSource(
    source.system,
    "Troubles and Assets",
    source.type === "asset" ? 131 : 130,
  );
}

export const addSecondEditionFeaturesMigration: Migration = Object.freeze({
  name: "Add Second Edition character feature Item families",
  updateItem: addSecondEditionFeatureFields,
  version: 11,
});
