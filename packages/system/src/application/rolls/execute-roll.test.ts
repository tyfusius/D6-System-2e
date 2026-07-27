import { describe, expect, it, vi } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  resolveRulesProfile,
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
    const profile = resolveRulesProfile({
      firstEditionActiveDefenses: true,
      firstEditionAdvancement: true,
      firstEditionAttributes: true,
      firstEditionDamage: true,
      firstEditionMetaCurrency: true,
      firstEditionPips: true,
      firstEditionSuccessEvaluator: true,
      firstEditionWildDie: true,
    });
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
    const profile = resolveRulesProfile({
      firstEditionActiveDefenses: false,
      firstEditionAdvancement: false,
      firstEditionAttributes: false,
      firstEditionDamage: false,
      firstEditionMetaCurrency: false,
      firstEditionPips: false,
      firstEditionSuccessEvaluator: false,
      firstEditionWildDie: false,
    });
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
    const profile = resolveRulesProfile({
      firstEditionActiveDefenses: false,
      firstEditionAdvancement: false,
      firstEditionAttributes: false,
      firstEditionDamage: false,
      firstEditionMetaCurrency: false,
      firstEditionPips: false,
      firstEditionSuccessEvaluator: false,
      firstEditionWildDie: false,
    });
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
    const profile = resolveRulesProfile({
      firstEditionActiveDefenses: false,
      firstEditionAdvancement: false,
      firstEditionAttributes: false,
      firstEditionDamage: false,
      firstEditionMetaCurrency: false,
      firstEditionPips: false,
      firstEditionSuccessEvaluator: false,
      firstEditionWildDie: false,
    });
    const executed = await executeD6Roll(
      { ...request, heroPointUse: "reroll-failed", score: 9 },
      profile,
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(2);
    expect(executed?.result.heroPointSpent).toBe(1);
    expect(executed?.result.pool.code).toEqual({ dice: 3, pips: 0 });
  });
});
