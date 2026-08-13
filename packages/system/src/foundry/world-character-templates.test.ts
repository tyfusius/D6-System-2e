import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  characterTemplateRegistry,
  resetCharacterTemplateRegistryForTests,
} from "../registries/character-templates";

vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: () => new Set<string>(),
  currentSecondEditionCampaignProfile: () => ({ activeAttributeIds: [] }),
}));
vi.mock("../settings/attributes", () => ({
  currentAttributeRuntimeStrategy: () => ({ family: "second-edition" }),
}));

import {
  characterTemplateFromItem,
  createCharacterTemplateFromActor,
  synchronizeWorldCharacterTemplates,
} from "./world-character-templates";

beforeEach(() => {
  resetCharacterTemplateRegistryForTests();
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    items: { contents: [] },
    settings: { get: () => undefined },
    user: { isGM: true },
  });
});

describe("world Character Templates", () => {
  function templateItem(
    id: string,
    overrides: Record<string, unknown> = {},
  ): FoundryItemDocument {
    return {
      id,
      name: `Template ${id}`,
      system: {
        attributeScores: [{ attributeId: "agility", score: 9 }],
        firstEdition: {
          biography: "",
          characterPoints: 5,
          fatePoints: 2,
          move: 10,
        },
        items: [],
        rulesFamily: "open-d6-first-edition",
        source: { book: "Test", page: 1 },
        suggestedSkillKeys: [],
        version: 2,
        ...overrides,
      },
      type: "character-template",
      uuid: `Item.${id}`,
    } as unknown as FoundryItemDocument;
  }

  it("omits an empty optional First Edition biography", () => {
    const template = characterTemplateFromItem(templateItem("valid"));

    expect(template?.firstEdition).toEqual({
      characterPoints: 5,
      fatePoints: 2,
      move: 10,
    });
  });

  it("isolates an invalid world template without blocking valid templates", () => {
    const valid = templateItem("valid");
    const invalid = templateItem("invalid", { unassignedAttributeScore: 1 });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      items: { contents: [valid, invalid] },
      settings: { get: () => undefined },
      user: { isGM: true },
    });
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    expect(() => synchronizeWorldCharacterTemplates()).not.toThrow();
    expect(characterTemplateRegistry.current()).toHaveLength(1);
    expect(characterTemplateRegistry.current()[0]?.templates).toHaveLength(1);
    expect(characterTemplateRegistry.current()[0]?.templates[0]?.id).toBe(
      "world.valid",
    );
    expect(warning).toHaveBeenCalledOnce();
  });

  it("passes mutable nested Item snapshots to Foundry document creation", async () => {
    const create = vi.fn((source: Record<string, unknown>) => {
      const system = source.system as {
        attributeScores: { attributeId: string; score: number }[];
        items: { img: string }[];
      };
      expect(system.attributeScores).toHaveLength(17);
      expect(system.attributeScores).toEqual(
        expect.arrayContaining([
          { attributeId: "acumen", score: 3 },
          { attributeId: "agility", score: 9 },
          { attributeId: "charisma", score: 3 },
          { attributeId: "charm", score: 3 },
          { attributeId: "coordination", score: 3 },
          { attributeId: "extranormal", score: 0 },
          { attributeId: "intellect", score: 3 },
          { attributeId: "magic", score: 3 },
          { attributeId: "mechanical", score: 3 },
          { attributeId: "mysticism", score: 3 },
          { attributeId: "physique", score: 3 },
          { attributeId: "presence", score: 3 },
          { attributeId: "reflexes", score: 3 },
          { attributeId: "technical", score: 3 },
        ]),
      );
      expect(Object.isFrozen(system.items[0])).toBe(false);
      const firstItem = system.items[0];
      if (firstItem) firstItem.img = "icons/svg/upgrade.svg";
      return Promise.resolve({ id: "template-1", ...source });
    });
    vi.stubGlobal("Item", { create });
    const actor = {
      id: "actor-1",
      img: "icons/svg/mystery-man.svg",
      isOwner: true,
      items: {
        contents: [
          {
            id: "gear-1",
            img: "icons/svg/item-bag.svg",
            name: "Field Kit",
            system: { key: "field-kit" },
            toObject: () => ({ system: { key: "field-kit" } }),
            type: "gear",
            uuid: "Actor.actor-1.Item.gear-1",
          },
        ],
      },
      name: "Template Source",
      system: {
        attributes: {
          agility: { score: 9 },
          brawn: { score: 9 },
          knowledge: { score: 9 },
          perception: { score: 9 },
        },
        biography: "",
        movement: { base: 10 },
        resources: {
          characterPoints: { value: 0 },
          fatePoints: { value: 0 },
        },
      },
      type: "character",
    };

    await createCharacterTemplateFromActor(
      actor as unknown as FoundryActorDocument,
    );

    expect(create).toHaveBeenCalledOnce();
  });
});
