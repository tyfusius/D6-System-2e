import { describe, expect, it } from "vitest";
import { addExtraordinaryPowerState } from "./050-add-extraordinary-power-state";

describe("extraordinary-power state migration", () => {
  it("normalizes bindings, maintained powers, and nonnegative consequences idempotently", () => {
    const actor = {
      items: [],
      system: {
        extraordinaryPowers: {
          futureRoot: { retained: true },
          frameworks: {
            "test.framework": {
              futureFramework: { retained: true },
              consequenceValues: { strain: 2, invalid: -1 },
              maintainedPowerIds: ["test.power", "test.power", ""],
              powerBindings: { "test.power": "manifestation-1", empty: "" },
              skillBindings: { focus: "skill-1" },
            },
          },
        },
      },
      type: "character",
    };
    addExtraordinaryPowerState(actor);
    expect(actor.system.extraordinaryPowers).toEqual({
      futureRoot: { retained: true },
      frameworks: {
        "test.framework": {
          futureFramework: { retained: true },
          consequenceValues: { strain: 2 },
          maintainedPowerIds: ["test.power"],
          powerBindings: { "test.power": "manifestation-1" },
          skillBindings: { focus: "skill-1" },
        },
      },
    });
    addExtraordinaryPowerState(actor);
    expect(actor.system.extraordinaryPowers).toEqual({
      futureRoot: { retained: true },
      frameworks: {
        "test.framework": {
          futureFramework: { retained: true },
          consequenceValues: { strain: 2 },
          maintainedPowerIds: ["test.power"],
          powerBindings: { "test.power": "manifestation-1" },
          skillBindings: { focus: "skill-1" },
        },
      },
    });
  });
});
