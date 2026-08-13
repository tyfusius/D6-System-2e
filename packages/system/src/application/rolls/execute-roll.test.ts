import { describe, expect, it, vi } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
  type D6WildDieChoice,
} from "@d6-system-2e/core";
import {
  executeD6Roll,
  type D6RollRuntimePort,
  type D6RolledBatch,
} from "./execute-roll";

const secondEditionOutcome = Object.freeze({
  profileId: "second-edition" as const,
  successEvaluator: "second-edition-strict" as const,
  wildPolicy: "second-edition" as const,
});

const openD6Outcome = Object.freeze({
  profileId: "open-d6" as const,
  successEvaluator: "first-edition-meets" as const,
  wildPolicy: "first-edition" as const,
});

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
    const executed = await executeD6Roll(request, openD6Outcome, runtime);
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
    await expect(
      executeD6Roll(request, secondEditionOutcome, runtime),
    ).resolves.toBeNull();
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
    await executeD6Roll(
      { ...request, heroPointUse: "double-die-code", score: 9 },
      secondEditionOutcome,
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(5);
  });

  it("rolls Character Point dice as separate exploding ordinary dice", async () => {
    const rollCharacterPointDie = vi.fn(() => Promise.resolve(batch(6, 4)));
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(2, 3))),
      rollCharacterPointDie,
      rollWildDie: vi.fn(() => Promise.resolve(batch(4))),
    };
    const executed = await executeD6Roll(
      {
        ...request,
        openD6Resources: { characterPointSpend: 1, fatePoint: "none" },
        score: 10,
      },
      openD6Outcome,
      runtime,
    );
    expect(rollCharacterPointDie).toHaveBeenCalledOnce();
    expect(executed?.result.characterPointFaceGroups).toEqual([[6, 4]]);
    expect(executed?.result.wildFaces).toEqual([4]);
    expect(executed?.result.total).toBe(20);
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
    const executed = await executeD6Roll(
      { ...request, heroPointUse: "reroll-failed", score: 9 },
      secondEditionOutcome,
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(2);
    expect(executed?.result.heroPointSpent).toBe(1);
    expect(executed?.result.pool.code).toEqual({ dice: 3, pips: 0 });
  });

  it("rolls Basic bonus dice as ordinary dice", async () => {
    const rollBaseDice = vi.fn((count: number) =>
      Promise.resolve(batch(...Array<number>(count).fill(2))),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice,
      rollWildDie: vi.fn(() => Promise.resolve(batch(3))),
    };
    const executed = await executeD6Roll(
      {
        ...request,
        heroPointSpend: 3,
        heroPointUse: "basic-bonus-dice",
        score: 9,
      },
      { ...secondEditionOutcome, wildPolicy: "second-edition-simple" },
      runtime,
    );
    expect(rollBaseDice).toHaveBeenCalledWith(5);
    expect(executed?.result.pool.wildDice).toBe(1);
  });

  it("rolls and independently explodes every Classic bonus Wild Die", async () => {
    const wild = [batch(4), batch(6), batch(6), batch(2), batch(3)];
    const rollWildDie = vi.fn(() => Promise.resolve(wild.shift() ?? batch(2)));
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(2, 3))),
      rollWildDie,
    };
    const executed = await executeD6Roll(
      {
        ...request,
        heroPointSpend: 2,
        heroPointUse: "classic-bonus-wild-dice",
        score: 9,
      },
      { ...secondEditionOutcome, wildPolicy: "second-edition-classic" },
      runtime,
    );
    expect(executed?.result.wildFaceGroups).toEqual([[4], [6, 2], [6, 3]]);
    expect(executed?.result.heroPointAward).toBe(2);
    expect(executed?.result.heroPointSpent).toBe(2);
    expect(rollWildDie).toHaveBeenCalledTimes(5);
  });

  it("resolves an exploding failed Doubling Down retry as a no-award Complication", async () => {
    const wild = [batch(6), batch(2)];
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(1, 1))),
      rollWildDie: vi.fn(() => Promise.resolve(wild.shift() ?? batch(2))),
    };
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
      secondEditionOutcome,
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
    const executed = await executeD6Roll(
      { ...request, difficulty: 30, score: 9 },
      secondEditionOutcome,
      runtime,
    );

    expect(executed?.result.wildFaces).toEqual([6, 6, 3]);
    expect(executed?.result.total).toBe(17);
    expect(executed?.result.wildOutcome).toBe("exploded");
    expect(executed?.result.heroPointAward).toBe(1);
    expect(rollWildDie).toHaveBeenCalledTimes(3);
    expect(chooseWildDie).not.toHaveBeenCalled();
  });

  it("requests an intrinsic exploding Wild Die term when the active policy explodes sixes", async () => {
    const rollWildDie = vi.fn((explodeOnSix: boolean) =>
      Promise.resolve(explodeOnSix ? batch(6, 6, 3) : batch(6)),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => Promise.resolve(null)),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(1, 1))),
      rollWildDie,
    };

    const executed = await executeD6Roll(
      { ...request, difficulty: 30, score: 9 },
      openD6Outcome,
      runtime,
    );

    expect(rollWildDie).toHaveBeenCalledOnce();
    expect(rollWildDie).toHaveBeenCalledWith(true);
    expect(executed?.result.wildFaces).toEqual([6, 6, 3]);
    expect(executed?.result.total).toBe(17);
  });

  it("keeps a successful core Advantage on a non-exploding Wild Die term", async () => {
    const rollWildDie = vi.fn((explodeOnSix: boolean) =>
      Promise.resolve(explodeOnSix ? batch(6, 2) : batch(6)),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() =>
        Promise.resolve("second-edition-ordinary" as const),
      ),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(5, 5))),
      rollWildDie,
    };

    const executed = await executeD6Roll(
      { ...request, difficulty: 12, score: 9 },
      secondEditionOutcome,
      runtime,
    );

    expect(rollWildDie).toHaveBeenCalledOnce();
    expect(rollWildDie).toHaveBeenCalledWith(false);
    expect(executed?.result.wildFaces).toEqual([6]);
    expect(executed?.result.wildOutcome).toBe("ordinary-success");
  });

  it("orchestrates the selected Second Edition alternate strategy", async () => {
    const chooseWildDie = vi.fn((choices: readonly D6WildDieChoice[]) =>
      Promise.resolve(choices[0] ?? null),
    );
    const runtime: D6RollRuntimePort = {
      chooseWildDie,
      rollBaseDice: vi.fn(() => Promise.resolve(batch(5, 3, 2, 2))),
      rollWildDie: vi.fn(() => Promise.resolve(batch(1))),
    };
    const executed = await executeD6Roll(
      request,
      { ...secondEditionOutcome, wildPolicy: "second-edition-classic" },
      runtime,
    );
    expect(executed?.result.wildPolicy).toBe("second-edition-classic");
    expect(executed?.result.total).toBe(8);
    expect(chooseWildDie).toHaveBeenCalledWith(
      ["second-edition-classic-penalty", "second-edition-classic-complication"],
      expect.any(Object),
    );
  });

  it("presents every physical die before requesting a Wild Die choice", async () => {
    const events: string[] = [];
    const runtime: D6RollRuntimePort = {
      chooseWildDie: vi.fn(() => {
        events.push("choose");
        return Promise.resolve("second-edition-classic-penalty" as const);
      }),
      presentWildDieRoll: vi.fn(
        (_result: unknown, artifacts: readonly unknown[]) => {
          events.push(`present:${artifacts.length}`);
          return Promise.resolve();
        },
      ),
      rollBaseDice: vi.fn(() => Promise.resolve(batch(5, 3, 2, 2))),
      rollWildDie: vi.fn(() => Promise.resolve(batch(1))),
    };

    await executeD6Roll(
      request,
      { ...secondEditionOutcome, wildPolicy: "second-edition-classic" },
      runtime,
    );

    expect(events).toEqual(["present:2", "choose"]);
  });
});
