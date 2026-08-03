import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  advancedSkills: "active",
  cyberpunk: true,
  firstEdition: false,
  narrativeFeatures: "active",
  psionics: true,
  rankedFeatures: "active",
}));

vi.mock("../settings/rules-compatibility", () => ({
  currentRulesProfile: () => ({
    compatibility: { firstEditionAttributes: state.firstEdition },
  }),
}));
vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    creation: { attributeBudgetScore: 36, skillBudgetScore: 21 },
    cyberpunk: state.cyberpunk,
    freeformSkillBasedMagic: true,
    psionics: state.psionics,
    superheroicSkills: false,
    superpowerCreationDice: 0,
    superpowers: false,
  }),
}));
vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    advancedSkills: { state: state.advancedSkills },
    narrativeFeatures: { state: state.narrativeFeatures },
    rankedFeatures: { state: state.rankedFeatures },
  }),
}));
vi.mock("./character-creation-service", () => ({
  createCreationSpecialization: (
    actor: FoundryActorDocument,
    parentSkillId: string,
    name: string,
  ) =>
    actor
      .createEmbeddedDocuments("Item", [
        {
          name,
          system: {
            parentSkillId,
            parentSkillKey: "blaster",
            score: 3,
          },
          type: "specialization",
        },
      ])
      .then((created) => created[0]),
}));
vi.mock("./advancement-service", () => ({
  acquireSpecialization: vi.fn(() => Promise.resolve(undefined)),
}));

import {
  applyActorItemDrop,
  canTransferActorItem,
  itemFromDropData,
  previewActorItemDrop,
  sortActorItem,
  transferActorItem,
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
      get(itemId: string) {
        return this.contents.find((item) => item.id === itemId);
      },
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
    updateEmbeddedDocuments: vi.fn(() => Promise.resolve([])),
    updates,
  };
}

