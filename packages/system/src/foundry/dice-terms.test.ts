import { describe, expect, it, vi } from "vitest";

import { registerD6System2eDiceTerms } from "./dice-terms";

describe("D6 System custom dice terms", () => {
  it("registers a six-sided Wild Die without embedding rules automation", () => {
    class FoundryDie {
      constructor(readonly data: Record<string, unknown>) {}
    }
    const terms: Record<string, unknown> = {};
    vi.stubGlobal("foundry", { dice: { terms: { Die: FoundryDie } } });
    vi.stubGlobal("CONFIG", { Dice: { terms } });

    registerD6System2eDiceTerms();

    const WildDie = terms.w as new (
      data: Record<string, unknown>,
    ) => FoundryDie;
    expect(new WildDie({ number: 1 }).data).toEqual({
      faces: 6,
      number: 1,
    });
    vi.unstubAllGlobals();
  });
});
