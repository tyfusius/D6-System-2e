export const D6_HIDEOUT_FEATURE_CONTRACT_VERSION = 1 as const;

export interface D6HideoutFeatureV1 {
  readonly description?: string;
  readonly id: string;
  readonly label: string;
  readonly prerequisiteIds?: readonly string[];
  readonly repeatable?: boolean;
  readonly source: Readonly<{ readonly book: string; readonly page: number }>;
  readonly version: typeof D6_HIDEOUT_FEATURE_CONTRACT_VERSION;
}

export interface D6HideoutFeatureCatalogV1 {
  readonly entries: readonly D6HideoutFeatureV1[];
  readonly id: string;
  readonly label: string;
  readonly version: typeof D6_HIDEOUT_FEATURE_CONTRACT_VERSION;
}

export interface D6ResolvedHideoutFeatureCatalogV1 extends D6HideoutFeatureCatalogV1 {
  readonly ownerId: string;
}

export interface D6System2eHideoutFeatureRegistry {
  current(): readonly D6ResolvedHideoutFeatureCatalogV1[];
  register(ownerId: string, catalog: D6HideoutFeatureCatalogV1): void;
  unregisterOwner(ownerId: string): void;
}
