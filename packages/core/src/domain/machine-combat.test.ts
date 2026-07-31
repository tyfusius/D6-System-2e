import { describe, expect, it } from "vitest";
import {
  secondEditionMachineRepairPlan,
  secondEditionMachineResistancePlan,
  secondEditionMachineWeaponAttackPlan,
} from "./machine-combat";

describe("Second Edition machine weapon attacks", () => {
  it("adds the mounted weapon bonus to crew Gunnery", () => {
    expect(
      secondEditionMachineWeaponAttackPlan({
        assignedCrewCount: 1,
        crewGunneryScore: 10,
        kind: "vehicle",
        minimumCrew: 0,
        weaponAttackBonusScore: 2,
      }),
    ).toEqual({
      assignedCrewCount: 1,
      crewGunneryScore: 10,
      crewPenaltyScore: 0,
      minimumCrew: 0,
      missingCrewCount: 0,
      score: 12,
      sourcePage: 182,
      weaponAttackBonusScore: 2,
    });
  });

  it("subtracts 1D for every missing starship crewmember", () => {
    expect(
      secondEditionMachineWeaponAttackPlan({
        assignedCrewCount: 1,
        crewGunneryScore: 12,
        kind: "starship",
        minimumCrew: 3,
        weaponAttackBonusScore: 3,
      }),
    ).toMatchObject({
      crewPenaltyScore: 6,
      missingCrewCount: 2,
      score: 9,
      sourcePage: 177,
    });
  });

  it("does not apply a minimum-crew penalty to vehicles", () => {
    expect(
      secondEditionMachineWeaponAttackPlan({
        assignedCrewCount: 0,
        crewGunneryScore: 9,
        kind: "vehicle",
        minimumCrew: 8,
        weaponAttackBonusScore: 0,
      }),
    ).toMatchObject({
      crewPenaltyScore: 0,
      minimumCrew: 0,
      missingCrewCount: 0,
      score: 9,
    });
  });
});

describe("Second Edition machine damage and repair", () => {
  it("adds Hull to the kind-specific protection score", () => {
    expect(secondEditionMachineResistancePlan("starship", 10, 5)).toEqual({
      hullScore: 10,
      kind: "starship",
      protectionScore: 5,
      score: 15,
      sourcePage: 180,
    });
    expect(secondEditionMachineResistancePlan("vehicle", 8, 4)).toMatchObject({
      score: 12,
      sourcePage: 183,
    });
  });

  it("maps only explicitly printed repairable conditions", () => {
    expect(secondEditionMachineRepairPlan("vehicle", "stunned")).toMatchObject({
      difficulty: 10,
      sourcePage: 183,
    });
    expect(
      secondEditionMachineRepairPlan("starship", "incapacitated"),
    ).toMatchObject({ difficulty: 15, sourcePage: 180 });
    expect(
      secondEditionMachineRepairPlan("starship", "mortally-wounded"),
    ).toMatchObject({ difficulty: 20 });
    expect(secondEditionMachineRepairPlan("vehicle", "staggered")).toBeNull();
    expect(secondEditionMachineRepairPlan("vehicle", "dead")).toBeNull();
  });
});
