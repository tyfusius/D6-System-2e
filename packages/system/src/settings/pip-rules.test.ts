import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
  currentPipsEnabled,
  currentPipsRuntimeStrategy,
  pipsRuntimeStrategy,
} from "./pip-rules";

let configured = "d6e2.pips.configured";
const settings = new Map<string, unknown>();

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ strategies: { pips: configured } }),
}));

beforeEach(() => {
  configured = "d6e2.pips.configured";
  settings.clear();
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("Pips runtime strategies", () => {
  it("publishes immutable storage, effective-score, and step contracts", () => {
    expect(pipsRuntimeStrategy("open-d6.pips.classic")).toEqual({
      dependencies: { rankedFeatures: "satisfied" },
      effectiveScore: "complete-pip-score",
      id: "open-d6.pips.classic",
      progressionStepScore: 1,
      splitModifiers: "active",
      storage: "canonical-pip-score",
    });
    expect(Object.isFrozen(pipsRuntimeStrategy(configured))).toBe(true);
  });

  it("preserves dormant modifiers while resolving whole-die components", () => {
    expect(currentPipsRuntimeStrategy().id).toBe("d6e2.pips.whole-dice");
    expect(currentPipsEnabled()).toBe(false);
    expect(currentEffectivePipScore(11)).toBe(9);
    expect(currentCombinedPipScore(11, 2)).toBe(9);
  });

  it("enables complete pip scores through the Second Edition module", () => {
    settings.set("secondEditionPipsModule", true);
    expect(currentPipsRuntimeStrategy().id).toBe("d6e2.pips.module");
    expect(currentEffectivePipScore(11)).toBe(11);
    expect(currentCombinedPipScore(11, 2)).toBe(13);
  });

  it("honors imported Open D6 Pips independently of the Attribute family", () => {
    configured = "open-d6.pips.classic";
    expect(currentPipsRuntimeStrategy()).toMatchObject({
      id: "open-d6.pips.classic",
      progressionStepScore: 1,
    });
  });

  it("fails closed to whole dice for an unavailable contributed strategy", () => {
    configured = "community.pips.unknown";
    expect(currentPipsRuntimeStrategy().id).toBe("d6e2.pips.whole-dice");
  });
});
