import { describe, expect, it } from "vitest";
import type { D6RulesRuntimeDecisionV1 } from "../contracts/rules-runtime";
import {
  addEffectivePipScores,
  effectivePipScore,
  usesPips,
} from "./pip-rules";

function decision(strategy: string): D6RulesRuntimeDecisionV1 {
  return {
    blockedBy: Object.freeze([]),
    id: "pips",
    owner: strategy.startsWith("open-d6") ? "open-d6" : "second-edition",
    state: "active",
    strategy,
  };
}

describe("pip rules", () => {
  it("preserves stored modifiers for both supported Pips strategies", () => {
    for (const strategy of [
      "second-edition-pips-module",
      "open-d6-classic-pips",
      "d6e2.pips.module",
      "open-d6.pips.classic",
    ]) {
      const capability = decision(strategy);
      expect(usesPips(capability)).toBe(true);
      expect(effectivePipScore(11, capability)).toBe(11);
    }
  });

  it("ignores but does not mutate stored modifiers in core Second Edition", () => {
    const capability = decision("second-edition-whole-dice");
    expect(usesPips(capability)).toBe(false);
    expect(effectivePipScore(11, capability)).toBe(9);
  });

  it("resolves components before addition so dormant modifiers never carry", () => {
    const capability = decision("second-edition-whole-dice");
    expect(addEffectivePipScores(capability, 11, 2)).toBe(9);
    expect(
      addEffectivePipScores(decision("second-edition-pips-module"), 11, 2),
    ).toBe(13);
  });
});
