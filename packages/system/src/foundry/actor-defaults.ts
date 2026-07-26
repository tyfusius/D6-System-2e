import type { RulesProfile } from "@d6-system-2e/core";
import { currentRulesProfile } from "../settings/rules-compatibility";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "../settings/settings-catalog";
import { numberSetting } from "../settings/setting-values";

type NumberReader = (key: string, fallback: number) => number;

export function newCharacterResourceDefaults(
  profile: RulesProfile,
  readNumber: NumberReader = numberSetting,
): Readonly<Record<string, number>> {
  if (profile.compatibility.firstEditionMetaCurrency) {
    return Object.freeze({
      "system.resources.characterPoints.value": Math.max(
        0,
        Math.trunc(
          readNumber(FIRST_EDITION_OPTION_KEYS.initialCharacterPoints, 5),
        ),
      ),
      "system.resources.fatePoints.value": Math.max(
        0,
        Math.trunc(readNumber(FIRST_EDITION_OPTION_KEYS.initialFatePoints, 1)),
      ),
    });
  }
  return Object.freeze({
    "system.resources.heroPoints.value": Math.max(
      0,
      Math.trunc(readNumber(SECOND_EDITION_OPTION_KEYS.startingHeroPoints, 1)),
    ),
  });
}

export function registerActorCreationDefaults(): void {
  Hooks.on("preCreateActor", (documentValue: unknown) => {
    const document = documentValue as Partial<
      FoundrySourceDocument & { readonly type: string }
    >;
    if (
      document.type !== "character" ||
      typeof document.updateSource !== "function"
    ) {
      return;
    }
    document.updateSource(newCharacterResourceDefaults(currentRulesProfile()));
  });
}
