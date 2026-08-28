export const D6_HEALTH_MODEL_CONTRACT_VERSION = 3 as const;
export const D6_HEALTH_MODEL_MIN_STATES = 2 as const;
export const D6_HEALTH_MODEL_MAX_STATES = 20 as const;
export const D6_HEALTH_MODEL_MAX_PENALTY_SCORE = 60 as const;
export const D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS = 2 as const;
export const D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS = 8 as const;

/**
 * Encode a stable model id for storage as one literal ObjectField key.
 * Foundry flattens dots in Document update payloads as property separators.
 */
export function healthTrackStorageKey(modelId: string): string {
  return encodeURIComponent(modelId).replaceAll(".", "%2E");
}

export const D6_HEALTH_MODEL_KINDS = Object.freeze([
  "track",
  "pool",
  "hybrid",
] as const);

export type D6HealthModelKind = (typeof D6_HEALTH_MODEL_KINDS)[number];

export const D6_HEALTH_DAMAGE_STRATEGIES = Object.freeze([
  "d6e2.damage.conditions",
  "open-d6.damage.wounds",
  "open-d6.damage.body-points",
  "open-d6.damage.body-points-with-wounds",
] as const);

export type D6HealthDamageStrategyId =
  (typeof D6_HEALTH_DAMAGE_STRATEGIES)[number];

export const D6_HEALTH_DAMAGE_OUTCOMES = Object.freeze({
  "d6e2.damage.conditions": Object.freeze([
    "staggered",
    "stunned",
    "wounded",
    "mortally-wounded",
    "dead",
  ] as const),
  "open-d6.damage.wounds": Object.freeze([
    "none",
    "stunned",
    "wounded",
    "incapacitated",
    "mortally-wounded",
    "dead",
  ] as const),
  "open-d6.damage.body-points": Object.freeze([] as const),
  "open-d6.damage.body-points-with-wounds": Object.freeze([] as const),
} satisfies Readonly<Record<D6HealthDamageStrategyId, readonly string[]>>);

export type D6HealthDamageOutcomeId =
  (typeof D6_HEALTH_DAMAGE_OUTCOMES)[D6HealthDamageStrategyId][number];

export type D6HealthModelSourceV1 =
  | Readonly<{ readonly kind: "bundled" }>
  | Readonly<{
      readonly kind: "module";
      readonly ownerId: string;
      readonly ownerVersion?: string;
    }>;

export type D6HealthModelSourceV2 =
  D6HealthModelSourceV1 | Readonly<{ readonly kind: "world" }>;

export interface D6HealthTrackStateV1 {
  readonly id: string;
  readonly label: string;
  readonly penaltyScore: number;
  readonly terminal?: boolean;
}

export interface D6HealthTrackStateV2 extends D6HealthTrackStateV1 {
  readonly allowsActions: boolean;
  /** Plain-text presentation guidance; never interpreted as HTML. */
  readonly description?: string;
  /** Optional one-step transition applied at the beginning of a Combat round. */
  readonly roundStartStateId?: string;
  readonly terminal: boolean;
}

export type D6HealthDamageTransitionTableV2 = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

export interface D6HealthTrackDefinitionV2 {
  readonly damageTransitions: D6HealthDamageTransitionTableV2;
  readonly initialStateId: string;
  readonly states: readonly D6HealthTrackStateV2[];
}

export interface D6HealthDamageBandV3 {
  /** Inclusive upper boundary. Omitted only for the final open-ended band. */
  readonly maximum?: number;
  /** Inclusive lower boundary for Damage - Resistance. */
  readonly minimum: number;
}

export type D6HealthDamageResultRuleV3 =
  | Readonly<{
      readonly band: D6HealthDamageBandV3;
      readonly kind: "difference-band";
    }>
  | Readonly<{
      /** Stable engine-owned predicate; presentation may describe but not execute it. */
      readonly kind: "strategy";
      readonly predicateId: string;
    }>;

export interface D6HealthDamageResultV3 {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly rule: D6HealthDamageResultRuleV3;
}

