export const D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION = 1 as const;

export type D6CampaignPackageKind = "genre" | "companion";
export type D6CampaignRulesFamily =
  "open-d6-first-edition" | "d6-system-second-edition";

export interface D6CampaignPackageSourceV1 {
  readonly book: string;
  readonly pages: string;
}

export interface D6CampaignPackageManifestV1 {
  readonly apiCompatibility: Readonly<{
    readonly maximum: number;
    readonly minimum: number;
  }>;
  readonly compatibleGenreIds?: readonly string[];
  readonly conflicts?: readonly string[];
  readonly contractVersion: typeof D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION;
  readonly genreId?: string;
  readonly id: string;
  readonly kind: D6CampaignPackageKind;
  readonly label: string;
  readonly rulesFamily: D6CampaignRulesFamily;
  readonly sources?: readonly D6CampaignPackageSourceV1[];
  readonly version: string;
}

export interface D6ResolvedCampaignPackageV1 extends D6CampaignPackageManifestV1 {
  readonly ownerId: string;
}

export type D6CampaignPackageDiagnosticCode =
  | "companion-without-genre"
  | "conflict"
  | "incompatible-api"
  | "incompatible-companion"
  | "kind-mismatch"
  | "unavailable";

export interface D6CampaignPackageDiagnosticV1 {
  readonly code: D6CampaignPackageDiagnosticCode;
  readonly message: string;
  readonly packageId: string;
}

export interface D6CampaignPackageResolutionV1 {
  readonly companion?: D6ResolvedCampaignPackageV1;
  readonly diagnostics: readonly D6CampaignPackageDiagnosticV1[];
  readonly genre?: D6ResolvedCampaignPackageV1;
  readonly requestedCompanionId: string;
  readonly requestedGenreId: string;
  readonly valid: boolean;
}

export interface D6System2eCampaignPackageRegistry {
  current(): readonly D6ResolvedCampaignPackageV1[];
  register(ownerId: string, manifest: D6CampaignPackageManifestV1): void;
  resolve(selection: {
    readonly companionId?: string;
    readonly genreId?: string;
  }): D6CampaignPackageResolutionV1;
  unregisterOwner(ownerId: string): void;
}
