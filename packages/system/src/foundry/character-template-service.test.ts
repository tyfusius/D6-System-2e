import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  campaign: {
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    creation: { attributeBudgetScore: 36, skillBudgetScore: 21 },
    superheroicSkills: false,
    superpowerCreationDice: 0,
    superpowers: false,
  },
}));

vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => state.campaign,
}));
vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    rankedFeatures: { state: "active" },
  }),
}));
vi.mock("../settings/rules-compatibility", () => ({
  currentRulesProfile: () => ({
    compatibility: { firstEditionAttributes: false },
  }),
}));

import {
  applyCharacterTemplate,
  previewCharacterTemplate,
} from "./character-template-service";
import {
  characterTemplateRegistry,
  resetCharacterTemplateRegistryForTests,
} from "../registries/character-templates";
import {
  featureCatalogRegistry,
  resetFeatureCatalogRegistryForTests,
} from "../registries/feature-catalogs";

function actor(options: { owner?: boolean; updateFails?: boolean } = {}) {
  const system = {
    attributes: {
      agility: { score: 3 },
      brawn: { score: 3 },
      charm: { score: 0 },
      knowledge: { score: 3 },
      perception: { score: 3 },
    },
    creation: { active: true, template: { applied: false } },
  };
  const createdItems: { id: string; name: string }[] = [];
  const deletedIds: string[] = [];
  return {
    createEmbeddedDocuments: vi.fn(
      (_name: string, sources: { name: string }[]) => {
        const created = sources.map((source, index) => ({
          id: `created-${index}`,
          name: source.name,
        }));
        createdItems.push(...created);
        return Promise.resolve(created);
      },
    ),
    deleteEmbeddedDocuments: vi.fn((_name: string, ids: readonly string[]) => {
      deletedIds.push(...ids);
      return Promise.resolve([]);
    }),
    deletedIds,
    id: "actor-1",
    isOwner: options.owner ?? true,
    items: {
      contents: [
        {
          id: "skill-1",
          name: "Athletics",
          system: { key: "athletics", training: "standard" },
          type: "skill",
        },
      ],
    },
    system,
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      if (options.updateFails)
        return Promise.reject(new Error("update failed"));
      for (const [key, value] of Object.entries(changes)) {
        if (key.startsWith("system.attributes.")) {
          const attributeId = key.split(".")[2] ?? "";
          system.attributes[
            attributeId as keyof typeof system.attributes
          ].score = Number(value);
        }
      }
      system.creation.template.applied =
        changes["system.creation.template.applied"] === true;
      return Promise.resolve(undefined);
    }),
  };
}

beforeEach(() => {
  resetCharacterTemplateRegistryForTests();
  resetFeatureCatalogRegistryForTests();
  state.campaign = {
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    creation: { attributeBudgetScore: 36, skillBudgetScore: 21 },
    superheroicSkills: false,
    superpowerCreationDice: 0,
    superpowers: false,
  };
  vi.stubGlobal("game", { user: { isGM: false } });
  characterTemplateRegistry.register("licensed-module", {
    id: "licensed.templates",
    label: "Licensed templates",
    templates: [
      {
        attributeScores: { agility: 15, brawn: 9, knowledge: 3, perception: 9 },
        id: "licensed-athletic",
        items: [
          { name: "Licensed kit", system: { quantity: 1 }, type: "gear" },
        ],
        label: "Licensed athletic template",
        source: { book: "Licensed source", page: 12 },
        suggestedSkillKeys: ["athletics"],
        version: 1,
      },
    ],
    version: 1,
  });
});

