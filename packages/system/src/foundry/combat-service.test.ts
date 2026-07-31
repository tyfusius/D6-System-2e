import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  combatDeclarationOptions,
  commitFirstEditionCombatantActions,
  completeNextCombatantAction,
  declareCombatantActions,
  forfeitWoundedCombatantActions,
  readCombatantRound,
  recordFirstEditionCombatantDefense,
  resetCombatantActions,
  spendFirstEditionCombatantAction,
} from "./combat-service";

let actionEconomyStrategy = "second-edition-action-segments";
let defenseStrategy = "static-defense-values";

vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    actionEconomy: { strategy: actionEconomyStrategy },
    defenses: { strategy: defenseStrategy },
    environments: { state: "inactive" },
  }),
}));

vi.mock("../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
}));

const flags = new Map<string, unknown>();
const updates: Record<string, unknown>[] = [];
const actorUpdates: Record<string, unknown>[] = [];
const combatant = {
  actor: null as object | null,
  actorId: "actor-1",
  id: "combatant-1",
  getFlag: (_namespace: string, key: string) => flags.get(key),
  update: (changes: Record<string, unknown>) => {
    updates.push(changes);
    const state = changes["flags.d6-system-2e.roundAction"];
    flags.set("roundAction", state);
    return Promise.resolve();
  },
};
const actor = {
  id: "actor-1",
  isOwner: true,
  items: {
    contents: [
      {
        id: "dodge",
        name: "Dodge",
        system: {
          attributeId: "perception",
          key: "dodge",
          score: 0,
          training: "standard",
        },
        type: "skill",
      },
      {
        id: "blaster",
        name: "Blaster",
        system: {
          attackAttributeId: "agility",
          attackBonus: 0,
          attackSkillKey: "",
        },
        type: "weapon",
      },
    ],
  },
  system: {
    attributes: {
      agility: { score: 9 },
      perception: { score: 9 },
    },
    health: { condition: "healthy" },
    movement: { posture: "standing" },
  },
  uuid: "Scene.scene-1.Token.token-1.Actor.actor-1",
  update: (changes: Record<string, unknown>) => {
    actorUpdates.push(changes);
    const posture = changes["system.movement.posture"];
    if (posture === "standing" || posture === "prone") {
      actor.system.movement.posture = posture;
    }
    return Promise.resolve();
  },
};

beforeEach(() => {
  flags.clear();
  updates.length = 0;
  actorUpdates.length = 0;
  actor.system.movement.posture = "standing";
  actor.system.health.condition = "healthy";
  actionEconomyStrategy = "second-edition-action-segments";
  defenseStrategy = "static-defense-values";
  combatant.actor = actor;
  vi.stubGlobal("game", {
    combat: { combatants: { contents: [combatant] }, round: 2 },
    i18n: { localize: (key: string) => key },
    user: { isGM: false },
  });
});

