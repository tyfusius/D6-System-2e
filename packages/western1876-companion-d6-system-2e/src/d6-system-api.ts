import type {
  D6ProfilePresetDefinitionV1,
  D6RulesProfileV5,
  D6SettingProfileV5,
  D6SettingProfileFontDefinitionV1,
  D6FirstEditionGenreProfileV1,
} from "@d6-system-2e/core";

interface Registry<T> {
  register(ownerId: string, contribution: T): void;
  unregisterOwner(ownerId: string): void;
}

/** Only the versioned public capabilities this companion consumes. */
export interface D6ProfileApi {
  readonly apiVersion: 2;
  readonly systemId: "d6-system-2e";
  readonly rulesProfileRegistry: Registry<D6RulesProfileV5>;
  readonly settingProfileRegistry: Registry<D6SettingProfileV5>;
  readonly settingProfileFontRegistry: Registry<D6SettingProfileFontDefinitionV1>;
  readonly profilePresetRegistry: Registry<D6ProfilePresetDefinitionV1>;
  readonly firstEditionGenreProfiles: Registry<D6FirstEditionGenreProfileV1>;
}

export function isD6ProfileApi(value: unknown): value is D6ProfileApi {
  if (typeof value !== "object" || value === null) return false;
  const api = value as Record<string, unknown>;
  return (
    api.apiVersion === 2 &&
    api.systemId === "d6-system-2e" &&
    [
      "rulesProfileRegistry",
      "settingProfileRegistry",
      "settingProfileFontRegistry",
      "profilePresetRegistry",
      "firstEditionGenreProfiles",
    ].every((name) => {
      const registry = api[name];
      if (typeof registry !== "object" || registry === null) return false;
      const candidate = registry as Record<string, unknown>;
      return (
        typeof candidate.register === "function" &&
        typeof candidate.unregisterOwner === "function"
      );
    })
  );
}
