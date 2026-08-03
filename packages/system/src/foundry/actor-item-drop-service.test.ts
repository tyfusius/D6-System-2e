import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ firstEdition: false }));

vi.mock("../settings/rules-compatibility", () => ({
  currentRulesProfile: () => ({
    compatibility: { firstEditionAttributes: state.firstEdition },
  }),
}));
vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    creation: { attributeBudgetScore: 36, skillBudgetScore: 21 },
    superheroicSkills: false,
    superpowerCreationDice: 0,
    superpowers: false,
  }),
}));
vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    rankedFeatures: { state: "inactive-preserved" },
  }),
}));

import {
  applyActorItemDrop,
  itemFromDropData,
  previewActorItemDrop,
} from "./actor-item-drop-service";
import {
  characterTemplateRegistry,
  resetCharacterTemplateRegistryForTests,
} from "../registries/character-templates";

function equipment(type = "weapon", parentId = "") {
  return {
    id: "source-item",
    img: "icons/svg/sword.svg",
    name: "Test Blaster",
    ...(parentId ? { parent: { id: parentId } } : {}),
    system: { damage: { score: 15 }, equipped: false },
    toObject: () => ({
      _id: "source-item",
      effects: [],
      flags: { source: { retained: true } },
      img: "icons/svg/sword.svg",
      name: "Test Blaster",
      system: { damage: { score: 15 }, equipped: false },
      type,
    }),
    type,
  };
}

function actor(type = "character", owner = true) {
  const createdSources: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  return {
    createEmbeddedDocuments: vi.fn(
      (_documentName: string, sources: readonly Record<string, unknown>[]) => {
        createdSources.push(...sources);
        return Promise.resolve(
          sources.map((_source, index) => ({ id: `created-${index}` })),
        );
      },
    ),
    createdSources,
    deleteEmbeddedDocuments: vi.fn(() => Promise.resolve([])),
    id: "actor-1",
    isOwner: owner,
    items: {
      contents: [
        {
          id: "blaster-skill",
          name: "Blaster",
          system: { key: "blaster", training: "standard" },
          type: "skill",
        },
      ],
    },
    name: "Drop Target",
    system: {
      attributes: {
        agility: { score: 3 },
        brawn: { score: 3 },
        knowledge: { score: 3 },
        mechanical: { score: 3 },
        perception: { score: 3 },
        technical: { score: 3 },
      },
      biography: "",
      creation: { active: true, template: { applied: false } },
      movement: { base: 10 },
      resources: {
        characterPoints: { value: 5 },
        fatePoints: { value: 1 },
      },
    },
    type,
    update: vi.fn((changes: Record<string, unknown>) => {
      updates.push(changes);
      return Promise.resolve(undefined);
    }),
    updates,
  };
}

beforeEach(() => {
  state.firstEdition = false;
  resetCharacterTemplateRegistryForTests();
  vi.stubGlobal("game", { user: { isGM: false } });
});

describe("Actor Item drop service", () => {
  it("fails closed when Foundry cannot resolve the dragged Item", async () => {
    vi.stubGlobal("Item", {
      implementation: {
        fromDropData: vi.fn(() => Promise.reject(new Error("missing UUID"))),
      },
    });
    await expect(
      itemFromDropData({ type: "Item", uuid: "Compendium.missing" }),
    ).resolves.toBeNull();
  });

  it("copies personal equipment without retaining the source document id", async () => {
    const target = actor();
    const result = await applyActorItemDrop(target, equipment());
    expect(result).toMatchObject({
      action: "embed-equipment",
      createdItemIds: ["created-0"],
    });
    expect(target.createdSources[0]).toMatchObject({
      flags: { source: { retained: true } },
      name: "Test Blaster",
      type: "weapon",
    });
    expect(target.createdSources[0]).not.toHaveProperty("_id");
  });

  it("uses the same personal equipment route in First Edition mode", () => {
    state.firstEdition = true;
    expect(previewActorItemDrop(actor(), equipment())).toMatchObject({
      action: "embed-equipment",
      canApply: true,
    });
  });

  it("enforces machine compatibility, ownership, and same-Actor safety", () => {
    expect(
      previewActorItemDrop(actor("vehicle"), equipment("starship-weapon")),
    ).toMatchObject({ canApply: false, issue: "item-type" });
    expect(
      previewActorItemDrop(actor("starship"), equipment("starship-weapon")),
    ).toMatchObject({ canApply: true });
    expect(
      previewActorItemDrop(actor("character", false), equipment()),
    ).toMatchObject({
      canApply: false,
      issue: "owner-required",
    });
    expect(
      previewActorItemDrop(actor(), equipment("weapon", "actor-1")),
    ).toMatchObject({
      canApply: false,
      issue: "same-actor",
    });
  });

  it("applies a registered First Edition template only in First Edition mode", async () => {
    characterTemplateRegistry.register("open-d6-space", {
      id: "open-d6-space.templates",
      label: "Open D6 Space templates",
      templates: [
        {
          attributeScores: {
            agility: 9,
            brawn: 9,
            knowledge: 9,
            mechanical: 9,
            perception: 9,
            technical: 9,
          },
          firstEdition: {
            biography: "Original private or licensed summary.",
            characterPoints: 5,
            fatePoints: 1,
            move: 10,
          },
          id: "space-pilot",
          label: "Space Pilot",
          rulesFamily: "open-d6-first-edition",
          source: { book: "Open D6 Space", page: 128 },
          suggestedSkillKeys: ["blaster"],
          version: 2,
        },
      ],
      version: 2,
    });
    const templateItem = {
      id: "space-pilot-item",
      name: "Space Pilot",
      system: {},
      toObject: () => ({
        flags: {
          "d6-system-2e": {
            characterTemplate: { templateId: "space-pilot" },
          },
        },
        name: "Space Pilot",
        system: {},
        type: "character-template",
      }),
      type: "character-template",
    };
    const target = actor();
    expect(
      previewActorItemDrop(target, templateItem).templatePreview?.issues,
    ).toContain("rules-family");

    state.firstEdition = true;
    expect(previewActorItemDrop(target, templateItem)).toMatchObject({
      action: "apply-template",
      canApply: true,
      templateId: "space-pilot",
    });
    const result = await applyActorItemDrop(target, templateItem);
    expect(result.action).toBe("apply-template");
    expect(target.updates[0]).toMatchObject({
      "system.biography": "Original private or licensed summary.",
      "system.creation.template.rulesFamily": "open-d6-first-edition",
      "system.movement.base": 10,
      "system.resources.characterPoints.value": 5,
      "system.resources.fatePoints.value": 1,
    });
  });
});
