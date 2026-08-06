import { RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  applyRulesCompatibilitySelection,
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
  type RulesCompatibilitySelection,
} from "./rules-compatibility";
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
): Promise<EditionDefaultsResult> {
  const compatibilityEnabled = category === "first-edition";
  const compatibilitySelection = Object.fromEntries(
    RULES_COMPATIBILITY_KEYS.map((key) => [key, compatibilityEnabled]),
  ) as unknown as RulesCompatibilitySelection;
  const compatibility = await applyRulesCompatibilitySelection(
    compatibilitySelection,
    {
      get: (key) => gateway.get(key),
      set: (key, value) => gateway.set(key, value),
    },
  );
  const applied = [...compatibility.applied];
  const failed: EditionDefaultsFailure[] = [...compatibility.failed];
  const unchanged = [...compatibility.unchanged];
  const compatibilityKeys = new Set<string>([
    OPEN_D6_MASTER_SETTING,
    ...Object.values(COMPATIBILITY_SETTING_KEYS),
  ]);
  const definitions = [
    ...settingsForCategory(category),
    ...tyfusiusHomebrewSettingsForEdition(category),
  ].filter(({ key }) => !compatibilityKeys.has(key));

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
