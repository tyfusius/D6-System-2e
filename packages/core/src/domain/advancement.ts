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
  readonly currentPoints: number;
  readonly currentSpecializations: number;
  readonly maximumSpecializations: number;
  readonly nextPoints: number;
  readonly skillRating: number;
}

export interface SecondEditionMilestoneBalance {
  readonly attributeDice: number;
  readonly skillPips: number;
}

export interface SecondEditionMilestoneSpend {
  readonly affordable: boolean;
  readonly cost: number;
  readonly nextBalance: SecondEditionMilestoneBalance;
  readonly scoreIncrease: 1 | 3;
}

export type SecondEditionNarrativeRewardKind = "attribute" | "perk" | "skill";
export type SecondEditionNarrativeArcStatus =
  "draft" | "approved" | "completed";

export interface SecondEditionNarrativeArcStep {
  readonly complete: boolean;
  readonly description: string;
  readonly id: string;
}

export interface SecondEditionNarrativeArc {
  readonly id: string;
  readonly rewardId: string;
  readonly rewardKind: SecondEditionNarrativeRewardKind;
  readonly rewardName: string;
  readonly status: SecondEditionNarrativeArcStatus;
  readonly steps: readonly SecondEditionNarrativeArcStep[];
  readonly targetScore: number;
  readonly title: string;
}

export interface SecondEditionNarrativeArcValidation {
  readonly complete: boolean;
  readonly requiredSteps: number;
  readonly valid: boolean;
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
  currentPoints: number,
  configuredMaximumSpecializations?: number,
): SecondEditionSpecializationAcquisition {
  const skillRating = Math.floor(Math.max(0, Math.trunc(skillScore)) / 3);
  const specializationCount = Math.max(0, Math.trunc(currentSpecializations));
  const points = Math.max(0, Math.trunc(currentPoints));
  const maximumSpecializations =
    configuredMaximumSpecializations === undefined
      ? skillRating
      : Math.max(0, Math.trunc(configuredMaximumSpecializations));
  const atLimit = specializationCount >= maximumSpecializations;
  const cost = skillRating + specializationCount;
  return Object.freeze({
    affordable: !atLimit && points >= cost,
    atLimit,
    cost,
    currentPoints: points,
    currentSpecializations: specializationCount,
    maximumSpecializations,
    nextPoints: Math.max(0, points - cost),
    skillRating,
  });
}

/**
 * Plans one Milestone reward spend (D62e pp. 90-91).
 * Skill rewards are stored as pips so the same balance supports +3D or +9 pips.
 */
export function secondEditionMilestoneSpend(
  kind: SecondEditionAdvancementKind,
  balanceValue: SecondEditionMilestoneBalance,
  pipsEnabled: boolean,
): SecondEditionMilestoneSpend {
  const balance = Object.freeze({
    attributeDice: Math.max(0, Math.trunc(balanceValue.attributeDice)),
    skillPips: Math.max(0, Math.trunc(balanceValue.skillPips)),
  });
  const cost = kind === "attribute" ? 1 : pipsEnabled ? 1 : 3;
  const available =
    kind === "attribute" ? balance.attributeDice : balance.skillPips;
  return Object.freeze({
    affordable: available >= cost,
    cost,
    nextBalance: Object.freeze({
      attributeDice:
        kind === "attribute"
          ? Math.max(0, balance.attributeDice - cost)
          : balance.attributeDice,
      skillPips:
        kind === "skill"
          ? Math.max(0, balance.skillPips - cost)
          : balance.skillPips,
    }),
    scoreIncrease: kind === "skill" && pipsEnabled ? 1 : 3,
  });
}

export function secondEditionNarrativeArcValidation(
  arc: SecondEditionNarrativeArc,
): SecondEditionNarrativeArcValidation {
  const requiredSteps =
    arc.rewardKind === "perk"
      ? Math.max(1, Math.trunc(arc.targetScore))
      : Math.max(1, Math.floor(Math.max(0, arc.targetScore) / 3));
  const describedSteps = arc.steps.filter(
    (step) => step.description.trim().length > 0,
  );
  return Object.freeze({
    complete:
      arc.status === "approved" &&
      describedSteps.length === requiredSteps &&
      describedSteps.every((step) => step.complete),
    requiredSteps,
    valid:
      arc.id.trim().length > 0 &&
      arc.title.trim().length > 0 &&
      (arc.rewardKind === "perk" || arc.rewardId.trim().length > 0) &&
      arc.rewardName.trim().length > 0 &&
      describedSteps.length === requiredSteps,
  });
}
