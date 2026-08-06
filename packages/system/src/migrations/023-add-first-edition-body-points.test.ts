import { describe, expect, it } from "vitest";
import { addFirstEditionBodyPoints } from "./023-add-first-edition-body-points";

describe("schema 23 First Edition Body Points", () => {
  it("adds an inactive, loss-preserving Body Point state", () => {
    const source = {
      items: [],
      system: {
        health: { condition: "healthy", body_points: { current: 18, max: 24 } },
      },
      type: "character",
    };
    addFirstEditionBodyPoints(source);
    expect(source.system.health).toMatchObject({
      condition: "healthy",
      firstEditionBodyPoints: { current: 18, maximum: 24 },
    });
  });

  it("initializes missing data without affecting machines", () => {
    const character = { items: [], system: { health: {} }, type: "npc" };
    addFirstEditionBodyPoints(character);
    expect(character.system.health).toMatchObject({
      firstEditionBodyPoints: { current: 0, maximum: 0 },
    });
    const machine = {
      items: [],
      system: { health: { condition: "healthy" } },
      type: "vehicle",
    };
    addFirstEditionBodyPoints(machine);
    expect(machine.system.health).toEqual({ condition: "healthy" });
  });

  it("preserves canonical Body Points when data-model migration repeats", () => {
    const character = {
      items: [],
      system: {
        health: {
          firstEditionBodyPoints: { current: 17, maximum: 28 },
        },
      },
      type: "character",
    };
    addFirstEditionBodyPoints(character);
    expect(character.system.health).toMatchObject({
      firstEditionBodyPoints: { current: 17, maximum: 28 },
    });
  });
});
