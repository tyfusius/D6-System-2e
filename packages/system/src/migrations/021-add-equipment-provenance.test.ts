import { describe, expect, it } from "vitest";
import { addEquipmentProvenance } from "./021-add-equipment-provenance";

describe("schema 21 equipment provenance", () => {
  it("adds a loss-preserving unclassified provenance record", () => {
    const item = {
      system: { equipmentProvenance: { retained: true } },
      type: "gear",
    };
    addEquipmentProvenance(item);
    expect(item.system.equipmentProvenance).toMatchObject({
      catalogId: "",
      catalogVersion: 0,
      era: "none",
      retained: true,
    });
  });

  it("preserves valid catalog data and ignores non-equipment", () => {
    const weapon = {
      system: {
        equipmentProvenance: {
          catalogId: "genre.weapons",
          catalogVersion: 2,
          entryId: "example",
          era: "science-fiction",
          ownerId: "genre",
          sourceBook: "Licensed Source",
          sourcePage: 42,
        },
      },
      type: "weapon",
    };
    addEquipmentProvenance(weapon);
    expect(weapon.system.equipmentProvenance).toMatchObject({
      catalogId: "genre.weapons",
      era: "science-fiction",
      sourcePage: 42,
    });
    const skill = { system: {}, type: "skill" };
    addEquipmentProvenance(skill);
    expect(skill.system).toEqual({});
  });
});
