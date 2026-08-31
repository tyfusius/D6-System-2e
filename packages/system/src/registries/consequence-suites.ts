import {
  type D6ConsequenceSuiteV1,
  type D6System2eConsequenceSuiteRegistry,
} from "@d6-system-2e/core";

const OWNER_ID = /^[a-z][a-z0-9.-]*$/;
const PORTABLE_ID = /^[a-z][a-z0-9.-]*(?:\.[a-z0-9-]+)+$/;

interface OwnedSuite extends D6ConsequenceSuiteV1 {
  readonly ownerId: string;
}

const suites = new Map<string, OwnedSuite>();

function portableId(value: string, label: string): string {
  const normalized = value.trim();
  if (!PORTABLE_ID.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}

function normalizeSuite(
  ownerId: string,
  value: D6ConsequenceSuiteV1,
): OwnedSuite {
  const id = portableId(value.id, "Consequence suite ID");
  if (!value.label.trim())
    throw new Error(`Consequence suite ${id} requires a label.`);
  if (value.channels.length === 0) {
    throw new Error(`Consequence suite ${id} requires at least one channel.`);
  }
  const channels = value.channels.map((channel) =>
    Object.freeze({
      ...channel,
      id: portableId(channel.id, "Consequence channel ID"),
      label: channel.label.trim(),
    }),
  );
  if (
    new Set(channels.map(({ id: channelId }) => channelId)).size !==
    channels.length
  ) {
    throw new Error(`Consequence suite ${id} contains duplicate channel IDs.`);
  }
  return Object.freeze({
    ...structuredClone(value),
    channels: Object.freeze(channels),
    id,
    label: value.label.trim(),
    ownerId,
  });
}

export const consequenceSuiteRegistry: D6System2eConsequenceSuiteRegistry =
  Object.freeze({
    current: () => Object.freeze([...suites.values()]),
    register: (ownerId: string, value: D6ConsequenceSuiteV1) => {
      const owner = ownerId.trim();
      if (!OWNER_ID.test(owner))
        throw new Error("Consequence provider ID is invalid.");
      const normalized = normalizeSuite(owner, value);
      const existing = suites.get(normalized.id);
      if (existing && existing.ownerId !== owner) {
        throw new Error(
          `Consequence suite ${normalized.id} is already owned by ${existing.ownerId}.`,
        );
      }
      suites.set(normalized.id, normalized);
    },
    unregisterOwner: (ownerId: string) => {
      for (const [id, suite] of suites) {
        if (suite.ownerId === ownerId) suites.delete(id);
      }
    },
  });

function registerBuiltInSuites(): void {
  consequenceSuiteRegistry.register("d6-system-2e", {
    channels: [
      {
        id: "d6e2.consequence.physical",
        kind: "physical-health",
        label: "Physical injury",
        penaltyStrategyId: "d6e2.health-model",
        recoveryStrategyId: "d6e2.health-model",
        resolutionStrategyId: "d6e2.health-model",
        terminalStrategyId: "d6e2.health-model",
      },
    ],
    id: "d6e2.consequences.physical-only",
    label: "Physical injury",
    stackingStrategyId: "d6e2.consequences.sum",
    version: 1,
  });
  consequenceSuiteRegistry.register("d6-system-2e", {
    channels: [
      {
        id: "d6e2.consequence.physical",
        kind: "physical-health",
        label: "Physical injury",
        penaltyStrategyId: "d6e2.health-model",
        recoveryStrategyId: "d6e2.health-model",
        resolutionStrategyId: "d6e2.health-model",
        terminalStrategyId: "d6e2.health-model",
      },
      {
        id: "free-d6.consequence.fatigue",
        kind: "counter",
        label: "Fatigue",
        penaltyStrategyId: "free-d6.fatigue.one-die-per-level",
        recoveryStrategyId: "free-d6.fatigue.independent",
        resolutionStrategyId: "free-d6.fatigue.stamina-or-willpower",
        terminalStrategyId: "free-d6.fatigue.unconscious-over-threshold",
      },
    ],
    id: "free-d6.consequences.physical-and-fatigue",
    label: "Physical injury and Fatigue",
    stackingStrategyId: "d6e2.consequences.sum",
    version: 1,
  });
}

registerBuiltInSuites();

export function resolvedConsequenceSuite(
  id: string,
): D6ConsequenceSuiteV1 | null {
  return suites.get(id) ?? null;
}

export function resetConsequenceSuiteRegistryForTests(): void {
  suites.clear();
  registerBuiltInSuites();
}
