import type { D6System2eResolvedTerminology } from "@d6-system-2e/core";
import {
  currentTerminology,
  terminologyActorLabel,
  terminologyItemDocumentLabel,
  type TerminologyActorType,
} from "../registries/terminology";

const ACTOR_DOCUMENT_TYPES = Object.freeze([
  "character",
  "creature",
  "hideout",
  "npc",
  "starship",
  "vehicle",
] as const satisfies readonly TerminologyActorType[]);

const ITEM_DOCUMENT_TYPES = Object.freeze([
  "action",
  "advantage",
  "armor",
  "asset",
  "character-template",
  "cybernetic",
  "disadvantage",
  "flaw",
  "gear",
  "item-group",
  "manifestation",
  "perk",
  "skill",
  "specialability",
  "specialization",
  "species-template",
  "starship-gear",
  "starship-weapon",
  "talent",
  "trouble",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
] as const);

const RUNTIME_TRANSLATION_ROOT = "D6E2RuntimeDocumentTypes";

export interface DocumentTypeLabelProjection {
  readonly actors: Readonly<Record<string, string>>;
  readonly items: Readonly<Record<string, string>>;
}

export function documentTypeLabelProjection(
  terminology: D6System2eResolvedTerminology,
  localize: (key: string) => string,
): DocumentTypeLabelProjection {
  return Object.freeze({
    actors: Object.freeze(
      Object.fromEntries(
        ACTOR_DOCUMENT_TYPES.map((type) => [
          type,
          terminologyActorLabel(
            terminology,
            type,
            "singular",
            localize(`TYPES.Actor.${type}`),
          ),
        ]),
      ),
    ),
    items: Object.freeze(
      Object.fromEntries(
        ITEM_DOCUMENT_TYPES.map((type) => [
          type,
          type === "specialability" && terminology.items.specialAbility
            ? terminology.items.specialAbility
            : terminologyItemDocumentLabel(
                terminology,
                type,
                "singular",
                localize(`TYPES.Item.${type}`),
              ),
        ]),
      ),
    ),
  });
}

function runtimeTranslations(): {
  readonly Actor: Record<string, string>;
  readonly Item: Record<string, string>;
} {
  const translations = game.i18n.translations;
  const current = translations[RUNTIME_TRANSLATION_ROOT];
  const root =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : (translations[RUNTIME_TRANSLATION_ROOT] = {});
  const group = (name: "Actor" | "Item"): Record<string, string> => {
    const value = root[name];
    if (value && typeof value === "object") {
      return value as Record<string, string>;
    }
    const created: Record<string, string> = {};
    root[name] = created;
    return created;
  };
  return { Actor: group("Actor"), Item: group("Item") };
}

/**
 * Project Setting Profile vocabulary into Foundry's supported type-label
 * registry. The keys remain stable; only the localized display value changes.
 */
export function applyDocumentTypeTerminology(
  terminology = currentTerminology(),
): void {
  const projection = documentTypeLabelProjection(
    terminology,
    game.i18n.localize.bind(game.i18n),
  );
  const translations = runtimeTranslations();
  for (const [type, value] of Object.entries(projection.actors)) {
    translations.Actor[type] = value;
    CONFIG.Actor.typeLabels[type] = `${RUNTIME_TRANSLATION_ROOT}.Actor.${type}`;
  }
  for (const [type, value] of Object.entries(projection.items)) {
    translations.Item[type] = value;
    CONFIG.Item.typeLabels[type] = `${RUNTIME_TRANSLATION_ROOT}.Item.${type}`;
  }
}
