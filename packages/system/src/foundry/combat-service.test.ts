import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeNextCombatantAction,
  declareCombatantActions,
  readCombatantRound,
  resetCombatantActions,
} from "./combat-service";

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
  system: { movement: { posture: "standing" } },
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
  combatant.actor = actor;
  vi.stubGlobal("game", {
    combat: { combatants: { contents: [combatant] }, round: 2 },
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
        { kind: "attack", label: "Attack" },
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
      currentAction: { label: "Attack" },
      revision: 2,
    });
    expect(updates).toHaveLength(2);
  });

  it("rejects stale commands and player resets after resolution begins", async () => {
    await declareCombatantActions(actor, {
      actions: [{ kind: "skill", label: "Dodge" }],
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
        { kind: "attack", label: "Attack" },
      ],
      expectedRevision: 0,
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [
        { kind: "move", label: "Run", movementMode: "run" },
        { kind: "attack", label: "Attack" },
      ],
      penaltyLabel: "−2D",
      penaltyScore: 6,
    });
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
      user: { isGM: false },
    });
    expect(readCombatantRound(actor)).toMatchObject({
      actions: [],
      revision: 0,
      round: 3,
    });
  });
});
