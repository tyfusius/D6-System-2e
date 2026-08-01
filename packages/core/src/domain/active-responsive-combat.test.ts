import { describe, expect, it } from "vitest";
import {
  canSecondEditionActionFeint,
  canSecondEditionActionRiposte,
  secondEditionAutofirePlan,
  secondEditionFeintDefensePenalty,
  secondEditionFullDefensePlan,
} from "./active-responsive-combat";

describe("Second Edition active and responsive combat", () => {
  it("adds whole-die Skill ratings to full defenses", () => {
    expect(secondEditionFullDefensePlan(12, 10, 13, 10)).toMatchObject({
      acrobaticsBonus: 4,
      dodge: 16,
      meleeBonus: 3,
      parry: 13,
      sourcePage: 163,
    });
  });

  it("trades autofire attack total for twice as much damage", () => {
    expect(secondEditionAutofirePlan(2, 12, 3)).toMatchObject({
      attackModifier: -3,
      damageModifier: 6,
      maximum: 4,
      spend: 3,
    });
    expect(() => secondEditionAutofirePlan(1, 6, 3)).toThrow(RangeError);
  });

  it("uses Melee whole dice for feints and the 4D action threshold", () => {
    expect(secondEditionFeintDefensePenalty(14)).toBe(4);
    expect(canSecondEditionActionFeint(11)).toBe(false);
    expect(canSecondEditionActionFeint(12)).toBe(true);
    expect(canSecondEditionActionRiposte(12)).toBe(true);
  });
});