describe("Foundry combatant action commands", () => {
  it("does not treat a base Actor as an unlinked synthetic Token combatant", () => {
    const baseActor = {
      ...actor,
      system: { movement: { posture: "standing" } },
      uuid: "Actor.actor-1",
    };
    const resolvedSyntheticActor = {
      ...actor,
      system: { movement: { posture: "standing" } },
    };
    combatant.actor = resolvedSyntheticActor;
    expect(readCombatantRound(baseActor)).toBeNull();
    expect(readCombatantRound(actor)).toMatchObject({
      active: true,
      actorId: "actor-1",
    });
  });

  it("declares, reads, and advances revision-checked action state", async () => {
    await declareCombatantActions(actor, {
      actions: [
        { kind: "move", label: "Move" },
        {
          kind: "attack",
          label: "Attack",
          sourceId: "blaster",
        },
      ],
      expectedRevision: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      currentAction: { label: "Move" },
      penaltyLabel: "−1D",
      revision: 1,
      round: 2,
    });
    await completeNextCombatantAction(actor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      completedActionIds: ["2-1-1"],
      currentAction: { label: "Blaster" },
      revision: 2,
    });
    expect(updates).toHaveLength(2);
  });

  it("locks the current Second Edition round when the combatant becomes Wounded", async () => {
    await declareCombatantActions(actor, {
      actions: [
        { kind: "other", label: "Take cover" },
        { kind: "attack", label: "Attack", sourceId: "blaster" },
      ],
      expectedRevision: 0,
    });
    await completeNextCombatantAction(actor, 1);

    await expect(forfeitWoundedCombatantActions(actor)).resolves.toMatchObject({
      changed: true,
      state: {
        actionForfeiture: { reason: "wounded", sourcePage: 33 },
        complete: true,
        completedActionIds: ["2-1-1"],
        revision: 3,
      },
    });
    await expect(forfeitWoundedCombatantActions(actor)).resolves.toMatchObject({
      changed: false,
      state: { revision: 3 },
    });
    await expect(
      declareCombatantActions(actor, {
        actions: [{ kind: "other", label: "Replacement" }],
        expectedRevision: 3,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationLocked");
  });

  it("does not apply the Second Edition wound lock to First Edition actions", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    const result = await forfeitWoundedCombatantActions(actor);
    expect(result.changed).toBe(false);
    expect(result.state).not.toHaveProperty("actionForfeiture");
    expect(updates).toEqual([]);
  });

  it("rejects stale commands and player resets after resolution begins", async () => {
    await declareCombatantActions(actor, {
      actions: [{ kind: "skill", label: "Dodge", sourceId: "dodge" }],
      expectedRevision: 0,
    });
    await expect(completeNextCombatantAction(actor, 0)).rejects.toThrow(
      "D6E2.Combat.Error.RevisionConflict",
    );
    await completeNextCombatantAction(actor, 1);
    await expect(resetCombatantActions(actor, 2)).rejects.toThrow(
      "D6E2.Combat.Error.ResetRequiresGM",
    );
  });

  it("persists typed running movement and includes its extra penalty", async () => {
    await declareCombatantActions(actor, {
      actions: [
        {
          kind: "move",
          label: "Run",
          movementMode: "run",
        },
        {
          kind: "attack",
          label: "Attack",
          sourceId: "blaster",
        },
      ],
      expectedRevision: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [
        { kind: "move", label: "Run", movementMode: "run" },
        {
          baseScore: 9,
          effectiveScore: 3,
          kind: "attack",
          label: "Blaster",
          sourceId: "blaster",
        },
      ],
      penaltyLabel: "−2D",
      penaltyScore: 6,
    });
  });

  it("projects authoritative Attribute, Skill, and weapon declaration pools", () => {
    expect(combatDeclarationOptions(actor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "attribute",
          score: 9,
          sourceId: "agility",
        }),
        expect.objectContaining({
          kind: "skill",
          score: 9,
          sourceId: "dodge",
        }),
        expect.objectContaining({
          kind: "attack",
          score: 9,
          sourceId: "blaster",
        }),
      ]),
    );
  });

  it("prevents a 3D attack from being declared as one of four actions", async () => {
    await expect(
      declareCombatantActions(actor, {
        actions: Array.from({ length: 4 }, () => ({
          kind: "attack" as const,
          label: "Attack",
          sourceId: "blaster",
        })),
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationPoolBelowOneDie");
    expect(updates).toEqual([]);
  });

  it("includes the wound penalty and rejects conditions that cannot act", async () => {
    actor.system.health.condition = "wounded";
    await expect(
      declareCombatantActions(actor, {
        actions: [
          {
            kind: "move",
            label: "Run",
            movementMode: "run",
          },
          {
            kind: "attack",
            label: "Attack",
            sourceId: "blaster",
          },
        ],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationPoolBelowOneDie");

    actor.system.health.condition = "stunned";
    await expect(
      declareCombatantActions(actor, {
        actions: [{ kind: "other", label: "Wait" }],
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.ConditionCannotAct");
  });

  it("applies the declared movement posture when that action completes", async () => {
    await declareCombatantActions(actor, {
      actions: [
        {
          endProne: true,
          kind: "move",
          label: "Run",
          movementMode: "run",
        },
      ],
      expectedRevision: 0,
    });
    await completeNextCombatantAction(actor, 1);
    expect(actorUpdates).toEqual([{ "system.movement.posture": "prone" }]);
    expect(readCombatantRound(actor)?.actions[0]).toMatchObject({
      endProne: true,
      movementMode: "run",
    });
  });

  it("starts a clean logical state when Foundry advances the round", async () => {
    await declareCombatantActions(actor, {
      actions: [{ kind: "other", label: "Wait" }],
      expectedRevision: 0,
    });
    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 3 },
      i18n: { localize: (key: string) => key },
      user: { isGM: false },
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [],
      revision: 0,
      round: 3,
    });
  });

  it("persists and spends a First Edition pre-turn defense commitment", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 1,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [],
      firstEditionActionPenaltyScore: 3,
      firstEditionCommitment: {
        defense: "partial-defense",
        plannedActionCount: 2,
        spentActionCount: 1,
      },
      firstEditionRemainingActionCount: 1,
      revision: 1,
    });
    await spendFirstEditionCombatantAction(actor, 1);
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionRemainingActionCount: 0,
      revision: 2,
    });
    await expect(
      commitFirstEditionCombatantActions(actor, {
        actionAllotment: 1,
        defense: "none",
        expectedRevision: 2,
        plannedActionCount: 1,
        spentActionCount: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.DeclarationLocked");
  });

  it("persists an explicit clear when the GM resets First Edition state", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 1,
    });
    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 2 },
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });

    await resetCombatantActions(actor, 1);

    expect(updates.at(-1)?.["flags.d6-system-2e.roundAction"]).toMatchObject({
      firstEditionCommitment: null,
      revision: 2,
    });
    const resetState = readCombatantRound(actor);
    expect(resetState).not.toHaveProperty("firstEditionCommitment");
    expect(resetState).toMatchObject({
      firstEditionRemainingActionCount: 0,
      revision: 2,
    });
  });

  it("records an authoritative typed First Edition defense and clears it on recommit", async () => {
    actionEconomyStrategy = "open-d6-flexible-action-allotment";
    defenseStrategy = "active-defense-scheduler";
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "partial-defense",
      expectedRevision: 0,
      plannedActionCount: 2,
      spentActionCount: 0,
    });
    await recordFirstEditionCombatantDefense(actor, {
      consumeAction: true,
      difficulty: 13,
      expectedRevision: 1,
      kind: "dodge",
      label: "Dodge",
      mode: "partial",
      sourceId: "dodge",
      total: 13,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      firstEditionActiveDefense: {
        difficulty: 13,
        kind: "dodge",
        mode: "partial",
      },
      firstEditionCommitment: { spentActionCount: 1 },
      revision: 2,
    });

    vi.stubGlobal("game", {
      combat: { combatants: { contents: [combatant] }, round: 2 },
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    await commitFirstEditionCombatantActions(actor, {
      actionAllotment: 1,
      defense: "full-defense",
      expectedRevision: 2,
      plannedActionCount: 1,
      spentActionCount: 0,
    });
    expect(updates.at(-1)?.["flags.d6-system-2e.roundAction"]).toMatchObject({
      firstEditionActiveDefense: null,
    });
    expect(readCombatantRound(actor)).not.toHaveProperty(
      "firstEditionActiveDefense",
    );
  });

  it("rejects First Edition commitments while that strategy is inactive", async () => {
    await expect(
      commitFirstEditionCombatantActions(actor, {
        actionAllotment: 1,
        defense: "none",
        expectedRevision: 0,
        plannedActionCount: 1,
        spentActionCount: 0,
      }),
    ).rejects.toThrow("D6E2.Combat.Error.FirstEditionActionEconomyInactive");
  });
});
