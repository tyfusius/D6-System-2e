import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveOptionalCapabilityRuntime } from "./optional-capabilities";

const source = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function options(
  overrides: Partial<
    Parameters<typeof resolveOptionalCapabilityRuntime>[0]
  > = {},
) {
  return {
    advancedSkillsModule: true,
    allowAdvancedSkillsImport: false,
    attributeFamily: "second-edition" as const,
    chasesModule: true,
    environmentsModule: true,
    narrativeFeaturesModule: true,
    pipsDependency: "satisfied" as const,
    rankedFeaturesModule: true,
    rulesProfileId: "second-edition",
    ...overrides,
  };
}

describe("Rules Profile-owned optional capability runtime", () => {
  it("activates all five feature families when their dependencies close", () => {
    const runtime = resolveOptionalCapabilityRuntime(options());
    expect(runtime.decisions.map(({ state }) => state)).toEqual([
      "active",
      "active",
      "active",
      "active",
      "active",
    ]);
    expect(runtime.rankedFeatures.strategy).toBe(
      "second-edition-perks-flaws-talents",
    );
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.decisions)).toBe(true);
    expect(Object.isFrozen(runtime.rankedFeatures.blockedBy)).toBe(true);
  });

  it("fails ranked features closed when Pips are inactive", () => {
    const runtime = resolveOptionalCapabilityRuntime(
      options({ pipsDependency: "requires-active-pips" }),
    );
    expect(runtime.rankedFeatures).toMatchObject({
      blockedBy: ["active-pips"],
      state: "inactive-preserved",
      strategy: "stored-inactive",
    });
    expect(runtime.narrativeFeatures.state).toBe("active");
  });

  it("preserves Second Edition families under an Open D6 Attribute strategy", () => {
    const runtime = resolveOptionalCapabilityRuntime(
      options({
        attributeFamily: "open-d6",
        rulesProfileId: "mixed-table-profile",
      }),
    );
    expect(runtime.rulesProfileId).toBe("mixed-table-profile");
    expect(runtime.decisions.every(({ state }) => state !== "active")).toBe(
      true,
    );
    expect(runtime.chases.blockedBy).toContain("second-edition-attributes");
  });

  it("allows only the explicit Advanced Skills cross-profile import", () => {
    const runtime = resolveOptionalCapabilityRuntime(
      options({
        allowAdvancedSkillsImport: true,
        attributeFamily: "open-d6",
        rulesProfileId: "open-d6-with-advanced-skills",
      }),
    );
    expect(runtime.advancedSkills).toMatchObject({
      blockedBy: [],
      state: "active",
      strategy: "second-edition-contextual-extension",
    });
    expect(runtime.chases.state).toBe("inactive-preserved");
    expect(runtime.environments.state).toBe("inactive-preserved");
    expect(runtime.rankedFeatures.state).toBe("inactive-preserved");
    expect(runtime.narrativeFeatures.state).toBe("inactive-preserved");
  });

  it("keeps every gameplay consumer off the edition compatibility adapter", () => {
    for (const path of [
      "../foundry/actor-item-drop-service.ts",
      "../foundry/character-creation-service.ts",
      "../foundry/chase-service.ts",
      "../foundry/combat-service.ts",
      "../foundry/condition-service.ts",
      "../foundry/environment-service.ts",
      "../foundry/feature-catalog-service.ts",
      "../foundry/feature-service.ts",
      "../foundry/read-models/actor.ts",
      "../foundry/rolls/roll-service.ts",
      "../foundry/second-edition-advancement-service.ts",
      "../foundry/sheets/character-sheet.ts",
      "../foundry/token-movement-service.ts",
    ]) {
      expect(source(path)).toContain("currentOptionalCapabilityRuntime");
      expect(source(path)).not.toContain("currentEditionCapabilityProfile");
    }
  });
});
