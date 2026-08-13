import { MODULE_ID } from "./module";
import { createEchoTerminology } from "./terminology";

export const ECHO_RULES_PROFILE_ID = "echo-d6";

export function createEchoRulesProfile(localize: (key: string) => string) {
  return Object.freeze({
    constraints: Object.freeze([]),
    description: localize("ECHOD6.Settings.PresetHint"),
    id: ECHO_RULES_PROFILE_ID,
    label: "Echo D6",
    source: Object.freeze({ kind: "module", ownerId: MODULE_ID }),
    strategies: Object.freeze({
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
    }),
    terminology: createEchoTerminology(localize),
    version: 1,
  });
}
