import { afterEach, describe, expect, it } from "vitest";
import {
  featureEconomyRegistry,
  resetFeatureEconomyRegistryForTests,
  resolvedFeatureBenefitDefinition,
} from "./feature-economy";

describe("feature economy registry", () => {
  afterEach(resetFeatureEconomyRegistryForTests);

  it("publishes a source-cited FreeD6 catalog with exact discrete values", () => {
    expect(
      resolvedFeatureBenefitDefinition("system/free-d6-absolute-direction"),
    ).toMatchObject({
      label: "Absolute direction",
      pointValue: { kind: "exact", value: 2 },
      role: "merit",
    });
    expect(
      resolvedFeatureBenefitDefinition("system/free-d6-acute-hearing"),
    ).toMatchObject({
      pointValue: { kind: "choices", values: [3, 8] },
    });
    expect(
      resolvedFeatureBenefitDefinition("system/free-d6-allergy"),
    ).toMatchObject({
      pointValue: { kind: "choices", values: [2, 4, 8] },
      role: "flaw",
    });
  });

  it("registers safe owner-scoped module definitions and restores after return", () => {
    const catalog = {
      definitions: [
        {
          actorTypes: ["character"],
          conflicts: [],
          effects: [
            {
              id: "roll",
              kind: "roll-modifier",
              scope: "skill:test",
              value: 3,
            },
          ],
          id: "module/frontier/dusty",
          label: "Dusty",
          pointValue: { kind: "exact", value: 2 },
          prerequisites: [],
          role: "merit",
          source: { kind: "module", ownerId: "frontier" },
          version: 1,
        },
      ],
      id: "frontier.features",
      label: "Frontier",
      version: 2,
    } as const;
    featureEconomyRegistry.register("frontier", catalog);
    expect(
      resolvedFeatureBenefitDefinition("module/frontier/dusty")?.label,
    ).toBe("Dusty");
    featureEconomyRegistry.unregisterOwner("frontier");
    expect(
      resolvedFeatureBenefitDefinition("module/frontier/dusty"),
    ).toBeNull();
    featureEconomyRegistry.register("frontier", catalog);
    expect(
      resolvedFeatureBenefitDefinition("module/frontier/dusty")?.label,
    ).toBe("Dusty");
  });

  it("rejects module namespace escape and malformed values", () => {
    expect(() =>
      featureEconomyRegistry.register("frontier", {
        definitions: [
          {
            actorTypes: ["character"],
            conflicts: [],
            effects: [],
            id: "module/other/unsafe",
            label: "Unsafe",
            pointValue: { kind: "exact", value: 1 },
            prerequisites: [],
            role: "flaw",
            source: { kind: "module", ownerId: "frontier" },
            version: 1,
          },
        ],
        id: "frontier.features",
        label: "Frontier",
        version: 2,
      }),
    ).toThrow("outside its module owner namespace");
    expect(() =>
      featureEconomyRegistry.register("frontier", {
        definitions: [
          {
            actorTypes: ["character"],
            conflicts: [],
            effects: [],
            id: "world/unsafe",
            label: "Unsafe",
            pointValue: { kind: "exact", value: 1 },
            prerequisites: [],
            role: "flaw",
            source: { kind: "world" },
            version: 1,
          },
        ],
        id: "frontier.world-escape",
        label: "Frontier",
        version: 2,
      }),
    ).toThrow("outside the world owner namespace");
    expect(() =>
      featureEconomyRegistry.register("frontier", {
        definitions: [
          {
            actorTypes: ["character"],
            conflicts: [],
            effects: [],
            id: "module/frontier/inverted",
            label: "Inverted",
            pointValue: { kind: "range", minimum: 4, maximum: 2 },
            prerequisites: [],
            role: "merit",
            source: { kind: "module", ownerId: "frontier" },
            version: 1,
          },
        ],
        id: "frontier.inverted",
        label: "Frontier",
        version: 2,
      }),
    ).toThrow("outside the allowed range");
  });
});
