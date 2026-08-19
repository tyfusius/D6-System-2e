import { describe, expect, it } from "vitest";
import { addConfigurableWeaponDamageBase } from "./052-add-configurable-weapon-damage-base";

describe("configurable personal Weapon damage base migration", () => {
  it("adds portable empty configuration while preserving existing damage modes", () => {
    const fixed = {
      system: { damage: 12, damageBasis: "fixed" },
      type: "weapon",
    };
    const strength = {
      system: { damage: 6, damageBasis: "strength-damage" },
      type: "weapon",
    };
    addConfigurableWeaponDamageBase(fixed);
    addConfigurableWeaponDamageBase(strength);
    expect(fixed.system).toMatchObject({
      damage: 12,
      damageAttributeId: "",
      damageBasis: "fixed",
      damageSkillKey: "",
    });
    expect(strength.system).toMatchObject({
      damageAttributeId: "",
      damageBasis: "strength-damage",
      damageSkillKey: "",
    });
  });

  it("preserves configured fields, is idempotent, and leaves machine weapons alone", () => {
    const personal = {
      system: {
        damageAttributeId: "knowledge",
        damageBasis: "attribute-skill",
        damageSkillKey: "demolitions",
      },
      type: "weapon",
    };
    const machine = {
      system: { damageBasis: "fixed", future: true },
      type: "vehicle-weapon",
    };
    addConfigurableWeaponDamageBase(personal);
    addConfigurableWeaponDamageBase(personal);
    addConfigurableWeaponDamageBase(machine);
    expect(personal.system).toEqual({
      damageAttributeId: "knowledge",
      damageBasis: "attribute-skill",
      damageSkillKey: "demolitions",
    });
    expect(machine.system).toEqual({ damageBasis: "fixed", future: true });
  });

  it("normalizes malformed personal Weapon fields without manufacturing a pool", () => {
    const source = {
      system: {
        damageAttributeId: 42,
        damageBasis: "unknown",
        damageSkillKey: null,
      },
      type: "weapon",
    };
    addConfigurableWeaponDamageBase(source);
    expect(source.system).toEqual({
      damageAttributeId: "",
      damageBasis: "fixed",
      damageSkillKey: "",
    });
  });
});
