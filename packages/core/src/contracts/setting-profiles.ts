import type { D6System2eTerminologyContribution } from "./contributions";

export const D6_SETTING_PROFILE_CONTRACT_VERSION = 2 as const;

export type D6SettingRulesFamily =
  "d6-system-second-edition" | "open-d6-first-edition";

export interface D6SettingAttributeV1 {
  readonly active: boolean;
  readonly id: string;
  readonly label: string;
}

export interface D6SettingSkillV1 {
  readonly attributeId: string;
  readonly description: string;
  readonly img: string;
  readonly key: string;
  readonly name: string;
  readonly training: "advanced" | "psionic" | "standard";
}

export interface D6SettingAssetV1 {
  readonly kind: "image" | "text";
  readonly value: string;
}

export interface D6SettingProfileV1 {
  readonly attributes: readonly D6SettingAttributeV1[];
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly logo: string;
  readonly logoAsWatermark: boolean;
  readonly rulesFamily: D6SettingRulesFamily;
  readonly skills: readonly D6SettingSkillV1[];
  readonly version: 1;
  readonly wildDie: Readonly<{
    readonly one: D6SettingAssetV1;
    readonly oneSound: string;
    readonly six: D6SettingAssetV1;
    readonly sixSound: string;
  }>;
}

export interface D6WorldSettingProfilesV1 {
  readonly firstEdition?: D6SettingProfileV1;
  readonly secondEdition?: D6SettingProfileV1;
  readonly version: 1;
}

/** A setting-owned character vocabulary and presentation, independent of rules. */
export interface D6SettingProfileV2 {
  readonly attributes: readonly D6SettingAttributeV1[];
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly logo: string;
  readonly logoAsWatermark: boolean;
  /** Migration/provenance only. It never controls whether this profile is active. */
  readonly originRulesFamily?: D6SettingRulesFamily;
  readonly skills: readonly D6SettingSkillV1[];
  /** Setting-specific labels layered over package terminology. */
  readonly terminology: D6System2eTerminologyContribution;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
  readonly wildDie: Readonly<{
    readonly one: D6SettingAssetV1;
    readonly oneSound: string;
    readonly six: D6SettingAssetV1;
    readonly sixSound: string;
  }>;
}

/** World-level profile library with one selection shared by every Game Mode. */
export interface D6WorldSettingProfilesV2 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6SettingProfileV2>>;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
}

export type D6SettingProfileSourceV2 = "bundled" | "module" | "world";

/** Provenance wrapper used by registries without polluting portable profiles. */
export interface D6ResolvedSettingProfileV2 {
  readonly ownerId: string;
  readonly profile: D6SettingProfileV2;
  readonly source: D6SettingProfileSourceV2;
}

export interface D6SettingProfileSelectionV2 {
  readonly activeProfileId: string;
  readonly available: boolean;
  readonly resolved: D6ResolvedSettingProfileV2;
}

export interface D6System2eSettingProfileRegistry {
  current(): readonly D6ResolvedSettingProfileV2[];
  register(ownerId: string, profile: D6SettingProfileV2): void;
  unregisterOwner(ownerId: string): void;
}
