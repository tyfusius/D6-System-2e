import {
  D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  type D6CharacterTemplateCatalogV1,
  type D6CharacterTemplateItemV1,
  type D6CharacterTemplateV1,
  type D6ResolvedCharacterTemplateCatalogV1,
  type D6System2eCharacterTemplateRegistry,
} from "@d6-system-2e/core";
import fantasyCharacterTemplateCatalogSource from "../../../../content/fantasy-character-template-catalog.json" with { type: "json" };

const catalogs = new Map<string, D6ResolvedCharacterTemplateCatalogV1>();
const ID_PATTERN = /^[a-z][a-z0-9.-]*$/;
const ITEM_TYPES = new Set([
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

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${field} must not be empty.`);
  return normalized;
}

function stableId(value: string, field: string): string {
  const normalized = requiredText(value, field);
  if (!ID_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a stable lowercase ID.`);
  }
  return normalized;
}

function normalizeItem(
  item: D6CharacterTemplateItemV1,
): D6CharacterTemplateItemV1 {
  if (!ITEM_TYPES.has(item.type)) {
    throw new Error(`Template item ${item.name} has an unsupported type.`);
  }
  const img = item.img?.trim();
  const sourceUuid = item.sourceUuid?.trim();
  return Object.freeze({
    ...(img ? { img } : {}),
    name: requiredText(item.name, "Template item name"),
    ...(sourceUuid ? { sourceUuid } : {}),
    system: Object.freeze(structuredClone(item.system)),
    type: item.type,
  });
}

function normalizeTemplate(
  template: D6CharacterTemplateV1,
): D6CharacterTemplateV1 {
  const templateId = stableId(template.id, "Character template ID");
  const version: unknown = template.version;
  if (version !== D6_CHARACTER_TEMPLATE_CONTRACT_VERSION) {
    throw new Error(
      `Character template ${templateId} uses an unsupported contract version.`,
    );
  }
  if (!Number.isSafeInteger(template.source.page) || template.source.page < 1) {
    throw new Error(
      `Character template ${templateId} requires a positive source page.`,
    );
  }
  const attributeScores = Object.fromEntries(
    Object.entries(template.attributeScores).map(([attributeId, score]) => {
      const normalizedId = stableId(attributeId, "Template Attribute ID");
      if (!Number.isSafeInteger(score)) {
        throw new Error(
          `Character template ${templateId} has a non-integer Attribute score.`,
        );
      }
      return [normalizedId, score];
    }),
  );
  const suggestedSkillKeys = template.suggestedSkillKeys.map((key) =>
    stableId(key, "Suggested Skill key"),
  );
  if (new Set(suggestedSkillKeys).size !== suggestedSkillKeys.length) {
    throw new Error(
      `Character template ${templateId} contains duplicate suggested Skills.`,
    );
  }
  const superpowerCreationDice: unknown =
    template.superheroic?.superpowerCreationDice;
  if (
    !["d6-system-second-edition", "open-d6-first-edition"].includes(
      template.rulesFamily,
    )
  ) {
    throw new Error(
      `Character template ${templateId} has an unsupported rules family.`,
    );
  }
  if (
    template.rulesFamily === "open-d6-first-edition" &&
    template.superheroic
  ) {
    throw new Error(
      `Character template ${templateId} cannot combine First Edition and Superheroic data.`,
    );
  }
  if (
    template.rulesFamily !== "open-d6-first-edition" &&
    template.firstEdition
  ) {
    throw new Error(
      `Character template ${templateId} has First Edition data for the wrong rules family.`,
    );
  }
  if (template.superheroic && superpowerCreationDice !== 10) {
    throw new Error(
      `Character template ${templateId} must use the printed 10D Superpower budget.`,
    );
  }
  const superheroic = template.superheroic
    ? Object.freeze({
        superpowerCreationDice: 10 as const,
        superpowers: Object.freeze(
          template.superheroic.superpowers.map((selection) =>
            Object.freeze({
              definitionId: stableId(
                selection.definitionId,
                "Template Superpower definition ID",
              ),
              ...(selection.focus?.trim()
                ? { focus: selection.focus.trim() }
                : {}),
              rank: selection.rank,
            }),
          ),
        ),
      })
    : undefined;
  if (
    superheroic?.superpowers.some(
      (selection) =>
        !Number.isSafeInteger(selection.rank) || selection.rank < 1,
    )
  ) {
    throw new Error(
      `Character template ${templateId} has an invalid Superpower rank.`,
    );
  }
  if (
    superheroic &&
    new Set(superheroic.superpowers.map(({ definitionId }) => definitionId))
      .size !== superheroic.superpowers.length
  ) {
    throw new Error(
      `Character template ${templateId} contains duplicate Superpowers.`,
    );
  }
  const unassignedAttributeScore = template.unassignedAttributeScore ?? 0;
  if (
    !Number.isSafeInteger(unassignedAttributeScore) ||
    unassignedAttributeScore < 0 ||
    unassignedAttributeScore % 3 !== 0
  ) {
    throw new Error(
      `Character template ${templateId} has an invalid unassigned Attribute score.`,
    );
  }
  const firstEdition = template.firstEdition
    ? Object.freeze({
        ...(template.firstEdition.biography?.trim()
          ? { biography: template.firstEdition.biography.trim() }
          : {}),
        ...(Number.isSafeInteger(template.firstEdition.characterPoints) &&
        Number(template.firstEdition.characterPoints) >= 0
          ? { characterPoints: Number(template.firstEdition.characterPoints) }
          : {}),
        ...(Number.isSafeInteger(template.firstEdition.fatePoints) &&
        Number(template.firstEdition.fatePoints) >= 0
          ? { fatePoints: Number(template.firstEdition.fatePoints) }
          : {}),
        ...(Number.isSafeInteger(template.firstEdition.move) &&
        Number(template.firstEdition.move) > 0
          ? { move: Number(template.firstEdition.move) }
          : {}),
      })
    : undefined;
  if (
    template.firstEdition &&
    Object.keys(firstEdition ?? {}).length !==
      Object.keys(template.firstEdition).filter(
        (key) =>
          template.firstEdition?.[
            key as keyof NonNullable<D6CharacterTemplateV1["firstEdition"]>
          ] !== undefined,
      ).length
  ) {
    throw new Error(
      `Character template ${templateId} has invalid First Edition values.`,
    );
  }
  return Object.freeze({
    attributeScores: Object.freeze(attributeScores),
    ...(firstEdition ? { firstEdition } : {}),
    id: templateId,
    items: Object.freeze((template.items ?? []).map(normalizeItem)),
    label: requiredText(template.label, "Character template label"),
    rulesFamily: template.rulesFamily,
    source: Object.freeze({
      book: requiredText(
        template.source.book,
        "Character template source book",
      ),
      page: template.source.page,
    }),
    suggestedSkillKeys: Object.freeze(suggestedSkillKeys),
    ...(superheroic ? { superheroic } : {}),
    ...(unassignedAttributeScore > 0 ? { unassignedAttributeScore } : {}),
    version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  });
}

