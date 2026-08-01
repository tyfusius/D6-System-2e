import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  featureCatalogRegistry,
  resetFeatureCatalogRegistryForTests,
} from "../registries/feature-catalogs";
import {
  applyFeatureDefinition,
  previewFeatureDefinition,
} from "./feature-catalog-service";

function actor(options: { duplicate?: boolean; owner?: boolean } = {}) {
  return {
    createEmbeddedDocuments: vi.fn((_name: string, sources: unknown[]) =>
      Promise.resolve(
        sources.map((_source, index) => ({ id: `item-${index + 1}` })),
      ),
    ),
    isOwner: options.owner ?? true,
    items: {
      contents: options.duplicate
        ? [
            {
              getFlag: () => ({ definitionId: "licensed.quick-study" }),
              id: "old-item",
              type: "talent",
            },
          ]
        : [],
    },
    system: {},
    type: "character",
  };
}

describe("feature catalog service", () => {
  beforeEach(() => {
    resetFeatureCatalogRegistryForTests();
    featureCatalogRegistry.register("licensed-module", {
      definitions: [
        {
          creationSkillDice: 2,
          focusRequired: true,
          id: "licensed.quick-study",
          kind: "talent",
          label: "Licensed Quick Study",
          mechanics: [
            {
              application: "skill",
              kind: "roll-modifier",
              perRank: true,
              score: 3,
              selector: "chosen-skill",
            },
          ],
          rankMaximum: 2,
          rankMinimum: 1,
          repeatable: false,
          source: { book: "Licensed Companion", page: 12 },
          version: 1,
        },
      ],
      id: "licensed.features",
      label: "Licensed features",
      version: 1,
    });
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === "secondEditionPerksFlawsTalentsModule" ||
          key === "secondEditionPipsModule",
      },
      user: { isGM: false },
    });
  });

  it("previews rank-scaled Talent cost and validates focus and duplicates", () => {
    expect(
      previewFeatureDefinition(actor(), "licensed.quick-study", {
        focus: "Investigation",
        rank: 2,
      }),
    ).toMatchObject({
      canApply: true,
      creationSkillCostScore: 12,
      focus: "Investigation",
      rank: 2,
    });
    expect(
      previewFeatureDefinition(actor(), "licensed.quick-study").issues,
    ).toContain("focus-required");
    expect(
      previewFeatureDefinition(
        actor({ duplicate: true }),
        "licensed.quick-study",
        {
          focus: "Investigation",
        },
      ).issues,
    ).toContain("duplicate");
  });

  it("creates an embedded Item with a durable mechanics snapshot", async () => {
    const document = actor();
    const result = await applyFeatureDefinition(
      document,
      "licensed.quick-study",
      {
        focus: "Investigation",
        rank: 2,
      },
    );
    expect(result.itemId).toBe("item-1");
    const source = document.createEmbeddedDocuments.mock.calls[0]?.[1][0];
    expect(source).toMatchObject({
      flags: {
        "d6-system-2e": {
          featureDefinition: {
            catalogId: "licensed.features",
            definitionId: "licensed.quick-study",
            mechanics: [{ kind: "roll-modifier", score: 3 }],
          },
        },
      },
      name: "Licensed Quick Study",
      system: { cost: 4, rank: 2 },
      type: "talent",
    });
  });
});
