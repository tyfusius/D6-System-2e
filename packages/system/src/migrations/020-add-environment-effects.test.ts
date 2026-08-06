import { describe, expect, it } from "vitest";
import { addEnvironmentEffects } from "./020-add-environment-effects";

describe("schema 20 environment effects", () => {
  it("adds an inactive loss-preserving effect record", () => {
    const source = {
      items: [],
      system: { environment: { retained: true } },
      type: "character",
    };
    addEnvironmentEffects(source);
    expect(source.system.environment).toMatchObject({
      active: false,
      hazard: "none",
      retained: true,
      severity: "none",
      version: 1,
    });
  });

  it("preserves valid persisted values and ignores machines", () => {
    const actor = {
      items: [],
      system: {
        environment: {
          active: true,
          difficulty: 20,
          hazard: "cold",
          penaltyScore: 6,
          sourcePage: 77,
        },
      },
      type: "npc",
    };
    addEnvironmentEffects(actor);
    expect(actor.system.environment).toMatchObject({
      active: true,
      difficulty: 20,
      hazard: "cold",
      penaltyScore: 6,
      sourcePage: 77,
    });
    const machine = { items: [], system: {}, type: "vehicle" };
    addEnvironmentEffects(machine);
    expect(machine.system).toEqual({});
  });
});
