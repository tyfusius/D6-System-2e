export const D6_RULES_RUNTIME_VERSION = 1 as const;

export type D6RulesRuntimeState = "active" | "inactive-preserved" | "planned";

export type D6RulesRuntimeOwner = "shared" | "second-edition" | "open-d6";

export interface D6RulesRuntimeDecisionV1 {
  readonly blockedBy: readonly string[];
  readonly id: string;
  readonly owner: D6RulesRuntimeOwner;
  readonly state: D6RulesRuntimeState;
  readonly strategy: string;
}

export interface D6RulesRuntimeSnapshotV1 {
  readonly actionEconomy: D6RulesRuntimeDecisionV1;
  readonly advancedSkills: D6RulesRuntimeDecisionV1;
  readonly advancement: D6RulesRuntimeDecisionV1;
  readonly attributes: D6RulesRuntimeDecisionV1;
  readonly chases: D6RulesRuntimeDecisionV1;
  readonly contractVersion: typeof D6_RULES_RUNTIME_VERSION;
  readonly damage: D6RulesRuntimeDecisionV1;
  readonly decisions: readonly D6RulesRuntimeDecisionV1[];
  readonly defenses: D6RulesRuntimeDecisionV1;
  readonly environments: D6RulesRuntimeDecisionV1;
  readonly initiative: D6RulesRuntimeDecisionV1;
  readonly metaCurrency: D6RulesRuntimeDecisionV1;
  readonly movement: D6RulesRuntimeDecisionV1;
  readonly narrativeFeatures: D6RulesRuntimeDecisionV1;
  readonly pips: D6RulesRuntimeDecisionV1;
  readonly rankedFeatures: D6RulesRuntimeDecisionV1;
  readonly retries: D6RulesRuntimeDecisionV1;
  readonly rulesProfileId: string;
  readonly scale: D6RulesRuntimeDecisionV1;
  readonly successEvaluator: D6RulesRuntimeDecisionV1;
  readonly wildDie: D6RulesRuntimeDecisionV1;
}
