import { describe, expect, it, vi } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  OPEN_D6_COMPATIBILITY,
  resolveRulesProfile,
  SECOND_EDITION_COMPATIBILITY,
  type D6RollRequestV1,
  type D6WildDieChoice,
} from "@d6-system-2e/core";
import {
  executeD6Roll,
  type D6RollRuntimePort,
  type D6RolledBatch,
} from "./execute-roll";

function batch(...faces: number[]): D6RolledBatch {
  return { artifact: { faces }, faces };
}

const request: D6RollRequestV1 = {
  contractVersion: D6_ROLL_CONTRACT_VERSION,
  difficulty: 12,
  heroPointUse: "none",
  kind: "skill",
  label: "Climbing",
  resultModifier: 0,
  rollMode: "publicroll",
  score: 16,
  source: {
    actorId: "actor-1",
    actorName: "Test Character",
    attributeId: "agility",
    itemId: "skill-1",
  },
};

describe("roll application service", () => {
  it("orchestrates base dice, an exploding Wild Die, and a choice", async () => {
    const wild = [batch(6), batch(6), batch(2)];
    const rollWildDie = vi.fn(() => Promise.resolve(wild.shift() ?? batch(2)));
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn((choices: readonly D6WildDieChoice[]) =>
        Promise.resolve(choices[0] ?? null),
      ),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(2, 2, 2, 2))),
      rollWildDie,
    };
    const profile = resolveRulesProfile(OPEN_D6_COMPATIBILITY);
    const executed = await executeD6Roll(request, profile, runtime);
    expect(executed?.result.total).toBe(23);
    expect(executed?.artifacts).toHaveLength(4);
    expect(rollWildDie).toHaveBeenCalledTimes(3);
  });

  it("stops without publishing when a required choice is cancelled", async () => {
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(5, 5, 5, 5))),
      rollWildDie: vi.fn(() => Promise.resolve(batch(6))),
    };
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    await expect(executeD6Roll(request, profile, runtime)).resolves.toBeNull();
  });

  it("requests the doubled physical pool for a Hero Point", async () => {
    const rollBaseDice = vi.fn((count: number) =>
      Promise.resolve(batch(...Array<number>(count).fill(2))),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice,
      rollWildDie: vi.fn(() => Promise.resolve(batch(3))),
    };
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    await executeD6Roll(
      { ...request, heroPointUse: "double-die-code", score: 9 },
      profile,
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(5);
  });

  it("rerolls the original physical pool without doubling it", async () => {
    const rollBaseDice = vi.fn((count: number) =>
      Promise.resolve(batch(...Array<number>(count).fill(3))),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice,
      rollWildDie: vi.fn(() => Promise.resolve(batch(2))),
    };
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    const executed = await executeD6Roll(
      { ...request, heroPointUse: "reroll-failed", score: 9 },
      profile,
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(2);
    expect(executed?.result.heroPointSpent).toBe(1);
    expect(executed?.result.pool.code).toEqual({ dice: 3, pips: 0 });
  });

  it("resolves an exploding failed Doubling Down retry as a no-award Complication", async () => {
    const wild = [batch(6), batch(2)];
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(1, 1))),
      rollWildDie: vi.fn(() => Promise.resolve(wild.shift() ?? batch(2))),
    };
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    const executed = await executeD6Roll(
      {
        ...request,
        context: {
          doublingDown: {
            originalTotal: 4,
            sourcePage: 25,
          },
        },
        difficulty: 30,
        score: 9,
      },
      profile,
      runtime,
    );

    expect(executed?.result.wildFaces).toEqual([6, 2]);
    expect(executed?.result.success).toBe(false);
    expect(executed?.result.wildOutcome).toBe("complication");
    expect(executed?.result.heroPointAward).toBe(0);
  });

  it("continues every Second Edition Wild Die six until the explosion ends", async () => {
    const wild = [batch(6), batch(6), batch(3)];
    const rollWildDie = vi.fn(() => Promise.resolve(wild.shift() ?? batch(2)));
    const chooseWildDie = vi.fn(() => Promise.resolve(null));
    const runtime: D6RollRuntimePort = {
      chooseWildDie,
      rollBaseDice: vi.fn(() => Promise.resolve(batch(1, 1))),
      rollWildDie,
    };
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    const executed = await executeD6Roll(
      { ...request, difficulty: 30, score: 9 },
      profile,
      runtime,
    );

    expect(executed?.result.wildFaces).toEqual([6, 6, 3]);
    expect(executed?.result.total).toBe(17);
    expect(executed?.result.wildOutcome).toBe("exploded");
    expect(executed?.result.heroPointAward).toBe(1);
    expect(rollWildDie).toHaveBeenCalledTimes(3);
    expect(chooseWildDie).not.toHaveBeenCalled();
  });
});
