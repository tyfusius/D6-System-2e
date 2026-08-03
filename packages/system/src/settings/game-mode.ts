import type { RulesProfileId } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  applyRulesPreset,
  OPEN_D6_MASTER_SETTING,
  type RulesPresetResult,
  type RulesSettingsGateway,
} from "./rules-compatibility";

export const GAME_MODE_SETTING = "gameMode" as const;

export type GameMode = "open-d6" | "second-edition";

export interface GameModeGateway {
  get(key: string): unknown;
  set(key: string, value: boolean | GameMode): Promise<unknown>;
}

export interface GameModeResult extends RulesPresetResult {
  readonly mode: GameMode;
  readonly modeChanged: boolean;
}

function foundryGateway(): GameModeGateway {
  return {
    get: (key) => game.settings.get(SYSTEM_ID, key),
    set: (key, value) => game.settings.set(SYSTEM_ID, key, value),
  };
}

export function normalizeGameMode(value: unknown): GameMode {
  return value === "open-d6" ? "open-d6" : "second-edition";
}

export function currentGameMode(
  read: (key: string) => unknown = (key) => game.settings.get(SYSTEM_ID, key),
): GameMode {
  return normalizeGameMode(read(GAME_MODE_SETTING));
}

export async function applyGameMode(
  mode: GameMode,
  gateway: GameModeGateway = foundryGateway(),
): Promise<GameModeResult> {
  const presetGateway: RulesSettingsGateway = {
    get: (key) => gateway.get(key),
    set: (key, value) => gateway.set(key, value),
  };
  const profileId: Exclude<RulesProfileId, "custom"> =
    mode === "open-d6" ? "open-d6" : "second-edition";
  const preset = await applyRulesPreset(profileId, presetGateway);
  let modeChanged = false;

  if (
    preset.failed.length === 0 &&
    currentGameMode((key) => gateway.get(key)) !== mode
  ) {
    await gateway.set(GAME_MODE_SETTING, mode);
    modeChanged = true;
  }

  return Object.freeze({
    ...preset,
    mode,
    modeChanged,
  });
}

export function registerGameModeSetting(onChange: () => void): void {
  const inferredDefault: GameMode =
    game.settings.get(SYSTEM_ID, OPEN_D6_MASTER_SETTING) === true
      ? "open-d6"
      : "second-edition";
  game.settings.register(SYSTEM_ID, GAME_MODE_SETTING, {
    choices: {
      "open-d6": "D6E2.Settings.GameMode.OpenD6",
      "second-edition": "D6E2.Settings.GameMode.SecondEdition",
    },
    config: false,
    default: inferredDefault,
    hint: "D6E2.Settings.GameMode.Hint",
    name: "D6E2.Settings.GameMode.Name",
    onChange,
    requiresReload: false,
    scope: "world",
    type: String,
  });
}
