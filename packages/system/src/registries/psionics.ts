import {
  D6_PSIONIC_DISCIPLINES,
  D6_PSIONICS_CONTRACT_VERSION,
  type D6PsionicPowerCatalogV1,
  type D6PsionicPowerV1,
  type D6ResolvedPsionicPowerCatalogV1,
  type D6System2ePsionicPowerRegistry,
} from "@d6-system-2e/core";

const catalogs = new Map<string, D6ResolvedPsionicPowerCatalogV1>();
const stableId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

function normalizePower(power: D6PsionicPowerV1): D6PsionicPowerV1 {
  if (!stableId.test(power.id) || !power.label.trim()) {
    throw new TypeError(
      "Psionic power IDs and labels must be stable and non-empty.",
    );
  }
  const disciplines = [...new Set(power.disciplines)];
  if (
    disciplines.length < 1 ||
    disciplines.length > 2 ||
    disciplines.some((value) => !D6_PSIONIC_DISCIPLINES.includes(value))
  ) {
    throw new TypeError(
      "A psionic power requires one or two valid disciplines.",
    );
  }
  const baseDifficulty = Math.trunc(power.baseDifficulty);
  const scalingDifficultyPerAttempt = Math.trunc(
    power.scalingDifficultyPerAttempt ?? 0,
  );
  if (
    baseDifficulty < 0 ||
    scalingDifficultyPerAttempt < 0 ||
    !power.source.book.trim() ||
    !Number.isInteger(power.source.page) ||
    power.source.page < 1
  ) {
    throw new TypeError(
      "Psionic power difficulty and source data are invalid.",
    );
  }
  return Object.freeze({
    baseDifficulty,
    disciplines: Object.freeze(disciplines),
    id: power.id,
    label: power.label.trim(),
    ...(scalingDifficultyPerAttempt > 0 ? { scalingDifficultyPerAttempt } : {}),
    source: Object.freeze({
      book: power.source.book.trim(),
      page: power.source.page,
    }),
  });
}

function normalizeCatalog(
  ownerId: string,
  catalog: D6PsionicPowerCatalogV1,
): D6ResolvedPsionicPowerCatalogV1 {
  if (!ownerId.trim() || !stableId.test(catalog.id)) {
    throw new TypeError("Psionic catalog owner and ID are required.");
  }
  const catalogVersion: unknown = Reflect.get(catalog, "catalogVersion");
  if (catalogVersion !== D6_PSIONICS_CONTRACT_VERSION) {
    throw new RangeError("Unsupported Psionics catalog version.");
  }
  const powers = catalog.powers.map(normalizePower);
  if (new Set(powers.map(({ id }) => id)).size !== powers.length) {
    throw new TypeError("Psionic power IDs must be unique within a catalog.");
  }
  return Object.freeze({ ...catalog, ownerId, powers: Object.freeze(powers) });
}

export const psionicPowerRegistry: D6System2ePsionicPowerRegistry =
  Object.freeze({
    current: () => Object.freeze([...catalogs.values()]),
    register: (ownerId: string, catalog: D6PsionicPowerCatalogV1) => {
      const normalized = normalizeCatalog(ownerId, catalog);
      for (const current of catalogs.values()) {
        if (current.ownerId === ownerId) continue;
        if (current.id === normalized.id)
          throw new Error(`Psionic catalog ${normalized.id} already exists.`);
        const ids = new Set(current.powers.map(({ id }) => id));
        const collision = normalized.powers.find(({ id }) => ids.has(id));
        if (collision)
          throw new Error(`Psionic power ${collision.id} already exists.`);
      }
      catalogs.set(ownerId, normalized);
    },
    unregisterOwner: (ownerId: string) => {
      catalogs.delete(ownerId);
    },
  });

export function registerBasePsionicPowerCatalog(): void {
  psionicPowerRegistry.register("d6-system-2e", {
    catalogVersion: D6_PSIONICS_CONTRACT_VERSION,
    id: "d6-system-2e.psionics",
    powers: [],
  });
}

export function resetPsionicPowerRegistryForTests(): void {
  catalogs.clear();
}
