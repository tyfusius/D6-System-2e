export const D6_FEATURE_ECONOMY_CONTRACT_VERSION = 1 as const;

export type D6FeatureSemanticRole = "flaw" | "merit";
export type D6FeatureEconomyPhase = "advancement" | "creation";

export type D6FeaturePointValueV1 =
  | Readonly<{ readonly kind: "exact"; readonly value: number }>
  | Readonly<{ readonly kind: "minimum"; readonly minimum: number }>
  | Readonly<{
      readonly kind: "range";
      readonly maximum: number;
      readonly minimum: number;
    }>
  | Readonly<{ readonly kind: "choices"; readonly values: readonly number[] }>;

export interface D6FeatureEffectV1 {
  readonly id: string;
  readonly kind:
    | "action-modifier"
    | "movement-modifier"
    | "narrative-only"
    | "resource-modifier"
    | "roll-modifier";
  readonly scope: string;
  readonly value: number;
}

export interface D6FeatureBenefitDefinitionV1 {
  readonly actorTypes: readonly string[];
  readonly conflicts: readonly string[];
  readonly effects: readonly D6FeatureEffectV1[];
  readonly id: string;
  readonly label: string;
  readonly pointValue: D6FeaturePointValueV1;
  readonly prerequisites: readonly string[];
  readonly role: D6FeatureSemanticRole;
  readonly source: Readonly<{
    readonly kind: "bundled" | "module" | "world";
    readonly ownerId?: string;
  }>;
  readonly version: typeof D6_FEATURE_ECONOMY_CONTRACT_VERSION;
}

export interface D6FeatureCatalogV2 {
  readonly definitions: readonly D6FeatureBenefitDefinitionV1[];
  readonly id: string;
  readonly label: string;
  readonly version: 2;
}

export interface D6FeatureEconomyTransactionV1 {
  readonly actorId: string;
  readonly balanceAfter: number;
  readonly balanceBefore: number;
  readonly cost: number;
  readonly definitionId: string;
  readonly id: string;
  readonly operation: "acquire" | "payoff" | "remove";
  readonly phase: D6FeatureEconomyPhase;
  readonly requiresGmApproval: boolean;
  readonly role: D6FeatureSemanticRole;
  readonly status: "approved" | "pending" | "rejected";
  readonly version: typeof D6_FEATURE_ECONOMY_CONTRACT_VERSION;
}

export interface D6FeatureEconomyRequestV1 {
  readonly actorId: string;
  readonly definitionId: string;
  readonly definitionLabel: string;
  readonly focus: string;
  readonly id: string;
  readonly operation: "acquire" | "payoff" | "remove";
  readonly phase: D6FeatureEconomyPhase;
  readonly private: boolean;
  readonly providerLabel?: string;
  readonly requesterId: string;
  readonly selectedValue: number;
  readonly status: "pending" | "rejected";
  readonly version: typeof D6_FEATURE_ECONOMY_CONTRACT_VERSION;
}

export interface D6System2eFeatureEconomyRegistry {
  current(): readonly D6FeatureCatalogV2[];
  register(ownerId: string, catalog: D6FeatureCatalogV2): void;
  unregisterOwner(ownerId: string): void;
}
