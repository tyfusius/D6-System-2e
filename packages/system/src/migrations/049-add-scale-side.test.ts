import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";
import { addActorScaleSide, addItemScaleSide } from "./049-add-scale-side";

describe("Open D6 scalar scale-side migration", () => {
  it("infers larger only for positive machine evidence", () => {
    const starship = {
      items: [],
      system: { scale: 18 },
      type: "starship",
    } as unknown as ActorSource;
    const character = {
      items: [],
      system: { scale: 3 },
      type: "character",
    } as unknown as ActorSource;
    addActorScaleSide(starship);
    addActorScaleSide(character);
    expect(starship.system.scaleSide).toBe("larger");
    expect(character.system.scaleSide).toBe("unresolved");
  });

  it("replaces the schema-injected Human default for positive values", () => {
    const starship = {
      items: [],
      system: { scale: 18, scaleSide: "human" },
      type: "starship",
    } as unknown as ActorSource;
    const character = {
      items: [],
      system: { scale: 3, scaleSide: "human" },
      type: "character",
    } as unknown as ActorSource;
    addActorScaleSide(starship);
    addActorScaleSide(character);
    expect(starship.system.scaleSide).toBe("larger");
    expect(character.system.scaleSide).toBe("unresolved");
  });

  it("treats zero as Human and mounted Weapon overrides as larger", () => {
    const weapon = {
      system: { scale: 0 },
      type: "weapon",
    } as unknown as ItemSource;
    const mounted = {
      system: { scale: 6 },
      type: "starship-weapon",
    } as unknown as ItemSource;
    addItemScaleSide(weapon);
    addItemScaleSide(mounted);
    expect(weapon.system.scaleSide).toBe("human");
    expect(mounted.system.scaleSide).toBe("larger");
  });

  it("preserves authored and unresolved sides idempotently", () => {
    const actor = {
      items: [],
      system: { scale: 183, scaleSide: "unresolved" },
      type: "starship",
    } as unknown as ActorSource;
    addActorScaleSide(actor);
    addActorScaleSide(actor);
    expect(actor.system).toEqual({ scale: 183, scaleSide: "unresolved" });
  });
});
