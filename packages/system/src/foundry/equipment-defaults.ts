import { exactLegacyCurrencyValue } from "@d6-system-2e/core";
import { currentCurrencyDefinition } from "./currency-state";
import {
  LEGACY_CURRENCY_DEFINITION,
  mutableCurrencyDocumentSource,
} from "../migrations/058-add-currency-denominations";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import { stringSetting } from "../settings/setting-values";

const EQUIPMENT_TYPES = new Set([
  "armor",
  "cybernetic",
  "gear",
  "starship-gear",
  "starship-weapon",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function preservedDocumentSource(source: Record<string, unknown>): boolean {
  const stats = record(source._stats);
  return (
    [stats.compendiumSource, stats.duplicateSource].some(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) || Object.keys(record(stats.exportSource)).length > 0
  );
}

function selectedEquipmentEra(): string {
  const selected = stringSetting(
    SECOND_EDITION_OPTION_KEYS.equipmentEra,
    "none",
  );
  return ["medieval", "modern", "science-fiction"].includes(selected)
    ? selected
    : "none";
}

export function initializeEquipmentProvenance(
  document: unknown,
  source: unknown,
): void {
  if (
    typeof source !== "object" ||
    source === null ||
    !("type" in source) ||
    typeof source.type !== "string" ||
    !EQUIPMENT_TYPES.has(source.type) ||
    !("updateSource" in (document as object)) ||
    typeof (document as FoundrySourceDocument).updateSource !== "function"
  ) {
    return;
  }
  const system =
    "system" in source &&
    typeof source.system === "object" &&
    source.system !== null
      ? (source.system as Record<string, unknown>)
      : {};
  if (system.equipmentProvenance !== undefined) return;
  (document as FoundrySourceDocument).updateSource({
    "system.equipmentProvenance": {
      catalogId: "",
      catalogVersion: 0,
      entryId: "",
      era: selectedEquipmentEra(),
      ownerId: "",
      sourceBook: "",
      sourcePage: 0,
    },
  });
}

/** Initialize only a genuinely new equipment price. Explicit and imported
 * sources retain their historical value system until reviewed migration. */
export function initializeEquipmentCurrencyValue(
  document: unknown,
  sourceValue: unknown,
  optionsValue: unknown = {},
): void {
  const source = record(sourceValue);
  const sourceType = typeof source.type === "string" ? source.type : "";
  if (
    !EQUIPMENT_TYPES.has(sourceType) ||
    !document ||
    typeof document !== "object" ||
    !("updateSource" in document) ||
    typeof (document as FoundrySourceDocument).updateSource !== "function"
  )
    return;
  const system = record(source.system);
  if (Object.keys(record(system.currencyValue)).length > 0) return;
  const options = record(optionsValue);
  const historical =
    preservedDocumentSource(source) ||
    options.d6System2eMigration === true ||
    (Object.hasOwn(system, "value") && system.value !== 0);
  const initializedSystem = record(
    (document as { readonly system?: unknown }).system,
  );
  const rawValue = Object.hasOwn(system, "value")
    ? system.value
    : initializedSystem.value;
  const definition = historical
    ? LEGACY_CURRENCY_DEFINITION
    : currentCurrencyDefinition();
  (document as FoundrySourceDocument).updateSource({
    "system.currencyValue": mutableCurrencyDocumentSource(
      exactLegacyCurrencyValue(definition, rawValue ?? 0),
    ),
  });
}

export function registerEquipmentDefaults(): void {
  Hooks.on(
    "preCreateItem",
    (document: unknown, source: unknown, options: unknown) => {
      initializeEquipmentProvenance(document, source);
      initializeEquipmentCurrencyValue(document, source, options);
    },
  );
}
