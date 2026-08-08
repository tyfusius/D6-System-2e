import type { D6ProfilePresetActivationResultV1 } from "@d6-system-2e/core";

export interface PreparedProfilePresetTransaction {
  readonly result: D6ProfilePresetActivationResultV1;
}

export interface ProfilePresetTransactionPort {
  activateRulesProfile(): Promise<void>;
  activateSettingProfile(): Promise<void>;
  restore(): Promise<void>;
}

/**
 * Coordinates the durable all-or-restored guarantee for a prepared profile
 * preset. Foundry owns validation, snapshots, and persistence through the port.
 */
export async function executeProfilePresetTransaction(
  prepared: PreparedProfilePresetTransaction,
  port: ProfilePresetTransactionPort,
): Promise<D6ProfilePresetActivationResultV1> {
  const { changes } = prepared.result.preview;
  if (!changes.rulesProfile && !changes.settingProfile) return prepared.result;
  try {
    if (changes.rulesProfile) await port.activateRulesProfile();
    if (changes.settingProfile) await port.activateSettingProfile();
  } catch (cause) {
    try {
      await port.restore();
    } catch (rollbackCause) {
      throw new AggregateError(
        [cause, rollbackCause],
        "Profile Preset activation failed and its prior selection could not be fully restored.",
      );
    }
    throw cause;
  }
  return prepared.result;
}
