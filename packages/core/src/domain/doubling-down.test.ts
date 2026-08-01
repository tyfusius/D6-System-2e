import { describe, expect, it } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "../contracts/roll";
import { canDoubleDown, doublingDownRequest } from "./doubling-down";

function failedResult(changes: Partial<D6RollResultV1> = {}): D6RollResultV1 {
  return {
    baseFaces: [2, 2],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    difficulty: { difficulty: 12, margin: -5, score: 7, success: false },
    heroPointAward: 0,
    heroPointSpent: 1,
    pendingChoices: [],
    pool: {
      baseDice: 2,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 3, pips: 1 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      difficulty: 12,
      heroPointUse: "double-die-code",
      kind: "skill",
      label: "Climbing",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 5,
      source: {
        actorId: "actor-1",
        actorName: "Hero",
        attributeId: "agility",
        itemId: "skill-1",
      },
    },
    requiresWildExplosion: false,
    success: false,
    total: 7,
    wildFaces: [3],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
    ...changes,
  };
}

describe("Doubling Down", () => {
  it("retries the complete previously rolled Die Code without charging again", () => {
    const request = doublingDownRequest(
      failedResult(),
      "I find a safer handhold.",
    );

    expect(request).toMatchObject({
      context: {
        doublingDown: {
          narration: "I find a safer handhold.",
          originalTotal: 7,
          sourcePage: 25,
        },
      },
      heroPointUse: "none",
      score: 10,
    });
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.context)).toBe(true);
  });

  it("allows one completed failed non-combat Attribute or Skill roll", () => {
    expect(canDoubleDown(failedResult())).toBe(true);
    expect(
      canDoubleDown(
        failedResult({
          request: { ...failedResult().request, kind: "attribute" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects successes, unresolved rolls, combat actions, and repeat retries", () => {
    expect(canDoubleDown(failedResult({ success: true }))).toBe(false);
    const { success, ...unresolved } = failedResult();
    expect(success).toBe(false);
    expect(canDoubleDown(unresolved)).toBe(false);
    expect(
      canDoubleDown(
        failedResult({
          request: { ...failedResult().request, kind: "weapon-attack" },
        }),
      ),
    ).toBe(false);
    expect(
      canDoubleDown(
        failedResult({
          request: {
            ...failedResult().request,
            context: {
              actionEconomy: {
                actionCount: 1,
                penaltyLabel: "No penalty",
                penaltyScore: 0,
                round: 1,
              },
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      canDoubleDown(
        failedResult({ request: doublingDownRequest(failedResult()) }),
      ),
    ).toBe(false);
  });
});
