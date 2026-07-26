export type AdvancementKind = "attribute" | "skill" | "specialization";

export interface AdvancementCostMultipliers {
  readonly attribute: number;
  readonly skill: number;
  readonly specialization: number;
}

export interface AdvancementCostOptions {
  readonly advanced?: boolean;
  readonly multipliers: AdvancementCostMultipliers;
  readonly pipsPerDie?: number;
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function advancementCost(
  kind: AdvancementKind,
  currentScore: number,
  options: AdvancementCostOptions,
): number {
  const pipsPerDie = Math.max(1, Math.trunc(options.pipsPerDie ?? 3));
  const dice = Math.floor(nonNegativeFinite(currentScore) / pipsPerDie);
  const multiplier = nonNegativeFinite(options.multipliers[kind]);
  const base = Math.ceil(dice * multiplier);
  return base * (options.advanced === true ? 2 : 1);
}
