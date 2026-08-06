import { dieCodeFromPipScore, pipScore } from "./die-code";

export type SecondEditionInitiativeStrategy =
  "standard" | "simple" | "basic" | "narrative";

export function secondEditionInitiativeStrategy(
  value: unknown,
): SecondEditionInitiativeStrategy {
  return value === "simple" || value === "basic" || value === "narrative"
    ? value
    : "standard";
}

/**
 * Resolve rolled initiative from highest to lowest. The printed alternate
 * initiative rules do not settle ties, so the existing Combat order is used as
 * a stable, loss-preserving implementation tiebreaker.
 */
export function orderedInitiativeIds(
  results: Readonly<Record<string, number | null | undefined>>,
  stableOrder: readonly string[],
): readonly string[] {
  const stableIndex = new Map(stableOrder.map((id, index) => [id, index]));
  return Object.freeze(
    Object.keys(results).sort((left, right) => {
      const scoreDifference =
        (results[right] ?? -Infinity) - (results[left] ?? -Infinity);
      return scoreDifference !== 0
        ? scoreDifference
        : (stableIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (stableIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
    }),
  );
}

export function basicInitiativeDeclarationOrder(
  resolutionOrder: readonly string[],
): readonly string[] {
  return Object.freeze([...resolutionOrder].reverse());
}

export function nextNarrativeInitiativeOrder(
  currentOrder: readonly string[],
): readonly string[] {
  if (currentOrder.length < 2) return Object.freeze([...currentOrder]);
  const last = currentOrder.at(-1);
  return last === undefined
    ? Object.freeze([...currentOrder])
    : Object.freeze([last, ...currentOrder.slice(0, -1)]);
}

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
