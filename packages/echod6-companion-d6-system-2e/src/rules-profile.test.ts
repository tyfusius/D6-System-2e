import { describe, expect, it } from "vitest";
import { createEchoRulesProfile } from "./rules-profile";

describe("Echo Rules Profile", () => {
  it("derives every strategy from the Second Edition baseline", () => {
    const profile = createEchoRulesProfile((key) => key);
    expect(profile.strategies).toEqual({
      actionEconomy: "d6e2.action-economy.segmented",
      activeDefenses: "d6e2.defenses.static",
      advancement: "d6e2.advancement.configured",
      attributes: "d6e2.attributes.campaign-profile",
      health: "d6e2.health.condition-track",
      initiative: "d6e2.initiative.contextual",
      movement: "d6e2.movement.segmented",
      metaCurrency: "d6e2.meta-currency.hero-points",
      pips: "d6e2.pips.configured",
      retries: "d6e2.retries.doubling-down",
      scale: "d6e2.scale.ranked",
      successEvaluator: "d6e2.success.strictly-greater",
      wildDie: "d6e2.wild-die.advantage-complication",
    });
  });
});
