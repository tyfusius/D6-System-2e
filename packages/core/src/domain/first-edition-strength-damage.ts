/** D6 Fantasy, printed p. 62: discard pips, halve dice, round up. */
export function firstEditionStrengthDamageScore(pipScore: number): number {
  const dice = Math.max(0, Math.floor(pipScore / 3));
  return Math.ceil(dice / 2) * 3;
}
