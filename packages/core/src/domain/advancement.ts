export type AdvancementKind = "attribute" | "skill" | "specialization";
export type SecondEditionAdvancementKind = "attribute" | "skill";
export type SecondEditionAdvancementStrategy =
  "unselected" | "experience-points" | "milestone" | "narrative";

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

export interface SecondEditionExperienceAdvancement {
  readonly cost: number;
  readonly increase: 1 | 3;
  readonly nextScore: number;
}

export interface SecondEditionSpecializationAcquisition {
  readonly affordable: boolean;
  readonly atLimit: boolean;
  readonly cost: number;
  readonly currentSpecializations: number;
  readonly maximumSpecializations: number;
  readonly nextExperiencePoints: number;
  readonly skillRating: number;
}

/**
 * Calculates one D62e Experience Point improvement (pp. 88, 97).
 * Scores use the system's canonical pip unit even when the Pips module is off.
 */
export function secondEditionExperienceAdvancement(
  kind: SecondEditionAdvancementKind,
  currentScore: number,
  pipsEnabled: boolean,
  advanced = false,
): SecondEditionExperienceAdvancement {
  const score = Math.max(0, Math.trunc(currentScore));
  const dice = Math.floor(score / 3);
  const pips = score % 3;
  const multiplier = kind === "attribute" ? 10 : 1;
  const completingDie = pipsEnabled && pips === 2;
  const regularCost = Math.max(
    1,
    dice * multiplier - (completingDie ? pips : 0),
  );
  const cost = regularCost * (advanced ? 2 : 1);
  const increase = pipsEnabled ? 1 : 3;
  return Object.freeze({ cost, increase, nextScore: score + increase });
}

/**
 * Calculates one post-creation specialization acquisition (D62e p. 99).
 * The Skill's own rating excludes its governing Attribute.
 */
export function secondEditionSpecializationAcquisition(
  skillScore: number,
  currentSpecializations: number,
  currentExperiencePoints: number,
): SecondEditionSpecializationAcquisition {
  const skillRating = Math.floor(Math.max(0, Math.trunc(skillScore)) / 3);
  const specializationCount = Math.max(0, Math.trunc(currentSpecializations));
  const experiencePoints = Math.max(0, Math.trunc(currentExperiencePoints));
  const maximumSpecializations = skillRating;
  const atLimit = specializationCount >= maximumSpecializations;
  const cost = skillRating + specializationCount;
  return Object.freeze({
    affordable: !atLimit && experiencePoints >= cost,
    atLimit,
    cost,
    currentSpecializations: specializationCount,
    maximumSpecializations,
    nextExperiencePoints: Math.max(0, experiencePoints - cost),
    skillRating,
  });
}
