import { missingSkillSources } from "../content/skill-catalog";
import {
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  validateCurrencyWallet,
  type D6CurrencyDefinitionV1,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "../settings/settings-catalog";
import { numberSetting } from "../settings/setting-values";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import { currentAttributeRuntimeStrategy } from "../settings/attributes";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { skillSourcesForRulesProfile } from "../settings/free-d6-profile";
import {
  currentMetaCurrencyRuntimeStrategy,
  type D6MetaCurrencyRuntimeStrategy,
} from "../settings/roll-outcome";
import { currentSettingProfile } from "../settings/setting-profile";
import {
  LEGACY_CURRENCY_DEFINITION,
  mutableCurrencyDocumentSource,
} from "../migrations/058-add-currency-denominations";

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

export function isCompendiumImport(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPreservedActorSource(value: unknown): boolean {
  const stats = record(value);
  if (!stats) return false;
  return (
    isCompendiumImport(stats.compendiumSource) ||
    isCompendiumImport(stats.duplicateSource) ||
    record(stats.exportSource) !== undefined
  );
}

export function newCharacterResourceDefaults(
  metaCurrency: Pick<
    D6MetaCurrencyRuntimeStrategy,
    "heroPointStrategy" | "primaryResource"
  >,
  readNumber: NumberReader = numberSetting,
  superheroicHeroPoints = false,
): Readonly<Record<string, number>> {
  if (metaCurrency.primaryResource === "characterPoints") {
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
  if (metaCurrency.heroPointStrategy === "classic") {
    return Object.freeze({
      "system.resources.experiencePoints.value": superheroicHeroPoints ? 3 : 0,
    });
  }
  if (
    "id" in metaCurrency &&
    metaCurrency.id === "d6mv.meta-currency.hero-and-skill-points"
  ) {
    return Object.freeze({
      "system.resources.heroPoints.value": 6,
    });
  }
  return Object.freeze({
    "system.resources.heroPoints.value": Math.max(
      0,
      superheroicHeroPoints
        ? 3
        : Math.trunc(
            readNumber(SECOND_EDITION_OPTION_KEYS.startingHeroPoints, 1),
          ),
    ),
  });
}

export function newCharacterCreationDefaults(
  actorType: string,
  imported: boolean,
): Readonly<Record<string, unknown>> {
  if (actorType !== "character" || imported) {
    return Object.freeze({});
  }
  return Object.freeze({
    "system.creation.active": true,
    "system.creation.specializationSlots": 0,
  });
}

function isSynthesizedLegacyWallet(
  source: Readonly<Record<string, unknown>>,
  rawCurrency: unknown,
): boolean {
  // The schema's native Character default is exactly zero. A nonzero legacy
  // wallet may have been supplied deliberately, and its denomination identity
  // must be preserved even when it otherwise resembles the generated default.
  if (rawCurrency !== 0) return false;
  try {
    const wallet = validateCurrencyWallet(
      LEGACY_CURRENCY_DEFINITION,
      source as unknown as D6CurrencyWalletV1,
    );
    return (
      wallet.definitionId === LEGACY_CURRENCY_DEFINITION.id &&
      wallet.definitionRevision === LEGACY_CURRENCY_DEFINITION.revision &&
      wallet.definitionFingerprint ===
        currencyDefinitionFingerprint(LEGACY_CURRENCY_DEFINITION) &&
      wallet.counts.currency === rawCurrency.toString() &&
      wallet.totalSmallestUnit === "0" &&
      wallet.recentOperationIds.length === 0 &&
      Object.keys(wallet.operationReceipts).length === 0
    );
  } catch {
    return false;
  }
}

/** Replace only the legacy wallet synthesized during native Actor creation. */
export function newCharacterCurrencyDefaults(
  actorType: string,
  preservedSource: boolean,
  explicitSystemSource: unknown,
  initializedSystemSource: unknown,
  definition: D6CurrencyDefinitionV1 = currentSettingProfile().currency,
): Readonly<Record<string, unknown>> {
  if (actorType !== "character" || preservedSource) return Object.freeze({});
  const explicitProfile = record(record(explicitSystemSource)?.profile) ?? {};
  if (Object.keys(record(explicitProfile.currencyWallet) ?? {}).length > 0)
    return Object.freeze({});
  const profile = record(record(initializedSystemSource)?.profile) ?? {};
  const rawCurrency = profile.currency;
  const walletSource = record(profile.currencyWallet) ?? {};
  const initializedWalletIsNativeEmpty =
    rawCurrency === 0 && Object.keys(walletSource).length === 0;
  if (
    !initializedWalletIsNativeEmpty &&
    !isSynthesizedLegacyWallet(walletSource, rawCurrency)
  )
    return Object.freeze({});
  const main = definition.denominations[0];
  if (!main) return Object.freeze({});
  return Object.freeze({
    "system.profile.currencyWallet": mutableCurrencyDocumentSource(
      createCurrencyWallet(definition, {
        [main.id]: String(rawCurrency),
      }),
    ),
  });
}

export function registerActorCreationDefaults(): void {
  Hooks.on("preCreateActor", (documentValue: unknown, dataValue: unknown) => {
    const document = documentValue as Partial<
      FoundrySourceDocument & {
        readonly system: unknown;
        readonly type: string;
      }
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
    const imported = isCompendiumImport(
      (data._stats as { compendiumSource?: unknown } | undefined)
        ?.compendiumSource,
    );
    const preservedActorSource = hasPreservedActorSource(data._stats);
    const campaign = currentSecondEditionCampaignProfile();
    const changes = expandedSourcePaths({
      ...newCharacterResourceDefaults(
        currentMetaCurrencyRuntimeStrategy(),
        numberSetting,
        campaign.superheroicHeroPoints && document.type === "character",
      ),
      ...explicitSystem,
      ...newCharacterCurrencyDefaults(
        document.type ?? "",
        preservedActorSource,
        data.system,
        document.system,
      ),
      // Foundry includes schema initial values in createData. Apply the native
      // creation contract after those defaults so `active: false` from the
      // data model cannot silently suppress the documented creation workflow.
      ...newCharacterCreationDefaults(document.type ?? "", imported),
    });
    if (
      !imported &&
      existingItems.length === 0 &&
      document.type !== "character"
    ) {
      changes.items = skillSourcesForRulesProfile(
        currentConfiguredRulesProfile(),
        new Set(),
        () =>
          missingSkillSources(
            new Set(),
            currentAttributeRuntimeStrategy().family === "open-d6"
              ? "open-d6"
              : "second-edition",
            campaignOptionalAttributeIds(),
            new Set([
              ...(campaign.fantasySkills ? ["fantasy"] : []),
              ...(campaign.scienceFictionSkills ? ["science-fiction"] : []),
              ...(campaign.superheroicSkills ? ["superheroic"] : []),
              ...(campaign.psionics ? ["psionics"] : []),
              ...(campaign.freeformSkillBasedMagic ? ["freeform-magic"] : []),
              ...(campaign.magicPointsCasting ? ["magic-points"] : []),
            ]),
          ),
      );
    }
    document.updateSource(changes);
  });
}
