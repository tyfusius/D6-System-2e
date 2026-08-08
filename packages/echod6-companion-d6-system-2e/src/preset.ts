import type {
  D6SystemPublicApi,
  ProfilePresetActivationResult,
} from "./d6-system-api";
import { ECHO_RULES_PROFILE_ID } from "./rules-profile";

export function createEchoProfilePreset(localize: (key: string) => string) {
  return Object.freeze({
    description: localize("ECHOD6.Settings.PresetHint"),
    id: "echo-d6-recommended",
    label: localize("ECHOD6.Settings.PresetName"),
    selection: Object.freeze({
      rulesProfileId: ECHO_RULES_PROFILE_ID,
      settingProfileId: "echo-d6",
      version: 1 as const,
    }),
    version: 1 as const,
  });
}

export function applyEchoPreset(
  api: D6SystemPublicApi,
): Promise<ProfilePresetActivationResult> {
  return api.profilePreset.activate(
    createEchoProfilePreset((key) => game.i18n.localize(key)).selection,
  );
}