function normalizeCatalog(
  ownerId: string,
  catalog: D6CharacterTemplateCatalogV1,
): D6ResolvedCharacterTemplateCatalogV1 {
  const normalizedOwnerId = stableId(ownerId, "Character template owner ID");
  const catalogId = stableId(catalog.id, "Character template catalog ID");
  const version: unknown = catalog.version;
  if (version !== D6_CHARACTER_TEMPLATE_CONTRACT_VERSION) {
    throw new Error(
      `Character template catalog ${catalogId} uses an unsupported contract version.`,
    );
  }
  const templates = catalog.templates.map(normalizeTemplate);
  if (
    new Set(templates.map((template) => template.id)).size !== templates.length
  ) {
    throw new Error(
      `Character template catalog ${catalogId} contains duplicate template IDs.`,
    );
  }
  return Object.freeze({
    id: catalogId,
    label: requiredText(catalog.label, "Character template catalog label"),
    ownerId: normalizedOwnerId,
    templates: Object.freeze(templates),
    version: D6_CHARACTER_TEMPLATE_CONTRACT_VERSION,
  });
}

export const characterTemplateRegistry: D6System2eCharacterTemplateRegistry =
  Object.freeze({
    current: (): readonly D6ResolvedCharacterTemplateCatalogV1[] =>
      Object.freeze([...catalogs.values()]),
    register: (
      ownerId: string,
      definition: D6CharacterTemplateCatalogV1,
    ): void => {
      const catalog = normalizeCatalog(ownerId, definition);
      const existing = catalogs.get(catalog.id);
      if (existing && existing.ownerId !== catalog.ownerId) {
        throw new Error(
          `Character template catalog ${catalog.id} is already owned by ${existing.ownerId}.`,
        );
      }
      const otherTemplateIds = new Set(
        [...catalogs.values()]
          .filter((candidate) => candidate.id !== catalog.id)
          .flatMap((candidate) =>
            candidate.templates.map((template) => template.id),
          ),
      );
      const conflict = catalog.templates.find((template) =>
        otherTemplateIds.has(template.id),
      );
      if (conflict) {
        throw new Error(
          `Character template ${conflict.id} is already registered by another catalog.`,
        );
      }
      catalogs.set(catalog.id, catalog);
    },
    unregisterOwner: (ownerId: string): void => {
      for (const [catalogId, catalog] of catalogs) {
        if (catalog.ownerId === ownerId) catalogs.delete(catalogId);
      }
    },
  });

export function registerBaseCharacterTemplateCatalog(): void {
  characterTemplateRegistry.register(
    "d6-system-2e",
    fantasyCharacterTemplateCatalogSource as D6CharacterTemplateCatalogV1,
  );
}

export function resolvedCharacterTemplate(templateId: string): {
  readonly catalog: D6ResolvedCharacterTemplateCatalogV1;
  readonly template: D6CharacterTemplateV1;
} | null {
  for (const catalog of catalogs.values()) {
    const template = catalog.templates.find(
      (candidate) => candidate.id === templateId,
    );
    if (template) return Object.freeze({ catalog, template });
  }
  return null;
}

export function resetCharacterTemplateRegistryForTests(): void {
  catalogs.clear();
}
