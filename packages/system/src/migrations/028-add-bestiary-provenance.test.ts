import { describe, expect, it } from "vitest";
import { addBestiaryProvenance } from "./028-add-bestiary-provenance";

describe("schema 28 bestiary provenance", () => {
  it("normalizes Creature provenance without touching other Actor families", () => {
    const creature = {
      items: [],
      system: {
        bestiary: {
          applied: true,
          catalogId: "licensed.bestiary",
          entryId: "licensed-creature",
          label: "Licensed creature",
          ownerId: "licensed-module",
          sourceBook: "Licensed source",
          sourcePage: 40,
          version: 1,
        },
      },
      type: "creature",
    };
    addBestiaryProvenance(creature);
    expect(creature.system.bestiary).toEqual({
      applied: true,
      catalogId: "licensed.bestiary",
      entryId: "licensed-creature",
      label: "Licensed creature",
      ownerId: "licensed-module",
      sourceBook: "Licensed source",
      sourcePage: 40,
      version: 1,
    });
    const character = { items: [], system: {}, type: "character" };
    addBestiaryProvenance(character);
    expect(character.system).toEqual({});
  });
});
