import type { D6ActionEconomyRuntimeStrategyId } from "./action-economy";
import type { D6InitiativeRuntimeStrategyId } from "./initiative";

/** Concrete supported opt-ins beyond the bundled profiles' default choices.
 * Type-only runtime imports keep profile loading free of initialization cycles. */
export const rulesProfileStrategyVariants = Object.freeze([
  Object.freeze({
    slot: "actionEconomy" as const,
    id: "open-d6.action-economy.segmented" satisfies D6ActionEconomyRuntimeStrategyId,
    labelKey:
      "D6E2.Settings.Capabilities.Strategy.OpenD6FlexibleActionAllotment",
  }),
  Object.freeze({
    slot: "initiative" as const,
    id: "open-d6.initiative.perception-base" satisfies D6InitiativeRuntimeStrategyId,
    labelKey: "D6E2.Settings.Capabilities.Strategy.OpenD6BaseInitiative",
  }),
  Object.freeze({
    slot: "initiative" as const,
    id: "open-d6.initiative.perception-reflexes" satisfies D6InitiativeRuntimeStrategyId,
    labelKey:
      "D6E2.Settings.Capabilities.Strategy.OpenD6PerceptionReflexesInitiative",
  }),
]);

export function rulesProfileStrategyVariantLabel(
  strategyId: string,
): string | undefined {
  if (strategyId === "open-d6.initiative.perception")
    return "D6E2.Settings.Capabilities.Strategy.OpenD6PerceptionInitiative";
  return rulesProfileStrategyVariants.find(
    (variant) => variant.id === strategyId,
  )?.labelKey;
}

/** Compact option labels; full strategy names remain in capability summaries. */
export function rulesProfileStrategyOptionLabel(
  strategyId: string,
): string | undefined {
  const keys: Readonly<Record<string, string>> = {
    "open-d6.initiative.perception-base": "AttributeTies",
    "open-d6.initiative.perception": "LegacyPerception",
    "open-d6.initiative.perception-reflexes": "PerceptionReflexes",
  };
  const key = keys[strategyId];
  return key
    ? `D6E2.Settings.RulesProfile.InitiativeTie.Option.${key}`
    : rulesProfileStrategyVariantLabel(strategyId);
}
