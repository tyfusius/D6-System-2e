import {
  D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  type D6CharacterTemplateItemKind,
  type D6CharacterTemplateItemV1,
  type D6CharacterTemplateV1,
} from "@d6-system-2e/core";
import { characterTemplateRegistry } from "../registries/character-templates";
import { currentAttributeRuntimeStrategy } from "../settings/attributes";
import { currentSettingProfile } from "../settings/setting-profile";
import { integer, record, stringValue } from "./sheets/values";

const WORLD_TEMPLATE_OWNER = "world.character-templates";
const WORLD_TEMPLATE_CATALOG = "world.character-templates";
const warnedInvalidWorldTemplates = new Set<string>();
const ALLOWED_ITEM_TYPES = new Set<string>([
  "advantage",
  "armor",
  "asset",
  "cybernetic",
  "disadvantage",
  "flaw",
  "gear",
  "manifestation",
  "perk",
  "skill",
  "specialability",
  "specialization",
  "talent",
  "trouble",
  "weapon",
]);

function stableKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function worldCharacterTemplateId(item: FoundryItemDocument): string {
  return `world.${item.id.toLocaleLowerCase()}`;
}

export function characterTemplateDocumentId(item: FoundryItemDocument): string {
  const isWorldItem = (game.items?.contents ?? []).some(
    (candidate) => candidate.id === item.id,
  );
  if (isWorldItem) return worldCharacterTemplateId(item);
  return `document.${stableKey(item.uuid ?? item.id) || item.id.toLocaleLowerCase()}`;
}

function templateItemSnapshot(
  item: FoundryItemDocument,
): D6CharacterTemplateItemV1 | null {
  if (!ALLOWED_ITEM_TYPES.has(item.type)) return null;
  const source = structuredClone(item.toObject());
  return {
    ...(item.img ? { img: item.img } : {}),
    name: item.name,
    ...(item.uuid ? { sourceUuid: item.uuid } : {}),
    system: record(source.system),
    type: item.type as D6CharacterTemplateItemKind,
  };
}

function storedTemplateItem(value: unknown): D6CharacterTemplateItemV1 | null {
  const item = record(value);
  const type = stringValue(item.type);
  const name = stringValue(item.name).trim();
  if (!ALLOWED_ITEM_TYPES.has(type) || !name) return null;
  const img = stringValue(item.img).trim();
  const sourceUuid = stringValue(item.sourceUuid).trim();
  return Object.freeze({
    ...(img ? { img } : {}),
    name,
    ...(sourceUuid ? { sourceUuid } : {}),
    system: Object.freeze(structuredClone(record(item.system))),
    type: type as D6CharacterTemplateItemKind,
  });
}

export function characterTemplateFromItem(
  item: FoundryItemDocument,
): D6CharacterTemplateV1 | null {
  if (item.type !== "character-template") return null;
  const attributeScores = Object.fromEntries(
    (Array.isArray(item.system.attributeScores)
      ? item.system.attributeScores
      : []
    ).flatMap((value) => {
      const entry = record(value);
      const attributeId = stringValue(entry.attributeId).trim();
      const score = integer(entry.score);
      return attributeId ? [[attributeId, score] as const] : [];
    }),
  );
  const rulesFamily =
    item.system.rulesFamily === "open-d6-first-edition"
      ? "open-d6-first-edition"
      : "d6-system-second-edition";
  const source = record(item.system.source);
  const firstEdition = record(item.system.firstEdition);
  const firstEditionBiography = stringValue(firstEdition.biography).trim();
  const suggestedSkillKeys = Array.isArray(item.system.suggestedSkillKeys)
    ? item.system.suggestedSkillKeys.filter(
        (key): key is string => typeof key === "string" && key.length > 0,
      )
    : [];
  return Object.freeze({
    attributeScores: Object.freeze(attributeScores),
    ...(rulesFamily === "open-d6-first-edition"
      ? {
          firstEdition: Object.freeze({
            ...(firstEditionBiography
              ? { biography: firstEditionBiography }
              : {}),
            characterPoints: integer(firstEdition.characterPoints),
            fatePoints: integer(firstEdition.fatePoints),
            move: integer(firstEdition.move) || 10,
          }),
        }
      : {}),
    id: characterTemplateDocumentId(item),
    items: Object.freeze(
      (Array.isArray(item.system.items) ? item.system.items : []).flatMap(
        (value) => {
          const snapshot = storedTemplateItem(value);
          return snapshot ? [snapshot] : [];
        },
      ),
    ),
    label: item.name,
    rulesFamily,
    source: Object.freeze({
      book: stringValue(source.book, "Custom template"),
      page: Math.max(1, integer(source.page) || 1),
    }),
    suggestedSkillKeys: Object.freeze([...new Set(suggestedSkillKeys)]),
    ...(integer(item.system.unassignedAttributeScore) > 0
      ? {
          unassignedAttributeScore: integer(
            item.system.unassignedAttributeScore,
          ),
        }
      : {}),
    version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  });
}

