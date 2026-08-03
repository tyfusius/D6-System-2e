import type { ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addTemplateContainerContracts(source: ItemSource): void {
  if (!["item-group", "species-template"].includes(source.type)) return;
  const system = record(source.system);
  const rulesFamily = [
    "both",
    "d6-system-second-edition",
    "open-d6-first-edition",
  ].includes(String(system.rulesFamily))
    ? system.rulesFamily
    : "both";
  source.system = {
    ...system,
    members: Array.isArray(system.members) ? system.members : [],
    rulesFamily,
    ...(source.type === "item-group"
      ? {
          actorTypes: Array.isArray(system.actorTypes)
            ? system.actorTypes
            : ["character", "creature", "npc"],
        }
      : {
          attributeBounds: Array.isArray(system.attributeBounds)
            ? system.attributeBounds
            : [],
        }),
  };
}

export const addTemplateContainerContractsMigration: Migration = Object.freeze({
  name: "Add stable species-template and Item-group contracts",
  updateItem: addTemplateContainerContracts,
  version: 40,
});
