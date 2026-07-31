import { describe, expect, it } from "vitest";
import {
  FIRST_EDITION_WOUND_LEVELS,
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionDamageResolution,
  firstEditionMortalityResolution,
  firstEditionNaturalHealingResolution,
  firstEditionNaturalHealingRule,
  firstEditionWoundPenaltyScore,
  isSecondEditionCondition,
  multipleActionPenaltyScore,
  SECOND_EDITION_CONDITIONS,
  secondEditionAttackHits,
  secondEditionConditionAllowsActions,
  secondEditionConditionPenaltyScore,
  secondEditionDamageResolution,
  secondEditionDeclarationPlan,
  secondEditionDefenseForPosture,
  secondEditionDefenseKind,
  secondEditionMovementPlan,
  secondEditionRangeForDistance,
  secondEditionResistancePlan,
  secondEditionRoundStartCondition,
  secondEditionScaleInteraction,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
} from "./combat";

describe("First Edition wound levels", () => {
  it("publishes the verified Space wound track and penalties", () => {
    expect(FIRST_EDITION_WOUND_LEVELS).toEqual([
      "healthy",
      "stunned",
      "wounded",
      "severely-wounded",
      "incapacitated",
      "mortally-wounded",
      "dead",
    ]);
    expect(firstEditionWoundPenaltyScore("wounded")).toBe(3);
    expect(firstEditionWoundPenaltyScore("severely-wounded")).toBe(6);
    expect(firstEditionWoundPenaltyScore("incapacitated")).toBe(9);
  });

  it("uses damage minus resistance for the printed wound thresholds", () => {
    expect(firstEditionDamageResolution(10, 10, "healthy")).toMatchObject({
      difference: 0,
      incoming: "none",
      nextWound: "healthy",
    });
    expect(firstEditionDamageResolution(10, 7, "healthy")).toMatchObject({
      incoming: "stunned",
      nextWound: "stunned",
    });
    expect(firstEditionDamageResolution(12, 7, "healthy")).toMatchObject({
      incoming: "wounded",
      nextWound: "wounded",
    });
    expect(firstEditionDamageResolution(20, 7, "healthy")).toMatchObject({
      incoming: "mortally-wounded",
      nextWound: "mortally-wounded",
    });
    expect(firstEditionDamageResolution(23, 7, "healthy")).toMatchObject({
      incoming: "dead",
      nextWound: "dead",
    });
  });

  it("advances repeated or lesser injuries one level", () => {
    expect(firstEditionDamageResolution(8, 3, "wounded")).toMatchObject({
      incoming: "wounded",
      nextWound: "severely-wounded",
    });
    expect(
      firstEditionDamageResolution(4, 3, "severely-wounded"),
    ).toMatchObject({ incoming: "stunned", nextWound: "incapacitated" });
    expect(
      firstEditionDamageResolution(12, 3, "mortally-wounded"),
    ).toMatchObject({ incoming: "incapacitated", nextWound: "dead" });
  });

  it("models the printed natural healing rest periods and result tables", () => {
    expect(firstEditionNaturalHealingRule("stunned")).toEqual({
      restAmount: 1,
      restUnit: "minute",
    });
    expect(firstEditionNaturalHealingRule("mortally-wounded")).toEqual({
      restAmount: 5,
      restUnit: "weeks",
      successDifficulty: 8,
    });
    expect(firstEditionNaturalHealingResolution("stunned", 0)).toMatchObject({
      nextWound: "healthy",
      outcome: "automatic",
    });
    expect(firstEditionNaturalHealingResolution("wounded", 6)).toMatchObject({
      nextWound: "healthy",
      outcome: "improved",
    });
    expect(
      firstEditionNaturalHealingResolution("severely-wounded", 5),
    ).toMatchObject({
      nextWound: "severely-wounded",
      outcome: "unchanged",
    });
    expect(
      firstEditionNaturalHealingResolution("incapacitated", 2, true),
    ).toMatchObject({
      nextWound: "mortally-wounded",
      outcome: "worsened",
    });
    expect(
      firstEditionNaturalHealingResolution("mortally-wounded", 2, true),
    ).toMatchObject({
      nextWound: "dead",
      outcome: "dead",
    });
  });

  it("uses fixed assisted-healing difficulties and improves one level", () => {
    expect(firstEditionAssistedHealingDifficulty("stunned")).toBe(10);
    expect(firstEditionAssistedHealingDifficulty("wounded")).toBe(15);
    expect(firstEditionAssistedHealingDifficulty("incapacitated")).toBe(20);
    expect(firstEditionAssistedHealingDifficulty("mortally-wounded")).toBe(25);
    expect(firstEditionAssistedHealingDifficulty("dead")).toBeNull();
    expect(firstEditionAssistedHealingResolution("wounded", 15)).toMatchObject({
      nextWound: "stunned",
      outcome: "improved",
    });
    expect(
      firstEditionAssistedHealingResolution("mortally-wounded", 24),
    ).toMatchObject({
      nextWound: "mortally-wounded",
      outcome: "unchanged",
    });
  });

  it("checks mortality against elapsed whole minutes", () => {
    expect(firstEditionMortalityResolution(4, 4)).toBe("survived");
    expect(firstEditionMortalityResolution(4, 3)).toBe("dead");
    expect(() => firstEditionMortalityResolution(0, 10)).toThrow(RangeError);
  });
});

