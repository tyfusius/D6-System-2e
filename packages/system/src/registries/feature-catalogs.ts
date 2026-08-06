import {
  D6_FEATURE_CATALOG_CONTRACT_VERSION,
  type D6FeatureCatalogV1,
  type D6FeatureDefinitionV1,
  type D6FeatureMechanicV1,
  type D6ResolvedFeatureCatalogV1,
  type D6System2eFeatureCatalogRegistry,
} from "@d6-system-2e/core";

const catalogs = new Map<string, D6ResolvedFeatureCatalogV1>();
const ID_PATTERN = /^[a-z][a-z0-9.-]*$/;
const KINDS = ["flaw", "perk", "talent"] as const;
const MECHANICS = [
  "action-modifier",
  "advancement-lock",
  "advancement-modifier",
  "minimum-total",
  "movement-modifier",
  "narrative",
  "reroll",
  "resource",
  "roll-modifier",
  "trained-use",
  "usage-limit",
] as const;
const APPLICATIONS = [
  "all-rolls",
  "attribute",
  "damage",
  "defense",
  "initiative",
  "movement",
  "resistance",
  "skill",
  "specialization",
] as const;

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${field} must not be empty.`);
  return normalized;
}

function stableId(value: string, field: string): string {
  const normalized = text(value, field);
  if (!ID_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a stable lowercase ID.`);
  }
  return normalized;
}

