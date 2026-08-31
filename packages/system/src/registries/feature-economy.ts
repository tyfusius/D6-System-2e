import {
  validateFeaturePointValue,
  type D6FeatureBenefitDefinitionV1,
  type D6FeatureCatalogV2,
  type D6System2eFeatureEconomyRegistry,
} from "@d6-system-2e/core";

const OWNER_ID = /^[a-z][a-z0-9.-]*$/;
const DEFINITION_ID =
  /^(?:system|world)\/[a-z][a-z0-9.-]*$|^module\/[a-z][a-z0-9.-]*\/[a-z][a-z0-9.-]*$/;
const catalogs = new Map<
  string,
  Readonly<D6FeatureCatalogV2 & { ownerId: string }>
>();

function stable(value: string, pattern: RegExp, field: string): string {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(`${field} is invalid.`);
  return normalized;
}

function normalizedDefinition(
  ownerId: string,
  value: D6FeatureBenefitDefinitionV1,
): D6FeatureBenefitDefinitionV1 {
  const id = stable(value.id, DEFINITION_ID, "Feature definition ID");
  if (value.source.kind === "module") {
    if (
      value.source.ownerId !== ownerId ||
      !id.startsWith(`module/${ownerId}/`)
    ) {
      throw new Error(`Feature ${id} is outside its module owner namespace.`);
    }
  }
  if (
    value.source.kind === "bundled" &&
    (ownerId !== "d6-system-2e" || !id.startsWith("system/"))
  ) {
    throw new Error(`Feature ${id} is outside the bundled system namespace.`);
  }
  if (
    value.source.kind === "world" &&
    (ownerId !== "world" || !id.startsWith("world/"))
  ) {
    throw new Error(`Feature ${id} is outside the world owner namespace.`);
  }
  if (!value.label.trim()) throw new Error(`Feature ${id} requires a label.`);
  const pointSamples =
    value.pointValue.kind === "exact"
      ? [value.pointValue.value]
      : value.pointValue.kind === "minimum"
        ? [value.pointValue.minimum]
        : value.pointValue.kind === "range"
          ? [value.pointValue.minimum, value.pointValue.maximum]
          : [...value.pointValue.values];
  if (pointSamples.length === 0) {
    throw new Error(`Feature ${id} has no point values.`);
  }
  for (const sample of pointSamples) {
    validateFeaturePointValue(value.pointValue, sample);
  }
  if (
    value.pointValue.kind === "range" &&
    value.pointValue.maximum < value.pointValue.minimum
  ) {
    throw new Error(`Feature ${id} has an inverted point-value range.`);
  }
  if (new Set(pointSamples).size !== pointSamples.length) {
    throw new Error(`Feature ${id} has duplicate point values.`);
  }
  for (const relatedId of [...value.prerequisites, ...value.conflicts]) {
    stable(relatedId, DEFINITION_ID, `Related feature ID for ${id}`);
  }
  if (
    value.actorTypes.length === 0 ||
    value.actorTypes.some((type) => !type.trim())
  ) {
    throw new Error(`Feature ${id} requires at least one Actor type.`);
  }
  for (const effect of value.effects) {
    if (
      !effect.id.trim() ||
      !effect.scope.trim() ||
      !Number.isSafeInteger(effect.value)
    ) {
      throw new Error(`Feature ${id} contains an invalid effect.`);
    }
  }
  return Object.freeze({
    ...structuredClone(value),
    actorTypes: Object.freeze([...value.actorTypes]),
    conflicts: Object.freeze([...value.conflicts]),
    effects: Object.freeze(
      value.effects.map((effect) => Object.freeze({ ...effect })),
    ),
    id,
    label: value.label.trim(),
    prerequisites: Object.freeze([...value.prerequisites]),
    source: Object.freeze({ ...value.source }),
  });
}

