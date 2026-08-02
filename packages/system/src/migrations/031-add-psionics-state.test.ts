import { describe, expect, it } from "vitest";
import { addPsionicsState } from "./031-add-psionics-state";

describe("Psionics state migration", () => {
  it("normalizes a loss-preserving attempt ledger", () => {
    const actor = {
      type: "character",
      system: {
        psionics: {
          attempts: [
            { powerId: "original-power", worldTime: 42 },
            { powerId: "", worldTime: -1 },
          ],
        },
      },
      items: [],
    };
    addPsionicsState(actor);
    expect(actor.system.psionics.attempts).toEqual([
      { powerId: "original-power", worldTime: 42 },
    ]);
    addPsionicsState(actor);
    expect(actor.system.psionics.attempts).toHaveLength(1);
  });
});
