import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addFirstEditionInjuryState } from "./018-add-first-edition-injury-state";

function actor(
  system: Record<string, unknown>,
  type = "character",
): ActorSource {
  return { items: [], system, type };
}

describe("schema 18 First Edition injury state", () => {
  it("adds a conscious empty state without changing either damage track", () => {
    const source = {
      items: [],
      system: {
        health: { condition: "wounded", firstEditionWound: "healthy" },
      },
      type: "character",
    };
    addFirstEditionInjuryState(source);
    expect(source.system.health).toEqual({
      condition: "wounded",
      firstEditionWound: "healthy",
      firstEditionState: {
        consciousness: "conscious",
        source: "none",
        stunWound: "none",
        unconsciousMinutes: 0,
      },
    });
  });

  it("infers unresolved Incapacitated and unconscious Mortally Wounded states", () => {
    const incapacitated = actor(
      { health: { firstEditionWound: "incapacitated" } },
      "npc",
    );
    const mortal = actor(
      { health: { firstEditionWound: "mortally-wounded" } },
      "creature",
    );
    addFirstEditionInjuryState(incapacitated);
    addFirstEditionInjuryState(mortal);
    expect(
      (incapacitated.system.health as Record<string, unknown>)
        .firstEditionState,
    ).toMatchObject({
      consciousness: "unresolved",
      source: "incapacitated",
    });
    expect(
      (mortal.system.health as Record<string, unknown>).firstEditionState,
    ).toMatchObject({
      consciousness: "unconscious",
      source: "mortally-wounded",
    });
  });

  it("is idempotent, sanitizes duration, and preserves valid state", () => {
    const source = {
      items: [],
      system: {
        health: {
          firstEditionState: {
            consciousness: "unconscious",
            source: "stun",
            stunWound: "severely-wounded",
            unconsciousMinutes: 7.9,
          },
          firstEditionWound: "healthy",
        },
      },
      type: "character",
    };
    addFirstEditionInjuryState(source);
    addFirstEditionInjuryState(source);
    expect(source.system.health.firstEditionState).toEqual({
      consciousness: "unconscious",
      source: "stun",
      stunWound: "severely-wounded",
      unconsciousMinutes: 7,
    });
  });

  it("does not alter machine actors", () => {
    const source = { items: [], system: {}, type: "vehicle" };
    addFirstEditionInjuryState(source);
    expect(source.system).toEqual({});
  });
});