export const featureEconomyRegistry: D6System2eFeatureEconomyRegistry =
  Object.freeze({
    current: () => Object.freeze([...catalogs.values()]),
    register: (ownerId: string, value: D6FeatureCatalogV2) => {
      const owner = stable(ownerId, OWNER_ID, "Feature provider ID");
      if (!value.label.trim())
        throw new Error("Feature catalog requires a label.");
      const definitions = value.definitions.map((entry) =>
        normalizedDefinition(owner, entry),
      );
      if (
        new Set(definitions.map(({ id }) => id)).size !== definitions.length
      ) {
        throw new Error(`Feature catalog ${value.id} contains duplicate IDs.`);
      }
      const id = stable(value.id, OWNER_ID, "Feature catalog ID");
      const existing = catalogs.get(id);
      if (existing && existing.ownerId !== owner) {
        throw new Error(
          `Feature catalog ${id} is already owned by ${existing.ownerId}.`,
        );
      }
      catalogs.set(
        id,
        Object.freeze({
          definitions: Object.freeze(definitions),
          id,
          label: value.label.trim(),
          ownerId: owner,
          version: 2,
        }),
      );
    },
    unregisterOwner: (ownerId: string) => {
      for (const [id, catalog] of catalogs) {
        if (catalog.ownerId === ownerId) catalogs.delete(id);
      }
    },
  });

function registerBuiltInFreeD6Catalog(): void {
  const narrative = (id: string) =>
    Object.freeze([
      Object.freeze({
        id: `${id}.narrative`,
        kind: "narrative-only" as const,
        scope: "all-rolls",
        value: 0,
      }),
    ]);
  featureEconomyRegistry.register("d6-system-2e", {
    definitions: [
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("absolute-direction"),
        id: "system/free-d6-absolute-direction",
        label: "Absolute direction",
        pointValue: { kind: "exact", value: 2 },
        prerequisites: [],
        role: "merit",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("absolute-timing"),
        id: "system/free-d6-absolute-timing",
        label: "Absolute timing",
        pointValue: { kind: "exact", value: 1 },
        prerequisites: [],
        role: "merit",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("acute-hearing"),
        id: "system/free-d6-acute-hearing",
        label: "Acute hearing",
        pointValue: { kind: "choices", values: [3, 8] },
        prerequisites: [],
        role: "merit",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("combat-sense"),
        id: "system/free-d6-combat-sense",
        label: "Combat sense",
        pointValue: { kind: "exact", value: 3 },
        prerequisites: [],
        role: "merit",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("rapid-healing"),
        id: "system/free-d6-rapid-healing",
        label: "Rapid healing",
        pointValue: { kind: "exact", value: 3 },
        prerequisites: [],
        role: "merit",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("age-old"),
        id: "system/free-d6-age-old",
        label: "Age — old",
        pointValue: { kind: "exact", value: 3 },
        prerequisites: [],
        role: "flaw",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("allergy"),
        id: "system/free-d6-allergy",
        label: "Allergy",
        pointValue: { kind: "choices", values: [2, 4, 8] },
        prerequisites: [],
        role: "flaw",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("bad-hearing"),
        id: "system/free-d6-bad-hearing",
        label: "Bad hearing",
        pointValue: { kind: "exact", value: 3 },
        prerequisites: [],
        role: "flaw",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("bad-sight"),
        id: "system/free-d6-bad-sight",
        label: "Bad sight",
        pointValue: { kind: "choices", values: [3, 8] },
        prerequisites: [],
        role: "flaw",
        source: { kind: "bundled" },
        version: 1,
      },
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: narrative("blind"),
        id: "system/free-d6-blind",
        label: "Blind",
        pointValue: { kind: "exact", value: 18 },
        prerequisites: [],
        role: "flaw",
        source: { kind: "bundled" },
        version: 1,
      },
    ],
    id: "d6-system-2e.free-d6",
    label: "FreeD6 Player Book and GM Guide",
    version: 2,
  });
}

registerBuiltInFreeD6Catalog();

export function resolvedFeatureBenefitDefinition(
  definitionId: string,
): D6FeatureBenefitDefinitionV1 | null {
  for (const catalog of catalogs.values()) {
    const definition = catalog.definitions.find(
      ({ id }) => id === definitionId,
    );
    if (definition) return definition;
  }
  return null;
}

export function resetFeatureEconomyRegistryForTests(): void {
  catalogs.clear();
  registerBuiltInFreeD6Catalog();
}
