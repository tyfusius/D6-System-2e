export const D6_SYSTEM_API_VERSION = 1 as const;

export interface CampaignPackageResolution {
  readonly companion?: { readonly id: string };
  readonly valid: boolean;
}

export interface RulesPresetResult {
  readonly applied: readonly string[];
  readonly failed: readonly { readonly error: string; readonly key: string }[];
  readonly unchanged: readonly string[];
}

export interface D6SystemPublicApi {
  readonly apiVersion: typeof D6_SYSTEM_API_VERSION;
  readonly campaignPackages: {
    register(ownerId: string, manifest: unknown): void;
    selection?(): CampaignPackageResolution;
    unregisterOwner(ownerId: string): void;
  };
  readonly rules: {
    applyPreset(profileId: "open-d6"): Promise<RulesPresetResult>;
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
    typeof rules === "object" &&
    rules !== null &&
    hasFunction(rules, "applyPreset")
  );
}
