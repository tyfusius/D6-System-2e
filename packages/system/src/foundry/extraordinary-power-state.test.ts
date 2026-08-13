import { afterEach, describe, expect, it } from "vitest";
import {
  extraordinaryPowerFrameworkRegistry,
  resetExtraordinaryPowerFrameworkRegistryForTests,
} from "../registries/extraordinary-powers";
import { extraordinaryPowerMaintenancePenalty } from "./extraordinary-power-state";

afterEach(resetExtraordinaryPowerFrameworkRegistryForTests);

describe("extraordinary-power maintenance penalty", () => {
  it("counts only maintained active-toggle powers in installed frameworks", () => {
    extraordinaryPowerFrameworkRegistry.register("test", {
      activation: {
        actionPenalty: "one-per-skill-check",
        strategy: "all-required-skills",
        usesWildDie: true,
      },
      id: "test.framework",
      label: "Test",
      maintenance: {
        actionPenalty: "one-per-maintained-power",
        strategy: "active-toggle",
      },
      powers: [
        {
          checks: [{ difficulty: 10, skillRoleId: "focus" }],
          id: "test.active",
          label: "Active",
          maintenance: "active-toggle",
        },
        {
          checks: [{ difficulty: 10, skillRoleId: "focus" }],
          id: "test.instant",
          label: "Instant",
          maintenance: "none",
        },
      ],
      resourceRoles: [],
      skillRoles: [{ id: "focus", label: "Focus" }],
      version: 1,
    });
    const actor = {
      system: {
        extraordinaryPowers: {
          frameworks: {
            "test.framework": {
              maintainedPowerIds: ["test.active", "test.instant", "unknown"],
            },
            unavailable: { maintainedPowerIds: ["unavailable.power"] },
          },
        },
      },
    } as unknown as FoundryActorDocument;
    expect(extraordinaryPowerMaintenancePenalty(actor)).toEqual({
      count: 1,
      score: 3,
    });
  });
});
