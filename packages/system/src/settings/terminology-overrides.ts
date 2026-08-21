import type {
  D6HealthDamageStrategyId,
  D6System2eTerminologyContribution,
} from "@d6-system-2e/core";

export const WORLD_TERMINOLOGY_SETTING = "worldTerminologyOverrides";

export interface TerminologyOverrideFieldDefinition {
  readonly defaultLabel: string;
  readonly group:
    | "attributes"
    | "actors"
    | "conditions"
    | "details"
    | "items"
    | "metaphysics"
    | "presentation"
    | "resources"
    | "machines";
  readonly label: string;
  readonly nameLabel?: string;
  readonly path: string;
  readonly plurality?: "plural" | "singular";
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

const ACTOR_DOCUMENT_FIELDS = Object.freeze(
  (
    ["character", "creature", "hideout", "npc", "starship", "vehicle"] as const
  ).flatMap((id) =>
    (["singular", "plural"] as const).map((plurality) => ({
      defaultLabel:
        plurality === "singular"
          ? `TYPES.Actor.${id}`
          : `D6E2.Settings.Terminology.Default.Actor.${id}.Plural`,
      group: "actors" as const,
      label: `D6E2.Settings.Terminology.Document.${plurality}`,
      nameLabel: `TYPES.Actor.${id}`,
      path: `actors.${id}.${plurality}`,
      plurality,
    })),
  ),
);

const ITEM_DOCUMENT_TYPES = Object.freeze([
  ["action", "action"],
  ["advancedSkill", "advanced-skill"],
  ["advantage", "advantage"],
  ["armor", "armor"],
  ["asset", "asset"],
  ["characterTemplate", "character-template"],
  ["cybernetic", "cybernetic"],
  ["disadvantage", "disadvantage"],
  ["flaw", "flaw"],
  ["gear", "gear"],
  ["group", "item-group"],
  ["manifestation", "manifestation"],
  ["perk", "perk"],
  ["skill", "skill"],
  ["specialization", "specialization"],
  ["speciesTemplate", "species-template"],
  ["starshipGear", "starship-gear"],
  ["starshipWeapon", "starship-weapon"],
  ["talent", "talent"],
  ["trouble", "trouble"],
  ["vehicle", "vehicle"],
  ["vehicleGear", "vehicle-gear"],
  ["vehicleWeapon", "vehicle-weapon"],
  ["weapon", "weapon"],
] as const);

const ITEM_DOCUMENT_FIELDS = Object.freeze(
  ITEM_DOCUMENT_TYPES.flatMap(([id, documentType]) =>
    (["singular", "plural"] as const).map((plurality) => ({
      defaultLabel:
        plurality === "singular"
          ? documentType === "advanced-skill"
            ? "D6E2.Item.AdvancedSkill"
            : `TYPES.Item.${documentType}`
          : `D6E2.Settings.Terminology.Default.Item.${id}.Plural`,
      group: "items" as const,
      label: `D6E2.Settings.Terminology.Document.${plurality}`,
      nameLabel:
        documentType === "advanced-skill"
          ? "D6E2.Item.AdvancedSkill"
          : `TYPES.Item.${documentType}`,
      path: `items.${id}.${plurality}`,
      plurality,
    })),
  ),
);

const SECOND_EDITION_CONDITION_FIELDS = Object.freeze([
  {
    defaultLabel: "D6E2.Combat.ConditionTrack",
    group: "conditions" as const,
    label: "D6E2.Settings.Terminology.ConditionTrack",
    path: "conditions.track",
  },
  ...(
    [
      ["healthy", "Healthy"],
      ["staggered", "Staggered"],
      ["stunned", "Stunned"],
      ["wounded", "Wounded"],
      ["incapacitated", "Incapacitated"],
      ["mortallyWounded", "MortallyWounded"],
      ["dead", "Dead"],
    ] as const
  ).map(([id, key]) => ({
    defaultLabel: `D6E2.Condition.${key}`,
    group: "conditions" as const,
    label: `D6E2.Condition.${key}`,
    path: `conditions.states.${id}`,
  })),
]);

const FIRST_EDITION_WOUND_FIELDS = Object.freeze([
  {
    defaultLabel: "D6E2.Combat.FirstEdition.WoundTrack",
    group: "conditions" as const,
    label: "D6E2.Settings.Terminology.ConditionTrack",
    path: "wounds.track",
  },
  ...(
    [
      ["healthy", "Healthy"],
      ["stunned", "Stunned"],
      ["wounded", "Wounded"],
      ["severelyWounded", "SeverelyWounded"],
      ["incapacitated", "Incapacitated"],
      ["mortallyWounded", "MortallyWounded"],
      ["dead", "Dead"],
    ] as const
  ).map(([id, key]) => ({
    defaultLabel: `D6E2.Condition.${key}`,
    group: "conditions" as const,
    label: `D6E2.Condition.${key}`,
    path: `wounds.states.${id}`,
  })),
]);

const FIRST_EDITION_BODY_POINT_FIELDS = Object.freeze([
  {
    defaultLabel: "D6E2.Combat.FirstEdition.BodyPoints.Track",
    group: "conditions" as const,
    label: "D6E2.Settings.Terminology.ConditionTrack",
    path: "bodyPoints.track",
  },
  {
    defaultLabel: "D6E2.Combat.FirstEdition.BodyPoints.Current",
    group: "conditions" as const,
    label: "D6E2.Settings.Terminology.BodyPointCurrent",
    path: "bodyPoints.current",
  },
  {
    defaultLabel: "D6E2.Combat.FirstEdition.BodyPoints.Maximum",
    group: "conditions" as const,
    label: "D6E2.Settings.Terminology.BodyPointMaximum",
    path: "bodyPoints.maximum",
  },
]);

export function healthTerminologyOverrideFields(
  strategyId: D6HealthDamageStrategyId,
): readonly TerminologyOverrideFieldDefinition[] {
  if (strategyId === "d6e2.damage.conditions") {
    return SECOND_EDITION_CONDITION_FIELDS;
  }
  if (strategyId === "open-d6.damage.body-points") {
    return FIRST_EDITION_BODY_POINT_FIELDS;
  }
  return FIRST_EDITION_WOUND_FIELDS;
}

export function healthTerminologyGroupLabel(
  strategyId: D6HealthDamageStrategyId,
): string {
  if (strategyId === "d6e2.damage.conditions") {
    return "D6E2.Settings.Terminology.Conditions";
  }
  if (strategyId === "open-d6.damage.body-points") {
    return "D6E2.Settings.Terminology.BodyPoints";
  }
  return "D6E2.Settings.Terminology.Wounds";
}

export function settingProfileTerminologyFields(
  strategyId: D6HealthDamageStrategyId,
): readonly TerminologyOverrideFieldDefinition[] {
  return Object.freeze([
    ...TERMINOLOGY_OVERRIDE_FIELDS.filter(
      ({ group }) => group !== "conditions",
    ),
    ...healthTerminologyOverrideFields(strategyId),
  ]);
}

export const TERMINOLOGY_OVERRIDE_FIELDS: readonly TerminologyOverrideFieldDefinition[] =
  Object.freeze([
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.SystemLabel",
      group: "presentation",
      label: "D6E2.Settings.Terminology.SystemLabel",
      path: "systemLabel",
    },
    {
      defaultLabel: "D6E2.Settings.Terminology.Default.CharacterSheetLabel",
      group: "presentation",
      label: "D6E2.Settings.Terminology.CharacterSheetLabel",
      path: "characterSheetLabel",
    },
    ...ACTOR_DOCUMENT_FIELDS,
    ...SECOND_EDITION_CONDITION_FIELDS,
    ...FIRST_EDITION_WOUND_FIELDS,
    ...FIRST_EDITION_BODY_POINT_FIELDS,
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
      defaultLabel: "D6E2.ExperiencePoints",
      group: "resources",
      label: "D6E2.ExperiencePoints",
      path: "resources.experiencePoints",
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
      label: "D6E2.Settings.Terminology.Currency",
      path: "details.currency",
    },
    {
      defaultLabel: "D6E2.Item.SpecialAbility",
      group: "metaphysics",
      label: "D6E2.Item.SpecialAbility",
      path: "items.specialAbility",
    },
    ...ITEM_DOCUMENT_FIELDS,
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
      defaultLabel: "D6E2.Attribute.Extranormal",
      group: "metaphysics",
      label: "D6E2.Settings.Terminology.MetaphysicsExtranormal",
      path: "metaphysics.extranormal",
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

export function mergeTerminologyOverrideEntries(
  current: D6System2eTerminologyContribution,
  entries: Iterable<readonly [string, unknown]>,
): D6System2eTerminologyContribution {
  const allowed = new Set(TERMINOLOGY_OVERRIDE_FIELDS.map(({ path }) => path));
  const values = new Map(
    TERMINOLOGY_OVERRIDE_FIELDS.flatMap(({ path }) => {
      const value = terminologyOverrideValue(current, path);
      return value ? ([[path, value]] as const) : [];
    }),
  );
  for (const [path, rawValue] of entries) {
    if (!allowed.has(path) || typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (value) values.set(path, value);
    else values.delete(path);
  }
  return terminologyOverridesFromEntries(values);
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