export type D6HealthRuleProvenanceV3 =
  "authored" | "generated" | "mixed" | "preset";

export interface D6HealthTrackDefinitionV3 extends D6HealthTrackDefinitionV2 {
  /** Ordered, presentation-ready definitions for every incoming result. */
  readonly damageResults: readonly D6HealthDamageResultV3[];
  /** Describes the matrix's origin; it never changes transition semantics. */
  readonly ruleProvenance: D6HealthRuleProvenanceV3;
}

export interface D6HealthTrackDefinitionV1 {
  readonly initialStateId: string;
  readonly states: readonly D6HealthTrackStateV1[];
}

export interface D6HealthPoolDefinitionV1 {
  /** Stable engine strategy used to establish a Character's maximum. */
  readonly maximumStrategyId: string;
  /** Whether damage may carry the current value below zero. */
  readonly permitsNegativeCurrent: boolean;
}

interface D6HealthModelBaseV1 {
  readonly damageStrategyId: D6HealthDamageStrategyId;
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly source: D6HealthModelSourceV1;
  readonly version: 1;
}

export type D6HealthModelV1 =
  | (D6HealthModelBaseV1 &
      Readonly<{
        readonly kind: "track";
        readonly track: D6HealthTrackDefinitionV1;
      }>)
  | (D6HealthModelBaseV1 &
      Readonly<{
        readonly kind: "pool";
        readonly pool: D6HealthPoolDefinitionV1;
      }>)
  | (D6HealthModelBaseV1 &
      Readonly<{
        /** Stable engine strategy that derives the visible track from the pool. */
        readonly derivationStrategyId: string;
        readonly kind: "hybrid";
        readonly pool: D6HealthPoolDefinitionV1;
        readonly track: D6HealthTrackDefinitionV1;
      }>);

interface D6HealthModelBaseV2 {
  readonly damageStrategyId: D6HealthDamageStrategyId;
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly source: D6HealthModelSourceV2;
  readonly version: 2;
}

/** Legacy version-2 health model contract retained for lossless normalization. */
export type D6HealthModelV2 =
  | (D6HealthModelBaseV2 &
      Readonly<{
        readonly kind: "track";
        readonly track: D6HealthTrackDefinitionV2;
      }>)
  | (D6HealthModelBaseV2 &
      Readonly<{
        readonly kind: "pool";
        readonly pool: D6HealthPoolDefinitionV1;
      }>)
  | (D6HealthModelBaseV2 &
      Readonly<{
        readonly derivationStrategyId: string;
        readonly kind: "hybrid";
        readonly pool: D6HealthPoolDefinitionV1;
        readonly track: D6HealthTrackDefinitionV2;
      }>);

interface D6HealthModelBaseV3 {
  readonly damageStrategyId: D6HealthDamageStrategyId;
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly source: D6HealthModelSourceV2;
  readonly version: typeof D6_HEALTH_MODEL_CONTRACT_VERSION;
}

/** Current health model contract. World-authored models are track-only. */
export type D6HealthModelV3 =
  | (D6HealthModelBaseV3 &
      Readonly<{
        readonly kind: "track";
        readonly track: D6HealthTrackDefinitionV3;
      }>)
  | (D6HealthModelBaseV3 &
      Readonly<{
        readonly kind: "pool";
        readonly pool: D6HealthPoolDefinitionV1;
      }>)
  | (D6HealthModelBaseV3 &
      Readonly<{
        readonly derivationStrategyId: string;
        readonly kind: "hybrid";
        readonly pool: D6HealthPoolDefinitionV1;
        readonly track: D6HealthTrackDefinitionV3;
      }>);

export type D6HealthModel = D6HealthModelV3;
export type D6HealthModelInput = D6HealthModelV2 | D6HealthModelV3;

export interface D6System2eHealthModelRegistry {
  current(): readonly D6HealthModel[];
  register(ownerId: string, model: D6HealthModelInput): void;
  unregisterOwner(ownerId: string): void;
}
