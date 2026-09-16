import { describe, expect, it } from "vitest";
import {
  actionEconomyRollPlan,
  firstEditionActionCommitment,
  spendFirstEditionCommittedAction,
} from "./action-economy";

describe("action-economy policy", () => {
  it("uses a tracked suggestion until the roller overrides it", () => {
    expect(
      actionEconomyRollPlan({
        assistance: "optional",
        baseScore: 12,
        manualMapDice: 2,
        rollCostsAction: true,
        trackedMapPenaltyScore: 6,
      }),
    ).toMatchObject({
      effectiveScore: 6,
      mapPenaltyScore: 6,
      mapPenaltySource: "tracked",
    });
    expect(
      actionEconomyRollPlan({
        assistance: "optional",
        baseScore: 12,
        manualMapDice: 1,
        rollCostsAction: true,
        trackedMapPenaltyScore: 6,
      }),
    ).toMatchObject({
      effectiveScore: 9,
      mapPenaltyScore: 3,
      mapPenaltySource: "manual",
    });
  });

  it("keeps manual mode independent from tracked declarations", () => {
    expect(
      actionEconomyRollPlan({
        assistance: "manual",
        baseScore: 9,
        manualMapDice: 0,
        rollCostsAction: true,
        trackedMapPenaltyScore: 6,
      }),
    ).toMatchObject({
      effectiveScore: 9,
      mapPenaltySource: "none",
      trackedMapPenaltyScore: 6,
    });
  });

  it("keeps maintained-power penalties mandatory when MAP is manually changed", () => {
    expect(
      actionEconomyRollPlan({
        assistance: "manual",
        baseScore: 12,
        extraordinaryPowerPenaltyScore: 3,
        manualMapDice: 0,
        rollCostsAction: true,
        trackedMapPenaltyScore: 6,
      }),
    ).toMatchObject({
      effectiveScore: 9,
      extraordinaryPowerPenaltyScore: 3,
      mapPenaltyScore: 0,
      totalPenaltyScore: 3,
    });
  });

  it("rejects a final pool with zero whole dice", () => {
    expect(
      actionEconomyRollPlan({
        assistance: "manual",
        baseScore: 5,
        manualMapDice: 1,
        rollCostsAction: true,
      }),
    ).toMatchObject({
      effectiveScore: 2,
      legal: false,
    });
  });

  it("can retain conditions without MAP, movement, or maintenance costs", () => {
    const input = {
      assistance: "optional" as const,
      baseScore: 12,
      conditionPenaltyScore: 6,
      applyConditionPenalty: true,
      rollCostsAction: false,
      trackedMapPenaltyScore: 9,
      manualMapDice: 4,
      movementPenaltyScore: 6,
      extraordinaryPowerPenaltyScore: 3,
    };
    expect(actionEconomyRollPlan(input)).toMatchObject({
      effectiveScore: 6,
      legal: true,
      conditionPenaltyScore: 6,
      mapPenaltyScore: 0,
      trackedMapPenaltyScore: 0,
      movementPenaltyScore: 0,
      extraordinaryPowerPenaltyScore: 0,
      totalPenaltyScore: 6,
    });
    expect(actionEconomyRollPlan({ ...input, baseScore: 8 })).toMatchObject({
      effectiveScore: 2,
      legal: false,
    });
  });

  it("keeps free rolls exempt from every action-economy penalty", () => {
    expect(
      actionEconomyRollPlan({
        assistance: "optional",
        baseScore: 3,
        conditionPenaltyScore: 3,
        manualMapDice: 4,
        movementPenaltyScore: 3,
        rollCostsAction: false,
        trackedMapPenaltyScore: 9,
      }),
    ).toMatchObject({
      effectiveScore: 3,
      legal: true,
      totalPenaltyScore: 0,
    });
  });
});

describe("First Edition action commitments", () => {
  it("applies the complete planned MAP to a pre-turn partial defense", () => {
    const reaction = firstEditionActionCommitment(2, 1, "partial-defense", 1);
    expect(reaction).toEqual({
      actionAllotment: 1,
      defense: "partial-defense",
      penaltyScore: 3,
      plannedActionCount: 2,
      remainingActionCount: 1,
      spentActionCount: 1,
    });
    expect(
      spendFirstEditionCommittedAction(reaction).remainingActionCount,
    ).toBe(0);
  });

  it("makes Full Defense exclusive and penalty-free", () => {
    expect(firstEditionActionCommitment(1, 1, "full-defense")).toMatchObject({
      penaltyScore: 0,
      remainingActionCount: 1,
    });
    expect(() => firstEditionActionCommitment(2, 1, "full-defense")).toThrow(
      /exclusive/,
    );
  });

  it("honors increased action allotments before MAP begins", () => {
    expect(firstEditionActionCommitment(8, 8).penaltyScore).toBe(0);
    expect(firstEditionActionCommitment(9, 8).penaltyScore).toBe(3);
  });
});
