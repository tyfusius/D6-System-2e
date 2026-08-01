import {
  secondEditionHeroPointStrategy,
  type SecondEditionHeroPointStrategy,
} from "@d6-system-2e/core";
import { booleanSetting, stringSetting } from "./setting-values";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export function configuredSecondEditionHeroPointStrategy(): SecondEditionHeroPointStrategy {
  return secondEditionHeroPointStrategy(
    stringSetting(SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"),
  );
}

export function currentSecondEditionHeroPointStrategy(): SecondEditionHeroPointStrategy {
  const configured = configuredSecondEditionHeroPointStrategy();
  if (configured !== "classic") return configured;
  const classicWildDie =
    stringSetting(SECOND_EDITION_OPTION_KEYS.wildDieStrategy, "core") ===
    "classic";
  const experiencePoints =
    stringSetting(
      SECOND_EDITION_OPTION_KEYS.advancementStrategy,
      "unselected",
    ) === "experience-points";
  return classicWildDie && experiencePoints ? "classic" : "heroic";
}

export function heroicHeroPointsCarryOver(): boolean {
  return booleanSetting(
    SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver,
    false,
  );
}
