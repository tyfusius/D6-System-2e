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
  forfeitRemainingCombatActions,
  grantSuperheroicCombatAction,
  recordFirstEditionActiveDefense,
  recordFirstEditionSegmentMovement,
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

  it("adds a superheroic action without increasing MAP", () => {
    const declared = declareCombatActions(createCombatantRoundState(1), [
      { id: "first", kind: "skill", label: "First" },
      { id: "second", kind: "attack", label: "Second" },
    ]);
    const expanded = grantSuperheroicCombatAction(declared);
    expect(expanded.actions).toHaveLength(3);
    expect(expanded.actions[2]).toMatchObject({
      mapExempt: true,
      sourcePage: 207,
    });
    expect(combatRoundActionPenaltyScore(expanded)).toBe(
      combatRoundActionPenaltyScore(declared),
    );
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

  it("forfeits every remaining action for a freshly Wounded round", () => {
    const declared = declareCombatActions(createCombatantRoundState(2), [
      { id: "first", kind: "skill", label: "First" },
      { id: "second", kind: "attack", label: "Second" },
      { id: "third", kind: "move", label: "Third" },
    ]);
    const afterFirst = completeNextCombatAction(declared);
    const forfeited = forfeitRemainingCombatActions(afterFirst);

    expect(forfeited.actionForfeiture).toEqual({
      reason: "wounded",
      sourcePage: 33,
    });
    expect(forfeited.completedActionIds).toEqual(["first"]);
    expect(currentCombatAction(forfeited)).toBeUndefined();
    expect(completeNextCombatAction(forfeited)).toBe(forfeited);
    expect(() =>
      declareCombatActions(forfeited, [
        { id: "replacement", kind: "other", label: "Replacement" },
      ]),
    ).toThrow("D6E2.Combat.Error.DeclarationLocked");
    expect(forfeitRemainingCombatActions(forfeited)).toBe(forfeited);
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
  it("tracks one movement per segment and lets reactive movement consume its own action", () => {
    const committed = commitFirstEditionActions(
      createCombatantRoundState(1),
      2,
      1,
      "none",
      0,
    );
    const reacted = recordFirstEditionSegmentMovement(committed, {
      consumeAction: true,
      distance: 4,
      normalDistance: 4,
    });
    expect(reacted.firstEditionCommitment?.spentActionCount).toBe(1);
    expect(reacted.firstEditionSegmentMovement).toMatchObject({
      movementUsedAtSpentActionCount: 0,
    });
  });

  it("forfeits other actions on a Running Complication and preserves one normal move", () => {
    const committed = commitFirstEditionActions(
      createCombatantRoundState(1),
      3,
      1,
      "none",
      0,
    );
    const complication = recordFirstEditionSegmentMovement(committed, {
      complication: true,
      consumeAction: true,
      distance: 6,
      normalDistance: 3,
    });
    expect(complication.firstEditionCommitment?.spentActionCount).toBe(3);
    expect(complication.completedActionIds).toHaveLength(3);
    expect(complication.firstEditionSegmentMovement).toMatchObject({
      complication: true,
      remainingMovementDistance: 3,
    });
  });
  it("preserves the legacy count-only API with generated queue entries", () => {
    const committed = commitFirstEditionActions(
      createCombatantRoundState(4),
      4,
      1,
      "none",
      0,
    );
    expect(committed.actions.map((action) => action.label)).toEqual([
      "Action 1",
      "Action 2",
      "Action 3",
      "Action 4",
    ]);
    const storedCommitment = committed.firstEditionCommitment;
    expect(storedCommitment).toBeDefined();
    if (!storedCommitment) throw new Error("Commitment was not stored.");
    expect(firstEditionCommitmentFromState(storedCommitment)).toMatchObject({
      penaltyScore: 9,
      plannedActionCount: 4,
      remainingActionCount: 4,
    });
  });

  it("stores linked and freeform First Edition actions in queue order", () => {
    const committed = commitFirstEditionActions(
      createCombatantRoundState(4),
      2,
      1,
      "none",
      0,
      [
        {
          baseScore: 12,
          effectiveScore: 9,
          id: "shoot",
          kind: "attack",
          label: "Blaster",
          sourceId: "weapon",
        },
        { id: "cover", kind: "other", label: "Take cover" },
      ],
    );

    expect(committed.actions).toMatchObject([
      { id: "shoot", sourceId: "weapon" },
      { id: "cover", label: "Take cover" },
    ]);
    expect(spendFirstEditionAction(committed).completedActionIds).toEqual([
      "shoot",
    ]);
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
