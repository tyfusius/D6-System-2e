import { describe, expect, it } from "vitest";
import {
  canPreventBecomingStunned,
  canRerollFailedRoll,
  heroPointBalanceAfter,
  heroPointRerollRequest,
} from "./hero-points";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "../contracts/roll";

function failedResult(
  heroPointSpent: 0 | 1 = 0,
  success: boolean | "unresolved" = false,
): D6RollResultV1 {
  return {
    baseFaces: [2],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent,
    pendingChoices: [],
    pool: {
      baseDice: 1,
      code: { dice: 2, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      difficulty: 10,
      heroPointUse: heroPointSpent === 1 ? "double-die-code" : "none",
      kind: "skill",
      label: "Climbing",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 6,
      source: {
        actorId: "actor-1",
        actorName: "Hero",
        attributeId: "agility",
        itemId: "skill-1",
      },
    },
    requiresWildExplosion: false,
    ...(success === "unresolved" ? {} : { success }),
    total: 4,
    wildFaces: [2],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
  };
}

describe("Hero Point transaction", () => {
  it("applies one expenditure and an award atomically", () => {
    expect(heroPointBalanceAfter(2, 1, 2)).toBe(3);
  });

  it("rejects overspending", () => {
    expect(() => heroPointBalanceAfter(0, 1, 0)).toThrow(RangeError);
  });

  it("builds a reroll from a failed typed request without doubling the pool", () => {
    const request = heroPointRerollRequest(failedResult());
    expect(request).toMatchObject({
      difficulty: 10,
      heroPointUse: "reroll-failed",
      label: "Climbing",
      score: 6,
    });
    expect(Object.isFrozen(request)).toBe(true);
  });

  it("rejects successful, unresolved, and previously enhanced rolls", () => {
    expect(canRerollFailedRoll(failedResult())).toBe(true);
    expect(canRerollFailedRoll(failedResult(0, true))).toBe(false);
    expect(canRerollFailedRoll(failedResult(0, "unresolved"))).toBe(false);
    expect(canRerollFailedRoll(failedResult(1))).toBe(false);
    expect(() => heroPointRerollRequest(failedResult(1))).toThrow(RangeError);
  });

  it("only prevents a transition into Stunned", () => {
    expect(canPreventBecomingStunned("healthy", "stunned")).toBe(true);
    expect(canPreventBecomingStunned("staggered", "stunned")).toBe(true);
    expect(canPreventBecomingStunned("stunned", "stunned")).toBe(false);
    expect(canPreventBecomingStunned("stunned", "healthy")).toBe(false);
  });
});
