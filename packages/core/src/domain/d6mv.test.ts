import { describe, expect, it } from "vitest";
import {
  accumulateD6MvInjury,
  accumulateD6MvTrauma,
  applyD6MvWildChoice,
  d6MvAttributeImprovementCost,
  d6MvBasicActionPenaltyScore,
  d6MvDegree,
  d6MvDegreeEvidence,
  d6MvCombinedPenaltyScore,
  d6MvFatigueState,
  d6MvFullDefenseBonus,
  d6MvInjuryForDamage,
  d6MvInitiativePlan,
  d6MvInitiativeSkill,
  d6MvInjuryRecoveryRule,
  d6MvMortalityResolution,
  d6MvMovementAction,
  d6MvScaleInteraction,
  d6MvSkillImprovementCost,
  d6MvSrp,
  D6MV_SURPRISE_ACTION,
  d6MvTraumaForAttack,
  d6MvTraumaRecoveryRule,
  d6MvVsm,
  d6MvWildDecision,
} from "./d6mv";

describe("D6MV neutral mechanics", () => {
  it("resolves all six fixed-difficulty degrees at their exact boundaries", () => {
    expect(d6MvDegree(31, 15)).toBe("exceptional-success");
    expect(d6MvDegree(30, 15)).toBe("ordinary-success");
    expect(d6MvDegree(16, 15)).toBe("ordinary-success");
    expect(d6MvDegree(15, 15)).toBe("partial-success");
    expect(d6MvDegree(14, 15)).toBe("ordinary-failure");
    expect(d6MvDegree(6, 15)).toBe("ordinary-failure");
    expect(d6MvDegree(5, 15)).toBe("exceptional-failure");
    expect(d6MvDegree(-4, 15)).toBe("exceptional-failure");
    expect(d6MvDegree(-5, 15)).toBe("catastrophic-failure");
    expect(d6MvDegreeEvidence(31, 15)).toMatchObject({
      achieved: true,
      consequence: "none",
      damageMultiplier: 2,
      margin: 16,
    });
    expect(d6MvDegreeEvidence(15, 15)).toMatchObject({
      achieved: true,
      consequence: "setback",
      damageMultiplier: 1,
    });
    expect(d6MvDegreeEvidence(5, 15).consequence).toBe("looming");
    expect(d6MvDegreeEvidence(-5, 15).consequence).toBe("immediate");
  });

  it("derives SRP from whole attribute dice and drops pips", () => {
    expect(
      d6MvSrp({ dexterityScore: 11, perceptionScore: 7, willpowerScore: 9 }),
    ).toEqual({ psyche: 9, ready: 9, surprised: 6 });
  });

  it("chooses the readiness-sensitive initiative skill", () => {
    expect(d6MvInitiativeSkill("unaware")).toBe("instinct");
    expect(d6MvInitiativeSkill("ready")).toBe("reflex");
  });

  it("uses the highest individual per side, rerolls each round, and gives player sides the tie", () => {
    const plan = d6MvInitiativePlan([
      {
        id: "pc-a",
        kind: "player",
        readiness: "ready",
        sideId: "pcs",
        total: 14,
      },
      {
        id: "pc-b",
        kind: "player",
        readiness: "ready",
        sideId: "pcs",
        total: 10,
      },
      {
        id: "npc-a",
        kind: "npc",
        readiness: "unaware",
        sideId: "foes",
        total: 14,
      },
      {
        id: "third",
        kind: "npc",
        readiness: "ready",
        sideId: "third",
        total: 8,
      },
    ]);
    expect(plan).toEqual({
      order: [
        { highest: 14, representativeId: "pc-a", sideId: "pcs" },
        { highest: 14, representativeId: "npc-a", sideId: "foes" },
        { highest: 8, representativeId: "third", sideId: "third" },
      ],
      rerollEachRound: true,
    });
    expect(D6MV_SURPRISE_ACTION).toEqual({
      beforeInitiative: true,
      choices: ["one-basic", "movement-and-basic"],
    });
  });

  it("keeps exact Quick/Basic movement and multiple-Basic penalties", () => {
    expect(d6MvMovementAction(6)).toBe("quick");
    expect(d6MvMovementAction(7)).toBe("basic");
    expect(d6MvMovementAction(12)).toBe("basic");
    expect(() => d6MvMovementAction(13)).toThrow(RangeError);
    expect(d6MvBasicActionPenaltyScore(1)).toBe(0);
    expect(d6MvBasicActionPenaltyScore(3)).toBe(6);
  });

  it("models the exact Advantage and Complication decision authorities and awards", () => {
    expect(d6MvWildDecision(6, "ordinary-success")).toEqual({
      authority: "player",
      choices: [
        "advantage-success-exceptional",
        "advantage-success-two-hero-points",
        "advantage-success-ally-hero-point",
      ],
      kind: "advantage",
    });
    expect(d6MvWildDecision(1, "ordinary-failure")).toEqual({
      authority: "game-master",
      choices: [
        "complication-failure-setback",
        "complication-failure-exceptional",
        "complication-failure-catastrophic",
      ],
      kind: "complication",
    });
    expect(d6MvWildDecision(4, "ordinary-success")).toBeNull();
    expect(
      applyD6MvWildChoice(
        "ordinary-success",
        6,
        "advantage-success-exceptional",
      ),
    ).toEqual({
      allyHeroPoints: 0,
      degree: "exceptional-success",
      requiresExplosion: false,
      selfHeroPoints: 1,
      setback: false,
    });
    expect(
      applyD6MvWildChoice("ordinary-failure", 6, "advantage-failure-explode"),
    ).toMatchObject({ requiresExplosion: true, selfHeroPoints: 1 });
    expect(
      applyD6MvWildChoice(
        "ordinary-success",
        1,
        "complication-success-partial",
      ),
    ).toMatchObject({ degree: "partial-success", selfHeroPoints: 1 });
    expect(() =>
      applyD6MvWildChoice(
        "ordinary-success",
        1,
        "advantage-success-exceptional",
      ),
    ).toThrow(RangeError);
  });

  it("models the three neutral scales without setting content", () => {
    expect(d6MvScaleInteraction("character", "vehicle")).toEqual({
      multiplier: 2,
      side: "target-resistance",
    });
    expect(d6MvScaleInteraction("grand", "character")).toEqual({
      multiplier: 4,
      side: "source-damage",
    });
    expect(d6MvScaleInteraction("vehicle", "vehicle")).toEqual({
      multiplier: 1,
      side: "none",
    });
  });

  it("applies Full Defense only while no other Basic action is taken", () => {
    expect(
      d6MvFullDefenseBonus({
        kind: "physical",
        skillScore: 8,
        tookOtherBasicAction: false,
      }),
    ).toBe(8);
    expect(
      d6MvFullDefenseBonus({
        kind: "mental",
        skillScore: 9,
        tookOtherBasicAction: true,
      }),
    ).toBe(0);
  });

  it("resolves physical injury, repeated injury, trauma, and Fatigue exactly", () => {
    expect(d6MvInjuryForDamage(8, 9)).toBe("stunned");
    expect(d6MvInjuryForDamage(9, 9)).toBe("wounded");
    expect(d6MvInjuryForDamage(18, 9)).toBe("incapacitated");
    expect(d6MvInjuryForDamage(27, 9)).toBe("mortally-wounded");
    expect(accumulateD6MvInjury("wounded", "wounded")).toBe("incapacitated");
    expect(accumulateD6MvInjury("incapacitated", "wounded")).toBe(
      "mortally-wounded",
    );
    expect(accumulateD6MvInjury("mortally-wounded", "wounded")).toBe("dead");
    expect(d6MvTraumaForAttack(8, 9)).toBe("none");
    expect(d6MvTraumaForAttack(9, 9)).toBe("stunned");
    expect(d6MvTraumaForAttack(18, 9)).toBe("shaken");
    expect(d6MvTraumaForAttack(27, 9)).toBe("traumatized");
    expect(d6MvTraumaForAttack(36, 9)).toBe("severely-traumatized");
    expect(d6MvFatigueState(2, 9)).toEqual({
      level: 2,
      mortallyWounded: false,
      penaltyScore: 6,
    });
    expect(d6MvFatigueState(3, 9).mortallyWounded).toBe(true);
    expect(accumulateD6MvTrauma("shaken", "stunned")).toBe("shaken");
    expect(accumulateD6MvTrauma("shaken", "traumatized")).toBe("traumatized");
    expect(
      d6MvCombinedPenaltyScore({
        fatigueLevel: 2,
        injury: "wounded",
        trauma: "shaken",
      }),
    ).toBe(12);
  });

  it("models injury, trauma, natural-healing, and mortality recovery boundaries", () => {
    expect(d6MvInjuryRecoveryRule("stunned")).toEqual({
      difficulty: 5,
      next: "healthy",
      reduction: "full",
    });
    expect(d6MvInjuryRecoveryRule("wounded").next).toBe("healthy");
    expect(d6MvInjuryRecoveryRule("incapacitated")).toMatchObject({
      difficulty: 15,
      next: "wounded",
    });
    expect(d6MvInjuryRecoveryRule("mortally-wounded")).toMatchObject({
      difficulty: 20,
      next: "incapacitated",
    });
    expect(d6MvTraumaRecoveryRule("stunned")).toMatchObject({
      difficulty: null,
      next: "none",
    });
    expect(d6MvTraumaRecoveryRule("shaken").difficulty).toBe(10);
    expect(d6MvTraumaRecoveryRule("traumatized").difficulty).toBe(15);
    expect(d6MvTraumaRecoveryRule("severely-traumatized").difficulty).toBe(20);
    expect(d6MvMortalityResolution(2, 3).died).toBe(true);
    expect(d6MvMortalityResolution(3, 3).died).toBe(false);
  });

  it("derives source-defined Static and Mobile vehicle defenses from whole dice", () => {
    expect(
      d6MvVsm({
        frameScore: 8,
        maneuverabilityScore: 17,
        scale: "vehicle",
      }),
    ).toEqual({ mobile: 6, static: 1 });
    expect(
      d6MvVsm({
        frameScore: 20,
        maneuverabilityScore: 5,
        scale: "grand",
      }),
    ).toEqual({ mobile: -5, static: -6 });
  });

  it("rejects VSM inputs outside the neutral vehicle/grand-scale contract", () => {
    expect(() =>
      d6MvVsm({
        frameScore: 6,
        maneuverabilityScore: 9,
        scale: "character",
      }),
    ).toThrow(RangeError);
    expect(() =>
      d6MvVsm({
        frameScore: -1,
        maneuverabilityScore: 9,
        scale: "vehicle",
      }),
    ).toThrow(RangeError);
  });

  it("uses distinct skill-point and Hero-point improvement costs", () => {
    expect(d6MvSkillImprovementCost(6)).toBe(2);
    expect(d6MvSkillImprovementCost(8)).toBe(2);
    expect(d6MvAttributeImprovementCost(10)).toBe(18);
  });

  it("rejects unsafe or negative mechanical inputs", () => {
    expect(() => d6MvDegree(10.5, 10)).toThrow(RangeError);
    expect(() =>
      d6MvSrp({ dexterityScore: -1, perceptionScore: 3, willpowerScore: 3 }),
    ).toThrow(RangeError);
    expect(() => d6MvSkillImprovementCost(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    );
  });
});
