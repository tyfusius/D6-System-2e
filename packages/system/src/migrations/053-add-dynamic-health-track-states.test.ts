import { describe, expect, it } from "vitest";
import { addDynamicHealthTrackStates } from "./053-add-dynamic-health-track-states";

describe("migration 053 per-model health states", () => {
  it.each(["character", "creature", "npc"])(
    "copies valid canonical states for %s without deleting mirrors",
    (type) => {
      const source = {
        items: [],
        system: {
          health: {
            condition: "wounded",
            firstEditionWound: "severely-wounded",
          },
        },
        type,
      };
      addDynamicHealthTrackStates(source);
      expect(source.system.health).toEqual({
        condition: "wounded",
        firstEditionWound: "severely-wounded",
        tracks: {
          "d6e2%2Ehealth%2Econdition-track": { stateId: "wounded" },
          "open-d6%2Ehealth%2Ewound-track": {
            stateId: "severely-wounded",
          },
        },
      });
    },
  );

  it("preserves orphaned model states and never guesses from invalid legacy data", () => {
    const source = {
      items: [],
      system: {
        health: {
          condition: "almost-dead",
          firstEditionWound: 4,
          tracks: { "campaign.health.grit": { stateId: "shaken" } },
        },
      },
      type: "character",
    };
    addDynamicHealthTrackStates(source);
    expect(source.system.health).toEqual({
      condition: "almost-dead",
      firstEditionWound: 4,
      tracks: {
        "campaign.health.grit": { stateId: "shaken" },
        "d6e2%2Ehealth%2Econdition-track": { stateId: "healthy" },
        "open-d6%2Ehealth%2Ewound-track": { stateId: "healthy" },
      },
    });
  });

  it("is idempotent and does not alter machines", () => {
    const personal = {
      items: [],
      system: {
        health: {
          condition: "healthy",
          firstEditionWound: "healthy",
          tracks: { "d6e2.health.condition-track": { stateId: "stunned" } },
        },
      },
      type: "npc",
    };
    addDynamicHealthTrackStates(personal);
    const once = structuredClone(personal);
    addDynamicHealthTrackStates(personal);
    expect(personal).toEqual(once);

    const machine = {
      items: [],
      system: { health: { condition: "wounded" } },
      type: "vehicle",
    };
    addDynamicHealthTrackStates(machine);
    expect(machine.system.health).toEqual({ condition: "wounded" });
  });
});
