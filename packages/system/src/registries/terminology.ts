import type {
  D6System2eResolvedTerminology,
  D6System2eTerminologyContribution,
  D6System2eTerminologyRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const contributions = new Map<string, D6System2eTerminologyContribution>();
let settingProfileContribution: D6System2eTerminologyContribution =
  Object.freeze({});
let rulesProfileContribution: D6System2eTerminologyContribution = Object.freeze(
  {},
);
let worldOverrides: D6System2eTerminologyContribution = Object.freeze({});

function label(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Terminology field "${field}" requires a label.`);
  }
  return value.trim();
}

function normalize(
  ownerId: string,
  contribution: D6System2eTerminologyContribution,
): D6System2eTerminologyContribution {
  if (!ID_PATTERN.test(ownerId)) {
    throw new TypeError(`Terminology owner id "${ownerId}" is invalid.`);
  }
  const attributes = Object.fromEntries(
    Object.entries(contribution.attributes ?? {}).map(([id, value]) => {
      if (!ID_PATTERN.test(id)) {
        throw new TypeError(`Terminology attribute id "${id}" is invalid.`);
      }
      return [id, label(value, `attributes.${id}`)];
    }),
  ) as Readonly<Record<string, string>>;
  const resources = Object.fromEntries(
    Object.entries(contribution.resources ?? {}).flatMap(([id, value]) => {
      const normalized = label(value, `resources.${id}`);
      return normalized ? [[id, normalized]] : [];
    }),
  );
  const conditionStates = Object.fromEntries(
    Object.entries(contribution.conditions?.states ?? {}).flatMap(
      ([id, value]) => {
        const normalized = label(value, `conditions.states.${id}`);
        return normalized ? [[id, normalized]] : [];
      },
    ),
  );
  const conditionTrack = label(
    contribution.conditions?.track,
    "conditions.track",
  );
  const conditions = Object.freeze({
    states: Object.freeze(conditionStates),
    ...(conditionTrack ? { track: conditionTrack } : {}),
  });
  const woundStates = Object.fromEntries(
    Object.entries(contribution.wounds?.states ?? {}).flatMap(([id, value]) => {
      const normalized = label(value, `wounds.states.${id}`);
      return normalized ? [[id, normalized]] : [];
    }),
  );
  const woundTrack = label(contribution.wounds?.track, "wounds.track");
  const wounds = Object.freeze({
    states: Object.freeze(woundStates),
    ...(woundTrack ? { track: woundTrack } : {}),
  });
  const bodyPointTrack = label(
    contribution.bodyPoints?.track,
    "bodyPoints.track",
  );
  const bodyPointCurrent = label(
    contribution.bodyPoints?.current,
    "bodyPoints.current",
  );
  const bodyPointMaximum = label(
    contribution.bodyPoints?.maximum,
    "bodyPoints.maximum",
  );
  const bodyPoints = Object.freeze({
    ...(bodyPointTrack ? { track: bodyPointTrack } : {}),
    ...(bodyPointCurrent ? { current: bodyPointCurrent } : {}),
    ...(bodyPointMaximum ? { maximum: bodyPointMaximum } : {}),
  });
  const allegiance = label(
    contribution.details?.allegiance,
    "details.allegiance",
  );
  const currency = label(contribution.details?.currency, "details.currency");
  const details = Object.freeze({
    ...(allegiance ? { allegiance } : {}),
    ...(currency ? { currency } : {}),
  });
  const interstellarDrive = label(
    contribution.machines?.interstellarDrive,
    "machines.interstellarDrive",
  );
  const starshipToughness = label(
    contribution.machines?.starshipToughness,
    "machines.starshipToughness",
  );
  const vehicleToughness = label(
    contribution.machines?.vehicleToughness,
    "machines.vehicleToughness",
  );
  const machines = Object.freeze({
    ...(interstellarDrive ? { interstellarDrive } : {}),
    ...(starshipToughness ? { starshipToughness } : {}),
    ...(vehicleToughness ? { vehicleToughness } : {}),
  });
  const manifestationPlural = label(
    contribution.manifestations?.plural,
    "manifestations.plural",
  );
  const manifestationSingular = label(
    contribution.manifestations?.singular,
    "manifestations.singular",
  );
  const manifestations = Object.freeze({
    ...(manifestationPlural ? { plural: manifestationPlural } : {}),
    ...(manifestationSingular ? { singular: manifestationSingular } : {}),
  });
  const specialAbility = label(
    contribution.items?.specialAbility,
    "items.specialAbility",
  );
  const items = Object.freeze({
    ...(specialAbility ? { specialAbility } : {}),
  });
  const channel = label(
    contribution.metaphysics?.skills?.channel,
    "metaphysics.skills.channel",
  );
  const sense = label(
    contribution.metaphysics?.skills?.sense,
    "metaphysics.skills.sense",
  );
  const transform = label(
    contribution.metaphysics?.skills?.transform,
    "metaphysics.skills.transform",
  );
  const metaphysicsSkills = Object.freeze({
    ...(channel ? { channel } : {}),
    ...(sense ? { sense } : {}),
    ...(transform ? { transform } : {}),
  });
  const metaphysicsAttribute = label(
    contribution.metaphysics?.attribute,
    "metaphysics.attribute",
  );
  const metaphysicsExtranormal = label(
    contribution.metaphysics?.extranormal,
    "metaphysics.extranormal",
  );
  const metaphysics = Object.freeze({
    ...(metaphysicsAttribute ? { attribute: metaphysicsAttribute } : {}),
    ...(metaphysicsExtranormal ? { extranormal: metaphysicsExtranormal } : {}),
    skills: metaphysicsSkills,
  });
  const characterSheetLabel = label(
    contribution.characterSheetLabel,
    "characterSheetLabel",
  );
  const systemLabel = label(contribution.systemLabel, "systemLabel");
  return Object.freeze({
    attributes: Object.freeze(attributes),
    bodyPoints,
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
    conditions,
    details,
    items,
    machines,
    manifestations,
    metaphysics,
    resources: Object.freeze(resources),
    ...(systemLabel ? { systemLabel } : {}),
    wounds,
  });
}

function resolveTerminology(
  resolvedContributions: readonly D6System2eTerminologyContribution[],
): D6System2eResolvedTerminology {
  let attributes: Readonly<Record<string, string>> = {};
  let conditions: D6System2eResolvedTerminology["conditions"] = { states: {} };
  let wounds: D6System2eResolvedTerminology["wounds"] = { states: {} };
  let bodyPoints: D6System2eResolvedTerminology["bodyPoints"] = {};
  let details: D6System2eResolvedTerminology["details"] = {};
  let machines: D6System2eResolvedTerminology["machines"] = {};
  let manifestations: D6System2eResolvedTerminology["manifestations"] = {};
  let items: D6System2eResolvedTerminology["items"] = {};
  let metaphysics: D6System2eResolvedTerminology["metaphysics"] = {
    skills: {},
  };
  let resources: D6System2eResolvedTerminology["resources"] = {};
  let characterSheetLabel: string | undefined;
  let systemLabel: string | undefined;
  for (const contribution of resolvedContributions) {
    attributes = { ...attributes, ...contribution.attributes };
    conditions = {
      ...conditions,
      ...contribution.conditions,
      states: { ...conditions.states, ...contribution.conditions?.states },
    };
    wounds = {
      ...wounds,
      ...contribution.wounds,
      states: { ...wounds.states, ...contribution.wounds?.states },
    };
    bodyPoints = { ...bodyPoints, ...contribution.bodyPoints };
    details = { ...details, ...contribution.details };
    machines = { ...machines, ...contribution.machines };
    manifestations = { ...manifestations, ...contribution.manifestations };
    items = { ...items, ...contribution.items };
    metaphysics = {
      ...metaphysics,
      ...contribution.metaphysics,
      skills: { ...metaphysics.skills, ...contribution.metaphysics?.skills },
    };
    resources = { ...resources, ...contribution.resources };
    characterSheetLabel =
      contribution.characterSheetLabel ?? characterSheetLabel;
    systemLabel = contribution.systemLabel ?? systemLabel;
  }
  return Object.freeze({
    attributes: Object.freeze(attributes),
    bodyPoints: Object.freeze(bodyPoints),
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
    conditions: Object.freeze({
      ...conditions,
      states: Object.freeze(conditions.states),
    }),
    details: Object.freeze(details),
    items: Object.freeze(items),
    machines: Object.freeze(machines),
    manifestations: Object.freeze(manifestations),
    metaphysics: Object.freeze({
      ...metaphysics,
      skills: Object.freeze(metaphysics.skills),
    }),
    resources: Object.freeze(resources),
    ...(systemLabel ? { systemLabel } : {}),
    wounds: Object.freeze({
      ...wounds,
      states: Object.freeze(wounds.states),
    }),
  });
}

export function currentPackageTerminology(): D6System2eResolvedTerminology {
  return resolveTerminology([...contributions.values()]);
}

export function currentTerminology(): D6System2eResolvedTerminology {
  return resolveTerminology([
    ...contributions.values(),
    rulesProfileContribution,
    settingProfileContribution,
    worldOverrides,
  ]);
}

export function setRulesProfileTerminology(
  contribution: D6System2eTerminologyContribution,
): void {
  rulesProfileContribution = normalize("rules-profile", contribution);
}

export function setSettingProfileTerminology(
  contribution: D6System2eTerminologyContribution,
): void {
  settingProfileContribution = normalize("setting-profile", contribution);
}

export function terminologyAttributeLabel(
  terminology: D6System2eResolvedTerminology,
  attributeId: string,
): string | undefined {
  return (
    terminology.attributes[attributeId] ??
    (attributeId === "extranormal"
      ? terminology.metaphysics.attribute
      : undefined)
  );
}

const CONDITION_KEY_BY_ID = Object.freeze({
  dead: "Dead",
  healthy: "Healthy",
  incapacitated: "Incapacitated",
  "mortally-wounded": "MortallyWounded",
  staggered: "Staggered",
  stunned: "Stunned",
  wounded: "Wounded",
} as const);

export type SecondEditionConditionId = keyof typeof CONDITION_KEY_BY_ID;

const WOUND_KEY_BY_ID = Object.freeze({
  dead: "Dead",
  healthy: "Healthy",
  incapacitated: "Incapacitated",
  "mortally-wounded": "MortallyWounded",
  "severely-wounded": "SeverelyWounded",
  stunned: "Stunned",
  wounded: "Wounded",
} as const);

export type FirstEditionWoundId = keyof typeof WOUND_KEY_BY_ID;
export type HealthTerminologyStrategyId =
  | "d6e2.damage.conditions"
  | "open-d6.damage.body-points"
  | "open-d6.damage.body-points-with-wounds"
  | "open-d6.damage.wounds";

export function terminologyConditionLabel(
  terminology: D6System2eResolvedTerminology,
  conditionId: SecondEditionConditionId,
): string {
  const property =
    conditionId === "mortally-wounded" ? "mortallyWounded" : conditionId;
  return (
    terminology.conditions.states[property] ??
    game.i18n.localize(`D6E2.Condition.${CONDITION_KEY_BY_ID[conditionId]}`)
  );
}

export function terminologyConditionTrackLabel(
  terminology: D6System2eResolvedTerminology,
): string {
  return (
    terminology.conditions.track ??
    game.i18n.localize("D6E2.Combat.ConditionTrack")
  );
}

export function terminologyWoundLabel(
  terminology: D6System2eResolvedTerminology,
  woundId: FirstEditionWoundId,
): string {
  const property =
    woundId === "mortally-wounded"
      ? "mortallyWounded"
      : woundId === "severely-wounded"
        ? "severelyWounded"
        : woundId;
  return (
    terminology.wounds.states[property] ??
    game.i18n.localize(`D6E2.Condition.${WOUND_KEY_BY_ID[woundId]}`)
  );
}

export function terminologyHealthStateLabel(
  terminology: D6System2eResolvedTerminology,
  strategyId: HealthTerminologyStrategyId,
  stateId: SecondEditionConditionId | FirstEditionWoundId,
): string {
  return strategyId === "d6e2.damage.conditions"
    ? terminologyConditionLabel(
        terminology,
        stateId as SecondEditionConditionId,
      )
    : terminologyWoundLabel(terminology, stateId as FirstEditionWoundId);
}

export function terminologyHealthTrackLabel(
  terminology: D6System2eResolvedTerminology,
  strategyId: HealthTerminologyStrategyId,
): string {
  if (strategyId === "d6e2.damage.conditions") {
    return terminologyConditionTrackLabel(terminology);
  }
  if (strategyId === "open-d6.damage.body-points") {
    return (
      terminology.bodyPoints.track ??
      game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.Track")
    );
  }
  return (
    terminology.wounds.track ??
    game.i18n.localize("D6E2.Combat.FirstEdition.WoundTrack")
  );
}

export function terminologyBodyPointLabel(
  terminology: D6System2eResolvedTerminology,
  field: "current" | "maximum",
): string {
  return (
    terminology.bodyPoints[field] ??
    game.i18n.localize(
      field === "current"
        ? "D6E2.Combat.FirstEdition.BodyPoints.Current"
        : "D6E2.Combat.FirstEdition.BodyPoints.Maximum",
    )
  );
}

export function setWorldTerminologyOverrides(
  contribution: D6System2eTerminologyContribution,
): void {
  worldOverrides = normalize("world-terminology", contribution);
}

export const terminologyRegistry: D6System2eTerminologyRegistry = Object.freeze(
  {
    current: currentTerminology,
    register: (
      ownerId: string,
      contribution: D6System2eTerminologyContribution,
    ) => {
      contributions.set(ownerId, normalize(ownerId, contribution));
    },
    unregisterOwner: (ownerId: string) => {
      contributions.delete(ownerId);
    },
  },
);

export function resetTerminologyRegistryForTests(): void {
  contributions.clear();
  rulesProfileContribution = Object.freeze({});
  settingProfileContribution = Object.freeze({});
  worldOverrides = Object.freeze({});
}
