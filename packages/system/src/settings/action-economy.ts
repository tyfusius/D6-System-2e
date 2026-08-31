import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "./settings-catalog";
import { booleanSetting } from "./setting-values";
import { currentConfiguredRulesProfile } from "./rules-profile-library";

export type D6ActionEconomyRuntimeStrategyId =
  | "d6e2.action-economy.segmented"
  | "d6mv.action-economy.quick-basic-slow"
  | "open-d6.action-economy.flexible"
  | "open-d6.action-economy.segmented";

export interface D6ActionEconomyRuntimeStrategy {
  readonly actionCountLabel: "actions" | "action-total";
  readonly declaration: "action-commitment" | "ordered-actions";
  readonly family: "d6mv" | "flexible" | "segmented";
  readonly freshWound: "forfeit-remaining" | "preserve-actions";
  readonly id: D6ActionEconomyRuntimeStrategyId;
  readonly penalty:
    "declared-actions-minus-one" | "planned-actions-minus-allotment";
  readonly reaction: "declared-only" | "triggered-interrupt";
  readonly roundTransition: "reset-round-state";
  readonly turnScheduling:
    "combatant-action-order" | "free-commitment" | "round-robin-segments";
}

const ACTION_ECONOMY_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.action-economy.segmented": Object.freeze({
    actionCountLabel: "actions",
    declaration: "ordered-actions",
    family: "segmented",
    freshWound: "forfeit-remaining",
    id: "d6e2.action-economy.segmented",
    penalty: "declared-actions-minus-one",
    reaction: "declared-only",
    roundTransition: "reset-round-state",
    turnScheduling: "combatant-action-order",
  }),
  "open-d6.action-economy.flexible": Object.freeze({
    actionCountLabel: "action-total",
    declaration: "action-commitment",
    family: "flexible",
    freshWound: "preserve-actions",
    id: "open-d6.action-economy.flexible",
    penalty: "planned-actions-minus-allotment",
    reaction: "triggered-interrupt",
    roundTransition: "reset-round-state",
    turnScheduling: "free-commitment",
  }),
  "open-d6.action-economy.segmented": Object.freeze({
    actionCountLabel: "action-total",
    declaration: "action-commitment",
    family: "flexible",
    freshWound: "preserve-actions",
    id: "open-d6.action-economy.segmented",
    penalty: "planned-actions-minus-allotment",
    reaction: "triggered-interrupt",
    roundTransition: "reset-round-state",
    turnScheduling: "round-robin-segments",
  }),
  "d6mv.action-economy.quick-basic-slow": Object.freeze({
    actionCountLabel: "actions",
    declaration: "ordered-actions",
    family: "d6mv",
    freshWound: "preserve-actions",
    id: "d6mv.action-economy.quick-basic-slow",
    penalty: "declared-actions-minus-one",
    reaction: "triggered-interrupt",
    roundTransition: "reset-round-state",
    turnScheduling: "free-commitment",
  }),
} as const satisfies Readonly<
  Record<D6ActionEconomyRuntimeStrategyId, D6ActionEconomyRuntimeStrategy>
>);

export function actionEconomyRuntimeStrategy(
  strategyId: string,
  firstEditionSegmentedActions = false,
): D6ActionEconomyRuntimeStrategy {
  const concreteId =
    strategyId === "open-d6.action-economy.flexible" &&
    firstEditionSegmentedActions
      ? "open-d6.action-economy.segmented"
      : strategyId;
  const resolved = Object.values(ACTION_ECONOMY_RUNTIME_STRATEGIES).find(
    ({ id }) => id === concreteId,
  );
  return (
    resolved ??
    ACTION_ECONOMY_RUNTIME_STRATEGIES["d6e2.action-economy.segmented"]
  );
}

export function currentActionEconomyRuntimeStrategy(): D6ActionEconomyRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.actionEconomy;
  return actionEconomyRuntimeStrategy(
    configured,
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions,
      false,
    ),
  );
}
