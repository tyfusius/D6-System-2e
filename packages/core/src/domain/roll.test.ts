import { describe, expect, it } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollRequestV1,
} from "../contracts/roll";
import {
  acceptedWildDieChoice,
  buildD6RollPool,
  effectiveD6RollScore,
  resolveD6Roll,
} from "./roll";

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
  it("applies a character cap after doubling and permits a Hero Point bypass", () => {
    const capped = request({
      context: { superheroicDieCodeCap: { cap: "standard", sourcePage: 208 } },
      heroPointUse: "double-die-code",
      score: 25,
    });
    expect(effectiveD6RollScore(capped)).toBe(47);
    expect(
      effectiveD6RollScore({
        ...capped,
        heroPointUse: "superheroic-bypass-cap",
      }),
    ).toBe(25);
  });
  it("turns a failed Doubling Down retry into a complication without a Hero Point", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 2],
      profileId: "second-edition",
      request: request({
        context: {
          doublingDown: {
            originalTotal: 8,
            sourcePage: 25,
          },
        },
        difficulty: 20,
        score: 9,
      }),
      successEvaluator: "second-edition-strict",
      wildFaces: [3],
      wildPolicy: "second-edition",
    });

    expect(result.success).toBe(false);
    expect(result.wildOutcome).toBe("complication");
    expect(result.heroPointAward).toBe(0);
  });

  it("treats dialog cancellation as no Wild Die choice", () => {
    const choices = [
      "first-edition-remove-highest",
      "first-edition-complication",
    ] as const;
    expect(acceptedWildDieChoice(choices, "cancel")).toBeNull();
    expect(acceptedWildDieChoice(choices, "first-edition-complication")).toBe(
      "first-edition-complication",
    );
  });

  it("builds the physical pool from the canonical pip score", () => {
    expect(buildD6RollPool(10)).toEqual({
      baseDice: 2,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
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

  it("keeps exploding Character Point dice separate from the Wild Die", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 3],
      characterPointFaceGroups: [[6, 4]],
      profileId: "open-d6",
      request: request({
        openD6Resources: { characterPointSpend: 1, fatePoint: "none" },
        score: 10,
      }),
      successEvaluator: "first-edition-meets",
      wildFaces: [4],
      wildPolicy: "first-edition",
    });
    expect(result.pool).toMatchObject({
      baseDice: 2,
      characterPointDice: 1,
      wildDice: 1,
    });
    expect(result.characterPointFaceGroups).toEqual([[6, 4]]);
    expect(result.wildFaces).toEqual([4]);
    expect(result.total).toBe(20);
  });

  it("doubles the full pip score for an active Open D6 Fate Point", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 2, 2, 2, 2],
      profileId: "open-d6",
      request: request({
        openD6Resources: { characterPointSpend: 0, fatePoint: "active" },
        score: 10,
      }),
      successEvaluator: "first-edition-meets",
      wildFaces: [2],
      wildPolicy: "first-edition",
    });
    expect(result.pool.code).toEqual({ dice: 6, pips: 2 });
    expect(result.fatePointsSpent).toBe(0);
  });

  it("requires one physical Character Point result group per point", () => {
    expect(() =>
      resolveD6Roll({
        baseFaces: [2, 3],
        profileId: "open-d6",
        request: request({
          openD6Resources: { characterPointSpend: 1, fatePoint: "none" },
          score: 10,
        }),
        successEvaluator: "first-edition-meets",
        wildFaces: [4],
        wildPolicy: "first-edition",
      }),
    ).toThrow("Expected 1 Character Point dice");
  });

  it("adds Basic Hero Point dice as ordinary non-Wild dice", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 3, 4, 5],
      profileId: "second-edition",
      request: request({
        heroPointSpend: 2,
        heroPointUse: "basic-bonus-dice",
        score: 9,
      }),
      successEvaluator: "second-edition-strict",
      wildFaces: [2],
      wildPolicy: "second-edition-simple",
    });
    expect(result.pool).toMatchObject({
      baseDice: 4,
      bonusOrdinaryDice: 2,
      bonusWildDice: 0,
      wildDice: 1,
    });
    expect(result.total).toBe(16);
    expect(result.heroPointSpent).toBe(2);
  });

  it("adds Classic Hero Point Wild Dice and awards every rolled six", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 3],
      profileId: "second-edition",
      request: request({
        heroPointSpend: 2,
        heroPointUse: "classic-bonus-wild-dice",
        score: 9,
      }),
      successEvaluator: "second-edition-strict",
      wildFaceGroups: [[4], [6, 2], [6, 6, 3]],
      wildFaces: [4, 6, 2, 6, 6, 3],
      wildPolicy: "second-edition-classic",
    });
    expect(result.pool).toMatchObject({ bonusWildDice: 2, wildDice: 3 });
    expect(result.total).toBe(32);
    expect(result.heroPointSpent).toBe(2);
    expect(result.heroPointAward).toBe(3);
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

  it("implements the automatic Basic Wild Die penalty and explosions", () => {
    const penalty = resolveD6Roll({
      baseFaces: [5, 3],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition-basic",
    });
    expect(penalty.total).toBe(4);
    expect(penalty.pendingChoices).toEqual([]);

    const explosion = resolveD6Roll({
      baseFaces: [2, 3],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [6, 6, 4],
      wildPolicy: "second-edition-basic",
    });
    expect(explosion.total).toBe(22);
    expect(explosion.wildOutcome).toBe("exploded");
  });

  it("routes Classic Wild Die mishaps through distinct typed choices", () => {
    const unresolved = resolveD6Roll({
      baseFaces: [5, 3],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition-classic",
    });
    expect(unresolved.pendingChoices).toEqual([
      "second-edition-classic-penalty",
      "second-edition-classic-complication",
    ]);
    const penalty = resolveD6Roll({
      baseFaces: [5, 3],
      choice: "second-edition-classic-penalty",
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition-classic",
    });
    expect(penalty.total).toBe(4);
    const complication = resolveD6Roll({
      baseFaces: [5, 3],
      choice: "second-edition-classic-complication",
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition-classic",
    });
    expect(complication.total).toBe(9);
    expect(complication.wildOutcome).toBe("complication");
  });

  it("makes Simple Wild Die ones ordinary and sixes explosive", () => {
    const one = resolveD6Roll({
      baseFaces: [5, 3],
      profileId: "second-edition",
      request: request(),
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition-simple",
    });
    expect(one.total).toBe(10);
    expect(one.wildOutcome).toBe("normal");
    expect(one.heroPointAward).toBe(0);
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

  it("leaves a Second Edition Complication unresolved without a difficulty", () => {
    const { difficulty, ...requestWithoutDifficulty } = request();
    void difficulty;
    const result = resolveD6Roll({
      baseFaces: [4, 4],
      profileId: "second-edition",
      request: requestWithoutDifficulty,
      successEvaluator: "second-edition-strict",
      wildFaces: [1],
      wildPolicy: "second-edition",
    });
    expect(result.wildOutcome).toBe("unresolved-complication");
    expect(result.pendingChoices).toEqual([]);
    expect(result.success).toBeUndefined();
    expect(result.heroPointAward).toBe(0);
  });

  it("records a Wild Triumph without replacing the normal difficulty result", () => {
    const result = resolveD6Roll({
      baseFaces: [1, 1],
      profileId: "second-edition",
      request: request({ difficulty: 50 }),
      successEvaluator: "second-edition-strict",
      wildFaceGroups: [[6, 6, 6, 2]],
      wildFaces: [6, 6, 6, 2],
      wildPolicy: "second-edition",
      wildTriumph: {
        automaticSuccess: false,
        characterPointAward: 2,
        enabled: true,
        metaCurrencyAward: 1,
        threshold: 3,
      },
    });

    expect(result.success).toBe(false);
    expect(result.wildTriumph).toEqual({
      automaticSuccessApplied: false,
      characterPointAward: 2,
      consecutiveSixes: 3,
      metaCurrencyAward: 1,
      successful: false,
      threshold: 3,
      triggered: true,
    });
  });

  it("can make a Wild Triumph an automatic fixed-difficulty success", () => {
    const result = resolveD6Roll({
      baseFaces: [1, 1],
      profileId: "second-edition",
      request: request({ difficulty: 50 }),
      successEvaluator: "second-edition-strict",
      wildFaceGroups: [[6, 6, 6, 2]],
      wildFaces: [6, 6, 6, 2],
      wildPolicy: "second-edition",
      wildTriumph: {
        automaticSuccess: true,
        characterPointAward: 0,
        enabled: true,
        metaCurrencyAward: 0,
        threshold: 3,
      },
    });

    expect(result.success).toBe(true);
    expect(result.wildTriumph?.automaticSuccessApplied).toBe(true);
  });

  it("never turns a Wild Triumph into an automatic opposed-roll win", () => {
    const { difficulty, ...opposedRequest } = request({
      opposition: {
        actorKind: "player-character",
        name: "Opponent",
        opponentKind: "non-player-character",
        total: 50,
      },
    });
    void difficulty;
    const result = resolveD6Roll({
      baseFaces: [1, 1],
      profileId: "second-edition",
      request: opposedRequest,
      successEvaluator: "second-edition-strict",
      wildFaceGroups: [[6, 6, 6, 2]],
      wildFaces: [6, 6, 6, 2],
      wildPolicy: "second-edition",
      wildTriumph: {
        automaticSuccess: true,
        characterPointAward: 0,
        enabled: true,
        metaCurrencyAward: 0,
        threshold: 3,
      },
    });

    expect(result.success).toBe(false);
    expect(result.opposition?.winner).toBe("opponent");
    expect(result.wildTriumph?.automaticSuccessApplied).toBe(false);
  });

  it("persists the D6MV six-degree result and player Advantage choices", () => {
    const pending = resolveD6Roll({
      baseFaces: [5, 5],
      profileId: "d6mv",
      request: request({ difficulty: 15, score: 9 }),
      successEvaluator: "first-edition-meets",
      wildFaces: [6],
      wildPolicy: "d6mv",
    });
    expect(pending.pendingChoices).toEqual([
      "d6mv-advantage-success-exceptional",
      "d6mv-advantage-success-two-hero-points",
      "d6mv-advantage-success-ally-hero-point",
    ]);
    const resolved = resolveD6Roll({
      baseFaces: [5, 5],
      choice: "d6mv-advantage-success-exceptional",
      profileId: "d6mv",
      request: request({ difficulty: 15, score: 9 }),
      successEvaluator: "first-edition-meets",
      wildFaces: [6],
      wildPolicy: "d6mv",
    });
    expect(resolved.d6mv).toMatchObject({
      allyHeroPointAward: 0,
      damageMultiplier: 2,
      degree: "exceptional-success",
      selfHeroPointAward: 1,
      version: 1,
    });
    expect(resolved.heroPointAward).toBe(1);
    expect(resolved.success).toBe(true);
  });

  it("evaluates a D6MV opposed check against the immutable opposing total", () => {
    const { difficulty, ...opposed } = request({
      opposition: {
        actorKind: "player-character",
        name: "Opponent",
        opponentKind: "non-player-character",
        total: 12,
      },
      score: 9,
    });
    void difficulty;
    const result = resolveD6Roll({
      baseFaces: [4, 3],
      profileId: "d6mv",
      request: opposed,
      successEvaluator: "first-edition-meets",
      wildFaces: [5],
      wildPolicy: "d6mv",
    });

    expect(result.total).toBe(12);
    expect(result.d6mv).toMatchObject({
      degree: "partial-success",
      difficulty: 12,
      margin: 0,
      setback: true,
    });
    expect(result.success).toBe(true);
  });

  it("uses the D6MV Complication authority choices and explodes only the selected failure option", () => {
    const pending = resolveD6Roll({
      baseFaces: [2, 2],
      profileId: "d6mv",
      request: request({ difficulty: 15, score: 9 }),
      successEvaluator: "first-edition-meets",
      wildFaces: [1],
      wildPolicy: "d6mv",
    });
    expect(pending.pendingChoices).toEqual([
      "d6mv-complication-failure-setback",
      "d6mv-complication-failure-exceptional",
      "d6mv-complication-failure-catastrophic",
    ]);
    const exploding = resolveD6Roll({
      baseFaces: [1, 1],
      choice: "d6mv-advantage-failure-explode",
      profileId: "d6mv",
      request: request({ difficulty: 30, score: 9 }),
      successEvaluator: "first-edition-meets",
      wildFaceGroups: [[6]],
      wildFaces: [6],
      wildPolicy: "d6mv",
    });
    expect(exploding.requiresWildExplosion).toBe(true);
    const completed = resolveD6Roll({
      baseFaces: [1, 1],
      choice: "d6mv-advantage-failure-explode",
      profileId: "d6mv",
      request: request({ difficulty: 30, score: 9 }),
      successEvaluator: "first-edition-meets",
      wildFaceGroups: [[6, 4]],
      wildFaces: [6, 4],
      wildPolicy: "d6mv",
    });
    expect(completed.requiresWildExplosion).toBe(false);
    expect(completed.total).toBe(12);
    expect(completed.d6mv?.selfHeroPointAward).toBe(1);
  });

  it("applies an explicit D6MV scale multiplier to the completed total once", () => {
    const result = resolveD6Roll({
      baseFaces: [2, 3],
      profileId: "d6mv",
      request: request({
        context: {
          scale: {
            application: "damage",
            family: "scalar",
            modifierScore: 0,
            sourceActorId: "source",
            sourceName: "Source",
            sourceRank: 2,
            sourcePage: 65,
            strategyId: "d6mv.scale.three-rank",
            targetActorId: "target",
            targetName: "Target",
            targetRank: 0,
            totalMultiplier: 4,
          },
        },
        difficulty: 30,
        score: 9,
      }),
      successEvaluator: "first-edition-meets",
      wildFaces: [4],
      wildPolicy: "d6mv",
    });

    expect(result.total).toBe(36);
    expect(result.d6mv).toMatchObject({
      degree: "ordinary-success",
      margin: 6,
    });
  });
});
