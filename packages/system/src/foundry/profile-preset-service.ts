import {
  D6_PROFILE_PRESET_CONTRACT_VERSION,
  type D6ProfilePresetActivationResultV1,
  type D6ProfilePresetPreviewV1,
  type D6ProfilePresetSelectionV1,
  type D6System2eProfilePresetApi,
} from "@d6-system-2e/core";
import { executeProfilePresetTransaction } from "../application/profile-presets/execute-profile-preset";
import { SYSTEM_ID } from "../constants";
import {
  availableRulesProfiles,
  rulesProfileDiagnostics,
  storedWorldRulesProfiles,
  WORLD_RULES_PROFILES_SETTING,
} from "../settings/rules-profile-library";
import {
  availableSettingProfiles,
  storedWorldSettingProfiles,
  WORLD_SETTING_PROFILES_SETTING,
} from "../settings/setting-profile";
import { settingProfileAssetDiagnostics } from "./setting-profile-storage";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;

interface PreparedFoundryProfilePreset {
  readonly result: D6ProfilePresetActivationResultV1;
  readonly previousRules: ReturnType<typeof storedWorldRulesProfiles>;
  readonly previousSetting: ReturnType<typeof storedWorldSettingProfiles>;
}

function validateSelection(selection: unknown): D6ProfilePresetSelectionV1 {
  const source =
    typeof selection === "object" && selection !== null
      ? (selection as Record<string, unknown>)
      : {};
  if (
    source.version !== D6_PROFILE_PRESET_CONTRACT_VERSION ||
    typeof source.rulesProfileId !== "string" ||
    !ID_PATTERN.test(source.rulesProfileId) ||
    typeof source.settingProfileId !== "string" ||
    !ID_PATTERN.test(source.settingProfileId)
  ) {
    throw new TypeError("Invalid Profile Preset selection contract.");
  }
  return Object.freeze({
    rulesProfileId: source.rulesProfileId,
    settingProfileId: source.settingProfileId,
    version: D6_PROFILE_PRESET_CONTRACT_VERSION,
  });
}

async function prepareProfilePreset(
  requested: D6ProfilePresetSelectionV1,
): Promise<PreparedFoundryProfilePreset> {
  const selection = validateSelection(requested);
  const rulesProfile = availableRulesProfiles().find(
    ({ id }) => id === selection.rulesProfileId,
  );
  if (!rulesProfile) {
    throw new RangeError(`Unknown Rules Profile: ${selection.rulesProfileId}`);
  }
  const rulesDiagnostics = rulesProfileDiagnostics(rulesProfile);
  if (rulesDiagnostics.length > 0) {
    throw new RangeError(
      rulesDiagnostics.map(({ message }) => message).join(" "),
    );
  }
  const settingProfile = availableSettingProfiles().find(
    ({ profile }) => profile.id === selection.settingProfileId,
  );
  if (!settingProfile) {
    throw new RangeError(
      `Unknown Setting Profile: ${selection.settingProfileId}`,
    );
  }
  const settingDiagnostics = await settingProfileAssetDiagnostics(
    settingProfile.profile,
  );
  if (settingDiagnostics.length > 0) {
    throw new RangeError(
      settingDiagnostics
        .map(({ path }) => path)
        .filter(Boolean)
        .join(" "),
    );
  }

  const previousRules = storedWorldRulesProfiles();
  const previousSetting = storedWorldSettingProfiles();
  const rulesChanged =
    previousRules.activeProfileId !== selection.rulesProfileId;
  const settingChanged =
    previousSetting.activeProfileId !== selection.settingProfileId;
  const changedCount = Number(rulesChanged) + Number(settingChanged);
  const previous = Object.freeze({
    rulesProfileId: previousRules.activeProfileId,
    settingProfileId: previousSetting.activeProfileId,
    version: D6_PROFILE_PRESET_CONTRACT_VERSION,
  });
  const preview: D6ProfilePresetPreviewV1 = Object.freeze({
    changedCount,
    changes: Object.freeze({
      rulesProfile: rulesChanged,
      settingProfile: settingChanged,
    }),
    previous,
    requiresReload: settingChanged,
    selection,
    unchangedCount: 2 - changedCount,
    version: D6_PROFILE_PRESET_CONTRACT_VERSION,
  });
  return Object.freeze({
    previousRules,
    previousSetting,
    result: Object.freeze({ preview, rulesProfile, settingProfile }),
  });
}

async function restoreProfilePreset(
  prepared: PreparedFoundryProfilePreset,
): Promise<void> {
  const restores = await Promise.allSettled([
    game.settings.set(
      SYSTEM_ID,
      WORLD_RULES_PROFILES_SETTING,
      prepared.previousRules,
    ),
    game.settings.set(
      SYSTEM_ID,
      WORLD_SETTING_PROFILES_SETTING,
      prepared.previousSetting,
    ),
  ]);
  const failures: unknown[] = [];
  for (const entry of restores) {
    if (entry.status === "rejected") failures.push(entry.reason as unknown);
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Could not restore the prior Profile Preset selection.",
    );
  }
}

export async function previewProfilePreset(
  selection: D6ProfilePresetSelectionV1,
): Promise<D6ProfilePresetPreviewV1> {
  return (await prepareProfilePreset(selection)).result.preview;
}

export async function activateProfilePreset(
  selection: D6ProfilePresetSelectionV1,
): Promise<D6ProfilePresetActivationResultV1> {
  if (!game.user?.isGM) {
    throw new Error("Only a Gamemaster can activate a Profile Preset.");
  }
  const prepared = await prepareProfilePreset(selection);
  const validatedSelection = prepared.result.preview.selection;
  const result = await executeProfilePresetTransaction(prepared, {
    activateRulesProfile: () =>
      game.settings
        .set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
          ...prepared.previousRules,
          activeProfileId: validatedSelection.rulesProfileId,
        })
        .then(() => undefined),
    activateSettingProfile: () =>
      game.settings
        .set(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
          ...prepared.previousSetting,
          activeProfileId: validatedSelection.settingProfileId,
        })
        .then(() => undefined),
    restore: () => restoreProfilePreset(prepared),
  });
  if (result.preview.changedCount > 0) {
    Hooks.callAll?.("d6e2ProfilePresetChanged", result.preview.selection);
  }
  return result;
}

export const profilePresetApi: D6System2eProfilePresetApi = Object.freeze({
  activate: activateProfilePreset,
  preview: previewProfilePreset,
});
