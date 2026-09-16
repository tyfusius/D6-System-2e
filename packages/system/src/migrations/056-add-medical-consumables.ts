import {
  MODEL_B_STIM_EFFECT_ID,
  type ActorSource,
  type ItemSource,
  type Migration,
} from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function addMedicalCharacterDefaults(source: ActorSource): void {
  if (source.type !== "character" && source.type !== "creature") return;
  const current = record(source.system.medical);
  const physiology = record(current.physiology);
  const marker = record(current.stim);
  const kind = ["biological", "mechanical", "unknown"].includes(
    String(physiology.kind),
  )
    ? physiology.kind
    : "unknown";
  source.system.medical = {
    physiology: {
      kind,
      revision:
        Number.isSafeInteger(physiology.revision) &&
        Number(physiology.revision) >= 0
          ? physiology.revision
          : 0,
      source: physiology.source === "world" ? "world" : "world",
    },
    stim:
      marker.version === 1 &&
      typeof marker.useId === "string" &&
      marker.useId.length > 0 &&
      marker.effectId === MODEL_B_STIM_EFFECT_ID &&
      (marker.status === "active" || marker.status === "needs-attention")
        ? {
            version: 1,
            useId: marker.useId,
            effectId: MODEL_B_STIM_EFFECT_ID,
            status: marker.status,
          }
        : { version: 0, useId: "", effectId: "", status: "none" },
  };
}

export function addMedicalGearDefaults(source: ItemSource): void {
  if (source.type !== "gear") return;
  const medical = record(source.system.medicalConsumable);
  source.system.gearCategory =
    source.system.gearCategory === "medical-consumable"
      ? "medical-consumable"
      : "general";
  source.system.medicalConsumable = {
    version: 1,
    effectId: MODEL_B_STIM_EFFECT_ID,
    compatibility: "biological",
    treatmentFamily: "none",
    duration: { dice: 1, faces: 6, unit: "rounds" },
    actionCost: 1,
    doseCost: 1,
    ...medical,
  };
}

export const addMedicalConsumablesMigration: Migration = Object.freeze({
  name: "Add explicit medical physiology and Model B consumable data",
  updateActor: addMedicalCharacterDefaults,
  updateItem: addMedicalGearDefaults,
  version: 56,
});
