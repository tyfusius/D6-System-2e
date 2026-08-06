import { describe, expect, it } from "vitest";
import { addSuperheroicEquipmentFields } from "./035-add-superheroic-equipment";

describe("schema 35 superheroic equipment", () => {
  it("normalizes personal Gear without inferring an opt-in kind", () => {
    const source = {
      type: "gear",
      system: {
        superheroicEquipmentKind: "unknown",
        superheroicEquipmentState: "malfunctioning",
        superheroicPowerSnapshots: [
          {
            automatic: true,
            name: "Custom Power",
            sourceItemId: "power-1",
            totalCost: 4,
          },
        ],
        superheroicPowerTalentIds: ["power-1", "power-1", ""],
      },
    };
    addSuperheroicEquipmentFields(source);
    expect(source.system).toMatchObject({
      gadgetTargetId: "",
      gadgetTargetKind: "skill",
      gadgetUseCase: "",
      superheroicCreatorActorId: "",
      superheroicEquipmentKind: "none",
      superheroicEquipmentState: "malfunctioning",
      superheroicPowerTalentIds: ["power-1"],
      superheroicRebuildDisabled: false,
    });
    expect(source.system.superheroicPowerSnapshots).toEqual([
      {
        automatic: true,
        name: "Custom Power",
        sourceItemId: "power-1",
        totalCost: 4,
      },
    ]);
  });

  it("does not add superheroic state to other equipment families", () => {
    const source = { type: "vehicle-gear", system: { quantity: 2 } };
    addSuperheroicEquipmentFields(source);
    expect(source.system).toEqual({ quantity: 2 });
  });
});
