import {
  secondEditionInitiativeStrategy,
  type SecondEditionInitiativeStrategy,
} from "@d6-system-2e/core";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";
import { stringSetting } from "./setting-values";
import { currentConfiguredRulesProfile } from "./rules-profile-library";

export type D6InitiativeRuntimeStrategyId =
  | "d6e2.initiative.basic"
  | "d6e2.initiative.contextual"
  | "d6e2.initiative.narrative"
  | "d6e2.initiative.simple"
  | "d6mv.initiative.side-readiness"
  | "open-d6.initiative.perception";

export interface D6InitiativeRuntimeStrategy {
  readonly family:
    "basic" | "contextual" | "d6mv" | "narrative" | "perception" | "simple";
  readonly id: D6InitiativeRuntimeStrategyId;
  readonly ordering: "manual" | "rolled-descending";
  readonly roll: "foundry-formula" | "none" | "system-attribute";
  readonly roundTransition:
    "clear-rolled-totals" | "preserve" | "rotate-narrative-order";
  readonly tracker: "declaration" | "foundry" | "manual" | "narrative";
}

const INITIATIVE_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.initiative.basic": Object.freeze({
    family: "basic",
    id: "d6e2.initiative.basic",
    ordering: "rolled-descending",
    roll: "system-attribute",
    roundTransition: "clear-rolled-totals",
    tracker: "declaration",
  }),
  "d6e2.initiative.contextual": Object.freeze({
    family: "contextual",
    id: "d6e2.initiative.contextual",
    ordering: "manual",
    roll: "none",
    roundTransition: "preserve",
    tracker: "manual",
  }),
  "d6e2.initiative.narrative": Object.freeze({
    family: "narrative",
    id: "d6e2.initiative.narrative",
    ordering: "manual",
    roll: "system-attribute",
    roundTransition: "rotate-narrative-order",
    tracker: "narrative",
  }),
  "d6e2.initiative.simple": Object.freeze({
    family: "simple",
    id: "d6e2.initiative.simple",
    ordering: "manual",
    roll: "none",
    roundTransition: "preserve",
    tracker: "manual",
  }),
  "open-d6.initiative.perception": Object.freeze({
    family: "perception",
    id: "open-d6.initiative.perception",
    ordering: "rolled-descending",
    roll: "foundry-formula",
    roundTransition: "preserve",
    tracker: "foundry",
  }),
  "d6mv.initiative.side-readiness": Object.freeze({
    family: "d6mv",
    id: "d6mv.initiative.side-readiness",
    ordering: "rolled-descending",
    roll: "system-attribute",
    roundTransition: "clear-rolled-totals",
    tracker: "foundry",
  }),
} as const satisfies Readonly<
  Record<D6InitiativeRuntimeStrategyId, D6InitiativeRuntimeStrategy>
>);

export function configuredSecondEditionInitiativeStrategy(): SecondEditionInitiativeStrategy {
  return secondEditionInitiativeStrategy(
    stringSetting(SECOND_EDITION_OPTION_KEYS.initiativeStrategy, "standard"),
  );
}

function secondEditionRuntimeId(
  strategy: SecondEditionInitiativeStrategy,
): D6InitiativeRuntimeStrategyId {
  return strategy === "standard"
    ? "d6e2.initiative.contextual"
    : strategy === "simple"
      ? "d6e2.initiative.simple"
      : strategy === "basic"
        ? "d6e2.initiative.basic"
        : "d6e2.initiative.narrative";
}

export function initiativeRuntimeStrategy(
  strategyId: string,
  configuredSecondEdition: SecondEditionInitiativeStrategy = configuredSecondEditionInitiativeStrategy(),
): D6InitiativeRuntimeStrategy {
  const concreteId =
    strategyId === "d6e2.initiative.contextual"
      ? secondEditionRuntimeId(configuredSecondEdition)
      : strategyId;
  const resolved = Object.values(INITIATIVE_RUNTIME_STRATEGIES).find(
    ({ id }) => id === concreteId,
  );
  return (
    resolved ??
    INITIATIVE_RUNTIME_STRATEGIES[
      secondEditionRuntimeId(configuredSecondEdition)
    ]
  );
}

export function currentInitiativeRuntimeStrategy(): D6InitiativeRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.initiative;
  return initiativeRuntimeStrategy(configured);
}

export function currentSecondEditionInitiativeStrategy(): SecondEditionInitiativeStrategy {
  const family = currentInitiativeRuntimeStrategy().family;
  return family === "perception" || family === "contextual" || family === "d6mv"
    ? "standard"
    : family;
}
