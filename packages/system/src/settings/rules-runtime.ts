import {
  D6_RULES_RUNTIME_VERSION,
  type D6RulesRuntimeDecisionV1,
  type D6RulesRuntimeOwner,
  type D6RulesRuntimeSnapshotV1,
  type D6RulesRuntimeState,
} from "@d6-system-2e/core";
import { currentActionEconomyRuntimeStrategy } from "./action-economy";
import { currentAdvancementRuntimeStrategy } from "./advancement";
import { currentAttributeRuntimeStrategy } from "./attributes";
import { currentDefenseRuntimeStrategy } from "./defenses";
import { currentConfiguredHealthModel } from "./health-model-library";
import { currentInitiativeRuntimeStrategy } from "./initiative";
import { currentMovementRuntimeStrategy } from "./movement";
import { currentOptionalCapabilityRuntime } from "./optional-capabilities";
import { currentPipsRuntimeStrategy } from "./pip-rules";
import {
  currentMetaCurrencyRuntimeStrategy,
  currentRetryRuntimeStrategy,
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
} from "./roll-outcome";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { currentScaleRuntimeStrategy } from "./scale";

function ownerFor(strategy: string): D6RulesRuntimeOwner {
  return strategy.startsWith("open-d6.") ? "open-d6" : "second-edition";
}

function decision(
  id: string,
  strategy: string,
  state: D6RulesRuntimeState = "active",
  blockedBy: readonly string[] = [],
): D6RulesRuntimeDecisionV1 {
  return Object.freeze({
    blockedBy: Object.freeze([...blockedBy]),
    id,
    owner: ownerFor(strategy),
    state,
    strategy,
  });
}

export function currentRulesRuntime(): D6RulesRuntimeSnapshotV1 {
  const profile = currentConfiguredRulesProfile();
  const advancementStrategy = currentAdvancementRuntimeStrategy();
  const optional = currentOptionalCapabilityRuntime();
  const actionEconomy = decision(
    "action-economy",
    currentActionEconomyRuntimeStrategy().id,
  );
  const advancement = decision(
    "advancement",
    advancementStrategy.id,
    advancementStrategy.family === "unavailable" ? "planned" : "active",
  );
  const attributes = decision(
    "attributes",
    currentAttributeRuntimeStrategy().id,
  );
  const damage = decision(
    "damage",
    currentConfiguredHealthModel(profile).damageStrategyId,
  );
  const defenses = decision("defenses", currentDefenseRuntimeStrategy().id);
  const initiative = decision(
    "initiative",
    currentInitiativeRuntimeStrategy().id,
  );
  const metaCurrency = decision(
    "meta-currency",
    currentMetaCurrencyRuntimeStrategy().id,
  );
  const movement = decision("movement", currentMovementRuntimeStrategy().id);
  const pips = decision("pips", currentPipsRuntimeStrategy().id);
  const retries = decision("retries", currentRetryRuntimeStrategy().id);
  const scale = decision("scale", currentScaleRuntimeStrategy(profile).id);
  const successEvaluator = decision(
    "success-evaluator",
    currentSuccessRuntimeStrategy().id,
  );
  const wildDie = decision("wild-die", currentWildDieRuntimeStrategy().id);
  const decisions = Object.freeze([
    successEvaluator,
    wildDie,
    metaCurrency,
    defenses,
    initiative,
    actionEconomy,
    movement,
    damage,
    advancement,
    attributes,
    pips,
    optional.chases,
    optional.environments,
    optional.advancedSkills,
    optional.rankedFeatures,
    optional.narrativeFeatures,
    retries,
    scale,
  ]);
  return Object.freeze({
    actionEconomy,
    advancedSkills: optional.advancedSkills,
    advancement,
    attributes,
    chases: optional.chases,
    contractVersion: D6_RULES_RUNTIME_VERSION,
    damage,
    decisions,
    defenses,
    environments: optional.environments,
    initiative,
    metaCurrency,
    movement,
    narrativeFeatures: optional.narrativeFeatures,
    pips,
    rankedFeatures: optional.rankedFeatures,
    retries,
    rulesProfileId: profile.id,
    scale,
    successEvaluator,
    wildDie,
  });
}
