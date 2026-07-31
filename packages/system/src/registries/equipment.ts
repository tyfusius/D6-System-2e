import {
  D6_EQUIPMENT_ERAS,
  type D6System2eEquipmentCatalogDefinition,
  type D6System2eEquipmentCatalogEntry,
  type D6System2eEquipmentCatalogRegistry,
  type D6System2eResolvedEquipmentCatalog,
} from "@d6-system-2e/core";

const catalogs = new Map<string, D6System2eResolvedEquipmentCatalog>();
const ID_PATTERN = /^[a-z][a-z0-9.-]*$/;

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${field} must not be empty.`);
  return normalized;
}

function id(value: string, field: string): string {
  const normalized = text(value, field);
  if (!ID_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a stable lowercase ID.`);
  }
  return normalized;
}

function normalizeEntry(
  value: D6System2eEquipmentCatalogEntry,
): D6System2eEquipmentCatalogEntry {
  if (!D6_EQUIPMENT_ERAS.includes(value.era)) {
    throw new Error(`Equipment entry ${value.id} has an invalid era.`);
  }
  if (!["armor", "gear", "weapon"].includes(value.kind)) {
    throw new Error(`Equipment entry ${value.id} has an invalid kind.`);
  }
  if (!Number.isSafeInteger(value.source.page) || value.source.page < 1) {
    throw new Error(
      `Equipment entry ${value.id} requires a positive source page.`,
    );
  }
  return Object.freeze({
    era: value.era,
    id: id(value.id, "Equipment entry ID"),
    kind: value.kind,
    name: text(value.name, "Equipment entry name"),
    source: Object.freeze({
      book: text(value.source.book, "Equipment source book"),
      page: value.source.page,
    }),
    system: Object.freeze(structuredClone(value.system)),
  });
}

function normalize(
  ownerId: string,
  definition: D6System2eEquipmentCatalogDefinition,
): D6System2eResolvedEquipmentCatalog {
  const normalizedOwner = id(ownerId, "Equipment catalog owner ID");
  const catalogId = id(definition.id, "Equipment catalog ID");
  if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
    throw new Error(
      `Equipment catalog ${catalogId} requires a positive version.`,
    );
  }
  const entries = definition.entries.map(normalizeEntry);
  if (
    new Set(entries.map((candidate) => candidate.id)).size !== entries.length
  ) {
    throw new Error(
      `Equipment catalog ${catalogId} contains duplicate entry IDs.`,
    );
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    id: catalogId,
    label: text(definition.label, "Equipment catalog label"),
    ownerId: normalizedOwner,
    version: definition.version,
  });
}

export const equipmentCatalogRegistry: D6System2eEquipmentCatalogRegistry =
  Object.freeze({
    current: () => Object.freeze([...catalogs.values()]),
    register: (
      ownerId: string,
      definition: D6System2eEquipmentCatalogDefinition,
    ): void => {
      const catalog = normalize(ownerId, definition);
      const existing = catalogs.get(catalog.id);
      if (existing && existing.ownerId !== catalog.ownerId) {
        throw new Error(
          `Equipment catalog ${catalog.id} is already owned by ${existing.ownerId}.`,
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

export function registerBaseEquipmentCatalog(): void {
  equipmentCatalogRegistry.register("d6-system-2e", {
    entries: [],
    id: "d6-system-2e.core-equipment",
    label: "D6 System Second Edition — catalog boundary",
    version: 1,
  });
}

export function resetEquipmentCatalogRegistryForTests(): void {
  catalogs.clear();
}
