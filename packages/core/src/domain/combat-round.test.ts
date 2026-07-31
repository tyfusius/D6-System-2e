import { describe, expect, it } from "vitest";
import {
  combatRoundActionPenaltyScore,
  combatRoundMovementSkillPenaltyScore,
  combatRoundPenaltyLabel,
  combatRoundPenaltyScore,
  commitFirstEditionActions,
  completeNextCombatAction,
  createCombatantRoundState,
  currentCombatAction,
  declareCombatActions,
  firstEditionCommitmentFromState,
  recordFirstEditionActiveDefense,
  spendFirstEditionAction,
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

  it("adds a running penalty to the multiple-action penalty", () => {
    const running = declareCombatActions(createCombatantRoundState(2), [
      {
        id: "run",
        kind: "move",
        label: "Run",
        movementMode: "run",
      },
      { id: "shoot", kind: "attack", label: "Shoot" },
    ]);
    expect(combatRoundActionPenaltyScore(running)).toBe(3);
    expect(combatRoundMovementSkillPenaltyScore(running)).toBe(3);
    expect(combatRoundPenaltyScore(running)).toBe(6);
    expect(combatRoundPenaltyLabel(running)).toBe("−2D");
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

  it("preserves a legal end-prone declaration and rejects duplicate movement", () => {
    const declared = declareCombatActions(createCombatantRoundState(1), [
      {
        endProne: true,
        id: "run",
        kind: "move",
        label: "Run",
        movementMode: "run",
      },
    ]);
    expect(declared.actions[0]?.endProne).toBe(true);
    expect(() =>
      declareCombatActions(createCombatantRoundState(1), [
        {
          id: "walk",
          kind: "move",
          label: "Walk",
          movementMode: "walk",
        },
        {
          id: "run",
          kind: "move",
          label: "Run",
          movementMode: "run",
        },
      ]),
    ).toThrow("D6E2.Combat.Error.InvalidDeclaration");
  });
});

describe("First Edition flexible action rounds", () => {
  it("stores only the action total instead of forcing exact action choices", () => {
    const committed = commitFirstEditionActions(
      createCombatantRoundState(4),
      4,
      1,
      "none",
      0,
    );
    expect(committed.actions).toEqual([]);
    const storedCommitment = committed.firstEditionCommitment;
    expect(storedCommitment).toBeDefined();
    if (!storedCommitment) throw new Error("Commitment was not stored.");
    expect(firstEditionCommitmentFromState(storedCommitment)).toMatchObject({
      penaltyScore: 9,
      plannedActionCount: 4,
      remainingActionCount: 4,
    });
  });

  it("records a pre-turn partial defense as spent with MAP applying", () => {
    const reaction = commitFirstEditionActions(
      createCombatantRoundState(2),
      2,
      1,
      "partial-defense",
      1,
    );
    const storedReaction = reaction.firstEditionCommitment;
    expect(storedReaction).toBeDefined();
    if (!storedReaction) throw new Error("Reaction was not stored.");
    const plan = firstEditionCommitmentFromState(storedReaction);
    expect(plan).toMatchObject({ penaltyScore: 3, remainingActionCount: 1 });
    const complete = spendFirstEditionAction(reaction);
    expect(complete.firstEditionCommitment?.spentActionCount).toBe(2);
    expect(() => spendFirstEditionAction(complete)).toThrow(
      /No planned First Edition actions remain/,
    );
  });

  it("clears the alternate commitment when Second Edition actions are declared", () => {
    const firstEdition = commitFirstEditionActions(
      createCombatantRoundState(1),
      2,
      1,
      "none",
      0,
    );
    const secondEdition = declareCombatActions(firstEdition, [
      { id: "one", kind: "other", label: "One" },
    ]);
    expect(secondEdition.firstEditionCommitment).toBeUndefined();
  });

  it("records a typed active defense and spends its unspent action", () => {
    const commitment = commitFirstEditionActions(
      createCombatantRoundState(1),
      2,
      1,
      "partial-defense",
      0,
    );
    const defended = recordFirstEditionActiveDefense(
      commitment,
      {
        difficulty: 14,
        kind: "dodge",
        label: "Dodge",
        mode: "partial",
        sourceId: "dodge",
        total: 14,
      },
      true,
    );
    expect(defended.firstEditionActiveDefense).toMatchObject({
      difficulty: 14,
      kind: "dodge",
      mode: "partial",
    });
    expect(defended.firstEditionCommitment?.spentActionCount).toBe(1);
  });

  it("does not double-spend a pre-recorded reaction action", () => {
    const commitment = commitFirstEditionActions(
      createCombatantRoundState(1),
      2,
      1,
      "partial-defense",
      1,
    );
    const defended = recordFirstEditionActiveDefense(
      commitment,
      {
        difficulty: 12,
        kind: "block",
        label: "Brawling Block",
        mode: "partial",
        sourceId: "brawling",
        total: 12,
      },
      false,
    );
    expect(defended.firstEditionCommitment?.spentActionCount).toBe(1);
  });
});
