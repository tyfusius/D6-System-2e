import { afterEach, describe, expect, it } from "vitest";
import {
  characterTemplateRegistry,
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
  source: { book: "Licensed source", page: 12 },
  suggestedSkillKeys: ["athletics"],
  version: 1 as const,
};

describe("character template registry", () => {
  it("normalizes and freezes lawful external catalogs", () => {
    characterTemplateRegistry.register("licensed-module", {
      id: "licensed.templates",
      label: "Licensed templates",
      templates: [template],
      version: 1,
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
        version: 1,
      }),
    ).toThrow("stable lowercase ID");
    expect(() =>
      characterTemplateRegistry.register("licensed-module", {
        id: "licensed.templates",
        label: "Licensed",
        templates: [
          {
            ...template,
            items: [{ name: "Skill", system: {}, type: "skill" as never }],
          },
        ],
        version: 1,
      }),
    ).toThrow("unsupported type");
    characterTemplateRegistry.register("owner-one", {
      id: "one.templates",
      label: "One",
      templates: [template],
      version: 1,
    });
    expect(() =>
      characterTemplateRegistry.register("owner-two", {
        id: "two.templates",
        label: "Two",
        templates: [template],
        version: 1,
      }),
    ).toThrow("already registered");
  });

  it("removes only the owning module's catalogs", () => {
    characterTemplateRegistry.register("owner-one", {
      id: "one.templates",
      label: "One",
      templates: [template],
      version: 1,
    });
    characterTemplateRegistry.unregisterOwner("owner-one");
    expect(characterTemplateRegistry.current()).toEqual([]);
  });
});
