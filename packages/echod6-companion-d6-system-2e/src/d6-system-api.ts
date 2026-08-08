export const D6_SYSTEM_API_VERSION = 2 as const;

export interface CampaignPackageResolution {
  readonly companion?: { readonly id: string };
  readonly valid: boolean;
}

export interface RulesProfileActivationResult {
  readonly profile: { readonly id: string };
}

export interface SettingProfileActivationResult {
  readonly profile: { readonly profile: { readonly id: string } };
}

export interface ProfilePresetActivationResult {
  readonly preview: {
    readonly changedCount: number;
    readonly unchangedCount: number;
  };
}

export interface D6SystemPublicApi {
  readonly apiVersion: typeof D6_SYSTEM_API_VERSION;
  readonly campaignPackages: {
    register(ownerId: string, manifest: unknown): void;
    selection?(): CampaignPackageResolution;
    unregisterOwner(ownerId: string): void;
  };
  readonly rules: {
    activate(profileId: string): Promise<RulesProfileActivationResult>;
  };
  readonly rulesProfileRegistry: {
    register(ownerId: string, profile: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly profilePreset: {
    activate(selection: {
      readonly rulesProfileId: string;
      readonly settingProfileId: string;
      readonly version: 1;
    }): Promise<ProfilePresetActivationResult>;
  };
  readonly profilePresetRegistry: {
    register(ownerId: string, preset: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly setting: {
    activate(profileId: string): Promise<SettingProfileActivationResult>;
  };
  readonly settingProfileRegistry: {
    register(ownerId: string, profile: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly systemId: "d6-system-2e";
  readonly terminology: {
    register(ownerId: string, contribution: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly themes: {
    register(ownerId: string, definition: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
}

function hasFunction(value: object, key: string): boolean {
  return (
    key in value &&
    typeof (value as Record<string, unknown>)[key] === "function"
  );
}

function isRegistry(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    hasFunction(value, "register") &&
    hasFunction(value, "unregisterOwner")
  );
}

export function isD6SystemPublicApi(
  value: unknown,
): value is D6SystemPublicApi {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const rules = candidate.rules;
  return (
    candidate.apiVersion === D6_SYSTEM_API_VERSION &&
    candidate.systemId === "d6-system-2e" &&
    isRegistry(candidate.campaignPackages) &&
    hasFunction(candidate.campaignPackages, "selection") &&
    isRegistry(candidate.terminology) &&
    isRegistry(candidate.themes) &&
    isRegistry(candidate.rulesProfileRegistry) &&
    isRegistry(candidate.settingProfileRegistry) &&
    typeof candidate.profilePreset === "object" &&
    candidate.profilePreset !== null &&
    hasFunction(candidate.profilePreset, "activate") &&
    isRegistry(candidate.profilePresetRegistry) &&
    typeof candidate.setting === "object" &&
    candidate.setting !== null &&
    hasFunction(candidate.setting, "activate") &&
    typeof rules === "object" &&
    rules !== null &&
    hasFunction(rules, "activate")
  );
}
