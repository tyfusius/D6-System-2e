import { beforeEach, describe, expect, it } from "vitest";
import {
  featureCatalogRegistry,
  resetFeatureCatalogRegistryForTests,
} from "./feature-catalogs";

const definition = {
  creationSkillDice: 2,
  focusRequired: true,
  id: "licensed.quick-study",
  kind: "talent" as const,
  label: "Licensed Quick Study",
  mechanics: [
    {
      application: "skill" as const,
      kind: "trained-use" as const,
      selector: "chosen-skill",
    },
  ],
  rankMaximum: 2,
  rankMinimum: 1,
  repeatable: false,
  source: { book: "Licensed Companion", page: 12 },
  version: 1 as const,
};

describe("feature catalog registry", () => {
  beforeEach(resetFeatureCatalogRegistryForTests);

  it("normalizes and freezes lawful owner-scoped definitions", () => {
    featureCatalogRegistry.register("licensed-module", {
      definitions: [definition],
      id: "licensed.features",
      label: " Licensed features ",
      version: 1,
    });
    const catalog = featureCatalogRegistry.current()[0];
    expect(catalog).toMatchObject({
      id: "licensed.features",
      label: "Licensed features",
      ownerId: "licensed-module",
    });
    expect(catalog?.definitions[0]?.mechanics[0]).toEqual({
      application: "skill",
      kind: "trained-use",
      selector: "chosen-skill",
    });
    expect(Object.isFrozen(catalog?.definitions[0]?.mechanics)).toBe(true);
  });

  it("rejects cross-catalog definition collisions and unregisters by owner", () => {
    featureCatalogRegistry.register("licensed-module", {
      definitions: [definition],
      id: "licensed.features",
      label: "Licensed features",
      version: 1,
    });
    expect(() =>
      featureCatalogRegistry.register("other-module", {
        definitions: [definition],
        id: "other.features",
        label: "Other features",
        version: 1,
      }),
    ).toThrow("already registered");
    featureCatalogRegistry.unregisterOwner("licensed-module");
    expect(featureCatalogRegistry.current()).toEqual([]);
  });

  it("accepts generic contributed Superpower accounting without executable content", () => {
    featureCatalogRegistry.register("private-companion", {
      definitions: [
        {
          ...definition,
          id: "private.custom-power",
          superpower: {
            automatic: true,
            enhancementCostPerRank: 2,
            limitationCredit: 1,
          },
        },
      ],
      id: "private.superpowers",
      label: "Private Superpowers",
      version: 1,
    });
    expect(
      featureCatalogRegistry.current()[0]?.definitions[0]?.superpower,
    ).toEqual({
      automatic: true,
      enhancementCostPerRank: 2,
      limitationCredit: 1,
    });
  });
});
