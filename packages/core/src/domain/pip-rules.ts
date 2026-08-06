import { addPipScores, pipScore, PIPS_PER_DIE } from "./die-code";
import type { EditionCapabilityDecision } from "./edition-capabilities";

export type PipRulesStrategy =
  | "open-d6-classic-pips"
  | "second-edition-pips-module"
  | "second-edition-whole-dice";

export function pipRulesStrategy(
  decision: EditionCapabilityDecision,
): PipRulesStrategy {
  switch (decision.strategy) {
    case "open-d6-classic-pips":
    case "second-edition-pips-module":
      return decision.strategy;
    default:
      return "second-edition-whole-dice";
  }
}

export function usesPips(decision: EditionCapabilityDecision): boolean {
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
  decision: EditionCapabilityDecision,
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
  decision: EditionCapabilityDecision,
  ...storedScores: readonly number[]
): number {
  return addPipScores(
    ...storedScores.map((score) => effectivePipScore(score, decision)),
  );
}

export function isWholeDieScore(score: number): boolean {
  return pipScore(score) % PIPS_PER_DIE === 0;
}
