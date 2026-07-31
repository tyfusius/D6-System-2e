import { describe, expect, it } from "vitest";
import { addFirstEditionWounds } from "./017-add-first-edition-wounds";

describe("schema 17 First Edition wounds", () => {
  it("adds an independent healthy wound level without changing 2e condition", () => {
    const source = {
      items: [],
      system: { health: { condition: "staggered" } },
      type: "character",
    };
    addFirstEditionWounds(source);
    expect(source.system.health).toEqual({
      condition: "staggered",
      firstEditionWound: "healthy",
    });
  });

  it("is idempotent and preserves a valid existing wound", () => {
    const source = {
      items: [],
      system: {
        health: {
          condition: "healthy",
          firstEditionWound: "severely-wounded",
        },
      },
      type: "npc",
    };
    addFirstEditionWounds(source);
    addFirstEditionWounds(source);
    expect(source.system.health.firstEditionWound).toBe("severely-wounded");
  });

  it("does not alter machine actors", () => {
    const source = { items: [], system: {}, type: "vehicle" };
    addFirstEditionWounds(source);
    expect(source.system).toEqual({});
  });
});
