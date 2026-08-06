import type {
  D6System2eResolvedTerminology,
  D6System2eTerminologyContribution,
  D6System2eTerminologyRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const contributions = new Map<string, D6System2eTerminologyContribution>();
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
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
    details,
    items,
    machines,
    manifestations,
    metaphysics,
    resources: Object.freeze(resources),
    ...(systemLabel ? { systemLabel } : {}),
  });
}

function resolveTerminology(
  resolvedContributions: readonly D6System2eTerminologyContribution[],
): D6System2eResolvedTerminology {
  let attributes: Readonly<Record<string, string>> = {};
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
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
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
  });
}

export function currentPackageTerminology(): D6System2eResolvedTerminology {
  return resolveTerminology([...contributions.values()]);
}

export function currentTerminology(): D6System2eResolvedTerminology {
  return resolveTerminology([...contributions.values(), worldOverrides]);
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
  worldOverrides = Object.freeze({});
}
