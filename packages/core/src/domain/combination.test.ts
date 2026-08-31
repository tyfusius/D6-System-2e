import { describe, expect, it } from "vitest";
import type { D6MatchingEvaluatorV1 } from "../contracts/pool-evaluation";
import {
  compareD6MatchingRankVectors,
  evaluateD6MatchingPool,
  observeD6MatchingCombination,
  resolveD6MatchingRewardPlan,
} from "./combination";

const evaluator: D6MatchingEvaluatorV1 = {
  appliesTo: ["attribute", "skill"],
  capabilities: {
    characterPoints: false,
    fatePoints: false,
    heroPoints: false,
    pips: false,
    resultModifiers: false,
    retries: false,
    specialDie: "none",
  },
  fallbackPatternId: "none",
  id: "d6-nexus.matches-v1",
  label: "D6 Nexus matching sets",
  patterns: [
    { enabled: true, groups: [], id: "none", label: "No match", precedence: 0 },
    {
      enabled: true,
      groups: [{ count: 2, mode: "minimum" }],
      id: "pair",
      label: "Pair",
      precedence: 1,
    },
    {
      enabled: true,
      groups: [
        { count: 2, mode: "minimum" },
        { count: 2, mode: "minimum" },
      ],
      id: "two-pair",
      label: "Two pair",
      precedence: 2,
    },
    {
      enabled: true,
      groups: [{ count: 3, mode: "minimum" }],
      id: "three-kind",
      label: "Three of a kind",
      precedence: 3,
    },
    {
      enabled: true,
      groups: [
        { count: 3, mode: "minimum" },
        { count: 2, mode: "minimum" },
      ],
      id: "full-house",
      label: "Full house",
      precedence: 4,
    },
    {
      enabled: true,
      groups: [{ count: 4, mode: "minimum" }],
      id: "four-kind",
      label: "Four of a kind",
      precedence: 5,
    },
    {
      enabled: true,
      groups: [{ count: 5, mode: "minimum" }],
      id: "five-kind",
      label: "Five of a kind",
      precedence: 6,
    },
    {
      enabled: true,
      groups: [{ count: 6, mode: "minimum" }],
      id: "six-kind",
      label: "Six of a kind",
      precedence: 7,
    },
  ],
  pool: { maximum: 12, minimum: 1 },
  source: { kind: "system" },
  version: 1,
};

