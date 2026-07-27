import { describe, expect, it } from "vitest";
import {
  combatRoundPenaltyLabel,
  completeNextCombatAction,
  createCombatantRoundState,
  currentCombatAction,
  declareCombatActions,
} from "./combat-round";

describe("Second Edition action segments", () => {
  it("locks the round penalty to the declared action count", () => {
    const declared = declareCombatActions(createCombatantRoundState(3), [
      { id: "move", kind: "move", label: "Move" },
      { id: "attack", kind: "attack", label: "Blaster" },
      { id: "dodge", kind: "skill", label: "Dodge" },
    ]);
    expect(combatRoundPenaltyLabel(declared)).toBe("−2D");
    expect(currentCombatAction(declared)?.id).toBe("move");
  });

  it("resolves actions in declaration order without passing", () => {
    const declared = declareCombatActions(createCombatantRoundState(1), [
      { id: "first", kind: "skill", label: "First" },
      { id: "second", kind: "move", label: "Second" },
    ]);
    const afterFirst = completeNextCombatAction(declared);
    expect(afterFirst.completedActionIds).toEqual(["first"]);
    expect(currentCombatAction(afterFirst)?.id).toBe("second");
    const complete = completeNextCombatAction(afterFirst);
    expect(currentCombatAction(complete)).toBeUndefined();
    expect(completeNextCombatAction(complete)).toBe(complete);
  });

  it("rejects redeclaration after resolution begins", () => {
    const declared = declareCombatActions(createCombatantRoundState(1), [
      { id: "first", kind: "skill", label: "First" },
    ]);
    expect(() =>
      declareCombatActions(completeNextCombatAction(declared), [
        { id: "replacement", kind: "other", label: "Replacement" },
      ]),
    ).toThrow("D6E2.Combat.Error.DeclarationLocked");
  });
});
