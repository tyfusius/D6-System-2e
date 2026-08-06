import {
  advancementCost,
  type AdvancementCostMultipliers,
  type AdvancementKind,
} from "@d6-system-2e/core";

export interface AdvancementPlan {
  readonly affordable: boolean;
  readonly cost: number;
  readonly currentCharacterPoints: number;
  readonly currentScore: number;
  readonly kind: AdvancementKind;
  readonly nextCharacterPoints: number;
  readonly nextScore: number;
}

export function planOpenD6Advancement(
  kind: AdvancementKind,
  currentScore: number,
  currentCharacterPoints: number,
  multipliers: AdvancementCostMultipliers,
  advanced = false,
): AdvancementPlan {
  const score = Math.max(0, Math.trunc(currentScore));
  const points = Math.max(0, Math.trunc(currentCharacterPoints));
  const cost = advancementCost(kind, score, { advanced, multipliers });
  return Object.freeze({
    affordable: points >= cost,
    cost,
    currentCharacterPoints: points,
    currentScore: score,
    kind,
    nextCharacterPoints: Math.max(0, points - cost),
    nextScore: score + 1,
  });
}
