import { describe, expect, it } from "vitest";
import type { D6WeaponDamageContinuationRollContext } from "@d6-system-2e/core";
import {
  d6BoundWeaponDamageAutofire,
  d6BoundWeaponDamageConsumesPending,
  d6PendingAutofireForAttack,
  d6WeaponDamageBaseForContinuation,
} from "./roll-service";

const plan = (bindingId = "attack-a") =>
  ({
    autofire: {
      attackModifier: -2,
      damageModifier: 4,
      maximum: 4,
      sourcePage: 163,
      spend: 2,
    },
    bindingId,
    scale: {
      application: "damage",
      modifierScore: 0,
      sourceActorId: "attacker",
      sourceName: "Attacker",
      sourcePage: 196,
      sourceRank: 0,
      targetActorId: "target",
      targetName: "Target",
      targetRank: 0,
    },
    score: 15,
    weaponDamage: {
      attributeId: "",
      baseKind: "fixed",
      baseScore: 0,
      configuredSkillKey: "",
      listedDamageScore: 15,
    },
  }) satisfies D6WeaponDamageContinuationRollContext;

describe("bound ordinary Weapon Damage continuation", () => {
  it("uses authored 5D Damage instead of a mutable 7D attack/item value", () => {
    const recompute = () => {
      throw new Error("Mutable Damage must not be recomputed.");
    };

    expect(d6WeaponDamageBaseForContinuation(plan(), recompute)).toEqual({
      score: 15,
      weaponDamage: plan().weaponDamage,
    });
  });

  it("uses only the initiating attack's attributed autofire modifier", () => {
    expect(
      d6BoundWeaponDamageAutofire(plan(), {
        bindingId: "stale-attack",
        damageModifier: 12,
        spend: 6,
      }),
    ).toEqual(plan().autofire);
    expect(
      d6BoundWeaponDamageConsumesPending(plan(), {
        bindingId: "stale-attack",
      }),
    ).toBe(false);
    expect(
      d6BoundWeaponDamageConsumesPending(plan(), { bindingId: "attack-a" }),
    ).toBe(true);
  });

  it("rejects attack-bound pending autofire from standalone or other attacks", () => {
    expect(
      d6BoundWeaponDamageAutofire(undefined, {
        bindingId: "other-attack",
        damageModifier: 6,
        spend: 3,
      }),
    ).toBeUndefined();
  });

  it("preserves the pre-binding legacy standalone autofire path", () => {
    expect(
      d6BoundWeaponDamageAutofire(undefined, {
        damageModifier: 4,
        maximum: 4,
        spend: 2,
      }),
    ).toEqual({
      attackModifier: -2,
      damageModifier: 4,
      maximum: 4,
      sourcePage: 163,
      spend: 2,
    });
  });

  it("replaces stale item state with only the completed attack's binding", () => {
    const autofire = {
      attackModifier: -2,
      damageModifier: 4,
      maximum: 4,
      sourcePage: 163 as const,
      spend: 2,
    };
    expect(d6PendingAutofireForAttack("attack-a", autofire)).toEqual({
      ...autofire,
      bindingId: "attack-a",
    });
    expect(
      d6PendingAutofireForAttack("attack-b", {
        attackModifier: 0,
        damageModifier: 0,
        maximum: 3,
        sourcePage: 163,
        spend: 0,
      }),
    ).toBeNull();
  });
});
