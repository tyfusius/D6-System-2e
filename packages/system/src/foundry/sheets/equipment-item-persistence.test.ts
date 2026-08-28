import { describe, expect, it } from "vitest";
import {
  equipmentFieldUpdate,
  equipmentFieldRequiresRerender,
  persistsEquipmentFieldsImmediately,
} from "./equipment-item-persistence";

describe("equipment Item persistence", () => {
  it("persists actor-owned personal Weapon fields immediately", () => {
    expect(persistsEquipmentFieldsImmediately("weapon")).toBe(true);
    expect(persistsEquipmentFieldsImmediately("skill")).toBe(false);
  });

  it("rerenders a Weapon after a conditional profile field changes", () => {
    expect(equipmentFieldRequiresRerender("system.weaponKind")).toBe(true);
    expect(equipmentFieldRequiresRerender("system.damageBasis")).toBe(true);
    expect(equipmentFieldRequiresRerender("system.range.shortMinimum")).toBe(
      false,
    );
  });

  it("records explicit Damage-basis authorship without changing unrelated fields", () => {
    expect(
      equipmentFieldUpdate("system.damageBasis", "strength-damage"),
    ).toEqual({
      "flags.d6-system-2e.damageBasisAuthored": true,
      "system.damageBasis": "strength-damage",
    });
    expect(equipmentFieldUpdate("system.damage", 15)).toEqual({
      "system.damage": 15,
    });
  });
});
