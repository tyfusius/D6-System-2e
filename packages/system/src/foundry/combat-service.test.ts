import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeNextCombatantAction,
  declareCombatantActions,
  readCombatantRound,
  resetCombatantActions,
} from "./combat-service";

const flags = new Map<string, unknown>();
const updates: Record<string, unknown>[] = [];
const combatant = {
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
const actor = { id: "actor-1", isOwner: true };

beforeEach(() => {
  flags.clear();
  updates.length = 0;
  vi.stubGlobal("game", {
    combat: { combatants: { contents: [combatant] }, round: 2 },
    user: { isGM: false },
  });
});

describe("Foundry combatant action commands", () => {
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
