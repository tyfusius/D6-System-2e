import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import {
  damageResolutionStatus,
  damageScaleContext,
  skipsFirstEditionBodyPointResistanceRoll,
} from "./damage-resolution";

function rollResult(
  kind: D6RollResultV1["request"]["kind"],
  application: "attack" | "damage" | "resistance",
): D6RollResultV1 {
  return {
    baseFaces: [4],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: [],
    pool: {
      baseDice: 1,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 2, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      context: {
        scale: {
          application,
          modifierScore: 0,
          sourceActorId: "attacker",
          sourceName: "Attacker",
          sourcePage: 196,
          sourceRank: 0,
          sourceTokenId: "attacker-token",
          targetActorId: "target",
          targetName: "Target",
          targetRank: 0,
          targetTokenId: "target-token",
        },
      },
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind,
      label: "Damage",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 6,
      source: {
        actorId: "attacker",
        actorName: "Attacker",
        attributeId: "agility",
      },
    },
    requiresWildExplosion: false,
    total: 7,
    wildFaces: [3],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
  };
}

describe("Second Edition damage chat workflow", () => {
  it("accepts only damage rolls with damage-scale target context", () => {
    expect(damageScaleContext(rollResult("damage", "damage"))).toMatchObject({
      application: "damage",
      targetActorId: "target",
      targetTokenId: "target-token",
    });
    expect(damageScaleContext(rollResult("damage", "attack"))).toBeNull();
    expect(
      damageScaleContext(rollResult("weapon-attack", "damage")),
    ).toBeNull();
  });

  it("recognizes only versioned resolving and applied claims", () => {
    expect(damageResolutionStatus({ status: "resolving", version: 1 })).toBe(
      "resolving",
    );
    expect(damageResolutionStatus({ status: "applied", version: 1 })).toBe(
      "applied",
    );
    expect(
      damageResolutionStatus({ status: "applied", version: 2 }),
    ).toBeNull();
    expect(damageResolutionStatus(null)).toBeNull();
  });

  it("skips an impossible 0D armor roll for unarmored Body Point targets", () => {
    expect(
      skipsFirstEditionBodyPointResistanceRoll(
        "open-d6-wounds-or-body-points",
        "body-points",
        0,
      ),
    ).toBe(true);
    expect(
      skipsFirstEditionBodyPointResistanceRoll(
        "open-d6-wounds-or-body-points",
        "body-points-with-wounds",
        0,
      ),
    ).toBe(true);
    expect(
      skipsFirstEditionBodyPointResistanceRoll(
        "open-d6-wounds-or-body-points",
        "wounds",
        0,
      ),
    ).toBe(false);
    expect(
      skipsFirstEditionBodyPointResistanceRoll(
        "open-d6-wounds-or-body-points",
        "body-points",
        3,
      ),
    ).toBe(false);
  });
});
