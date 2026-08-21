import type { D6System2eTerminologyContribution } from "./contributions";

export const D6_SETTING_PROFILE_CONTRACT_VERSION = 5 as const;

export interface D6SettingHealthModelLabelsV1 {
  readonly states: Readonly<Record<string, string>>;
  readonly track: string;
}

export type D6SettingRulesFamily =
  "d6-system-second-edition" | "open-d6-first-edition";

export interface D6SettingAttributeV1 {
  readonly active: boolean;
  readonly id: string;
  readonly label: string;
}

/** Setting-owned Attribute vocabulary. Rules Profiles own activation. */
export interface D6SettingAttributeV2 {
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
  readonly version: 2;
  readonly wildDie: Readonly<{
    readonly one: D6SettingAssetV1;
    readonly oneSound: string;
    readonly six: D6SettingAssetV1;
    readonly sixSound: string;
  }>;
}

/** A setting-owned vocabulary and presentation profile, independent of rules. */
export interface D6SettingProfileV3 {
  readonly attributes: readonly D6SettingAttributeV2[];
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
  readonly version: 3;
  readonly wildDie: Readonly<{
    readonly one: D6SettingAssetV1;
    readonly oneSound: string;
    readonly six: D6SettingAssetV1;
    readonly sixSound: string;
  }>;
}

/** Current setting-owned vocabulary and presentation profile contract. */
export interface D6SettingProfileV4 extends Omit<
  D6SettingProfileV3,
  "version"
> {
  readonly version: 4;
}

/** Current setting-owned vocabulary and presentation profile contract. */
export interface D6SettingProfileV5 extends Omit<
  D6SettingProfileV4,
  "version"
> {
  /** Presentation only, keyed by stable health model and state ids. */
  readonly healthLabels: Readonly<Record<string, D6SettingHealthModelLabelsV1>>;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
}

/** World-level profile library with one selection shared by every Game Mode. */
export interface D6WorldSettingProfilesV2 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6SettingProfileV2>>;
  readonly version: 2;
}

/** World-level profile library with one selection shared by every Rules Profile. */
export interface D6WorldSettingProfilesV3 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6SettingProfileV3>>;
  readonly version: 3;
}

export interface D6WorldSettingProfilesV4 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6SettingProfileV4>>;
  readonly version: 4;
}

export interface D6WorldSettingProfilesV5 {
  readonly activeProfileId: string;
  readonly profiles: Readonly<Record<string, D6SettingProfileV5>>;
  readonly version: typeof D6_SETTING_PROFILE_CONTRACT_VERSION;
}

export type D6SettingProfileSourceV2 = "bundled" | "module" | "world";

/** Provenance wrapper used by registries without polluting portable profiles. */
export interface D6ResolvedSettingProfileV2 {
  readonly ownerId: string;
  readonly profile: D6SettingProfileV2;
  readonly source: D6SettingProfileSourceV2;
}

/** Provenance wrapper used by registries without polluting portable profiles. */
export interface D6ResolvedSettingProfileV3 {
  readonly ownerId: string;
  readonly profile: D6SettingProfileV3;
  readonly source: D6SettingProfileSourceV2;
}

export interface D6ResolvedSettingProfileV4 {
  readonly ownerId: string;
  readonly profile: D6SettingProfileV4;
  readonly source: D6SettingProfileSourceV2;
}

export interface D6ResolvedSettingProfileV5 {
  readonly ownerId: string;
  readonly profile: D6SettingProfileV5;
  readonly source: D6SettingProfileSourceV2;
}

export interface D6SettingProfileSelectionV2 {
  readonly activeProfileId: string;
  readonly available: boolean;
  readonly resolved: D6ResolvedSettingProfileV2;
}

export interface D6SettingProfileSelectionV3 {
  readonly activeProfileId: string;
  readonly available: boolean;
  readonly resolved: D6ResolvedSettingProfileV3;
}

export interface D6SettingProfileSelectionV4 {
  readonly activeProfileId: string;
  readonly available: boolean;
  readonly resolved: D6ResolvedSettingProfileV4;
}

export interface D6SettingProfileSelectionV5 {
  readonly activeProfileId: string;
  readonly available: boolean;
  readonly resolved: D6ResolvedSettingProfileV5;
}

export interface D6System2eSettingProfileRegistry {
  current(): readonly D6ResolvedSettingProfileV5[];
  register(ownerId: string, profile: D6SettingProfileV5): void;
  unregisterOwner(ownerId: string): void;
}
