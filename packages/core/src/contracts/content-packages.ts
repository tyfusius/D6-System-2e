import type { RulesProfileId } from "../domain/rules-profile";

export const D6_CONTENT_PACKAGE_CONTRACT_VERSION = 1 as const;

export type D6OfficialContentFamily =
  | "core"
  | "fantasy"
  | "science-fiction"
  | "superhero"
  | "first-edition-core"
  | "first-edition-adventure"
  | "first-edition-fantasy"
  | "first-edition-space";

export type D6ContentRulesFamily =
  "d6-system-second-edition" | "open-d6-first-edition";

export interface D6ContentPackageManifestV1 {
  readonly contractVersion: typeof D6_CONTENT_PACKAGE_CONTRACT_VERSION;
  readonly family: D6OfficialContentFamily;
  readonly id: string;
  readonly label: string;
  readonly mechanicIds: readonly string[];
  readonly recommendedPrimaryProfile: Exclude<RulesProfileId, "custom">;
  readonly rulesFamily: D6ContentRulesFamily;
  readonly version: string;
}

export interface D6ResolvedContentPackageV1 extends D6ContentPackageManifestV1 {
  readonly ownerId: string;
}

export interface D6System2eContentPackageRegistry {
  current(): readonly D6ResolvedContentPackageV1[];
  register(ownerId: string, manifest: D6ContentPackageManifestV1): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6RulesSelectionV1 {
  readonly contractVersion: 1;
  readonly importedMechanicIds: readonly string[];
  readonly primaryProfileId: Exclude<RulesProfileId, "custom">;
  readonly resolvedProfileId: RulesProfileId;
}
