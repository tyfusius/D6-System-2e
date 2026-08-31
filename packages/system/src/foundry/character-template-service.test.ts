import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6CharacterTemplateCatalogV1 } from "@d6-system-2e/core";
import coreCharacterTemplateCatalog from "../../../../content/core-character-template-catalog.json" with { type: "json" };
import fantasyCharacterTemplateCatalog from "../../../../content/fantasy-character-template-catalog.json" with { type: "json" };

const state = vi.hoisted(() => ({
  firstEdition: false,
  genre: {
    attributeBudgetScore: 54,
    attributes: [
      "reflexes",
      "coordination",
      "physique",
      "knowledge",
      "perception",
      "presence",
      "extranormal",
    ].map((id) => ({ id, label: id })),
  },
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
vi.mock("../settings/optional-capabilities", () => ({
  currentOptionalCapabilityRuntime: () => ({
    rankedFeatures: { state: "active" },
  }),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ id: "test-profile" }),
  strategyUsesOpenD6: () => state.firstEdition,
}));
vi.mock("../settings/attributes", () => ({
  currentAttributeCreationRuntime: () => ({
    attributeBudgetScore: state.firstEdition
      ? state.genre.attributeBudgetScore
      : state.campaign.creation.attributeBudgetScore,
  }),
}));
vi.mock("../settings/first-edition-genre-profile", () => ({
  currentFirstEditionGenreProfile: () => state.genre,
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
      magic: { score: 0 },
      mechanical: { score: 0 },
      mysticism: { score: 0 },
      perception: { score: 3 },
      technical: { score: 0 },
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
    createdItems,
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

function registerFantasyTemplates(): void {
  characterTemplateRegistry.register(
    "d6-system-2e-fantasy",
    fantasyCharacterTemplateCatalog as D6CharacterTemplateCatalogV1,
  );
}

function registerCoreTemplates(): void {
  characterTemplateRegistry.register(
    "d6-system-2e-core-content",
    coreCharacterTemplateCatalog as D6CharacterTemplateCatalogV1,
  );
}

beforeEach(() => {
  resetCharacterTemplateRegistryForTests();
  resetFeatureCatalogRegistryForTests();
  state.firstEdition = false;
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
        rulesFamily: "d6-system-second-edition",
        source: { book: "Licensed source", page: 12 },
        suggestedSkillKeys: ["athletics"],
        version: 2,
      },
    ],
    version: 2,
  });
});

it("uses the explicit primary mode for template-family compatibility", () => {
  state.firstEdition = true;

  expect(
    previewCharacterTemplate(actor(), "licensed-athletic").issues,
  ).not.toContain("rules-family");
});

it("adapts the lawful Fantasy Warrior scaffold to the active core profile", () => {
  registerFantasyTemplates();
  const preview = previewCharacterTemplate(actor(), "fantasy-warrior");

  expect(preview.canApply).toBe(true);
  expect(preview.issues).not.toContain("attribute-ids");
  expect(preview.issues).toContain("attribute-budget");
  expect(preview.issues).not.toContain("suggested-skill-missing");
  expect(preview.suggestedSkills.map(({ name }) => name)).toEqual([
    "Athletics",
    "Melee",
    "Shooting",
    "Stamina",
    "Throwing",
  ]);
  expect(
    preview.attributeChanges.map(({ attributeId, nextScore }) => ({
      attributeId,
      nextScore,
    })),
  ).toEqual([
    { attributeId: "agility", nextScore: 12 },
    { attributeId: "brawn", nextScore: 15 },
    { attributeId: "knowledge", nextScore: 9 },
    { attributeId: "perception", nextScore: 12 },
  ]);
});

it("keeps every lawful Second Edition Fantasy template available in the core profile", () => {
  registerFantasyTemplates();

  for (const templateId of [
    "fantasy-occultist",
    "fantasy-priest",
    "fantasy-warrior",
    "fantasy-wizard",
  ]) {
    const preview = previewCharacterTemplate(actor(), templateId);
    expect(preview.canApply, templateId).toBe(true);
    expect(preview.issues, templateId).not.toContain("attribute-ids");
    expect(preview.issues, templateId).not.toContain("rules-family");
  }
});

it("recognizes the full 21D Fantasy profile without a budget advisory", () => {
  state.campaign = {
    activeAttributeIds: [
      "agility",
      "brawn",
      "knowledge",
      "perception",
      "charm",
      "magic",
      "mysticism",
    ],
    creation: { attributeBudgetScore: 63, skillBudgetScore: 21 },
    superheroicSkills: false,
    superpowerCreationDice: 0,
    superpowers: false,
  };
  registerFantasyTemplates();

  const preview = previewCharacterTemplate(actor(), "fantasy-warrior");
  expect(preview.canApply).toBe(true);
  expect(preview.issues).not.toContain("attribute-budget");
  expect(preview.issues).not.toContain("attribute-ids");
});

