export const D6_HEALTH_MODEL_CONTRACT_VERSION = 1 as const;

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

export type D6HealthModelSourceV1 =
  | Readonly<{ readonly kind: "bundled" }>
  | Readonly<{
      readonly kind: "module";
      readonly ownerId: string;
      readonly ownerVersion?: string;
    }>;

export interface D6HealthTrackStateV1 {
  readonly id: string;
  readonly label: string;
  readonly penaltyScore: number;
  readonly terminal?: boolean;
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
  readonly version: typeof D6_HEALTH_MODEL_CONTRACT_VERSION;
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

export interface D6System2eHealthModelRegistry {
  current(): readonly D6HealthModelV1[];
  register(ownerId: string, model: D6HealthModelV1): void;
  unregisterOwner(ownerId: string): void;
}
