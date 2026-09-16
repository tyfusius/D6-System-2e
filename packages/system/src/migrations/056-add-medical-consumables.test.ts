import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import { MODEL_B_STIM_EFFECT_ID } from "@d6-system-2e/core";
import {
  addMedicalCharacterDefaults,
  addMedicalGearDefaults,
} from "./056-add-medical-consumables";

describe("migration 056 medical consumables", () => {
  it("adds unknown physiology and a non-sensitive empty public marker idempotently", () => {
    const actor = { type: "character", system: {}, items: [] } as ActorSource;
    addMedicalCharacterDefaults(actor);
    const first = structuredClone(actor);
    addMedicalCharacterDefaults(actor);
    expect(actor).toEqual(first);
    expect(actor.system.medical).toEqual({
      physiology: { kind: "unknown", revision: 0, source: "world" },
      stim: { version: 0, useId: "", effectId: "", status: "none" },
    });
  });

  it("adds fixed Model B structure without classifying ordinary gear as medical", () => {
    const gear = { type: "gear", system: { quantity: 2 } } as ItemSource;
    addMedicalGearDefaults(gear);
    expect(gear.system).toMatchObject({
      gearCategory: "general",
      medicalConsumable: {
        version: 1,
        effectId: MODEL_B_STIM_EFFECT_ID,
        compatibility: "biological",
        treatmentFamily: "none",
        duration: { dice: 1, faces: 6, unit: "rounds" },
        actionCost: 1,
        doseCost: 1,
      },
      quantity: 2,
    });
  });
});
