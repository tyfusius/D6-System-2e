import {
  secondEditionExperienceAdvancement,
  secondEditionSpecializationAcquisition,
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

export interface SecondEditionSpecializationAcquisitionPlan {
  readonly affordable: boolean;
  readonly atLimit: boolean;
  readonly cost: number;
  readonly currentPoints: number;
  readonly currentSpecializations: number;
  readonly maximumSpecializations: number;
  readonly nextPoints: number;
  readonly skillRating: number;
}

export function planSecondEditionSpecializationAcquisition(
  skillScore: number,
  currentSpecializations: number,
  currentPoints: number,
  configuredMaximumSpecializations?: number,
): SecondEditionSpecializationAcquisitionPlan {
  const points = Math.max(0, Math.trunc(currentPoints));
  const acquisition = secondEditionSpecializationAcquisition(
    skillScore,
    currentSpecializations,
    points,
    configuredMaximumSpecializations,
  );
  return Object.freeze(acquisition);
}
