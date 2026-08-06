import { afterEach, describe, expect, it } from "vitest";
import type { D6CharacterTemplateCatalogV1 } from "@d6-system-2e/core";
import coreCharacterTemplateCatalog from "../../../../content/core-character-template-catalog.json" with { type: "json" };
import fantasyCharacterTemplateCatalog from "../../../../content/fantasy-character-template-catalog.json" with { type: "json" };
import {
  characterTemplateRegistry,
  registerBaseCharacterTemplateCatalog,
  resetCharacterTemplateRegistryForTests,
} from "./character-templates";

afterEach(resetCharacterTemplateRegistryForTests);

const template = {
  attributeScores: { agility: 9, brawn: 9, knowledge: 9, perception: 9 },
  id: "licensed-balanced",
  items: [
    { name: "Licensed gear", system: { quantity: 1 }, type: "gear" as const },
  ],
  label: "Licensed balanced template",
  rulesFamily: "d6-system-second-edition" as const,
  source: { book: "Licensed source", page: 12 },
  suggestedSkillKeys: ["athletics"],
  version: 2 as const,
};

describe("character template registry", () => {
  it("keeps package-owned templates out of the base system boundary", () => {
    registerBaseCharacterTemplateCatalog();
    const [catalog] = characterTemplateRegistry.current();
    expect(catalog?.id).toBe("d6-system-2e.templates");
    expect(catalog?.templates).toEqual([]);
  });

  it("registers all nine exact core templates through the content module", () => {
    characterTemplateRegistry.register(
      "d6-system-2e-core-content",
      coreCharacterTemplateCatalog as D6CharacterTemplateCatalogV1,
    );
    const [catalog] = characterTemplateRegistry.current();
    expect(catalog?.id).toBe("d6-system-2e.core-templates");
    expect(catalog?.templates.map(({ label }) => label)).toEqual([
      "Athlete",
      "Brawler",
      "Doctor",
      "Driver",
      "Jack of all Trades",
      "Thief",
      "Investigator",
      "Scholar",
      "Veteran",
    ]);
    for (const template of catalog?.templates ?? []) {
      expect(Object.keys(template.attributeScores)).toEqual([
        "agility",
        "brawn",
        "knowledge",
        "perception",
      ]);
      expect(
        Object.values(template.attributeScores).reduce(
          (total, score) => total + score,
          0,
        ),
      ).toBe(36);
      expect(template.rulesFamily).toBe("d6-system-second-edition");
    }
    expect(catalog?.templates[4]?.suggestedSkillKeys).toEqual([]);
  });

  it("registers Fantasy templates only through the Fantasy content module", () => {
    characterTemplateRegistry.register(
      "d6-system-2e-fantasy",
      fantasyCharacterTemplateCatalog as D6CharacterTemplateCatalogV1,
    );
    const [catalog] = characterTemplateRegistry.current();
    expect(catalog?.templates.map(({ id }) => id)).toEqual([
      "fantasy-occultist",
      "fantasy-priest",
      "fantasy-warrior",
      "fantasy-wizard",
    ]);
  });

  it("normalizes and freezes lawful external catalogs", () => {
    characterTemplateRegistry.register("licensed-module", {
      id: "licensed.templates",
      label: "Licensed templates",
      templates: [template],
      version: 2,
    });
    const [catalog] = characterTemplateRegistry.current();
    expect(catalog).toMatchObject({
      ownerId: "licensed-module",
      templates: [template],
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog?.templates[0]?.items)).toBe(true);
  });

  it("rejects malformed, conflicting, and mechanically broad data", () => {
    expect(() =>
      characterTemplateRegistry.register("bad owner", {
        id: "bad.templates",
        label: "Bad",
        templates: [],
        version: 2,
      }),
    ).toThrow("stable lowercase ID");
    expect(() =>
      characterTemplateRegistry.register("licensed-module", {
        id: "licensed.templates",
        label: "Licensed",
        templates: [
          {
            ...template,
            items: [{ name: "Actor", system: {}, type: "actor" as never }],
          },
        ],
        version: 2,
      }),
    ).toThrow("unsupported type");
    characterTemplateRegistry.register("owner-one", {
      id: "one.templates",
      label: "One",
      templates: [template],
      version: 2,
    });
    expect(() =>
      characterTemplateRegistry.register("owner-two", {
        id: "two.templates",
        label: "Two",
        templates: [template],
        version: 2,
      }),
    ).toThrow("already registered");
  });

  it("removes only the owning module's catalogs", () => {
    characterTemplateRegistry.register("owner-one", {
      id: "one.templates",
      label: "One",
      templates: [template],
      version: 2,
    });
    characterTemplateRegistry.unregisterOwner("owner-one");
    expect(characterTemplateRegistry.current()).toEqual([]);
  });

  it("normalizes the bounded Superheroic Template extension", () => {
    characterTemplateRegistry.register("owner-one", {
      id: "hero.templates",
      label: "Hero templates",
      templates: [
        {
          ...template,
          id: "lawful-hero",
          superheroic: {
            superpowerCreationDice: 10,
            superpowers: [
              { definitionId: "lawful-flight", focus: " Sky ", rank: 2 },
            ],
          },
        },
      ],
      version: 2,
    });
    expect(
      characterTemplateRegistry.current()[0]?.templates[0]?.superheroic,
    ).toEqual({
      superpowerCreationDice: 10,
      superpowers: [{ definitionId: "lawful-flight", focus: "Sky", rank: 2 }],
    });
  });
});