describe("character template application", () => {
  it("previews exact changes and atomically records the applied template", async () => {
    const document = actor();
    const preview = previewCharacterTemplate(document, "licensed-athletic");
    expect(preview).toMatchObject({
      canApply: true,
      itemAdditions: [{ name: "Licensed kit", type: "gear" }],
      suggestedSkills: [{ key: "athletics", name: "Athletics" }],
    });
    expect(preview.attributeChanges.map(({ nextScore }) => nextScore)).toEqual([
      15, 9, 3, 9,
    ]);

    const result = await applyCharacterTemplate(document, "licensed-athletic");
    expect(result.createdItemIds).toEqual(["created-0"]);
    expect(document.system.attributes.agility.score).toBe(15);
    expect(document.system.creation.template.applied).toBe(true);
    expect(document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.creation.template.catalogId": "licensed.templates",
        "system.creation.template.suggestedSkillKeys": ["athletics"],
        "system.creation.template.templateId": "licensed-athletic",
      }),
    );
  });

  it("fails closed for permissions, incompatible attributes, and repeat application", () => {
    expect(
      previewCharacterTemplate(actor({ owner: false }), "licensed-athletic")
        .issues,
    ).toContain("owner-required");
    characterTemplateRegistry.register("licensed-module", {
      id: "licensed.templates",
      label: "Licensed templates",
      templates: [
        {
          attributeScores: {
            agility: 18,
            brawn: 9,
            knowledge: 3,
            perception: 6,
          },
          id: "invalid-template",
          label: "Invalid",
          source: { book: "Licensed source", page: 14 },
          suggestedSkillKeys: ["missing-skill"],
          version: 1,
        },
      ],
      version: 1,
    });
    const invalid = previewCharacterTemplate(actor(), "invalid-template");
    expect(invalid.canApply).toBe(false);
    expect(invalid.issues).toEqual(
      expect.arrayContaining(["attribute-score", "suggested-skill-missing"]),
    );
    const applied = actor();
    applied.system.creation.template.applied = true;
    expect(
      previewCharacterTemplate(applied, "invalid-template").issues,
    ).toContain("already-applied");
  });

  it("deletes every created Item when the Actor update fails", async () => {
    const document = actor({ updateFails: true });
    await expect(
      applyCharacterTemplate(document, "licensed-athletic"),
    ).rejects.toThrow("update failed");
    expect(document.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      "created-0",
    ]);
    expect(document.system.creation.template.applied).toBe(false);
  });

  it("previews and atomically applies a lawful 10D Superheroic Template", async () => {
    state.campaign = {
      activeAttributeIds: [
        "agility",
        "brawn",
        "knowledge",
        "perception",
        "charm",
      ],
      creation: { attributeBudgetScore: 45, skillBudgetScore: 24 },
      superheroicSkills: true,
      superpowerCreationDice: 10,
      superpowers: true,
    };
    featureCatalogRegistry.register("licensed-module", {
      definitions: [
        {
          creationSkillDice: 2,
          id: "licensed-power-one",
          kind: "talent",
          label: "Licensed Power One",
          mechanics: [],
          rankMinimum: 1,
          repeatable: false,
          source: { book: "Licensed source", page: 20 },
          superpower: {},
          version: 1,
        },
        {
          creationSkillDice: 3,
          id: "licensed-power-two",
          kind: "talent",
          label: "Licensed Power Two",
          mechanics: [],
          rankMinimum: 1,
          repeatable: false,
          source: { book: "Licensed source", page: 21 },
          superpower: {},
          version: 1,
        },
      ],
      id: "licensed.superpowers",
      label: "Licensed Superpowers",
      version: 1,
    });
    characterTemplateRegistry.register("licensed-module", {
      id: "licensed.templates",
      label: "Licensed templates",
      templates: [
        {
          attributeScores: {
            agility: 15,
            brawn: 9,
            charm: 6,
            knowledge: 6,
            perception: 9,
          },
          id: "licensed-superhero",
          label: "Licensed superhero",
          source: { book: "Licensed source", page: 30 },
          suggestedSkillKeys: ["athletics"],
          superheroic: {
            superpowerCreationDice: 10,
            superpowers: [
              { definitionId: "licensed-power-one", rank: 2 },
              { definitionId: "licensed-power-two", rank: 2 },
            ],
          },
          version: 1,
        },
      ],
      version: 1,
    });

    const document = actor();
    const preview = previewCharacterTemplate(document, "licensed-superhero");
    expect(preview).toMatchObject({
      canApply: true,
      rulesFamily: "superheroic",
      superpowerCreationDice: 10,
      superpowerAdditions: [
        { name: "Licensed Power One", rank: 2, totalCost: 4 },
        { name: "Licensed Power Two", rank: 2, totalCost: 6 },
      ],
    });

    const result = await applyCharacterTemplate(document, "licensed-superhero");
    expect(result.createdItemIds).toEqual(["created-0", "created-1"]);
    expect(document.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      expect.arrayContaining([
        expect.objectContaining({
          name: "Licensed Power One",
          type: "talent",
        }),
        expect.objectContaining({
          name: "Licensed Power Two",
          type: "talent",
        }),
      ]),
    );
    expect(document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.creation.template.rulesFamily": "superheroic",
        "system.creation.template.superpowerCreationDice": 10,
        "system.creation.template.superpowerDefinitionIds": [
          "licensed-power-one",
          "licensed-power-two",
        ],
      }),
    );
  });
});
