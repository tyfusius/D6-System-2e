import {
  secondEditionInitiativeStrategy,
  type SecondEditionInitiativeStrategy,
} from "@d6-system-2e/core";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";
import { stringSetting } from "./setting-values";
import { currentRulesProfile } from "./rules-compatibility";

export function configuredSecondEditionInitiativeStrategy(): SecondEditionInitiativeStrategy {
  return secondEditionInitiativeStrategy(
    stringSetting(SECOND_EDITION_OPTION_KEYS.initiativeStrategy, "standard"),
  );
}

export function currentSecondEditionInitiativeStrategy(): SecondEditionInitiativeStrategy {
  return currentRulesProfile().compatibility.firstEditionInitiative
    ? "standard"
    : configuredSecondEditionInitiativeStrategy();
}
