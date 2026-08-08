import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "./settings-catalog";
import { booleanSetting } from "./setting-values";

export type D6MovementRuntimeStrategyId =
  | "d6e2.movement.segmented"
  | "open-d6.movement.relative"
  | "open-d6.movement.segmented";

export interface D6MovementRuntimeStrategy {
  readonly check: "none" | "skill-or-attribute";
  readonly distance: "fixed-mode" | "relative-rate";
  readonly family: "relative" | "segmented";
  readonly id: D6MovementRuntimeStrategyId;
  readonly posture: "standing-prone" | "untracked";
  readonly reactive: "consume-next-action-no-chain" | "unsupported";
  readonly segment: "declared-action" | "free-or-action" | "round-robin-rate";
  readonly tokenCompletion:
    | "complete-declared-action-after-translation"
    | "resolve-check-before-translation";
}

const MOVEMENT_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.movement.segmented": Object.freeze({
    check: "none",
    distance: "fixed-mode",
    family: "segmented",
    id: "d6e2.movement.segmented",
    posture: "standing-prone",
    reactive: "unsupported",
    segment: "declared-action",
    tokenCompletion: "complete-declared-action-after-translation",
  }),
  "open-d6.movement.relative": Object.freeze({
    check: "skill-or-attribute",
    distance: "relative-rate",
    family: "relative",
    id: "open-d6.movement.relative",
    posture: "untracked",
    reactive: "unsupported",
    segment: "free-or-action",
    tokenCompletion: "resolve-check-before-translation",
  }),
  "open-d6.movement.segmented": Object.freeze({
    check: "skill-or-attribute",
    distance: "relative-rate",
    family: "relative",
    id: "open-d6.movement.segmented",
    posture: "untracked",
    reactive: "consume-next-action-no-chain",
    segment: "round-robin-rate",
    tokenCompletion: "resolve-check-before-translation",
  }),
} as const satisfies Readonly<
  Record<D6MovementRuntimeStrategyId, D6MovementRuntimeStrategy>
>);

export function movementRuntimeStrategy(
  strategyId: string,
  firstEditionSegmentedActions = false,
): D6MovementRuntimeStrategy {
  const concreteId =
    strategyId === "open-d6.movement.relative" && firstEditionSegmentedActions
      ? "open-d6.movement.segmented"
      : strategyId;
  return (
    Object.values(MOVEMENT_RUNTIME_STRATEGIES).find(
      ({ id }) => id === concreteId,
    ) ?? MOVEMENT_RUNTIME_STRATEGIES["d6e2.movement.segmented"]
  );
}

export function currentMovementRuntimeStrategy(): D6MovementRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.movement;
  return movementRuntimeStrategy(
    configured,
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions,
      false,
    ),
  );
}
