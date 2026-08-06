import { describe, expect, it } from "vitest";
import { addFirstEditionGenreAttributes } from "./041-add-first-edition-genre-attributes";

describe("schema 41 First Edition genre Attributes", () => {
  it("adds missing Fantasy Attribute storage without changing existing scores", () => {
    const source = {
      items: [],
      system: { attributes: { agility: { score: 12 } } },
      type: "character",
    };
    addFirstEditionGenreAttributes(source);
    expect(source.system.attributes).toMatchObject({
      agility: { score: 12 },
      coordination: { score: 0 },
      physique: { score: 0 },
      intellect: { score: 0 },
      acumen: { score: 0 },
      charisma: { score: 0 },
      extranormal: { score: 0 },
    });
  });
});
