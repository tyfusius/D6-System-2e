import { describe, expect, it } from "vitest";
import {
  addFirstEditionAdventureActorData,
  addFirstEditionAdventureItemData,
} from "./047-add-first-edition-adventure-data";

describe("First Edition Adventure data migration", () => {
  it("adds Adventure Attribute storage without changing existing values", () => {
    const actor = {
      type: "character",
      system: {
        attributes: { agility: { score: 9 }, reflexes: { score: 12 } },
      },
    };
    addFirstEditionAdventureActorData(actor as never);
    expect(actor.system.attributes).toEqual({
      agility: { score: 9 },
      presence: { score: 0 },
      reflexes: { score: 12 },
    });
  });

  it("normalizes only Adventure manifestations and is idempotent", () => {
    const item = {
      type: "manifestation",
      system: {
        magicSystem: "first-edition-adventure",
        firstEdition: {
          difficulty: 1,
          skillKey: "psionics-telepathy",
          sourcePage: 111,
          tradition: "psionics",
        },
      },
    };
    addFirstEditionAdventureItemData(item);
    addFirstEditionAdventureItemData(item);
    expect(item.system.firstEdition).toEqual({
      difficulty: 2,
      skillKey: "psionics-telepathy",
      sourcePage: 111,
      tradition: "psionics",
    });
  });
});
