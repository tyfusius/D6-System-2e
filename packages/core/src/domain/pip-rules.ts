import { addPipScores, pipScore, PIPS_PER_DIE } from "./die-code";
import type { D6RulesRuntimeDecisionV1 } from "../contracts/rules-runtime";

export type PipRulesStrategy =
  | "open-d6-classic-pips"
  | "second-edition-pips-module"
  | "second-edition-whole-dice";

export function pipRulesStrategy(
  decision: D6RulesRuntimeDecisionV1,
): PipRulesStrategy {
  switch (decision.strategy) {
    case "open-d6.pips.classic":
    case "open-d6-classic-pips":
      return "open-d6-classic-pips";
    case "d6e2.pips.module":
    case "second-edition-pips-module":
      return "second-edition-pips-module";
    default:
      return "second-edition-whole-dice";
  }
}

export function usesPips(decision: D6RulesRuntimeDecisionV1): boolean {
  return pipRulesStrategy(decision) !== "second-edition-whole-dice";
}

/**
 * Resolve one independently stored Die Code for the active rules profile.
 *
 * Scores remain lossless canonical pip totals in persistence. Core Second
 * Edition ignores an inactive +1/+2 remainder instead of destroying it.
 */
export function effectivePipScore(
  storedScore: number,
  decision: D6RulesRuntimeDecisionV1,
): number {
  const score = pipScore(storedScore);
  return usesPips(decision)
    ? score
    : Math.floor(score / PIPS_PER_DIE) * PIPS_PER_DIE;
}

/**
 * Resolve independently stored Die Codes before adding them. This ordering is
 * intentional: two inactive +2 modifiers must not combine into an extra die.
 */
export function addEffectivePipScores(
  decision: D6RulesRuntimeDecisionV1,
  ...storedScores: readonly number[]
): number {
  return addPipScores(
    ...storedScores.map((score) => effectivePipScore(score, decision)),
  );
}

export function isWholeDieScore(score: number): boolean {
  return pipScore(score) % PIPS_PER_DIE === 0;
}
