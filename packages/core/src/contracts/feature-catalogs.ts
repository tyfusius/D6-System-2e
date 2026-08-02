export const D6_FEATURE_CATALOG_CONTRACT_VERSION = 1 as const;

export type D6RankedFeatureKind = "flaw" | "perk" | "talent";

export type D6FeatureMechanicKind =
  | "action-modifier"
  | "advancement-lock"
  | "advancement-modifier"
  | "minimum-total"
  | "movement-modifier"
  | "narrative"
  | "reroll"
  | "resource"
  | "roll-modifier"
  | "trained-use"
  | "usage-limit";

export type D6FeatureMechanicApplication =
  | "all-rolls"
  | "attribute"
  | "damage"
  | "defense"
  | "initiative"
  | "movement"
  | "resistance"
  | "skill"
  | "specialization";

/**
 * A system-owned semantic description of a feature mechanic. It deliberately
 * contains no executable callbacks: contributed content can describe mechanics
 * without acquiring code execution inside the system.
 */
export interface D6FeatureMechanicV1 {
  readonly application?: D6FeatureMechanicApplication;
  readonly automatic?: boolean;
  readonly kind: D6FeatureMechanicKind;
  readonly limit?: number;
  readonly perRank?: boolean;
  readonly score?: number;
  readonly selector?: string;
}

export interface D6FeatureDefinitionV1 {
  readonly conflicts?: readonly string[];
  readonly creationSkillDice: number;
  readonly focusRequired?: boolean;
  readonly id: string;
  readonly kind: D6RankedFeatureKind;
  readonly label: string;
  readonly mechanics: readonly D6FeatureMechanicV1[];
  readonly prerequisites?: readonly string[];
  readonly rankMaximum?: number;
  readonly rankMinimum: number;
  readonly repeatable: boolean;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  /** Optional generic Superpower accounting; labels and prose remain contributor-owned. */
  readonly superpower?: Readonly<{
    readonly automatic?: boolean;
    readonly enhancementCostPerRank?: number;
    readonly limitationCredit?: number;
  }>;
  readonly version: typeof D6_FEATURE_CATALOG_CONTRACT_VERSION;
}

export interface D6FeatureCatalogV1 {
  readonly definitions: readonly D6FeatureDefinitionV1[];
  readonly id: string;
  readonly label: string;
  readonly version: typeof D6_FEATURE_CATALOG_CONTRACT_VERSION;
}

export interface D6ResolvedFeatureCatalogV1 extends D6FeatureCatalogV1 {
  readonly ownerId: string;
}

export interface D6System2eFeatureCatalogRegistry {
  current(): readonly D6ResolvedFeatureCatalogV1[];
  register(ownerId: string, catalog: D6FeatureCatalogV1): void;
  unregisterOwner(ownerId: string): void;
}

export type D6FeatureCatalogIssueCode =
  | "actor-type"
  | "duplicate"
  | "conflict"
  | "feature-missing"
  | "focus-required"
  | "module-inactive"
  | "owner-required"
  | "prerequisite"
  | "rank-maximum"
  | "rank-minimum";

export interface D6FeatureCatalogPreviewV1 {
  readonly canApply: boolean;
  readonly catalogId: string;
  readonly catalogLabel: string;
  readonly creationSkillCostScore: number;
  readonly definitionId: string;
  readonly featureLabel: string;
  readonly focus: string;
  readonly issues: readonly D6FeatureCatalogIssueCode[];
  readonly kind: D6RankedFeatureKind;
  readonly mechanics: readonly D6FeatureMechanicV1[];
  readonly ownerId: string;
  readonly rank: number;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly superpower?: Readonly<{
    readonly automatic: boolean;
    readonly baseCostPerRank: number;
    readonly enhancementCostPerRank: number;
    readonly limitationCredit: number;
    readonly totalCost: number;
  }>;
  readonly version: typeof D6_FEATURE_CATALOG_CONTRACT_VERSION;
}

export interface D6FeatureCatalogApplicationV1 {
  readonly itemId: string;
  readonly preview: D6FeatureCatalogPreviewV1;
  readonly version: typeof D6_FEATURE_CATALOG_CONTRACT_VERSION;
}

export interface D6System2eFeatureCatalogApi {
  apply(
    actor: unknown,
    definitionId: string,
    options?: Readonly<{ readonly focus?: string; readonly rank?: number }>,
  ): Promise<D6FeatureCatalogApplicationV1>;
  preview(
    actor: unknown,
    definitionId: string,
    options?: Readonly<{ readonly focus?: string; readonly rank?: number }>,
  ): D6FeatureCatalogPreviewV1;
}