function whole(value: number, field: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be an integer of at least ${minimum}.`);
  }
  return value;
}

function normalizeMechanic(
  value: D6FeatureMechanicV1,
  featureId: string,
): D6FeatureMechanicV1 {
  if (!MECHANICS.includes(value.kind)) {
    throw new Error(`Feature ${featureId} has an unsupported mechanic kind.`);
  }
  if (value.application && !APPLICATIONS.includes(value.application)) {
    throw new Error(`Feature ${featureId} has an unsupported application.`);
  }
  const selector = value.selector?.trim();
  return Object.freeze({
    ...(value.application ? { application: value.application } : {}),
    ...(value.automatic !== undefined ? { automatic: value.automatic } : {}),
    kind: value.kind,
    ...(value.limit !== undefined
      ? { limit: whole(value.limit, `Feature ${featureId} mechanic limit`) }
      : {}),
    ...(value.perRank !== undefined ? { perRank: value.perRank } : {}),
    ...(value.score !== undefined
      ? {
          score: whole(
            value.score,
            `Feature ${featureId} mechanic score`,
            -999,
          ),
        }
      : {}),
    ...(selector ? { selector } : {}),
  });
}

function normalizeDefinition(
  value: D6FeatureDefinitionV1,
): D6FeatureDefinitionV1 {
  const id = stableId(value.id, "Feature definition ID");
  const contractVersion: unknown = value.version;
  if (contractVersion !== D6_FEATURE_CATALOG_CONTRACT_VERSION) {
    throw new Error(`Feature ${id} uses an unsupported contract version.`);
  }
  if (!KINDS.includes(value.kind)) {
    throw new Error(`Feature ${id} has an unsupported kind.`);
  }
  if (value.kind !== "talent" && value.creationSkillDice !== 1) {
    throw new Error(`Feature ${id} must cost or grant one Skill die per rank.`);
  }
  if (value.superpower && value.kind !== "talent") {
    throw new Error(`Feature ${id} must be a Talent to be a Superpower.`);
  }
  const relationships = (
    values: readonly string[] | undefined,
    field: string,
  ) => {
    const normalized = (values ?? []).map((entry) => stableId(entry, field));
    if (
      new Set(normalized).size !== normalized.length ||
      normalized.includes(id)
    ) {
      throw new Error(
        `Feature ${id} has invalid ${field.toLowerCase()} entries.`,
      );
    }
    return Object.freeze(normalized);
  };
  const conflicts = relationships(value.conflicts, "Feature conflict ID");
  const prerequisites = relationships(
    value.prerequisites,
    "Feature prerequisite ID",
  );
  const rankMinimum = whole(value.rankMinimum, `Feature ${id} minimum rank`, 1);
  const rankMaximum =
    value.rankMaximum === undefined
      ? undefined
      : whole(value.rankMaximum, `Feature ${id} maximum rank`, rankMinimum);
  if (!Number.isSafeInteger(value.source.page) || value.source.page < 1) {
    throw new Error(`Feature ${id} requires a positive source page.`);
  }
  return Object.freeze({
    ...(conflicts.length > 0 ? { conflicts } : {}),
    creationSkillDice: whole(
      value.creationSkillDice,
      `Feature ${id} creation Skill-dice cost`,
    ),
    ...(value.focusRequired ? { focusRequired: true } : {}),
    id,
    kind: value.kind,
    label: text(value.label, `Feature ${id} label`),
    mechanics: Object.freeze(
      value.mechanics.map((mechanic) => normalizeMechanic(mechanic, id)),
    ),
    ...(prerequisites.length > 0 ? { prerequisites } : {}),
    ...(rankMaximum === undefined ? {} : { rankMaximum }),
    rankMinimum,
    repeatable: value.repeatable,
    source: Object.freeze({
      book: text(value.source.book, `Feature ${id} source book`),
      page: value.source.page,
    }),
    ...(value.superpower
      ? {
          superpower: Object.freeze({
            ...(value.superpower.automatic === true ? { automatic: true } : {}),
            enhancementCostPerRank: whole(
              value.superpower.enhancementCostPerRank ?? 0,
              `Feature ${id} enhancement cost`,
            ),
            limitationCredit: whole(
              value.superpower.limitationCredit ?? 0,
              `Feature ${id} limitation credit`,
            ),
          }),
        }
      : {}),
    version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
  });
}

function normalizeCatalog(
  ownerId: string,
  value: D6FeatureCatalogV1,
): D6ResolvedFeatureCatalogV1 {
  const owner = stableId(ownerId, "Feature catalog owner ID");
  const id = stableId(value.id, "Feature catalog ID");
  const contractVersion: unknown = value.version;
  if (contractVersion !== D6_FEATURE_CATALOG_CONTRACT_VERSION) {
    throw new Error(
      `Feature catalog ${id} uses an unsupported contract version.`,
    );
  }
  const definitions = value.definitions.map(normalizeDefinition);
  if (
    new Set(definitions.map((entry) => entry.id)).size !== definitions.length
  ) {
    throw new Error(`Feature catalog ${id} contains duplicate definition IDs.`);
  }
  return Object.freeze({
    definitions: Object.freeze(definitions),
    id,
    label: text(value.label, "Feature catalog label"),
    ownerId: owner,
    version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
  });
}

export const featureCatalogRegistry: D6System2eFeatureCatalogRegistry =
  Object.freeze({
    current: () => Object.freeze([...catalogs.values()]),
    register: (ownerId: string, value: D6FeatureCatalogV1): void => {
      const catalog = normalizeCatalog(ownerId, value);
      const existing = catalogs.get(catalog.id);
      if (existing && existing.ownerId !== catalog.ownerId) {
        throw new Error(
          `Feature catalog ${catalog.id} is already owned by ${existing.ownerId}.`,
        );
      }
      const otherIds = new Set(
        [...catalogs.values()]
          .filter((candidate) => candidate.id !== catalog.id)
          .flatMap((candidate) =>
            candidate.definitions.map((entry) => entry.id),
          ),
      );
      const conflict = catalog.definitions.find((entry) =>
        otherIds.has(entry.id),
      );
      if (conflict) {
        throw new Error(
          `Feature ${conflict.id} is already registered by another catalog.`,
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

export function registerBaseFeatureCatalog(): void {
  featureCatalogRegistry.register("d6-system-2e", {
    definitions: [],
    id: "d6-system-2e.features",
    label: "D6 System Second Edition — feature boundary",
    version: D6_FEATURE_CATALOG_CONTRACT_VERSION,
  });
}

export function resolvedFeatureDefinition(definitionId: string): {
  readonly catalog: D6ResolvedFeatureCatalogV1;
  readonly definition: D6FeatureDefinitionV1;
} | null {
  for (const catalog of catalogs.values()) {
    const definition = catalog.definitions.find(
      (entry) => entry.id === definitionId,
    );
    if (definition) return Object.freeze({ catalog, definition });
  }
  return null;
}

export function resetFeatureCatalogRegistryForTests(): void {
  catalogs.clear();
}
