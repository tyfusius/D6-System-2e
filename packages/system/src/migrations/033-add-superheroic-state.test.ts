import { describe, expect, it } from "vitest";
import { addSuperheroicState } from "./033-add-superheroic-state";

describe("superheroic state migration", () => {
  it("adds the printed secret-identity defaults", () => {
    const actor = {
      items: [],
      system: {} as Record<string, unknown>,
      type: "character",
    };
    addSuperheroicState(actor);
    expect(
      (actor.system.superheroic as { secretIdentity: unknown }).secretIdentity,
    ).toEqual({
      heroicIdentity: "",
      heroPoints: 1,
      secretIdentity: "",
      status: "active",
      suspicion: 0,
    });
  });
});
