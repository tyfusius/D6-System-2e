import { MODULE_ID } from "./campaign";
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
      actionEconomy: "open-d6.action-economy.flexible",
      activeDefenses: "open-d6.defenses.active",
      advancement: "open-d6.advancement.character-points",
      attributes: "open-d6.attributes.six-attribute",
      health: "open-d6.health.wounds-or-body-points",
      initiative: "open-d6.initiative.perception",
      movement: "open-d6.movement.relative",
      metaCurrency: "open-d6.meta-currency.character-and-fate-points",
      pips: "open-d6.pips.classic",
      retries: "open-d6.retries.no-general-reroll",
      successEvaluator: "open-d6.success.meets-or-exceeds",
      wildDie: "open-d6.wild-die.critical-one",
    }),
    terminology: createEchoTerminology(localize),
    version: 1,
  });
}
