import type { SecondEditionHyperLethalOptions } from "@d6-system-2e/core";
import { PIPS_PER_DIE } from "@d6-system-2e/core";
import { booleanSetting } from "./setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export interface SecondEditionHyperLethalProfile extends SecondEditionHyperLethalOptions {
  readonly maximumResistanceScore?: number;
}

/** Resolve the four independently selectable options from D62e pp. 89-90. */
export function currentSecondEditionHyperLethalProfile(): SecondEditionHyperLethalProfile {
  const maximumArmor = booleanSetting(
    SECOND_EDITION_OPTION_KEYS.hyperLethalMaximumArmor,
    false,
  );
  return Object.freeze({
    killingBlows: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows,
      false,
    ),
    ...(maximumArmor ? { maximumResistanceScore: 6 * PIPS_PER_DIE } : {}),
    removeStunned: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveStunned,
      false,
    ),
    removeWounded: booleanSetting(
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveWounded,
      false,
    ),
  });
}
