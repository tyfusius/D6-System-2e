import type { RulesProfile } from "@d6-system-2e/core";
import { missingSkillSources } from "../content/skill-catalog";
import { currentRulesProfile } from "../settings/rules-compatibility";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "../settings/settings-catalog";
import { numberSetting } from "../settings/setting-values";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import { currentSecondEditionHeroPointStrategy } from "../settings/hero-points";
import type { SecondEditionHeroPointStrategy } from "@d6-system-2e/core";

type NumberReader = (key: string, fallback: number) => number;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function explicitSystemSourcePaths(
  value: unknown,
  prefix = "system",
): Readonly<Record<string, unknown>> {
  const source = record(value);
  if (!source) return Object.freeze({});
  const paths: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    const path = `${prefix}.${key}`;
    const nested = record(entry);
    if (nested) Object.assign(paths, explicitSystemSourcePaths(nested, path));
    else paths[path] = structuredClone(entry);
  }
  return Object.freeze(paths);
}

export function expandedSourcePaths(
  value: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const source: Record<string, unknown> = {};
  for (const [path, entry] of Object.entries(value)) {
    const segments = path.split(".");
    const leaf = segments.pop();
    if (!leaf) continue;
    let parent = source;
    for (const segment of segments) {
      parent[segment] = record(parent[segment]) ?? {};
      parent = parent[segment] as Record<string, unknown>;
    }
    parent[leaf] = structuredClone(entry);
  }
  return source;
}

export function newCharacterResourceDefaults(
  profile: RulesProfile,
  readNumber: NumberReader = numberSetting,
  heroPointStrategy: SecondEditionHeroPointStrategy = "heroic",
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
  if (heroPointStrategy === "classic") {
    return Object.freeze({ "system.resources.experiencePoints.value": 0 });
  }
  return Object.freeze({
    "system.resources.heroPoints.value": Math.max(
      0,
      Math.trunc(readNumber(SECOND_EDITION_OPTION_KEYS.startingHeroPoints, 1)),
    ),
  });
}

export function newCharacterCreationDefaults(
  actorType: string,
  profile: RulesProfile,
  imported: boolean,
): Readonly<Record<string, unknown>> {
  if (
    actorType !== "character" ||
    imported ||
    profile.compatibility.firstEditionAttributes
  ) {
    return Object.freeze({});
  }
  return Object.freeze({
    "system.creation.active": true,
    "system.creation.specializationSlots": 0,
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
    const explicitSystem = explicitSystemSourcePaths(data.system);
    const imported =
      typeof (data._stats as { compendiumSource?: unknown } | undefined)
        ?.compendiumSource === "string";
    const profile = currentRulesProfile();
    const changes = expandedSourcePaths({
      ...newCharacterResourceDefaults(
        profile,
        numberSetting,
        currentSecondEditionHeroPointStrategy(),
      ),
      ...newCharacterCreationDefaults(document.type ?? "", profile, imported),
      ...explicitSystem,
    });
    if (!imported && existingItems.length === 0) {
      const campaign = currentSecondEditionCampaignProfile();
      changes.items = missingSkillSources(
        new Set(),
        profile.compatibility.firstEditionAttributes
          ? "open-d6"
          : "second-edition",
        campaignOptionalAttributeIds(),
        new Set([
          ...(campaign.fantasySkills ? ["fantasy"] : []),
          ...(campaign.scienceFictionSkills ? ["science-fiction"] : []),
          ...(campaign.psionics ? ["psionics"] : []),
          ...(campaign.freeformSkillBasedMagic ? ["freeform-magic"] : []),
          ...(campaign.magicPointsCasting ? ["magic-points"] : []),
        ]),
      );
    }
    document.updateSource(changes);
  });
}