describe("Second Edition combat values", () => {
  it("uses five per full attribute die for static defenses", () => {
    expect(secondEditionStaticDefense(6)).toBe(10);
    expect(secondEditionStaticDefense(8)).toBe(10);
    expect(secondEditionStaticDefense(9)).toBe(15);
  });

  it("applies one die per action after the first", () => {
    expect(multipleActionPenaltyScore(1)).toBe(0);
    expect(multipleActionPenaltyScore(2)).toBe(3);
    expect(multipleActionPenaltyScore(4)).toBe(9);
  });

  it("publishes and validates the persistent condition track", () => {
    expect(SECOND_EDITION_CONDITIONS).toEqual([
      "healthy",
      "staggered",
      "stunned",
      "wounded",
      "incapacitated",
      "mortally-wounded",
      "dead",
    ]);
    expect(isSecondEditionCondition("mortally-wounded")).toBe(true);
    expect(isSecondEditionCondition("severely-wounded")).toBe(false);
  });

  it("models condition action eligibility and penalties", () => {
    expect(secondEditionConditionPenaltyScore("healthy")).toBe(0);
    expect(secondEditionConditionPenaltyScore("staggered")).toBe(3);
    expect(secondEditionConditionPenaltyScore("wounded")).toBe(3);
    expect(secondEditionConditionAllowsActions("wounded")).toBe(true);
    expect(secondEditionConditionAllowsActions("stunned")).toBe(false);
    expect(secondEditionConditionAllowsActions("incapacitated")).toBe(false);
  });

  it("uses Brawn greater than Damage for Staggered and repeats into Stunned", () => {
    expect(secondEditionDamageResolution(8, 9, false, "healthy")).toMatchObject(
      {
        incoming: "staggered",
        nextCondition: "staggered",
      },
    );
    expect(
      secondEditionDamageResolution(8, 9, false, "staggered"),
    ).toMatchObject({
      incoming: "staggered",
      nextCondition: "stunned",
    });
  });

  it("uses ties or lower Brawn for Wounded and progresses repeated wounds", () => {
    expect(secondEditionDamageResolution(8, 8, false, "healthy")).toMatchObject(
      {
        incoming: "wounded",
        nextCondition: "wounded",
      },
    );
    expect(secondEditionDamageResolution(8, 7, false, "wounded")).toMatchObject(
      {
        incoming: "wounded",
        nextCondition: "incapacitated",
      },
    );
    expect(
      secondEditionDamageResolution(8, 7, false, "incapacitated"),
    ).toMatchObject({
      incoming: "wounded",
      nextCondition: "mortally-wounded",
    });
  });

  it("uses only a Brawn complication to escalate a failed resistance", () => {
    expect(secondEditionDamageResolution(8, 8, true, "healthy")).toMatchObject({
      incoming: "mortally-wounded",
      nextCondition: "mortally-wounded",
      resistanceComplication: true,
    });
    expect(secondEditionDamageResolution(8, 9, true, "healthy")).toMatchObject({
      incoming: "staggered",
      nextCondition: "staggered",
      resistanceComplication: true,
    });
  });

  it("never downgrades an existing severe condition", () => {
    expect(secondEditionDamageResolution(8, 9, false, "wounded")).toMatchObject(
      {
        nextCondition: "wounded",
      },
    );
    expect(
      secondEditionDamageResolution(8, 7, false, "mortally-wounded"),
    ).toMatchObject({
      nextCondition: "mortally-wounded",
    });
    expect(secondEditionDamageResolution(8, 7, true, "dead")).toMatchObject({
      nextCondition: "dead",
    });
  });

  it("rejects declarations that reduce any selected pool below 1D", () => {
    expect(
      secondEditionDeclarationPlan(4, "healthy", "hold", [
        { id: "shooting", kind: "skill", label: "Shooting", score: 9 },
      ]),
    ).toMatchObject({
      actionPenaltyScore: 9,
      legal: false,
      pools: [{ effectiveScore: 0, legal: false }],
    });
    expect(
      secondEditionDeclarationPlan(3, "healthy", "hold", [
        { id: "shooting", kind: "skill", label: "Shooting", score: 9 },
      ]),
    ).toMatchObject({
      actionPenaltyScore: 6,
      legal: true,
      pools: [{ effectiveScore: 3, legal: true }],
    });
  });

  it("applies running only to skills while wounds affect every roll pool", () => {
    expect(
      secondEditionDeclarationPlan(2, "wounded", "run", [
        { id: "agility", kind: "attribute", label: "Agility", score: 9 },
        { id: "shooting", kind: "skill", label: "Shooting", score: 12 },
      ]),
    ).toMatchObject({
      actionPenaltyScore: 3,
      conditionPenaltyScore: 3,
      legal: true,
      movementSkillPenaltyScore: 3,
      pools: [
        { effectiveScore: 3, legal: true },
        { effectiveScore: 3, legal: true },
      ],
    });
  });

  it("resolves weapon ranges without changing the core static defense", () => {
    const ranges = { short: 10, medium: 30, long: 50 };
    expect(secondEditionWeaponAttackKind(ranges)).toBe("ranged");
    expect(secondEditionDefenseKind("ranged")).toBe("dodge");
    expect(secondEditionRangeForDistance(10, ranges)).toMatchObject({
      attackKind: "ranged",
      band: "short",
      outOfRange: false,
    });
    expect(secondEditionRangeForDistance(11, ranges)).toMatchObject({
      band: "medium",
    });
    expect(secondEditionRangeForDistance(50, ranges)).toMatchObject({
      band: "long",
    });
    expect(secondEditionRangeForDistance(51, ranges)).toMatchObject({
      band: null,
      outOfRange: true,
    });
  });

  it("uses Parry and adjacency for weapons without ranged bands", () => {
    const ranges = { short: 0, medium: 0, long: 0 };
    expect(secondEditionWeaponAttackKind(ranges)).toBe("melee");
    expect(secondEditionDefenseKind("melee")).toBe("parry");
    expect(secondEditionRangeForDistance(1, ranges)).toMatchObject({
      band: "melee",
      outOfRange: false,
    });
    expect(secondEditionRangeForDistance(2, ranges)).toMatchObject({
      band: null,
      outOfRange: true,
    });
  });

  it("requires an attack to exceed rather than equal the defense", () => {
    expect(secondEditionAttackHits(15, 15)).toBe(false);
    expect(secondEditionAttackHits(16, 15)).toBe(true);
  });

  it("uses the strongest armor plus the strongest explicit shield", () => {
    expect(
      secondEditionResistancePlan(6, [
        { id: "leather", label: "Leather", score: 3 },
        { id: "plate", label: "Plate", score: 9 },
        {
          id: "shield",
          label: "Shield",
          score: 2,
          stackingTag: "shield",
        },
        {
          id: "buckler",
          label: "Buckler",
          score: 1,
          stackingTag: "shield",
        },
      ]),
    ).toEqual({
      armorScore: 11,
      brawnScore: 6,
      contributors: [
        { id: "plate", label: "Plate", score: 9, stackingTag: undefined },
        { id: "shield", label: "Shield", score: 2, stackingTag: "shield" },
      ],
      score: 17,
    });
  });

  it("plans personal movement and its skill penalties", () => {
    expect(secondEditionMovementPlan("walk")).toMatchObject({
      actionRequired: true,
      maximumDistance: 5,
      skillPenaltyScore: 0,
    });
    expect(secondEditionMovementPlan("run")).toMatchObject({
      maximumDistance: 10,
      skillPenaltyScore: 3,
    });
    expect(secondEditionMovementPlan("crawl", "prone")).toMatchObject({
      maximumDistance: 2,
      requiresProne: true,
    });
    expect(secondEditionMovementPlan("stand", "prone")).toMatchObject({
      postureAfter: "standing",
    });
    expect(secondEditionMovementPlan("run", "standing", true)).toMatchObject({
      postureAfter: "prone",
    });
    expect(() => secondEditionMovementPlan("stand", "standing")).toThrow(
      "D6E2.Combat.Error.MovementRequiresProne",
    );
    expect(() => secondEditionMovementPlan("walk", "prone")).toThrow(
      "D6E2.Combat.Error.MovementRequiresStanding",
    );
  });

  it("applies prone defenses by attack family", () => {
    expect(secondEditionDefenseForPosture(15, "ranged", "prone")).toBe(25);
    expect(secondEditionDefenseForPosture(15, "melee", "prone")).toBe(10);
    expect(secondEditionDefenseForPosture(8, "melee", "prone")).toBe(8);
    expect(secondEditionDefenseForPosture(15, "ranged", "standing")).toBe(15);
  });

  it("clears only round-scoped conditions at the next round start", () => {
    expect(secondEditionRoundStartCondition("staggered")).toBe("healthy");
    expect(secondEditionRoundStartCondition("stunned")).toBe("healthy");
    expect(secondEditionRoundStartCondition("wounded")).toBe("wounded");
  });

  it("plans relative scale bonuses", () => {
    expect(secondEditionScaleInteraction(0, 2)).toEqual({
      attackerAttackBonusScore: 6,
      attackerDamageBonusScore: 0,
      difference: 2,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: 6,
    });
    expect(secondEditionScaleInteraction(3, 1)).toEqual({
      attackerAttackBonusScore: 0,
      attackerDamageBonusScore: 6,
      difference: 2,
      targetDodgeBonus: 6,
      targetResistanceBonusScore: 0,
    });
    expect(secondEditionScaleInteraction(4, 4).difference).toBe(0);
  });
});
