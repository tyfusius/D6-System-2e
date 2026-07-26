import type { RulesProfile } from "@d6-system-2e/core";
import { missingSkillSources } from "../content/skill-catalog";
import { currentRulesProfile } from "../settings/rules-compatibility";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "../settings/settings-catalog";
import { numberSetting } from "../settings/setting-values";
import { secondEditionOptionalAttributes } from "../settings/setting-values";

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
  Hooks.on("preCreateActor", (documentValue: unknown, dataValue: unknown) => {
    const document = documentValue as Partial<
      FoundrySourceDocument & { readonly type: string }
    >;
    if (
      !["character", "creature", "npc"].includes(document.type ?? "") ||
      typeof document.updateSource !== "function"
    ) {
      return;
    }
    const data =
      typeof dataValue === "object" && dataValue !== null
        ? (dataValue as Record<string, unknown>)
        : {};
    const existingItems = Array.isArray(data.items) ? data.items : [];
    const imported =
      typeof (data._stats as { compendiumSource?: unknown } | undefined)
        ?.compendiumSource === "string";
    const profile = currentRulesProfile();
    document.updateSource({
      ...newCharacterResourceDefaults(profile),
      ...(!imported && existingItems.length === 0
        ? {
            items: missingSkillSources(
              new Set(),
              profile.compatibility.firstEditionAttributes
                ? "open-d6"
                : "second-edition",
              secondEditionOptionalAttributes(),
            ),
          }
        : {}),
    });
  });
}
