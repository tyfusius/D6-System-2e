import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addFirstEditionFantasyMagicAndStrengthDamage } from "./042-add-first-edition-fantasy-magic-and-strength-damage";

describe("schema 42 Fantasy magic and Strength Damage", () => {
  it("preserves explicit First Edition manifestation fields", () => {
    const source: ItemSource = {
      _id: "spell",
      name: "Spell",
      type: "manifestation",
      system: {
        magicSystem: "first-edition-fantasy",
        firstEdition: {
          difficulty: 11,
          skillKey: "miracles-favor",
          sourcePage: 108,
          tradition: "miracles",
        },
      },
    };
    addFirstEditionFantasyMagicAndStrengthDamage(source);
    expect(source.system).toMatchObject({
      magicSystem: "first-edition-fantasy",
      firstEdition: {
        difficulty: 11,
        skillKey: "miracles-favor",
        sourcePage: 108,
        tradition: "miracles",
      },
    });
  });

  it("defaults legacy manifestations and weapons safely", () => {
    const spell: ItemSource = {
      _id: "spell",
      name: "Spell",
      type: "manifestation",
      system: {},
    };
    const weapon: ItemSource = {
      _id: "weapon",
      name: "Weapon",
      type: "weapon",
      system: {},
    };
    addFirstEditionFantasyMagicAndStrengthDamage(spell);
    addFirstEditionFantasyMagicAndStrengthDamage(weapon);
    expect(spell.system.magicSystem).toBe("second-edition-freeform");
    expect(weapon.system.damageBasis).toBe("fixed");
  });

  it("leaves later Adventure manifestations for their owning migration", () => {
    const exercise: ItemSource = {
      _id: "exercise",
      name: "Exercise",
      type: "manifestation",
      system: {
        magicSystem: "first-edition-adventure",
        firstEdition: {
          difficulty: 10,
          skillKey: "psionics-telepathy",
          sourcePage: 111,
          tradition: "psionics",
        },
      },
    };
    addFirstEditionFantasyMagicAndStrengthDamage(exercise);
    expect(exercise.system).toMatchObject({
      magicSystem: "first-edition-adventure",
      firstEdition: {
        difficulty: 10,
        skillKey: "psionics-telepathy",
        sourcePage: 111,
        tradition: "psionics",
      },
    });
  });
});