describe("character template application", () => {
  function registerFreeD6Template(): void {
    state.firstEdition = true;
    characterTemplateRegistry.register("free-d6-test", {
      id: "free-d6.test-templates",
      label: "FreeD6 test templates",
      templates: [
        {
          attributeScores: {
            agility: 15,
            brawn: 15,
            knowledge: 12,
            perception: 12,
          },
          freeD6: {
            initialFatigueLevel: 2,
            strategyId: "free-d6.creation.creation-points",
            templatePointValue: 4,
            version: 1,
          },
          id: "free-d6-athlete",
          label: "FreeD6 athlete",
          rulesFamily: "open-d6-first-edition",
          source: { book: "FreeD6 test source", page: 42 },
          suggestedSkillKeys: ["athletics"],
          version: 3,
        },
      ],
      version: 3,
    });
  }

  it("refuses to overwrite a nonempty FreeD6 creation ledger before creating documents", async () => {
    registerFreeD6Template();
    const document = actor();
    Object.assign(document.system.creation, {
      freeD6: {
        baselineAttributeScores: {},
        baselineSkillScores: {},
        budgetUnits: 60,
        finalized: false,
        revision: 1,
        strategyId: "free-d6.creation.creation-points",
        templateId: "",
        templatePointUnits: 0,
        transactions: [
          {
            id: "feature:merit-1",
            kind: "merit",
            label: "Existing merit",
            pointUnits: 4,
            sourceId: "free-d6.merit.existing",
          },
        ],
        version: 1,
      },
    });
    document.items.contents.push({
      id: "merit-1",
      name: "Existing merit",
      system: {
        featureEconomy: {
          definitionId: "free-d6.merit.existing",
          transactionId: "merit-1",
        },
      },
      type: "perk",
    } as never);

    const preview = previewCharacterTemplate(document, "free-d6-athlete");
    expect(preview.canApply).toBe(false);
    expect(preview.issues).toContain("free-d6-ledger-dirty");
    await expect(
      applyCharacterTemplate(document, "free-d6-athlete"),
    ).rejects.toThrow("D6E2.Template.Issue.free-d6-ledger-dirty");
    expect(document.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(
      (
        document.system.creation as unknown as {
          freeD6: { transactions: readonly unknown[] };
        }
      ).freeD6.transactions,
    ).toHaveLength(1);
  });

  it("applies a FreeD6 template's initial fatigue level in the atomic actor update", async () => {
    registerFreeD6Template();
    const document = actor();

    await applyCharacterTemplate(document, "free-d6-athlete");

    const update = document.update.mock.calls.at(0)?.at(0);
    expect(update?.["system.health.tracks"]).toEqual({
      "free-d6.consequences.v1": {
        channels: {
          "free-d6.consequence.fatigue": {
            channelId: "free-d6.consequence.fatigue",
            level: 2,
            revision: 1,
            source: "template:free-d6-athlete",
            unconscious: true,
          },
        },
        version: 1,
      },
    });
  });

  it("applies sparse templates without clearing missing Attributes or writing inactive ones", async () => {
    characterTemplateRegistry.register("sparse-module", {
      id: "sparse.templates",
      label: "Sparse templates",
      templates: [
        {
          attributeScores: { agility: 12, charm: 15 },
          id: "sparse-template",
          label: "Sparse template",
          rulesFamily: "d6-system-second-edition",
          source: { book: "Licensed source", page: 15 },
          suggestedSkillKeys: [],
          version: 2,
        },
      ],
      version: 2,
    });
    const document = actor();
    const preview = previewCharacterTemplate(document, "sparse-template");

    expect(preview.canApply).toBe(true);
    expect(preview.issues).not.toContain("attribute-ids");
    expect(preview.attributeChanges).toEqual([
      { attributeId: "agility", currentScore: 3, nextScore: 12 },
      { attributeId: "brawn", currentScore: 3, nextScore: 3 },
      { attributeId: "knowledge", currentScore: 3, nextScore: 3 },
      { attributeId: "perception", currentScore: 3, nextScore: 3 },
    ]);

    await applyCharacterTemplate(document, "sparse-template");

    expect(document.system.attributes.agility.score).toBe(12);
    expect(document.system.attributes.brawn.score).toBe(3);
    expect(document.system.attributes.charm.score).toBe(0);
    expect(document.update.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      "system.attributes.charm.score",
    );
  });

  it("keeps a missing active optional Attribute unchanged", async () => {
    state.campaign = {
      activeAttributeIds: [
        "agility",
        "brawn",
        "knowledge",
        "perception",
        "charm",
      ],
      creation: { attributeBudgetScore: 45, skillBudgetScore: 21 },
      superheroicSkills: false,
      superpowerCreationDice: 0,
      superpowers: false,
    };
    const document = actor();
    const preview = previewCharacterTemplate(document, "licensed-athletic");

    expect(preview.canApply).toBe(true);
    expect(preview.issues).not.toContain("attribute-ids");
    expect(
      preview.attributeChanges.find(
        ({ attributeId }) => attributeId === "charm",
      ),
    ).toEqual({ attributeId: "charm", currentScore: 0, nextScore: 0 });

    await applyCharacterTemplate(document, "licensed-athletic");
    expect(document.system.attributes.charm.score).toBe(0);
  });

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

  it("creates every missing published Skill when applying a template", async () => {
    registerFantasyTemplates();
    const document = actor();

    await applyCharacterTemplate(document, "fantasy-warrior");

    expect(document.createdItems.map(({ name }) => name)).toEqual([
      "Melee",
      "Shooting",
      "Stamina",
      "Throwing",
    ]);
  });

  it("previews and applies every printed core template with its exact 12D Attribute scaffold", async () => {
    registerCoreTemplates();
    const expected = new Map(
      coreCharacterTemplateCatalog.templates.map((template) => [
        template.id,
        template,
      ]),
    );

    for (const [templateId, template] of expected) {
      const document = actor();
      const preview = previewCharacterTemplate(document, templateId);
      expect(preview.canApply, templateId).toBe(true);
      expect(preview.issues, templateId).toEqual([]);

      await applyCharacterTemplate(document, templateId);
      expect(document.system.creation.template.applied, templateId).toBe(true);
      expect(
        Object.fromEntries(
          Object.keys(template.attributeScores).map((attributeId) => [
            attributeId,
            document.system.attributes[
              attributeId as keyof typeof document.system.attributes
            ].score,
          ]),
        ),
        templateId,
      ).toEqual(template.attributeScores);
      expect(
        document.createdItems.map(({ name }) => name),
        templateId,
      ).toEqual(
        preview.suggestedSkills
          .map(({ key, name }) => ({ key, name }))
          .filter(({ key }) => key !== "athletics")
          .map(({ name }) => name),
      );
    }
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
            unknown: 3,
          },
          id: "invalid-template",
          label: "Invalid",
          rulesFamily: "d6-system-second-edition",
          source: { book: "Licensed source", page: 14 },
          suggestedSkillKeys: ["missing-skill"],
          version: 2,
        },
      ],
      version: 2,
    });
    const invalid = previewCharacterTemplate(actor(), "invalid-template");
    expect(invalid.canApply).toBe(false);
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        "attribute-ids",
        "attribute-score",
        "suggested-skill-missing",
      ]),
    );
    const applied = actor();
    applied.system.creation.template.applied = true;
    expect(
      previewCharacterTemplate(applied, "invalid-template").issues,
    ).toContain("already-applied");
  });

  it("accepts zero Extranormal only for a First Edition template", () => {
    state.firstEdition = true;
    characterTemplateRegistry.register("licensed-module", {
      id: "licensed.templates",
      label: "Licensed templates",
      templates: [
        {
          attributeScores: {
            coordination: 9,
            extranormal: 0,
            knowledge: 9,
            perception: 9,
            physique: 9,
            presence: 9,
            reflexes: 9,
          },
          id: "licensed-adventure",
          label: "Licensed Adventure template",
          rulesFamily: "open-d6-first-edition",
          source: { book: "Licensed source", page: 128 },
          suggestedSkillKeys: ["athletics"],
          version: 2,
        },
      ],
      version: 2,
    });
    const document = actor();
    document.system.attributes = {
      coordination: { score: 3 },
      extranormal: { score: 0 },
      knowledge: { score: 3 },
      perception: { score: 3 },
      physique: { score: 3 },
      presence: { score: 3 },
      reflexes: { score: 3 },
    } as never;
    const preview = previewCharacterTemplate(document, "licensed-adventure");
    expect(preview.canApply).toBe(true);
    expect(preview.issues).not.toContain("attribute-score");
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
          rulesFamily: "d6-system-second-edition",
          source: { book: "Licensed source", page: 30 },
          suggestedSkillKeys: ["athletics"],
          superheroic: {
            superpowerCreationDice: 10,
            superpowers: [
              { definitionId: "licensed-power-one", rank: 2 },
              { definitionId: "licensed-power-two", rank: 2 },
            ],
          },
          version: 2,
        },
      ],
      version: 2,
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
