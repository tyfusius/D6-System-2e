import { SYSTEM_ID } from "../constants";
import { selectRulesProfile } from "./rules-profile-library";
import {
  settingsForCategory,
  tyfusiusHomebrewSettingsForEdition,
  type SettingCategory,
} from "./settings-catalog";

export type EditionDefaultsCategory = Extract<
  SettingCategory,
  "first-edition" | "second-edition"
>;

export interface EditionDefaultsGateway {
  get(key: string): unknown;
  set(key: string, value: boolean | number | string): Promise<unknown>;
}

export interface EditionDefaultsFailure {
  readonly error: string;
  readonly key: string;
}

export interface EditionDefaultsResult {
  readonly applied: readonly string[];
  readonly failed: readonly EditionDefaultsFailure[];
  readonly unchanged: readonly string[];
}

function foundryGateway(): EditionDefaultsGateway {
  return {
    get: (key) => game.settings.get(SYSTEM_ID, key),
    set: (key, value) => game.settings.set(SYSTEM_ID, key, value),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function restoreRecommendedEditionDefaults(
  category: EditionDefaultsCategory,
  gateway: EditionDefaultsGateway = foundryGateway(),
  activateProfile: (id: string) => Promise<unknown> = selectRulesProfile,
): Promise<EditionDefaultsResult> {
  const applied: string[] = [];
  const failed: EditionDefaultsFailure[] = [];
  const unchanged: string[] = [];
  const profileId = category === "first-edition" ? "open-d6" : "second-edition";
  try {
    await activateProfile(profileId);
    applied.push("worldRulesProfiles");
  } catch (error) {
    failed.push({ error: errorMessage(error), key: "worldRulesProfiles" });
  }
  const definitions = [
    ...settingsForCategory(category),
    ...tyfusiusHomebrewSettingsForEdition(category),
  ];

  for (const definition of definitions) {
    if (Object.is(gateway.get(definition.key), definition.default)) {
      unchanged.push(definition.key);
      continue;
    }
    try {
      await gateway.set(definition.key, definition.default);
      applied.push(definition.key);
    } catch (error) {
      failed.push({ error: errorMessage(error), key: definition.key });
    }
  }

  return Object.freeze({
    applied: Object.freeze(applied),
    failed: Object.freeze(failed),
    unchanged: Object.freeze(unchanged),
  });
}
