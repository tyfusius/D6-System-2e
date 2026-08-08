import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceAlternateInitiativeRound,
  handleCombatUpdate,
  recoverCombatRoundStart,
  recoverFirstEditionAccumulatingStuns,
  runFirstEditionEndOfRoundMortality,
} from "./combat-hooks";
import type { D6ActorHealthLifecycleStrategy } from "./health-runtime";
import type { D6InitiativeRuntimeStrategy } from "../settings/initiative";

const combatMocks = vi.hoisted(() => ({
  initiative: vi.fn<() => D6InitiativeRuntimeStrategy>(),
  lifecycle: vi.fn<() => D6ActorHealthLifecycleStrategy>(),
  mortality: vi.fn(),
}));

vi.mock("./first-edition-healing-service", () => ({
  resolveFirstEditionEndOfRoundMortality: combatMocks.mortality,
}));
vi.mock("./health-runtime", () => ({
  currentHealthResolutionStrategy: () => ({
    lifecycle: combatMocks.lifecycle(),
  }),
}));
vi.mock("../settings/initiative", () => ({
  currentInitiativeRuntimeStrategy: () => combatMocks.initiative(),
}));

const render = vi.fn();

beforeEach(() => {
  render.mockClear();
  combatMocks.lifecycle.mockReset().mockReturnValue({
    accumulatingStuns: "none",
    mortality: "none",
    roundStartRecovery: "d6e2.transient-conditions",
  });
  combatMocks.initiative.mockReset().mockReturnValue({
    family: "contextual",
    id: "d6e2.initiative.contextual",
    ordering: "manual",
    roll: "none",
    roundTransition: "preserve",
    tracker: "manual",
  });
  vi.stubGlobal("game", {
    actors: { contents: [{ sheet: { render } }] },
    users: { contents: [] },
  });
});

describe("First Edition end-of-round mortality", () => {
  it("does not schedule mortality for a Condition lifecycle", async () => {
    combatMocks.mortality.mockReset();
    vi.stubGlobal("game", {
      user: { active: true, id: "gm-1", isGM: true, name: "Alpha" },
      users: {
        contents: [{ active: true, id: "gm-1", isGM: true, name: "Alpha" }],
      },
    });
    await expect(
      runFirstEditionEndOfRoundMortality({ id: "combat-1", round: 2 }),
    ).resolves.toBe(0);
    expect(combatMocks.mortality).not.toHaveBeenCalled();
  });

  it("runs once per distinct synthetic Actor under the primary active GM", async () => {
    combatMocks.lifecycle.mockReturnValue({
      accumulatingStuns: "open-d6.optional-accumulating-stuns",
      mortality: "open-d6.elapsed-rounds",
      roundStartRecovery: "none",
    });
    const actor = {
      id: "shared-id",
      type: "character",
      uuid: "Scene.scene.Token.token.Actor.shared-id",
    } as unknown as FoundryActorDocument;
    const otherTokenActor = {
      id: "shared-id",
      type: "character",
      uuid: "Scene.scene.Token.other.Actor.shared-id",
    } as unknown as FoundryActorDocument;
    combatMocks.mortality
      .mockReset()
      .mockResolvedValue({ outcome: "survived" });
    vi.stubGlobal("game", {
      settings: { get: () => true },
      user: { active: true, id: "gm-1", isGM: true, name: "Alpha" },
      users: {
        contents: [
          { active: true, id: "gm-2", isGM: true, name: "Zulu" },
          { active: true, id: "gm-1", isGM: true, name: "Alpha" },
        ],
      },
    });
    await expect(
      runFirstEditionEndOfRoundMortality({
        combatants: {
          contents: [{ actor }, { actor }, { actor: otherTokenActor }],
        },
        id: "combat-1",
        round: 2,
      }),
    ).resolves.toBe(2);
    expect(combatMocks.mortality).toHaveBeenCalledTimes(2);
    expect(combatMocks.mortality).toHaveBeenCalledWith(
      actor,
      "combat-1:round:1",
    );
  });

  it("does not run on initial round setup or a secondary GM", async () => {
    combatMocks.lifecycle.mockReturnValue({
      accumulatingStuns: "open-d6.optional-accumulating-stuns",
      mortality: "open-d6.elapsed-rounds",
      roundStartRecovery: "none",
    });
    vi.stubGlobal("game", {
      settings: { get: () => true },
      user: { active: true, id: "gm-2", isGM: true, name: "Zulu" },
      users: {
        contents: [
          { active: true, id: "gm-1", isGM: true, name: "Alpha" },
          { active: true, id: "gm-2", isGM: true, name: "Zulu" },
        ],
      },
    });
    await expect(
      runFirstEditionEndOfRoundMortality({ id: "combat-1", round: 2 }),
    ).resolves.toBe(0);
    vi.stubGlobal("game", {
      settings: { get: () => true },
      user: { active: true, id: "gm-1", isGM: true, name: "Alpha" },
      users: {
        contents: [{ active: true, id: "gm-1", isGM: true, name: "Alpha" }],
      },
    });
    await expect(
      runFirstEditionEndOfRoundMortality({ id: "combat-1", round: 1 }),
    ).resolves.toBe(0);
  });
});

