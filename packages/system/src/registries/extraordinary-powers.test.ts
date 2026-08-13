import { beforeEach, describe, expect, it } from "vitest";
import {
  extraordinaryPowerFrameworkRegistry,
  resetExtraordinaryPowerFrameworkRegistryForTests,
} from "./extraordinary-powers";

function framework() {
  return {
    activation: {
      actionPenalty: "one-per-skill-check" as const,
      strategy: "all-required-skills" as const,
      usesWildDie: true,
    },
    id: "private-companion.mystic-art",
    label: "Mystic Art",
    maintenance: {
      actionPenalty: "one-per-maintained-power" as const,
      strategy: "active-toggle" as const,
    },
    powers: [
      {
        checks: [{ difficulty: 10, skillRoleId: "focus" }],
        id: "private-companion.first-power",
        label: "First Power",
        maintenance: "none" as const,
      },
      {
        checks: [
          { difficulty: 15, skillRoleId: "focus" },
          { difficulty: 20, skillRoleId: "shape" },
        ],
        id: "private-companion.second-power",
        label: "Second Power",
        maintenance: "active-toggle" as const,
        prerequisites: ["private-companion.first-power"],
      },
    ],
    resourceRoles: [
      {
        binding: "fate-points" as const,
        id: "amplifier",
        kind: "roll-amplifier" as const,
        label: "Amplifier",
      },
      {
        binding: "actor-extension-number" as const,
        extensionKey: "consequence",
        id: "consequence",
        kind: "consequence-track" as const,
        label: "Consequence",
      },
    ],
    skillRoles: [
      { id: "focus", label: "Focus" },
      { id: "shape", label: "Shape" },
    ],
    version: 1 as const,
  };
}

describe("extraordinary-power framework registry", () => {
  beforeEach(resetExtraordinaryPowerFrameworkRegistryForTests);

  it("clones and freezes a complete declarative framework", () => {
    const contribution = framework();
    extraordinaryPowerFrameworkRegistry.register(
      "private-companion",
      contribution,
    );
    const contributedRole = contribution.skillRoles[0];
    if (!contributedRole) throw new Error("Fixture requires a Skill role.");
    contributedRole.label = "Changed outside";

    const resolved = extraordinaryPowerFrameworkRegistry.current()[0];
    if (!resolved) throw new Error("Registered framework was not resolved.");
    expect(resolved).toMatchObject({
      id: "private-companion.mystic-art",
      ownerId: "private-companion",
      version: 1,
    });
    expect(resolved.skillRoles[0]?.label).toBe("Focus");
    expect(Object.isFrozen(resolved.powers[1]?.checks)).toBe(true);
  });

  it("rejects ownership conflicts and references the system cannot execute", () => {
    extraordinaryPowerFrameworkRegistry.register(
      "private-companion",
      framework(),
    );
    expect(() =>
      extraordinaryPowerFrameworkRegistry.register(
        "other-companion",
        framework(),
      ),
    ).toThrow("already owned");

    const invalid = framework();
    const invalidCheck = invalid.powers[1]?.checks[1];
    if (!invalidCheck)
      throw new Error("Fixture requires a second Skill check.");
    invalidCheck.skillRoleId = "unknown";
    expect(() =>
      extraordinaryPowerFrameworkRegistry.register(
        "private-companion",
        invalid,
      ),
    ).toThrow("unknown skill role");
  });

  it("removes only the requested owner's frameworks", () => {
    extraordinaryPowerFrameworkRegistry.register(
      "private-companion",
      framework(),
    );
    extraordinaryPowerFrameworkRegistry.unregisterOwner("private-companion");
    expect(extraordinaryPowerFrameworkRegistry.current()).toEqual([]);
  });
});
