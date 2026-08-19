import { describe, expect, it } from "vitest";
import {
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
});
