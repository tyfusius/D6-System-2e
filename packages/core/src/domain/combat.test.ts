import { describe, expect, it } from "vitest";
import {
  isSecondEditionCondition,
  multipleActionPenaltyScore,
  SECOND_EDITION_CONDITIONS,
  secondEditionAttackHits,
  secondEditionDefenseKind,
  secondEditionRangeForDistance,
  secondEditionResistancePlan,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
} from "./combat";

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
});
