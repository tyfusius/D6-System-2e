import { describe, expect, it } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
} from "../contracts/roll";
import { buildD6RollPool, resolveD6Roll } from "./roll";

function request(overrides: Partial<D6RollRequestV1> = {}): D6RollRequestV1 {
  return {
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    difficulty: 10,
    heroPointUse: "none",
    kind: "attribute",
    label: "Agility",
    resultModifier: 0,
    rollMode: "publicroll",
    score: 10,
    source: {
      actorId: "actor-1",
      actorName: "Test Character",
      attributeId: "agility",
    },
    ...overrides,
  };
}

describe("D6 roll resolution", () => {
  it("builds the physical pool from the canonical pip score", () => {
    expect(buildD6RollPool(10)).toEqual({
      baseDice: 2,
      code: { dice: 3, pips: 1 },
      resultModifier: 0,
      wildDice: 1,
    });
  });

  it("doubles the complete canonical die code for a Hero Point", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 2, 2, 2, 2],
      profileId: "second-edition",
      request: request({
        heroPointUse: "double-die-code",
        score: 10,
      }),
      successEvaluator: "second-edition-strict",
      wildFaces: [2],
      wildPolicy: "second-edition",
    });
    expect(result.pool.code).toEqual({ dice: 6, pips: 2 });
    expect(result.heroPointSpent).toBe(1);
  });

  it("charges a Hero Point reroll without changing the original pool", () => {
    const result = resolveD6Roll({
      baseFaces: [3, 4],
      profileId: "second-edition",
      request: {
        ...request({ score: 9 }),
        heroPointUse: "reroll-failed",
      },
      successEvaluator: "second-edition-strict",
      wildFaces: [2],
      wildPolicy: "second-edition",
    });
    expect(result.pool.code).toEqual({ dice: 3, pips: 0 });
    expect(result.heroPointSpent).toBe(1);
  });

  it("resolves opposed checks and their Wild Die success context", () => {
    const opposedRequest: D6RollRequestV1 = {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "attribute",
      label: "Agility",
      opposition: {
        actorKind: "player-character",
        name: "Rival",
        opponentKind: "non-player-character",
        total: 10,
      },
      resultModifier: 0,
      rollMode: "publicroll",
      score: 10,
      source: {
        actorId: "actor-1",
        actorName: "Test Character",
        attributeId: "agility",
      },
    };
    const result = resolveD6Roll({
      baseFaces: [4, 4],
      choice: "second-edition-exceptional",
      profileId: "second-edition",
      request: opposedRequest,
      successEvaluator: "second-edition-strict",
      wildFaces: [6],
      wildPolicy: "second-edition",
    });
    expect(result.opposition?.winner).toBe("actor");
    expect(result.success).toBe(true);
    expect(result.wildOutcome).toBe("exceptional-success");
  });

  it("uses strict Second Edition success evaluation", () => {
    const result = resolveD6Roll({
      baseFaces: [3, 3],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [3],
      wildPolicy: "second-edition",
    });
    expect(result.total).toBe(10);
    expect(result.success).toBe(false);
  });

  it("uses meet-or-beat in the First Edition compatibility profile", () => {
    const result = resolveD6Roll({
      baseFaces: [3, 3],
      profileId: "open-d6",
      request: request(),
      successEvaluator: "first-edition-meets",
      wildFaces: [3],
      wildPolicy: "first-edition",
    });
    expect(result.success).toBe(true);
  });

  it("resolves the First Edition exploding Wild Die", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 3],
      profileId: "open-d6",
      request: request(),
      successEvaluator: "first-edition-meets",
      wildFaces: [6, 6, 4],
      wildPolicy: "first-edition",
    });
    expect(result.total).toBe(22);
    expect(result.requiresWildExplosion).toBe(false);
    expect(result.wildOutcome).toBe("exploded");
  });

  it("offers both First Edition critical-failure choices", () => {
    const unresolved = resolveD6Roll({
      baseFaces: [5, 3],
      profileId: "open-d6",
      request: request(),
      successEvaluator: "first-edition-meets",
      wildFaces: [1],
      wildPolicy: "first-edition",
    });
    expect(unresolved.pendingChoices).toEqual([
      "first-edition-remove-highest",
      "first-edition-complication",
    ]);
    const resolved = resolveD6Roll({
      baseFaces: [5, 3],
      choice: "first-edition-remove-highest",
      profileId: "open-d6",
      request: request(),
      successEvaluator: "first-edition-meets",
      wildFaces: [1],
      wildPolicy: "first-edition",
    });
    expect(resolved.total).toBe(4);
  });

  it("implements successful Second Edition Advantage choices and awards", () => {
    const unresolved = resolveD6Roll({
      baseFaces: [5, 5],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [6],
      wildPolicy: "second-edition",
    });
    expect(unresolved.pendingChoices).toEqual([
      "second-edition-exceptional",
      "second-edition-ordinary",
    ]);
    const resolved = resolveD6Roll({
      baseFaces: [5, 5],
      choice: "second-edition-ordinary",
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [6],
      wildPolicy: "second-edition",
    });
    expect(resolved.heroPointAward).toBe(2);
    expect(resolved.wildOutcome).toBe("ordinary-success");
  });

  it("explodes a failed Second Edition Advantage and then reevaluates", () => {
    const result = resolveD6Roll({
      baseFaces: [1, 1],
      profileId: "second-edition",
      request: request({ difficulty: 15 }),
      successEvaluator: "second-edition-strict",
      wildFaces: [6, 6, 4],
      wildPolicy: "second-edition",
    });
    expect(result.total).toBe(19);
    expect(result.success).toBe(true);
    expect(result.heroPointAward).toBe(1);
  });

  it("allows the GM to turn a successful Complication into failure", () => {
    const result = resolveD6Roll({
      baseFaces: [6, 6],
      choice: "second-edition-failure",
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition",
    });
    expect(result.total).toBe(14);
    expect(result.success).toBe(false);
    expect(result.heroPointAward).toBe(2);
  });

  it("leaves a Second Edition Advantage unresolved without a difficulty", () => {
    const requestWithoutDifficulty: D6RollRequestV1 = {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "attribute",
      label: "Agility",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 10,
      source: {
        actorId: "actor-1",
        actorName: "Test Character",
        attributeId: "agility",
      },
    };
    const result = resolveD6Roll({
      baseFaces: [4, 4],
      profileId: "second-edition",
      request: requestWithoutDifficulty,
      successEvaluator: "second-edition-strict",
      wildFaces: [6],
      wildPolicy: "second-edition",
    });
    expect(result.wildOutcome).toBe("unresolved-advantage");
    expect(result.success).toBeUndefined();
    expect(result.heroPointAward).toBe(0);
  });
});
