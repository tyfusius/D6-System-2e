import {
  D6_BESTIARY_CONTRACT_VERSION,
  type D6BestiaryCatalogV1,
  type D6BestiaryEntryV1,
  type D6BestiaryItemV1,
  type D6ResolvedBestiaryCatalogV1,
  type D6System2eBestiaryRegistry,
} from "@d6-system-2e/core";

const catalogs = new Map<string, D6ResolvedBestiaryCatalogV1>();
const ID_PATTERN = /^[a-z][a-z0-9.-]*$/;
const ITEM_TYPES = Object.freeze([
  "armor",
  "gear",
  "manifestation",
  "specialability",
  "weapon",
] as const);

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

function nonnegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a nonnegative integer.`);
  }
  return value;
}

function boundedInteger(value: number, field: string, maximum: number): number {
  const normalized = nonnegativeInteger(value, field);
  if (normalized > maximum) {
    throw new Error(`${field} must not exceed ${maximum}.`);
  }
  return normalized;
}

function normalizeItem(item: D6BestiaryItemV1): D6BestiaryItemV1 {
  if (!ITEM_TYPES.includes(item.type)) {
    throw new Error(`Bestiary item ${item.name} has an unsupported type.`);
  }
  const img = item.img?.trim();
  return Object.freeze({
    ...(img ? { img } : {}),
    name: requiredText(item.name, "Bestiary item name"),
    system: Object.freeze(structuredClone(item.system)),
    type: item.type,
  });
}

function normalizeEntry(entry: D6BestiaryEntryV1): D6BestiaryEntryV1 {
  const entryId = stableId(entry.id, "Bestiary entry ID");
  const version: unknown = entry.version;
  if (version !== D6_BESTIARY_CONTRACT_VERSION) {
    throw new Error(
      `Bestiary entry ${entryId} uses an unsupported contract version.`,
    );
  }
  if (!Number.isSafeInteger(entry.source.page) || entry.source.page < 1) {
    throw new Error(
      `Bestiary entry ${entryId} requires a positive source page.`,
    );
  }
  const attributeScores = Object.fromEntries(
    Object.entries(entry.attributeScores).map(([attributeId, score]) => [
      stableId(attributeId, "Bestiary Attribute ID"),
      boundedInteger(score, `Bestiary Attribute ${attributeId}`, 60),
    ]),
  );
  if (Object.keys(attributeScores).length === 0) {
    throw new Error(
      `Bestiary entry ${entryId} requires at least one Attribute.`,
    );
  }
  const biography = entry.biography?.trim();
  const img = entry.img?.trim();
  return Object.freeze({
    attributeScores: Object.freeze(attributeScores),
    ...(biography ? { biography } : {}),
    defenseOverrides: Object.freeze({
      dodge: nonnegativeInteger(
        entry.defenseOverrides.dodge,
        "Bestiary Dodge override",
      ),
      parry: nonnegativeInteger(
        entry.defenseOverrides.parry,
        "Bestiary Parry override",
      ),
    }),
    id: entryId,
    ...(img ? { img } : {}),
    items: Object.freeze((entry.items ?? []).map(normalizeItem)),
    label: requiredText(entry.label, "Bestiary entry label"),
    magicPoints: nonnegativeInteger(
      entry.magicPoints ?? 0,
      "Bestiary Magic Points",
    ),
    scale: boundedInteger(entry.scale ?? 0, "Bestiary Scale", 6),
    source: Object.freeze({
      book: requiredText(entry.source.book, "Bestiary source book"),
      page: entry.source.page,
    }),
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

function normalizeCatalog(
  ownerId: string,
  value: D6BestiaryCatalogV1,
): D6ResolvedBestiaryCatalogV1 {
  const normalizedOwnerId = stableId(ownerId, "Bestiary owner ID");
  const catalogId = stableId(value.id, "Bestiary catalog ID");
  const version: unknown = value.version;
  if (version !== D6_BESTIARY_CONTRACT_VERSION) {
    throw new Error(
      `Bestiary catalog ${catalogId} uses an unsupported contract version.`,
    );
  }
  const entries = value.entries.map(normalizeEntry);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error(
      `Bestiary catalog ${catalogId} contains duplicate entry IDs.`,
    );
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    id: catalogId,
    label: requiredText(value.label, "Bestiary catalog label"),
    ownerId: normalizedOwnerId,
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

export const bestiaryRegistry: D6System2eBestiaryRegistry = Object.freeze({
  current: (): readonly D6ResolvedBestiaryCatalogV1[] =>
    Object.freeze([...catalogs.values()]),
  register: (ownerId: string, value: D6BestiaryCatalogV1): void => {
    const catalog = normalizeCatalog(ownerId, value);
    const existing = catalogs.get(catalog.id);
    if (existing && existing.ownerId !== catalog.ownerId) {
      throw new Error(
        `Bestiary catalog ${catalog.id} is already owned by ${existing.ownerId}.`,
      );
    }
    const otherEntryIds = new Set(
      [...catalogs.values()]
        .filter((candidate) => candidate.id !== catalog.id)
        .flatMap((candidate) => candidate.entries.map((entry) => entry.id)),
    );
    const conflict = catalog.entries.find((entry) =>
      otherEntryIds.has(entry.id),
    );
    if (conflict) {
      throw new Error(
        `Bestiary entry ${conflict.id} is already registered by another catalog.`,
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

export function registerBaseBestiaryCatalog(): void {
  bestiaryRegistry.register("d6-system-2e", {
    entries: [],
    id: "d6-system-2e.bestiary",
    label: "D6 System Second Edition — bestiary boundary",
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

export function resolvedBestiaryEntry(entryId: string): {
  readonly catalog: D6ResolvedBestiaryCatalogV1;
  readonly entry: D6BestiaryEntryV1;
} | null {
  for (const catalog of catalogs.values()) {
    const entry = catalog.entries.find((candidate) => candidate.id === entryId);
    if (entry) return Object.freeze({ catalog, entry });
  }
  return null;
}

export function resetBestiaryRegistryForTests(): void {
  catalogs.clear();
}