describe("D6 Nexus matching combinations", () => {
  it("appends observation evidence without changing numeric, Wild Die, or difficulty behavior", () => {
    const numeric = Object.freeze({
      baseFaces: Object.freeze([5, 5, 2]),
      characterPointFaces: Object.freeze([2]),
      contractVersion: 2,
      difficulty: Object.freeze({ difficulty: 12, margin: 7, success: true }),
      heroPointAward: 0,
      heroPointSpent: 0,
      pendingChoices: Object.freeze([]),
      pool: Object.freeze({
        baseDice: 3,
        bonusOrdinaryDice: 0,
        bonusWildDice: 0,
        code: Object.freeze({ dice: 4, pips: 0 }),
        resultModifier: 0,
        wildDice: 1,
      }),
      profileId: "numeric-profile",
      request: Object.freeze({ kind: "attribute" }),
      requiresWildExplosion: false,
      success: true,
      total: 19,
      wildFaces: Object.freeze([5]),
      wildPolicy: "second-edition",
      wildOutcome: "normal",
    }) as never;
    const observed = observeD6MatchingCombination(numeric, evaluator);
    const { matchingObservation, ...numericAfter } = observed;
    expect(numericAfter).toEqual(numeric);
    expect(matchingObservation?.best.patternId).toBe("full-house");
    expect(matchingObservation?.rawFaces).toEqual([5, 5, 2, 5, 2]);
  });
  it.each([
    [[1, 2, 3], "none"],
    [[2, 2, 3], "pair"],
    [[2, 2, 5, 5, 1], "two-pair"],
    [[4, 4, 4, 1], "three-kind"],
    [[3, 3, 3, 6, 6], "full-house"],
    [[5, 5, 5, 5], "four-kind"],
    [[1, 1, 1, 1, 1], "five-kind"],
    [[6, 6, 6, 6, 6, 6, 6], "six-kind"],
  ] as const)("classifies %j as %s", (faces, expected) => {
    expect(evaluateD6MatchingPool(evaluator, faces).best.patternId).toBe(
      expected,
    );
  });

  it("uses precedence, matched faces, then unused dice as its deterministic rank vector", () => {
    const result = evaluateD6MatchingPool(evaluator, [2, 2, 6, 6, 5]);
    expect(result.best.patternId).toBe("two-pair");
    expect(
      result.best.consumedGroups.map(({ count, face }) => ({ count, face })),
    ).toEqual([
      { count: 2, face: 6 },
      { count: 2, face: 2 },
    ]);
    expect(result.best.rankVector).toEqual([2, 6, 2, 5]);
  });

  it("supports minimum-combination success without inventing a numeric total", () => {
    const result = evaluateD6MatchingPool(evaluator, [3, 3, 3, 2, 2], {
      mode: "minimum-combination",
      targetPatternId: "full-house",
    });
    expect(result.success).toBe(true);
    expect(result.best.patternId).toBe("full-house");
    expect(result).not.toHaveProperty("total");
  });

  it("persists raw faces, grouped indices, candidates, and an evaluator snapshot", () => {
    const source = [6, 6, 6, 2, 2];
    const result = evaluateD6MatchingPool(evaluator, source);
    source[0] = 1;
    expect(result.rawFaces).toEqual([6, 6, 6, 2, 2]);
    expect(result.groups).toEqual([
      { count: 3, dieIndices: [0, 1, 2], face: 6 },
      { count: 2, dieIndices: [3, 4], face: 2 },
    ]);
    expect(result.candidates.map(({ patternId }) => patternId)).toContain(
      "pair",
    );
    expect(result.evaluator.hash).toMatch(/^fnv1a32-[0-9a-f]{8}$/u);
  });

  it("supports broad minimum and strict exact multiplicity semantics", () => {
    expect(
      evaluateD6MatchingPool(evaluator, [4, 4, 4, 4, 2, 2]).best.patternId,
    ).toBe("four-kind");
    const strict: D6MatchingEvaluatorV1 = {
      ...evaluator,
      patterns: evaluator.patterns.map((pattern) =>
        pattern.id === "full-house"
          ? {
              ...pattern,
              groups: [
                { count: 3, mode: "exact" },
                { count: 2, mode: "exact" },
              ],
            }
          : pattern,
      ),
    };
    expect(
      evaluateD6MatchingPool(strict, [4, 4, 4, 4, 2, 2]).candidates.map(
        ({ patternId }) => patternId,
      ),
    ).not.toContain("full-house");
  });

  it("selects the higher triple deterministically for 3+3", () => {
    const result = evaluateD6MatchingPool(evaluator, [2, 2, 2, 5, 5, 5]);
    expect(result.best.patternId).toBe("full-house");
    expect(result.best.consumedGroups.map(({ face }) => face)).toEqual([5, 2]);
  });

  it("rejects ambiguous definitions and invalid pools", () => {
    const pair = evaluator.patterns.find(({ id }) => id === "pair");
    if (!pair) throw new Error("Pair fixture is missing.");
    expect(() =>
      evaluateD6MatchingPool(
        {
          ...evaluator,
          patterns: [...evaluator.patterns, pair],
        },
        [2, 2],
      ),
    ).toThrow(/Duplicate matching pattern id/u);
    expect(() => evaluateD6MatchingPool(evaluator, [])).toThrow(
      /requires 1–12 dice/u,
    );
  });

  it("evaluates every d6 face-count multiset from one to twelve dice invariantly", () => {
    const visit = (remaining: number, face: number, counts: number[]): void => {
      if (face === 6) {
        const all = [...counts, remaining];
        const faces = all.flatMap((count, index) =>
          Array.from({ length: count }, () => index + 1),
        );
        if (faces.length === 0) return;
        const forward = evaluateD6MatchingPool(evaluator, faces);
        const reverse = evaluateD6MatchingPool(evaluator, [...faces].reverse());
        expect(reverse.best.patternId).toBe(forward.best.patternId);
        expect(reverse.best.rankVector).toEqual(forward.best.rankVector);
        return;
      }
      for (let count = 0; count <= remaining; count += 1) {
        visit(remaining - count, face + 1, [...counts, count]);
      }
    };
    for (let size = 1; size <= 12; size += 1) visit(size, 1, []);
  }, 15_000);

  it("makes evaluator snapshots canonical, immutable, and independent of object key order", () => {
    const reordered = {
      version: evaluator.version,
      source: evaluator.source,
      pool: evaluator.pool,
      patterns: evaluator.patterns,
      label: evaluator.label,
      id: evaluator.id,
      fallbackPatternId: evaluator.fallbackPatternId,
      capabilities: evaluator.capabilities,
      appliesTo: evaluator.appliesTo,
    } satisfies D6MatchingEvaluatorV1;
    const first = evaluateD6MatchingPool(evaluator, [2, 2]);
    const second = evaluateD6MatchingPool(reordered, [2, 2]);
    expect(second.evaluator.hash).toBe(first.evaluator.hash);
    expect(Object.isFrozen(first.evaluator.evaluator.patterns[0])).toBe(true);
  });

  it("orders rank vectors antisymmetrically and transitively without enabling opposition", () => {
    const vectors = [
      [1, 6, 5],
      [2, 2, 1],
      [2, 5, 1],
      [4, 3, 2],
    ] as const;
    for (const left of vectors) {
      for (const right of vectors) {
        expect(
          compareD6MatchingRankVectors(left, right) +
            compareD6MatchingRankVectors(right, left),
        ).toBe(0);
      }
    }
    for (let index = 0; index < vectors.length - 2; index += 1) {
      expect(
        compareD6MatchingRankVectors(
          vectors[index] ?? [],
          vectors[index + 2] ?? [],
        ),
      ).toBeLessThan(0);
    }
  });

  it("excludes disabled definitions while retaining them in the evaluator snapshot", () => {
    const disabledPair = {
      ...evaluator,
      patterns: evaluator.patterns.map((pattern) =>
        pattern.id === "pair" ? { ...pattern, enabled: false } : pattern,
      ),
    };
    const result = evaluateD6MatchingPool(disabledPair, [3, 3]);
    expect(result.best.patternId).toBe("none");
    expect(
      result.evaluator.evaluator.patterns.find(({ id }) => id === "pair")
        ?.enabled,
    ).toBe(false);
  });

  it("awards only the single best stable pattern in the selected evaluator", () => {
    const result = evaluateD6MatchingPool(evaluator, [6, 6, 6, 6, 2, 2]);
    expect(result.best.patternId).toBe("four-kind");
    const plan = resolveD6MatchingRewardPlan(
      {
        awards: {
          pair: {
            characterPoints: 9,
            enabled: true,
            metaCurrency: 9,
            patternLabel: "Pair",
            sourceLabel: "System",
          },
          "four-kind": {
            characterPoints: 2,
            enabled: true,
            metaCurrency: 1,
            patternLabel: "Four of a kind",
            sourceLabel: "System",
          },
        },
        enabled: true,
        evaluatorId: evaluator.id,
        detectorId: "d6-nexus.matching-detector.matches-v1",
        version: 1,
      },
      {
        evaluatorId: evaluator.id,
        operationId: "reward-1",
        patternId: result.best.patternId,
        detectorId: "d6-nexus.matching-detector.matches-v1",
      },
    );
    expect(plan).toMatchObject({
      characterPoints: 2,
      metaCurrency: 1,
      patternId: "four-kind",
    });
  });

  it("fails closed for disabled, zero, invalid, or differently scoped policies", () => {
    const base = {
      awards: {
        pair: {
          characterPoints: 0,
          enabled: true,
          metaCurrency: 0,
          patternLabel: "Pair",
          sourceLabel: "System",
        },
      },
      enabled: true,
      evaluatorId: evaluator.id,
      detectorId: "matches",
      version: 1 as const,
    };
    const input = {
      evaluatorId: evaluator.id,
      operationId: "op",
      patternId: "pair",
      detectorId: "matches",
    };
    expect(resolveD6MatchingRewardPlan(base, input)).toBeUndefined();
    expect(
      resolveD6MatchingRewardPlan({ ...base, enabled: false }, input),
    ).toBeUndefined();
    expect(
      resolveD6MatchingRewardPlan({ ...base, evaluatorId: "missing" }, input),
    ).toBeUndefined();
    expect(
      resolveD6MatchingRewardPlan(
        {
          ...base,
          awards: { pair: { ...base.awards.pair, metaCurrency: 1000 } },
        },
        input,
      ),
    ).toBeUndefined();
  });
});
