import { afterEach, describe, expect, it } from "vitest";
import { bestiaryRegistry, resetBestiaryRegistryForTests } from "./bestiary";

afterEach(resetBestiaryRegistryForTests);

const entry = {
  attributeScores: { agility: 12, brawn: 27, knowledge: 6, perception: 9 },
  biography: "Licensed description",
  defenseOverrides: { dodge: 10, parry: 15 },
  id: "licensed-large-creature",
  items: [
    {
      name: "Natural attack",
      system: { damage: 9 },
      type: "weapon" as const,
    },
  ],
  label: "Licensed large creature",
  scale: 3,
  source: { book: "Licensed source", page: 40 },
  version: 1 as const,
};

describe("bestiary registry", () => {
  it("normalizes and freezes lawful external creature catalogs", () => {
    bestiaryRegistry.register("licensed-module", {
      entries: [entry],
      id: "licensed.bestiary",
      label: "Licensed bestiary",
      version: 1,
    });
    const [catalog] = bestiaryRegistry.current();
    expect(catalog).toMatchObject({
      ownerId: "licensed-module",
      entries: [entry],
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog?.entries[0]?.attributeScores)).toBe(true);
    expect(Object.isFrozen(catalog?.entries[0]?.items)).toBe(true);
  });

  it("rejects malformed, conflicting, and mechanically broad entries", () => {
    expect(() =>
      bestiaryRegistry.register("bad owner", {
        entries: [],
        id: "bad.bestiary",
        label: "Bad",
        version: 1,
      }),
    ).toThrow("stable lowercase ID");
    expect(() =>
      bestiaryRegistry.register("licensed-module", {
        entries: [
          {
            ...entry,
            items: [{ name: "Skill", system: {}, type: "skill" as never }],
          },
        ],
        id: "bad-items.bestiary",
        label: "Bad items",
        version: 1,
      }),
    ).toThrow("unsupported type");
    expect(() =>
      bestiaryRegistry.register("licensed-module", {
        entries: [{ ...entry, attributeScores: { brawn: 61 } }],
        id: "bad-score.bestiary",
        label: "Bad score",
        version: 1,
      }),
    ).toThrow("must not exceed 60");
    bestiaryRegistry.register("owner-one", {
      entries: [entry],
      id: "one.bestiary",
      label: "One",
      version: 1,
    });
    expect(() =>
      bestiaryRegistry.register("owner-two", {
        entries: [entry],
        id: "two.bestiary",
        label: "Two",
        version: 1,
      }),
    ).toThrow("already registered");
  });

  it("removes only the owning module's catalogs", () => {
    bestiaryRegistry.register("owner-one", {
      entries: [entry],
      id: "one.bestiary",
      label: "One",
      version: 1,
    });
    bestiaryRegistry.unregisterOwner("owner-one");
    expect(bestiaryRegistry.current()).toEqual([]);
  });
});