describe("combat round sheet refresh", () => {
  it("refreshes sheets when the round changes", () => {
    handleCombatUpdate({}, { round: 2 });
    expect(render).toHaveBeenCalledWith(false);
  });

  it("does not refresh sheets for unrelated combat updates", () => {
    handleCombatUpdate({}, { turn: 1 });
    expect(render).not.toHaveBeenCalled();
  });
});

describe("alternate initiative round lifecycle", () => {
  it("clears Basic initiative for a fresh Perception declaration order", async () => {
    combatMocks.initiative.mockReturnValue({
      family: "basic",
      id: "d6e2.initiative.basic",
      ordering: "rolled-descending",
      roll: "system-attribute",
      roundTransition: "clear-rolled-totals",
      tracker: "declaration",
    });
    const resetAll = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", { user: { isGM: true } });
    await advanceAlternateInitiativeRound({ round: 2, resetAll });
    expect(resetAll).toHaveBeenCalledOnce();
  });

  it("rotates the previous last Narrative declarer to the next round lead", async () => {
    combatMocks.initiative.mockReturnValue({
      family: "narrative",
      id: "d6e2.initiative.narrative",
      ordering: "manual",
      roll: "system-attribute",
      roundTransition: "rotate-narrative-order",
      tracker: "narrative",
    });
    const flags = new Map<string, unknown>([
      ["manualInitiativeOrder", ["alpha", "bravo", "charlie"]],
    ]);
    const setFlag = vi.fn((_namespace: string, key: string, value: unknown) => {
      flags.set(key, value);
      return Promise.resolve(value);
    });
    vi.stubGlobal("game", { user: { isGM: true } });
    await advanceAlternateInitiativeRound({
      combatants: {
        contents: [
          { actor: null, id: "alpha" },
          { actor: null, id: "bravo" },
          { actor: null, id: "charlie" },
        ] as never,
      },
      getFlag: (_namespace: string, key: string) => flags.get(key),
      round: 2,
      setFlag,
    });
    expect(flags.get("manualInitiativeOrder")).toEqual([
      "charlie",
      "alpha",
      "bravo",
    ]);
    expect(flags.get("narrativeInitiativeSequence")).toEqual(["charlie"]);
  });

  it("preserves the active profile's order when its strategy has no round reset", async () => {
    combatMocks.initiative.mockReturnValue({
      family: "perception",
      id: "open-d6.initiative.perception",
      ordering: "rolled-descending",
      roll: "foundry-formula",
      roundTransition: "preserve",
      tracker: "foundry",
    });
    const resetAll = vi.fn();
    const setFlag = vi.fn();
    vi.stubGlobal("game", { user: { isGM: true } });

    await advanceAlternateInitiativeRound({
      round: 2,
      resetAll,
      setFlag,
    });

    expect(resetAll).not.toHaveBeenCalled();
    expect(setFlag).not.toHaveBeenCalled();
  });
});

