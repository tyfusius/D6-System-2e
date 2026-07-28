import {
  secondEditionExperienceAdvancement,
  type SecondEditionAdvancementKind,
} from "@d6-system-2e/core";

export interface SecondEditionExperienceAdvancementPlan {
  readonly affordable: boolean;
  readonly cost: number;
  readonly currentExperiencePoints: number;
  readonly currentScore: number;
  readonly kind: SecondEditionAdvancementKind;
  readonly nextExperiencePoints: number;
  readonly nextScore: number;
  readonly scoreIncrease: 1 | 3;
}

export function planSecondEditionExperienceAdvancement(
  kind: SecondEditionAdvancementKind,
  currentScore: number,
  currentExperiencePoints: number,
  pipsEnabled: boolean,
  advanced = false,
): SecondEditionExperienceAdvancementPlan {
  const score = Math.max(0, Math.trunc(currentScore));
  const points = Math.max(0, Math.trunc(currentExperiencePoints));
  const improvement = secondEditionExperienceAdvancement(
    kind,
    score,
    pipsEnabled,
    advanced,
  );
  return Object.freeze({
    affordable: points >= improvement.cost,
    cost: improvement.cost,
    currentExperiencePoints: points,
    currentScore: score,
    kind,
    nextExperiencePoints: Math.max(0, points - improvement.cost),
    nextScore: improvement.nextScore,
    scoreIncrease: improvement.increase,
  });
}
