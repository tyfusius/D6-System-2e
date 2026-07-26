import type {
  D6System2eResolvedTerminology,
  D6System2eTerminologyContribution,
  D6System2eTerminologyRegistry,
} from "@d6-system-2e/core";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const contributions = new Map<string, D6System2eTerminologyContribution>();

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
  const characterSheetLabel = label(
    contribution.characterSheetLabel,
    "characterSheetLabel",
  );
  const systemLabel = label(contribution.systemLabel, "systemLabel");
  return Object.freeze({
    attributes: Object.freeze(attributes),
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
    resources: Object.freeze(resources),
    ...(systemLabel ? { systemLabel } : {}),
  });
}

export function currentTerminology(): D6System2eResolvedTerminology {
  let attributes: Readonly<Record<string, string>> = {};
  let resources: D6System2eResolvedTerminology["resources"] = {};
  let characterSheetLabel: string | undefined;
  let systemLabel: string | undefined;
  for (const contribution of contributions.values()) {
    attributes = { ...attributes, ...contribution.attributes };
    resources = { ...resources, ...contribution.resources };
    characterSheetLabel =
      contribution.characterSheetLabel ?? characterSheetLabel;
    systemLabel = contribution.systemLabel ?? systemLabel;
  }
  return Object.freeze({
    attributes: Object.freeze(attributes),
    ...(characterSheetLabel ? { characterSheetLabel } : {}),
    resources: Object.freeze(resources),
    ...(systemLabel ? { systemLabel } : {}),
  });
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
}
