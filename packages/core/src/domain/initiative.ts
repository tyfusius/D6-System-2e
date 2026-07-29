import { dieCodeFromPipScore, pipScore } from "./die-code";

export interface FirstEditionInitiativeOptions {
  readonly agilityScore: number;
  readonly perceptionScore: number;
}

export interface FirstEditionInitiativeFormula {
  readonly formula: string;
  readonly score: number;
  readonly tiebreaker: number;
}

/**
 * Build the Foundry tracker formula for the optional First Edition-style
 * Perception initiative roll. One die is represented by the distinct Wild Die
 * term so Dice So Nice can preserve its system appearance.
 */
export function firstEditionInitiativeFormula(
  options: FirstEditionInitiativeOptions,
): FirstEditionInitiativeFormula {
  const score = pipScore(options.perceptionScore);
  const agilityScore = pipScore(options.agilityScore);
  const pool = dieCodeFromPipScore(score);
  const baseDice = Math.max(pool.dice - 1, 0);
  const tiebreaker = Number((score / 100 + agilityScore / 100).toPrecision(2));
  const terms = [`${baseDice}d6[Base]`, "1dw[Wild]"];
  if (pool.pips > 0) terms.push(String(pool.pips));
  if (tiebreaker > 0) terms.push(String(tiebreaker));
  return Object.freeze({
    formula: terms.join("+"),
    score,
    tiebreaker,
  });
}