beforeEach(() => {
  state.advancedSkills = "active";
  state.cyberpunk = true;
  state.firstEdition = false;
  state.narrativeFeatures = "active";
  state.psionics = true;
  state.rankedFeatures = "active";
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
      action: "embed-item",
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
      action: "embed-item",
      canApply: true,
    });
  });

  it("adds Skills at 0D and rejects a duplicate stable key", async () => {
    const target = actor();
    const skill = {
      ...equipment("skill"),
      name: "Search",
      system: {
        attributeId: "perception",
        key: "search",
        score: 12,
        training: "standard",
      },
      toObject: () => ({
        name: "Search",
        system: {
          attributeId: "perception",
          key: "search",
          score: 12,
          training: "standard",
        },
        type: "skill",
      }),
    };
    await applyActorItemDrop(target, skill);
    expect(target.createdSources[0]).toMatchObject({
      system: { key: "search", score: 0 },
      type: "skill",
    });
    target.items.contents.push(skill);
    expect(previewActorItemDrop(target, skill)).toMatchObject({
      canApply: false,
      issue: "duplicate",
    });
  });

  it("routes a Second Edition Specialization through protected creation", async () => {
    const target = actor();
    const specialization = {
      ...equipment("specialization"),
      name: "Blaster: Pistols",
      system: { key: "blaster-pistols", parentSkillKey: "blaster", score: 9 },
      toObject: () => ({
        name: "Blaster: Pistols",
        system: {
          key: "blaster-pistols",
          parentSkillId: "source-parent",
          parentSkillKey: "blaster",
          score: 9,
        },
        type: "specialization",
      }),
    };
    await applyActorItemDrop(target, specialization);
    expect(target.createdSources[0]).toMatchObject({
      system: {
        parentSkillId: "blaster-skill",
        parentSkillKey: "blaster",
        score: 3,
      },
    });
  });

  it("adds cybernetics only when available and clears installed runtime state", async () => {
    const target = actor();
    const cybernetic = {
      ...equipment("cybernetic"),
      system: { installed: true },
      toObject: () => ({
        name: "Replacement Hand",
        system: {
          disabled: { combatId: "combat", untilRound: 9, untilTurn: 2 },
          installation: {
            difficulty: 12,
            installerName: "Doc",
            minutes: 30,
            previousCount: 2,
          },
          installed: true,
          linkedTalentId: "talent-1",
        },
        type: "cybernetic",
      }),
    };
    await applyActorItemDrop(target, cybernetic);
    expect(target.createdSources[0]).toMatchObject({
      system: {
        disabled: { combatId: "", untilRound: 0, untilTurn: 0 },
        installation: {
          difficulty: 12,
          installerName: "",
          minutes: 30,
          previousCount: 0,
        },
        installed: false,
        linkedTalentId: "",
      },
    });
    state.cyberpunk = false;
    expect(previewActorItemDrop(target, cybernetic)).toMatchObject({
      canApply: false,
      issue: "module-inactive",
    });
  });

  it("applies stable-UUID groups atomically", async () => {
    const target = actor();
    const member = equipment("weapon");
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve(member)),
    );
    const group = {
      ...equipment("item-group"),
      name: "Field Kit",
      system: {
        actorTypes: ["character"],
        members: [
          { label: "Test Blaster", required: true, uuid: "Item.member" },
        ],
        rulesFamily: "both",
      },
      toObject: () => ({ name: "Field Kit", system: {}, type: "item-group" }),
    };
    const result = await applyActorItemDrop(target, group);
    expect(result).toMatchObject({
      action: "apply-group",
      createdItemIds: ["created-0"],
    });
    expect(fromUuid).toHaveBeenCalledWith("Item.member");
  });

  it("applies one species, clamps bounded Attributes, and embeds its referenced Items", async () => {
    const target = actor();
    const member = equipment("specialability");
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve(member)),
    );
    const species = {
      ...equipment("species-template"),
      name: "Sturdy Folk",
      system: {
        attributeBounds: [{ attributeId: "brawn", maximum: 18, minimum: 9 }],
        members: [{ label: "Sturdy", required: true, uuid: "Item.sturdy" }],
        rulesFamily: "both",
      },
      toObject: () => ({
        name: "Sturdy Folk",
        system: {
          attributeBounds: [{ attributeId: "brawn", maximum: 18, minimum: 9 }],
          members: [{ label: "Sturdy", required: true, uuid: "Item.sturdy" }],
          rulesFamily: "both",
        },
        type: "species-template",
      }),
    };
    const result = await applyActorItemDrop(target, species);
    expect(result).toMatchObject({
      action: "apply-species",
      createdItemIds: ["created-0", "created-1"],
    });
    expect(target.updates).toContainEqual({
      "system.attributes.brawn.score": 9,
    });
  });

  it("rejects content for the other rules family", () => {
    const target = actor();
    const item = {
      ...equipment(),
      system: { rulesFamily: "open-d6-first-edition" },
    };
    expect(previewActorItemDrop(target, item)).toMatchObject({
      canApply: false,
      issue: "rules-family",
    });
  });

  it("moves safe equipment only after the target copy succeeds", async () => {
    const target = actor();
    const sourceActor = actor();
    sourceActor.id = "actor-2";
    const item = equipment();
    item.parent = sourceActor;
    expect(canTransferActorItem(target, item).canApply).toBe(true);
    const result = await transferActorItem(target, item);
    expect(result.createdItemIds).toEqual(["created-0"]);
    expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      "source-item",
    ]);
  });

  it("does not treat a world Item collection as a source Actor", () => {
    const target = actor();
    const item = equipment();
    item.parent = { id: "world-items" };
    expect(canTransferActorItem(target, item)).toMatchObject({
      action: "embed-item",
      canApply: true,
    });
  });

  it("rolls back the target copy when source deletion fails", async () => {
    const target = actor();
    const sourceActor = actor();
    sourceActor.id = "actor-2";
    sourceActor.deleteEmbeddedDocuments.mockRejectedValueOnce(
      new Error("locked"),
    );
    const item = equipment();
    item.parent = sourceActor;
    await expect(transferActorItem(target, item)).rejects.toThrow("locked");
    expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      "created-0",
    ]);
  });

  it("sorts only same-type Items within their owning Actor", async () => {
    const target = actor();
    const first = { ...equipment(), id: "first", parent: target };
    const second = { ...equipment(), id: "second", parent: target };
    vi.stubGlobal("SortingHelpers", {
      performIntegerSort: vi.fn(() => [
        { target: first, update: { sort: 20 } },
      ]),
    });
    await expect(
      sortActorItem(target, first, second, [first, second]),
    ).resolves.toBe(true);
    expect(target.updateEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      { _id: "first", sort: 20 },
    ]);
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