export function synchronizeWorldCharacterTemplates(
  additionalDocuments: readonly FoundryItemDocument[] = [],
): readonly FoundryItemDocument[] {
  characterTemplateRegistry.unregisterOwner(WORLD_TEMPLATE_OWNER);
  const documents = [
    ...(game.items?.contents ?? []),
    ...additionalDocuments,
  ].filter(
    (item, index, collection) =>
      item.type === "character-template" &&
      collection.findIndex(
        (candidate) =>
          (candidate.uuid ?? candidate.id) === (item.uuid ?? item.id),
      ) === index,
  );
  const templates: D6CharacterTemplateV1[] = [];
  for (const item of documents) {
    try {
      const template = characterTemplateFromItem(item);
      if (!template) continue;
      characterTemplateRegistry.register(WORLD_TEMPLATE_OWNER, {
        id: WORLD_TEMPLATE_CATALOG,
        label: game.i18n.localize("D6E2.Template.WorldCatalog"),
        templates: [...templates, template],
        version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
      });
      templates.push(template);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warningKey = `${item.uuid ?? item.id}:${message}`;
      if (!warnedInvalidWorldTemplates.has(warningKey)) {
        warnedInvalidWorldTemplates.add(warningKey);
        console.warn(
          `D6 System Second Edition | Skipped invalid world Character Template ${item.uuid ?? item.id}: ${message}`,
          error,
        );
      }
    }
  }
  return Object.freeze(documents);
}

export async function createCharacterTemplateFromActor(
  actor: FoundryActorDocument,
): Promise<FoundryItemDocument> {
  if (actor.type !== "character") {
    throw new Error("D6E2.Template.ActorRequired");
  }
  if (actor.isOwner !== true && game.user?.isGM !== true) {
    throw new Error("D6E2.Template.Issue.owner-required");
  }
  const firstEdition = currentAttributeRuntimeStrategy().family === "open-d6";
  const attributes = record(actor.system.attributes);
  const attributeScores = currentSettingProfile().attributes.map(({ id }) => ({
    attributeId: id,
    score:
      firstEdition || id === "extranormal"
        ? integer(record(attributes[id]).score)
        : Math.max(3, integer(record(attributes[id]).score)),
  }));
  const items = actor.items.contents.flatMap((item) => {
    if (
      item.type === "skill" &&
      integer(item.system.score) === 0 &&
      item.system.training !== "advanced"
    ) {
      return [];
    }
    const snapshot = templateItemSnapshot(item);
    return snapshot ? [snapshot] : [];
  });
  const resources = record(actor.system.resources);
  const movement = record(actor.system.movement);
  const create = Item as unknown as {
    create(
      source: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<FoundryItemDocument | null>;
  };
  const created = await create.create(
    {
      img: actor.img,
      name: `${actor.name} Template`,
      system: {
        attributeScores,
        description: "",
        firstEdition: {
          biography: stringValue(actor.system.biography),
          characterPoints: integer(record(resources.characterPoints).value),
          fatePoints: integer(record(resources.fatePoints).value),
          move: integer(movement.base) || 10,
        },
        items,
        key: `${stableKey(actor.name) || "character"}-template`,
        rulesFamily: firstEdition
          ? "open-d6-first-edition"
          : "d6-system-second-edition",
        source: { book: "Custom template", page: 1 },
        suggestedSkillKeys: [],
        unassignedAttributeScore: 0,
        version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
      },
      type: "character-template",
    },
    { renderSheet: true },
  );
  if (!created) throw new Error("D6E2.Template.ItemCreationFailed");
  synchronizeWorldCharacterTemplates();
  return created;
}
