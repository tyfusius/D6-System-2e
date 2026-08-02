import type { ItemSource, Migration } from "@d6-system-2e/core";

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0,
      ),
    ),
  ];
}

function snapshots(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const source = candidate as Record<string, unknown>;
    const sourceItemId =
      typeof source.sourceItemId === "string" ? source.sourceItemId.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    if (!sourceItemId || !name) return [];
    const totalCost = Number.isSafeInteger(source.totalCost)
      ? Math.max(1, Number(source.totalCost))
      : 1;
    return [
      {
        automatic: source.automatic === true,
        name,
        sourceItemId,
        totalCost,
      },
    ];
  });
}

export function addSuperheroicEquipmentFields(source: ItemSource): void {
  if (source.type !== "gear") return;
  const kind = source.system.superheroicEquipmentKind;
  source.system.superheroicEquipmentKind = ["gadget", "gear"].includes(
    String(kind),
  )
    ? kind
    : "none";
  const state = source.system.superheroicEquipmentState;
  source.system.superheroicEquipmentState = [
    "malfunctioning",
    "destroyed",
  ].includes(String(state))
    ? state
    : "ready";
  source.system.gadgetTargetKind =
    source.system.gadgetTargetKind === "attribute" ? "attribute" : "skill";
  source.system.gadgetTargetId =
    typeof source.system.gadgetTargetId === "string"
      ? source.system.gadgetTargetId
      : "";
  source.system.gadgetUseCase =
    typeof source.system.gadgetUseCase === "string"
      ? source.system.gadgetUseCase
      : "";
  source.system.superheroicCreatorActorId =
    typeof source.system.superheroicCreatorActorId === "string"
      ? source.system.superheroicCreatorActorId
      : "";
  source.system.superheroicPowerTalentIds = strings(
    source.system.superheroicPowerTalentIds,
  );
  source.system.superheroicPowerSnapshots = snapshots(
    source.system.superheroicPowerSnapshots,
  );
  source.system.superheroicRebuildDisabled =
    source.system.superheroicRebuildDisabled === true;
}

export const addSuperheroicEquipmentMigration: Migration = Object.freeze({
  name: "Add superheroic Gadgets and Gear state",
  updateItem: addSuperheroicEquipmentFields,
  version: 35,
});
