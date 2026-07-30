import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCombatUpdate, recoverCombatRoundStart } from "./combat-hooks";

const render = vi.fn();

beforeEach(() => {
  render.mockClear();
  vi.stubGlobal("game", {
    actors: { contents: [{ sheet: { render } }] },
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
