import { describe, expect, it } from "vitest";
import { addFirstEditionMortalityClock } from "./019-add-first-edition-mortality-clock";

describe("schema 19 First Edition mortality clock", () => {
  it("adds an empty loss-preserving mortality clock", () => {
    const source = {
      items: [],
      system: {
        health: {
          firstEditionState: { consciousness: "unconscious" },
          firstEditionWound: "mortally-wounded",
        },
      },
      type: "character",
    };
    addFirstEditionMortalityClock(source);
    expect(source.system.health.firstEditionState).toEqual({
      consciousness: "unconscious",
      mortalityCheckId: "",
      mortalityRounds: 0,
    });
  });

  it("is idempotent and sanitizes persisted values", () => {
    const source = {
      items: [],
      system: {
        health: {
          firstEditionState: {
            mortalityCheckId: "combat-1:round:4",
            mortalityRounds: 7.8,
          },
        },
      },
      type: "npc",
    };
    addFirstEditionMortalityClock(source);
    addFirstEditionMortalityClock(source);
    expect(source.system.health.firstEditionState).toEqual({
      mortalityCheckId: "combat-1:round:4",
      mortalityRounds: 7,
    });
  });

  it("does not alter machine actors", () => {
    const source = { items: [], system: {}, type: "starship" };
    addFirstEditionMortalityClock(source);
    expect(source.system).toEqual({});
  });
});
