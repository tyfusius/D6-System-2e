import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceAlternateInitiativeRound,
  handleCombatUpdate,
  recoverCombatRoundStart,
  runFirstEditionEndOfRoundMortality,
} from "./combat-hooks";

const combatMocks = vi.hoisted(() => ({ mortality: vi.fn() }));

vi.mock("./first-edition-healing-service", () => ({
  resolveFirstEditionEndOfRoundMortality: combatMocks.mortality,
}));

const render = vi.fn();

beforeEach(() => {
  render.mockClear();
  vi.stubGlobal("game", {
    actors: { contents: [{ sheet: { render } }] },
    users: { contents: [] },
  });
});

describe("First Edition end-of-round mortality", () => {
  it("runs once per distinct synthetic Actor under the primary active GM", async () => {
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
    const resetAll = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === "secondEditionInitiativeStrategy" ? "basic" : false,
      },
      user: { isGM: true },
    });
    await advanceAlternateInitiativeRound({ round: 2, resetAll });
    expect(resetAll).toHaveBeenCalledOnce();
  });

  it("rotates the previous last Narrative declarer to the next round lead", async () => {
    const flags = new Map<string, unknown>([
      ["manualInitiativeOrder", ["alpha", "bravo", "charlie"]],
    ]);
    const setFlag = vi.fn((_namespace: string, key: string, value: unknown) => {
      flags.set(key, value);
      return Promise.resolve(value);
    });
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === "secondEditionInitiativeStrategy" ? "narrative" : false,
      },
      user: { isGM: true },
    });
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
});
