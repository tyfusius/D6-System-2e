import {
  secondEditionHeroPointStrategy,
  type SecondEditionHeroPointStrategy,
} from "@d6-system-2e/core";
import { booleanSetting, stringSetting } from "./setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";
import { currentMetaCurrencyRuntimeStrategy } from "./roll-outcome";

export function configuredSecondEditionHeroPointStrategy(): SecondEditionHeroPointStrategy {
  return secondEditionHeroPointStrategy(
    stringSetting(SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"),
  );
}

export function currentSecondEditionHeroPointStrategy(): SecondEditionHeroPointStrategy {
  return currentMetaCurrencyRuntimeStrategy().heroPointStrategy ?? "heroic";
}

export function heroicHeroPointsCarryOver(): boolean {
  return booleanSetting(
    SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver,
    false,
  );
}
