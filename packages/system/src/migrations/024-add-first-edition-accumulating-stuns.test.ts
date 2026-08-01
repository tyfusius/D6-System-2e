import { describe, expect, it } from "vitest";
import { addFirstEditionAccumulatingStuns } from "./024-add-first-edition-accumulating-stuns";

describe("schema 24 First Edition accumulating stuns", () => {
  it("adds an inactive persistent state and maps a compatible legacy shape", () => {
    const source = {
      items: [],
      system: {
        health: { stuns: { value: 2, current: 1, rounds: 2 } },
      },
      type: "character",
    };
    addFirstEditionAccumulatingStuns(source);
    expect(source.system.health).toMatchObject({
      firstEditionStuns: {
        version: 1,
        total: 2,
        penaltyDice: 1,
        roundsRemaining: 2,
        lastProcessedRoundId: "",
      },
    });
  });

  it("initializes supported actors without affecting machines", () => {
    const character = { items: [], system: { health: {} }, type: "npc" };
    addFirstEditionAccumulatingStuns(character);
    expect(character.system.health).toMatchObject({
      firstEditionStuns: {
        version: 1,
        total: 0,
        penaltyDice: 0,
        roundsRemaining: 0,
        lastProcessedRoundId: "",
      },
    });
    const machine = { items: [], system: { health: {} }, type: "vehicle" };
    addFirstEditionAccumulatingStuns(machine);
    expect(machine.system.health).toEqual({});
  });

  it("preserves canonical state when data-model migration repeats", () => {
    const source = {
      items: [],
      system: {
        health: {
          firstEditionStuns: {
            version: 1,
            total: 3,
            penaltyDice: 2,
            roundsRemaining: 1,
            lastProcessedRoundId: "combat:4",
          },
        },
      },
      type: "creature",
    };
    addFirstEditionAccumulatingStuns(source);
    expect(source.system.health.firstEditionStuns).toEqual({
      version: 1,
      total: 3,
      penaltyDice: 2,
      roundsRemaining: 1,
      lastProcessedRoundId: "combat:4",
    });
  });
});
