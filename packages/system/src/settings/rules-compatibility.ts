import {
  compatibilityPreset,
  resolveRulesProfile,
  RULES_COMPATIBILITY_KEYS,
  type RulesCompatibility,
  type RulesCompatibilityKey,
  type RulesProfile,
  type RulesProfileId,
} from "@d6-system-2e/core";
import { SYSTEM_ID, SYSTEM_NAME } from "../constants";

export const OPEN_D6_MASTER_SETTING = "useOpenD6Rules" as const;

export const COMPATIBILITY_SETTING_KEYS: Readonly<
  Record<RulesCompatibilityKey, string>
> = Object.freeze({
  firstEditionActiveDefenses: "useFirstEditionActiveDefenses",
  firstEditionAdvancement: "useFirstEditionAdvancement",
  firstEditionAttributes: "useFirstEditionAttributes",
  firstEditionDamage: "useFirstEditionDamage",
  firstEditionMetaCurrency: "useFirstEditionMetaCurrency",
  firstEditionSuccessEvaluator: "useFirstEditionSuccessEvaluator",
  firstEditionWildDie: "useFirstEditionWildDie",
});

export interface RulesSettingsGateway {
  get(key: string): unknown;
  set(key: string, value: boolean): Promise<unknown>;
}

export interface RulesPresetFailure {
  readonly error: string;
  readonly key: string;
}

export interface RulesPresetResult {
  readonly applied: readonly string[];
  readonly failed: readonly RulesPresetFailure[];
  readonly profile: RulesProfile;
  readonly unchanged: readonly string[];
}

type RulesSettingReader = (key: string) => unknown;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function foundryGateway(): RulesSettingsGateway {
  return {
    get: (key) => game.settings.get(SYSTEM_ID, key),
    set: (key, value) => game.settings.set(SYSTEM_ID, key, value),
  };
}

function foundryReader(key: string): unknown {
  try {
    return game.settings.get(SYSTEM_ID, key);
  } catch {
    return undefined;
  }
}

export function readRulesCompatibility(
  read: RulesSettingReader = foundryReader,
): RulesCompatibility {
  return Object.freeze(
    Object.fromEntries(
      RULES_COMPATIBILITY_KEYS.map((key) => [
        key,
        read(COMPATIBILITY_SETTING_KEYS[key]) === true,
      ]),
    ) as unknown as RulesCompatibility,
  );
}

export function currentRulesProfile(
  read: RulesSettingReader = foundryReader,
): RulesProfile {
  return resolveRulesProfile(readRulesCompatibility(read));
}

export async function applyRulesPreset(
  profileId: Exclude<RulesProfileId, "custom">,
  gateway: RulesSettingsGateway = foundryGateway(),
  includeMaster = true,
): Promise<RulesPresetResult> {
  const compatibility = compatibilityPreset(profileId);
  const desired = [
    ...RULES_COMPATIBILITY_KEYS.map(
      (key) => [COMPATIBILITY_SETTING_KEYS[key], compatibility[key]] as const,
    ),
    ...(includeMaster
      ? ([[OPEN_D6_MASTER_SETTING, profileId === "open-d6"] as const] as const)
      : []),
  ];
  const applied: string[] = [];
  const failed: RulesPresetFailure[] = [];
  const unchanged: string[] = [];

  for (const [key, value] of desired) {
    if (gateway.get(key) === value) {
      unchanged.push(key);
      continue;
    }
    try {
      await gateway.set(key, value);
      applied.push(key);
    } catch (error) {
      failed.push({ error: errorMessage(error), key });
    }
  }

  const resolved = readRulesCompatibility((key) => gateway.get(key));
  return Object.freeze({
    applied: Object.freeze(applied),
    failed: Object.freeze(failed),
    profile: resolveRulesProfile(resolved),
    unchanged: Object.freeze(unchanged),
  });
}

let settingsWriteMode: "idle" | "master-preset" | "master-sync" = "idle";

async function applyMasterPreset(enabled: boolean): Promise<void> {
  if (settingsWriteMode !== "idle") return;
  settingsWriteMode = "master-preset";
  try {
    const result = await applyRulesPreset(
      enabled ? "open-d6" : "second-edition",
      foundryGateway(),
      false,
    );
    if (result.failed.length > 0) {
      console.error(
        `${SYSTEM_NAME} | Failed to apply rules preset`,
        result.failed,
      );
    }
  } finally {
    settingsWriteMode = "idle";
  }
}

async function synchronizeMasterSetting(): Promise<void> {
  if (settingsWriteMode !== "idle") return;
  const shouldBeEnabled = currentRulesProfile().id === "open-d6";
  if (
    game.settings.get(SYSTEM_ID, OPEN_D6_MASTER_SETTING) === shouldBeEnabled
  ) {
    return;
  }
  settingsWriteMode = "master-sync";
  try {
    await game.settings.set(SYSTEM_ID, OPEN_D6_MASTER_SETTING, shouldBeEnabled);
  } finally {
    settingsWriteMode = "idle";
  }
}

const SETTING_LOCALIZATION_KEYS: Readonly<
  Record<RulesCompatibilityKey, string>
> = Object.freeze({
  firstEditionActiveDefenses: "ActiveDefenses",
  firstEditionAdvancement: "Advancement",
  firstEditionAttributes: "Attributes",
  firstEditionDamage: "Damage",
  firstEditionMetaCurrency: "MetaCurrency",
  firstEditionSuccessEvaluator: "SuccessEvaluator",
  firstEditionWildDie: "WildDie",
});

export function registerRulesCompatibilitySettings(): void {
  game.settings.register(SYSTEM_ID, OPEN_D6_MASTER_SETTING, {
    config: true,
    default: false,
    hint: "D6E2.Settings.UseOpenD6Rules.Hint",
    name: "D6E2.Settings.UseOpenD6Rules.Name",
    onChange: (value: unknown) => {
      if (settingsWriteMode === "idle") void applyMasterPreset(value === true);
    },
    requiresReload: false,
    scope: "world",
    type: Boolean,
  });

  for (const key of RULES_COMPATIBILITY_KEYS) {
    const localizationKey = SETTING_LOCALIZATION_KEYS[key];
    game.settings.register(SYSTEM_ID, COMPATIBILITY_SETTING_KEYS[key], {
      config: true,
      default: false,
      hint: `D6E2.Settings.FirstEdition.${localizationKey}.Hint`,
      name: `D6E2.Settings.FirstEdition.${localizationKey}.Name`,
      onChange: () => {
        if (settingsWriteMode === "idle") void synchronizeMasterSetting();
      },
      requiresReload: false,
      scope: "world",
      type: Boolean,
    });
  }
}

export function resetRulesSettingsStateForTests(): void {
  settingsWriteMode = "idle";
}