describe("Second Edition round-start recovery", () => {
  it("recovers the combatant's synthetic Actor once and retains lasting wounds", async () => {
    const stunnedUpdates: Record<string, unknown>[] = [];
    const stunned = {
      id: "synthetic-actor",
      isOwner: true,
      system: { health: { condition: "stunned" } },
      type: "character",
      update: (changes: Record<string, unknown>) => {
        stunnedUpdates.push(changes);
        return Promise.resolve();
      },
    };
    const woundedUpdates: Record<string, unknown>[] = [];
    const wounded = {
      id: "wounded-actor",
      isOwner: true,
      system: { health: { condition: "wounded" } },
      type: "npc",
      update: (changes: Record<string, unknown>) => {
        woundedUpdates.push(changes);
        return Promise.resolve();
      },
    };
    vi.stubGlobal("game", {
      settings: { get: () => false },
      user: { isGM: true },
    });

    await expect(
      recoverCombatRoundStart({
        combatants: {
          contents: [
            { actor: stunned as unknown as FoundryActorDocument },
            { actor: stunned as unknown as FoundryActorDocument },
            { actor: wounded as unknown as FoundryActorDocument },
          ],
        },
      }),
    ).resolves.toBe(1);
    expect(stunnedUpdates).toEqual([{ "system.health.condition": "healthy" }]);
    expect(woundedUpdates).toEqual([]);
  });

  it("does not recover stored Conditions under an Open D6 lifecycle", async () => {
    combatMocks.lifecycle.mockReturnValue({
      accumulatingStuns: "open-d6.optional-accumulating-stuns",
      mortality: "open-d6.elapsed-rounds",
      roundStartRecovery: "none",
    });
    const update = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", { user: { isGM: true } });
    await expect(
      recoverCombatRoundStart({
        combatants: {
          contents: [
            {
              actor: {
                id: "stored-condition",
                isOwner: true,
                system: { health: { condition: "stunned" } },
                type: "character",
                update,
              } as unknown as FoundryActorDocument,
            },
          ],
        },
      }),
    ).resolves.toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("First Edition accumulating-stun round lifecycle", () => {
  it("decays each distinct Actor once under the primary active GM", async () => {
    combatMocks.lifecycle.mockReturnValue({
      accumulatingStuns: "open-d6.optional-accumulating-stuns",
      mortality: "open-d6.elapsed-rounds",
      roundStartRecovery: "none",
    });
    const update = vi.fn().mockResolvedValue(undefined);
    const actor = {
      id: "actor-1",
      isOwner: true,
      system: {
        attributes: { brawn: { score: 9 } },
        health: {
          firstEditionStuns: {
            version: 1,
            total: 2,
            penaltyDice: 1,
            roundsRemaining: 2,
            lastProcessedRoundId: "",
          },
        },
      },
      type: "character",
      update,
      uuid: "Actor.actor-1",
    } as unknown as FoundryActorDocument;
    vi.stubGlobal("game", {
      settings: { get: () => true },
      user: { id: "gm-1", isGM: true, name: "Alpha" },
      users: {
        contents: [{ active: true, id: "gm-1", isGM: true, name: "Alpha" }],
      },
    });
    await expect(
      recoverFirstEditionAccumulatingStuns({
        combatants: { contents: [{ actor }, { actor }] },
        id: "combat-1",
        round: 3,
      }),
    ).resolves.toBe(1);
    expect(update).toHaveBeenCalledOnce();
    const payload = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload["system.health.firstEditionStuns"]).toMatchObject({
      lastProcessedRoundId: "combat-1:round:3",
      penaltyDice: 1,
      roundsRemaining: 1,
      total: 2,
    });
  });
});
