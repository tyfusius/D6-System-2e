import { describe, expect, it } from "vitest";
import { machinePilotPlan } from "./machine-pilot";

describe("ordinary machine pilot contributions", () => {
  it.each(["vehicle", "starship"] as const)(
    "adds OpenD6 %s maneuverability without importing a 2e crew penalty",
    (kind) => {
      expect(
        machinePilotPlan({
          family: "open-d6",
          kind,
          maneuverabilityScore: 4,
          assignedCrewCount: 1,
          minimumCrew: 5,
        }),
      ).toMatchObject({
        maneuverabilityScore: 4,
        crewPenaltyScore: 0,
        modifierScore: 4,
      });
    },
  );
  it("adds 2e starship maneuverability and applies the existing crew-shortfall formula once", () => {
    expect(
      machinePilotPlan({
        family: "second-edition",
        kind: "starship",
        maneuverabilityScore: 6,
        assignedCrewCount: 1,
        minimumCrew: 3,
      }),
    ).toMatchObject({
      maneuverabilityScore: 6,
      crewPenaltyScore: 6,
      modifierScore: 0,
    });
  });
  it("keeps ordinary 2e Driving distinct from the Evading formula", () => {
    expect(
      machinePilotPlan({
        family: "second-edition",
        kind: "vehicle",
        maneuverabilityScore: 6,
        assignedCrewCount: 1,
        minimumCrew: 3,
      }),
    ).toMatchObject({
      maneuverabilityScore: 0,
      crewPenaltyScore: 0,
      modifierScore: 0,
    });
  });
});
