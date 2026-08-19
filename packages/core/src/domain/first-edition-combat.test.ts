import { describe, expect, it } from "vitest";
import {
  firstEditionActiveDefensePlan,
  firstEditionMovementPlan,
  firstEditionRangedCombatDifficultyPlan,
} from "./first-edition-combat";

describe("First Edition active defenses", () => {
  it("applies MAP to Partial Defense and prohibits a zero-die pool", () => {
    expect(
      firstEditionActiveDefensePlan("dodge", "partial", 9, 3),
    ).toMatchObject({ effectiveScore: 6, legal: true, resultModifier: 0 });
    expect(firstEditionActiveDefensePlan("block", "partial", 6, 6).legal).toBe(
      false,
    );
  });

  it("makes Full Defense an unpenalized roll with an automatic +10", () => {
    expect(firstEditionActiveDefensePlan("parry", "full", 9, 6)).toEqual({
      baseScore: 9,
      effectiveScore: 9,
      kind: "parry",
      legal: true,
      mapPenaltyScore: 0,
      mode: "full",
      resultModifier: 10,
    });
  });
});

describe("First Edition ranged combat difficulty", () => {
  it.each([
    ["point-blank", 5],
    ["short", 10],
    ["medium", 15],
    ["long", 20],
  ] as const)(
    "derives %s from passive defense and range",
    (rangeBand, defense) => {
      expect(firstEditionRangedCombatDifficultyPlan(rangeBand)).toEqual({
        activeDefense: false,
        baseDefense: 10,
        defense,
        rangeBand,
        rangeModifier: defense - 10,
        sourcePage: 73,
      });
    },
  );

  it("uses a completed active defense as the base before range", () => {
    expect(firstEditionRangedCombatDifficultyPlan("medium", 18)).toEqual({
      activeDefense: true,
      baseDefense: 18,
      defense: 23,
      rangeBand: "medium",
      rangeModifier: 5,
      sourcePage: 73,
    });
  });
});

describe("First Edition movement", () => {
  it("keeps movement up to half Move free", () => {
    expect(
      firstEditionMovementPlan({ baseMove: 10, distance: 5, type: "land" }),
    ).toMatchObject({
      actionRequired: false,
      difficulty: 0,
      freeDistance: 5,
      movementRate: 10,
      rollRequired: false,
    });
  });

  it("makes longer movement an action and scales running difficulty", () => {
    expect(
      firstEditionMovementPlan({ baseMove: 10, distance: 20, type: "land" }),
    ).toMatchObject({
      actionRequired: true,
      difficulty: 5,
      maximumDistance: 40,
      rollRequired: true,
    });
  });

  it("derives swimming and untrained climbing rates", () => {
    expect(
      firstEditionMovementPlan({ baseMove: 10, distance: 2.5, type: "swim" }),
    ).toMatchObject({
      actionRequired: false,
      freeDistance: 2.5,
      movementRate: 5,
    });
    expect(
      firstEditionMovementPlan({
        baseMove: 10,
        distance: 7.5,
        hasMovementSkill: false,
        type: "climb",
      }),
    ).toMatchObject({ actionRequired: true, difficulty: 15, movementRate: 5 });
  });

  it("enforces the four-times-Move ceiling", () => {
    expect(() =>
      firstEditionMovementPlan({ baseMove: 10, distance: 41, type: "land" }),
    ).toThrow("D6E2.Combat.Error.FirstEditionMovementTooFar");
  });
});
