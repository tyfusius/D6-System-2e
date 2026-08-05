import type { D6System2eTerminologyContribution } from "@d6-system-2e/core";

export const WORLD_TERMINOLOGY_SETTING = "worldTerminologyOverrides";

export interface TerminologyOverrideFieldDefinition {
  readonly defaultLabel: string;
  readonly group:
    "attributes" | "details" | "metaphysics" | "resources" | "machines";
  readonly label: string;
  readonly path: string;
}

const attributeIds = Object.freeze([
  "agility",
  "acumen",
  "brawn",
  "charisma",
  "charm",
  "coordination",
  "extranormal",
  "intellect",
  "knowledge",
  "magic",
  "mechanical",
  "mysticism",
  "perception",
  "physique",
  "presence",
  "reflexes",
  "technical",
] as const);

const attributeName = (id: string): string =>
  `${id[0]?.toUpperCase() ?? ""}${id.slice(1)}`;

export const TERMINOLOGY_OVERRIDE_FIELDS: readonly TerminologyOverrideFieldDefinition[] =
  Object.freeze([
    ...attributeIds.map((id) => ({
      defaultLabel: `D6E2.Attribute.${attributeName(id)}`,
      group: "attributes" as const,
      label: `D6E2.Attribute.${attributeName(id)}`,
      path: `attributes.${id}`,
    })),
    {
      defaultLabel: "D6E2.HeroPoints",
      group: "resources",
      label: "D6E2.HeroPoints",
      path: "resources.heroPoints",
    },
    {
      defaultLabel: "D6E2.CharacterPoints",
      group: "resources",
      label: "D6E2.CharacterPoints",
      path: "resources.characterPoints",
    },
    {
      defaultLabel: "D6E2.FatePoints",
      group: "resources",
      label: "D6E2.FatePoints",
      path: "resources.fatePoints",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Allegiance",
      group: "details",
      label: "D6E2.Settings.Terminology.Default.Allegiance",
      path: "details.allegiance",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Currency",
      group: "details",
      label: "D6E2.Settings.Terminology.Default.Currency",
      path: "details.currency",
    },
    {
      defaultLabel: "D6E2.Item.SpecialAbility",
      group: "metaphysics",
      label: "D6E2.Item.SpecialAbility",
      path: "items.specialAbility",
    },
    {
      defaultLabel: "D6E2.Item.Manifestation",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.ManifestationSingular",
      path: "manifestations.singular",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Manifestations",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.ManifestationPlural",
      path: "manifestations.plural",
    },
    {
      defaultLabel: "D6E2.Attribute.Mysticism",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.MetaphysicsAttribute",
      path: "metaphysics.attribute",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Channel",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.Channel",
      path: "metaphysics.skills.channel",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Sense",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.Sense",
      path: "metaphysics.skills.sense",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.Transform",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.Transform",
      path: "metaphysics.skills.transform",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.InterstellarDrive",
      group: "machines",
      label: "D6E2.Settings.Terminology.Default.InterstellarDrive",
      path: "machines.interstellarDrive",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.StarshipToughness",
      group: "machines",
      label: "D6E2.Settings.Terminology.Default.StarshipToughness",
      path: "machines.starshipToughness",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.VehicleToughness",
      group: "machines",
      label: "D6E2.Settings.Terminology.Default.VehicleToughness",
      path: "machines.vehicleToughness",
    },
  ]);

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function terminologyOverrideValue(
  contribution: D6System2eTerminologyContribution,
  path: string,
): string {
  let value: unknown = contribution;
  for (const segment of path.split(".")) value = record(value)[segment];
  return typeof value === "string" ? value : "";
}

export function terminologyOverridesFromEntries(
  entries: Iterable<readonly [string, unknown]>,
): D6System2eTerminologyContribution {
  const root: Record<string, unknown> = {};
  const allowed = new Set(TERMINOLOGY_OVERRIDE_FIELDS.map(({ path }) => path));
  for (const [path, rawValue] of entries) {
    if (!allowed.has(path) || typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (value.length === 0) continue;
    const segments = path.split(".");
    let destination = root;
    for (const segment of segments.slice(0, -1)) {
      const child = record(destination[segment]);
      destination[segment] = child;
      destination = child;
    }
    const leaf = segments.at(-1);
    if (leaf) destination[leaf] = value;
  }
  return root;
}

export function normalizeStoredTerminologyOverrides(
  value: unknown,
): D6System2eTerminologyContribution {
  const stored = record(value);
  return terminologyOverridesFromEntries(
    TERMINOLOGY_OVERRIDE_FIELDS.map(
      ({ path }) =>
        [
          path,
          terminologyOverrideValue(
            stored as D6System2eTerminologyContribution,
            path,
          ),
        ] as const,
    ),
  );
}
