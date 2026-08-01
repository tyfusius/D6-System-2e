import {
  ACTION_DECLARATION_ASSISTANCE_MODES,
  type ActionDeclarationAssistanceMode,
  type D6RollMode,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
} from "./settings-catalog";
import {
  FIRST_EDITION_DAMAGE_MODES,
  type FirstEditionDamageMode,
} from "@d6-system-2e/core";

function settingValue(key: string): unknown {
  try {
    return game.settings.get(SYSTEM_ID, key);
  } catch {
    return undefined;
  }
}

export function booleanSetting(key: string, fallback: boolean): boolean {
  const value = settingValue(key);
  return typeof value === "boolean" ? value : fallback;
}

export function numberSetting(key: string, fallback: number): number {
  const value = settingValue(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function stringSetting(key: string, fallback: string): string {
  const value = settingValue(key);
  return typeof value === "string" ? value : fallback;
}

export function currentFirstEditionDamageMode(): FirstEditionDamageMode {
  const value = settingValue(FIRST_EDITION_OPTION_KEYS.bodyPoints);
  if (value === true || value === "true") return "body-points";
  if (value === false || value === "false") return "wounds";
  return FIRST_EDITION_DAMAGE_MODES.includes(value as FirstEditionDamageMode)
    ? (value as FirstEditionDamageMode)
    : "wounds";
}

export function currentDefaultRollMode(): D6RollMode {
  const value = stringSetting(
    SHARED_SETTING_KEYS.defaultRollMode,
    "publicroll",
  );
  return ["blindroll", "gmroll", "publicroll", "selfroll"].includes(value)
    ? (value as D6RollMode)
    : "publicroll";
}

export function currentActionDeclarationAssistance(): ActionDeclarationAssistanceMode {
  const value = stringSetting(
    SHARED_SETTING_KEYS.actionDeclarationAssistance,
    "optional",
  );
  return ACTION_DECLARATION_ASSISTANCE_MODES.includes(
    value as ActionDeclarationAssistanceMode,
  )
    ? (value as ActionDeclarationAssistanceMode)
    : "optional";
}

export function secondEditionOptionalAttributes(): ReadonlySet<string> {
  return new Set(
    [
      ["mechanical", SECOND_EDITION_OPTION_KEYS.optionalMechanical],
      ["technical", SECOND_EDITION_OPTION_KEYS.optionalTechnical],
      ["charm", SECOND_EDITION_OPTION_KEYS.optionalCharm],
      ["magic", SECOND_EDITION_OPTION_KEYS.optionalMagic],
      ["mysticism", SECOND_EDITION_OPTION_KEYS.optionalMysticism],
    ]
      .filter(([, key]) => booleanSetting(key ?? "", false))
      .map(([id]) => id ?? ""),
  );
}
