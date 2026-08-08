import type { D6System2eTerminologyContribution } from "./contributions";

export const D6_RULES_PROFILE_CONTRACT_VERSION = 1 as const;

export const D6_RULE_STRATEGY_SLOTS = Object.freeze([
  "actionEconomy",
  "activeDefenses",
  "advancement",
  "attributes",
  "health",
  "initiative",
  "movement",
  "metaCurrency",
  "pips",
  "retries",
  "successEvaluator",
  "wildDie",
] as const);

export type D6RulesStrategySlot = (typeof D6_RULE_STRATEGY_SLOTS)[number];

/** Stable engine strategy identifiers selected by a Rules Profile. */
export type D6RulesStrategySelectionV1 = Readonly<
  Record<D6RulesStrategySlot, string>
>;

export type D6RulesPredicateV1 =
  | Readonly<{
      readonly equals: boolean | number | string;
      readonly key: string;
      readonly kind: "setting";
    }>
  | Readonly<{
      readonly equals: string;
      readonly kind: "strategy";
      readonly slot: D6RulesStrategySlot;
    }>
  | Readonly<{
      readonly kind: "all" | "any";
      readonly predicates: readonly D6RulesPredicateV1[];
    }>
  | Readonly<{
      readonly kind: "not";
      readonly predicate: D6RulesPredicateV1;
    }>;

export interface D6RulesConstraintV1 {
  readonly assertion: D6RulesPredicateV1;
  readonly id: string;
  readonly message: string;
}

export type D6RulesProfileSourceV1 =
  | Readonly<{ readonly kind: "bundled" }>
  | Readonly<{
      readonly kind: "module";
      readonly ownerId: string;
      readonly ownerVersion?: string;
    }>
  | Readonly<{ readonly kind: "world" }>;

/**
 * A portable rules configuration. Labels are presentation only; mechanics
 * resolve exclusively through stable strategy identifiers.
 */
export interface D6RulesProfileV1 {
  readonly constraints: readonly D6RulesConstraintV1[];
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly source: D6RulesProfileSourceV1;
  readonly strategies: D6RulesStrategySelectionV1;
  readonly terminology: D6System2eTerminologyContribution;
  readonly version: typeof D6_RULES_PROFILE_CONTRACT_VERSION;
}

/** World-authored Rules Profiles plus the active selection. */
export interface D6WorldRulesProfilesV1 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6RulesProfileV1>>;
  readonly version: typeof D6_RULES_PROFILE_CONTRACT_VERSION;
}

export interface D6System2eRulesProfileRegistry {
  current(): readonly D6RulesProfileV1[];
  register(ownerId: string, profile: D6RulesProfileV1): void;
  unregisterOwner(ownerId: string): void;
}
