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

export function registerEquipmentDefaults(): void {
  Hooks.on("preCreateItem", initializeEquipmentProvenance);
}
