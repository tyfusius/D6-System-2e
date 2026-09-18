import { addPipScores, pipScore, PIPS_PER_DIE } from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { SYSTEM_ID } from "../constants";

function booleanSetting(key: string, fallback: boolean): boolean {
  try {
    const value = game.settings.get(SYSTEM_ID, key);
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}

export type D6PipsRuntimeStrategyId =
  "d6e2.pips.whole-dice" | "d6e2.pips.module" | "open-d6.pips.classic";

export interface D6PipsRuntimeStrategy {
  readonly dependencies: {
    readonly rankedFeatures: "requires-active-pips" | "satisfied";
  };
  readonly effectiveScore: "complete-pip-score" | "whole-die-component";
  readonly id: D6PipsRuntimeStrategyId;
  readonly progressionStepScore: 1 | 3;
  readonly splitModifiers: "active" | "dormant-preserved";
  readonly storage: "canonical-pip-score";
}

const PIPS_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.pips.whole-dice": Object.freeze({
    dependencies: Object.freeze({
      rankedFeatures: "requires-active-pips",
    }),
    effectiveScore: "whole-die-component",
    id: "d6e2.pips.whole-dice",
    progressionStepScore: 3,
    splitModifiers: "dormant-preserved",
    storage: "canonical-pip-score",
  }),
  "d6e2.pips.module": Object.freeze({
    dependencies: Object.freeze({ rankedFeatures: "satisfied" }),
    effectiveScore: "complete-pip-score",
    id: "d6e2.pips.module",
    progressionStepScore: 1,
    splitModifiers: "active",
    storage: "canonical-pip-score",
  }),
  "open-d6.pips.classic": Object.freeze({
    dependencies: Object.freeze({ rankedFeatures: "satisfied" }),
    effectiveScore: "complete-pip-score",
    id: "open-d6.pips.classic",
    progressionStepScore: 1,
    splitModifiers: "active",
    storage: "canonical-pip-score",
  }),
} as const satisfies Readonly<
  Record<D6PipsRuntimeStrategyId, D6PipsRuntimeStrategy>
>);

export function pipsRuntimeStrategy(strategyId: string): D6PipsRuntimeStrategy {
  return (
    Object.values(PIPS_RUNTIME_STRATEGIES).find(
      ({ id }) => id === strategyId,
    ) ?? PIPS_RUNTIME_STRATEGIES["d6e2.pips.whole-dice"]
  );
}

export function currentPipsRuntimeStrategy(): D6PipsRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.pips;
  if (configured === "d6e2.pips.configured") {
    return booleanSetting("secondEditionPipsModule", false)
      ? PIPS_RUNTIME_STRATEGIES["d6e2.pips.module"]
      : PIPS_RUNTIME_STRATEGIES["d6e2.pips.whole-dice"];
  }
  return pipsRuntimeStrategy(configured);
}

export function currentPipsEnabled(): boolean {
  return currentPipsRuntimeStrategy().effectiveScore === "complete-pip-score";
}

function effectivePipScore(storedScore: number, enabled: boolean): number {
  const score = pipScore(storedScore);
  return enabled ? score : Math.floor(score / PIPS_PER_DIE) * PIPS_PER_DIE;
}

/** Resolve once for a synchronous projection; create a fresh projection each render. */
export function currentPipScoreProjection() {
  const enabled = currentPipsEnabled();
  const effective = (score: number): number =>
    effectivePipScore(score, enabled);
  return Object.freeze({
    enabled,
    effective,
    combined: (...scores: readonly number[]): number =>
      addPipScores(...scores.map(effective)),
  });
}

export function currentEffectivePipScore(storedScore: number): number {
  return effectivePipScore(storedScore, currentPipsEnabled());
}

export function currentCombinedPipScore(
  ...storedScores: readonly number[]
): number {
  return addPipScores(...storedScores.map(currentEffectivePipScore));
}
