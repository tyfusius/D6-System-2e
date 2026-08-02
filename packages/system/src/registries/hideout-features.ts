import {
  D6_HIDEOUT_FEATURE_CONTRACT_VERSION,
  type D6HideoutFeatureCatalogV1,
  type D6HideoutFeatureV1,
  type D6ResolvedHideoutFeatureCatalogV1,
  type D6System2eHideoutFeatureRegistry,
} from "@d6-system-2e/core";

const catalogs = new Map<string, D6ResolvedHideoutFeatureCatalogV1>();
const stableId = /^[a-z][a-z0-9.-]*$/u;

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must not be empty.`);
  return normalized;
}

function id(value: string, field: string): string {
  const normalized = text(value, field);
  if (!stableId.test(normalized)) {
    throw new TypeError(`${field} must be a stable lowercase ID.`);
  }
  return normalized;
}

function normalizeFeature(value: D6HideoutFeatureV1): D6HideoutFeatureV1 {
  const version: unknown = value.version;
  if (version !== D6_HIDEOUT_FEATURE_CONTRACT_VERSION) {
    throw new RangeError("Unsupported hideout feature contract version.");
  }
  if (!Number.isSafeInteger(value.source.page) || value.source.page < 1) {
    throw new TypeError("Hideout feature source page must be positive.");
  }
  const prerequisiteIds = Object.freeze(
    [...new Set(value.prerequisiteIds ?? [])].map((entry) =>
      id(entry, "Hideout feature prerequisite ID"),
    ),
  );
  return Object.freeze({
    ...(value.description?.trim()
      ? { description: value.description.trim() }
      : {}),
    id: id(value.id, "Hideout feature ID"),
    label: text(value.label, "Hideout feature label"),
    ...(prerequisiteIds.length > 0 ? { prerequisiteIds } : {}),
    ...(value.repeatable === true ? { repeatable: true } : {}),
    source: Object.freeze({
      book: text(value.source.book, "Hideout feature source book"),
      page: value.source.page,
    }),
    version: D6_HIDEOUT_FEATURE_CONTRACT_VERSION,
  });
}

function normalizeCatalog(
  ownerId: string,
  value: D6HideoutFeatureCatalogV1,
): D6ResolvedHideoutFeatureCatalogV1 {
  const version: unknown = value.version;
  if (version !== D6_HIDEOUT_FEATURE_CONTRACT_VERSION) {
    throw new RangeError("Unsupported hideout feature catalog version.");
  }
  const entries = value.entries.map(normalizeFeature);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new TypeError("Hideout feature IDs must be unique within a catalog.");
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    id: id(value.id, "Hideout feature catalog ID"),
    label: text(value.label, "Hideout feature catalog label"),
    ownerId: id(ownerId, "Hideout feature catalog owner ID"),
    version: D6_HIDEOUT_FEATURE_CONTRACT_VERSION,
  });
}

export const hideoutFeatureRegistry: D6System2eHideoutFeatureRegistry =
  Object.freeze({
    current: () => Object.freeze([...catalogs.values()]),
    register: (ownerId: string, value: D6HideoutFeatureCatalogV1) => {
      const catalog = normalizeCatalog(ownerId, value);
      const otherIds = new Set(
        [...catalogs.values()]
          .filter((candidate) => candidate.id !== catalog.id)
          .flatMap((candidate) => candidate.entries.map((entry) => entry.id)),
      );
      const collision = catalog.entries.find((entry) => otherIds.has(entry.id));
      if (collision) {
        throw new Error(`Hideout feature ${collision.id} already exists.`);
      }
      const existing = catalogs.get(catalog.id);
      if (existing && existing.ownerId !== catalog.ownerId) {
        throw new Error(`Hideout catalog ${catalog.id} already exists.`);
      }
      catalogs.set(catalog.id, catalog);
    },
    unregisterOwner: (ownerId: string) => {
      for (const [catalogId, catalog] of catalogs) {
        if (catalog.ownerId === ownerId) catalogs.delete(catalogId);
      }
    },
  });

export function resolvedHideoutFeature(featureId: string): Readonly<{
  catalog: D6ResolvedHideoutFeatureCatalogV1;
  feature: D6HideoutFeatureV1;
}> | null {
  for (const catalog of catalogs.values()) {
    const feature = catalog.entries.find((entry) => entry.id === featureId);
    if (feature) return Object.freeze({ catalog, feature });
  }
  return null;
}

export function registerBaseHideoutFeatureCatalog(): void {
  hideoutFeatureRegistry.register("d6-system-2e", {
    entries: [],
    id: "d6-system-2e.hideouts",
    label: "D6 System Second Edition - hideout contribution boundary",
    version: D6_HIDEOUT_FEATURE_CONTRACT_VERSION,
  });
}

export function resetHideoutFeatureRegistryForTests(): void {
  catalogs.clear();
}
