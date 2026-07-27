import { PIPS_PER_DIE } from "./die-code";

export type SecondEditionCreationSkillKind =
  "advanced" | "specialization" | "standard";

export interface SecondEditionCreationSkill {
  readonly kind: SecondEditionCreationSkillKind;
  readonly score: number;
}

export interface SecondEditionCreationInput {
  readonly activeAttributeScores: readonly number[];
  readonly optionalSkillModules: number;
  readonly skills: readonly SecondEditionCreationSkill[];
}

export type SecondEditionCreationIssue =
  | "attribute-budget"
  | "attribute-maximum"
  | "attribute-minimum"
  | "advanced-skill-budget"
  | "skill-budget"
  | "skill-maximum"
  | "specialization-count"
  | "specialization-score";

export interface SecondEditionCreationProgress {
  readonly attributes: {
    readonly budget: number;
    readonly remaining: number;
    readonly used: number;
  };
  readonly canFinalize: boolean;
  readonly issues: readonly SecondEditionCreationIssue[];
  readonly skills: {
    readonly budget: number;
    readonly remaining: number;
    readonly used: number;
  };
  readonly specializations: {
    readonly count: number;
    readonly maximumCount: 3;
    readonly purchaseCost: number;
  };
}

function wholeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Audits the core Second Edition character-creation budgets from printed p. 20
 * and the optional specialization/advanced-skill module from pp. 96-99.
 */
export function secondEditionCreationProgress(
  input: SecondEditionCreationInput,
): SecondEditionCreationProgress {
  const activeAttributes = input.activeAttributeScores.map(wholeNonNegative);
  const optionalAttributes = Math.max(0, activeAttributes.length - 4);
  const attributeBudget = (12 + optionalAttributes * 3) * PIPS_PER_DIE;
  const attributeUsed = activeAttributes.reduce(
    (total, score) => total + score,
    0,
  );

  const skills = input.skills.map((skill) => ({
    kind: skill.kind,
    score: wholeNonNegative(skill.score),
  }));
  const standardSkills = skills.filter((skill) => skill.kind === "standard");
  const advancedSkills = skills.filter((skill) => skill.kind === "advanced");
  const specializations = skills.filter(
    (skill) => skill.kind === "specialization",
  );
  const specializationPurchaseCost =
    specializations.length > 0 ? PIPS_PER_DIE : 0;
  const skillUsed =
    [...standardSkills, ...advancedSkills].reduce(
      (total, skill) => total + skill.score,
      0,
    ) + specializationPurchaseCost;
  const skillBudget =
    (7 + wholeNonNegative(input.optionalSkillModules) * 2) * PIPS_PER_DIE;

  const issues = new Set<SecondEditionCreationIssue>();
  if (activeAttributes.some((score) => score < PIPS_PER_DIE)) {
    issues.add("attribute-minimum");
  }
  if (activeAttributes.some((score) => score > 5 * PIPS_PER_DIE)) {
    issues.add("attribute-maximum");
  }
  if (attributeUsed !== attributeBudget) issues.add("attribute-budget");
  if (standardSkills.some((skill) => skill.score > 2 * PIPS_PER_DIE)) {
    issues.add("skill-maximum");
  }
  if (
    advancedSkills.reduce((total, skill) => total + skill.score, 0) >
    2 * PIPS_PER_DIE
  ) {
    issues.add("advanced-skill-budget");
  }
  if (skillUsed > skillBudget) issues.add("skill-budget");
  if (specializations.length > 3) issues.add("specialization-count");
  if (specializations.some((skill) => skill.score !== PIPS_PER_DIE)) {
    issues.add("specialization-score");
  }

  return Object.freeze({
    attributes: Object.freeze({
      budget: attributeBudget,
      remaining: attributeBudget - attributeUsed,
      used: attributeUsed,
    }),
    canFinalize: issues.size === 0,
    issues: Object.freeze([...issues]),
    skills: Object.freeze({
      budget: skillBudget,
      remaining: skillBudget - skillUsed,
      used: skillUsed,
    }),
    specializations: Object.freeze({
      count: specializations.length,
      maximumCount: 3,
      purchaseCost: specializationPurchaseCost,
    }),
  });
}

export interface AdvancedSkillValidationInput {
  readonly prerequisiteScores: readonly number[];
  readonly score: number;
}

export type AdvancedSkillIssue =
  | "advanced-skill-exceeds-prerequisite"
  | "advanced-skill-prerequisite-count"
  | "advanced-skill-prerequisite-rating"
  | "advanced-skill-unrated";

/**
 * Advanced skills require at least two prerequisite skills rated 3D or more,
 * cannot exceed the lowest prerequisite, and cannot be attempted untrained.
 */
export function validateAdvancedSkill(
  input: AdvancedSkillValidationInput,
): readonly AdvancedSkillIssue[] {
  const issues = new Set<AdvancedSkillIssue>();
  const score = wholeNonNegative(input.score);
  const prerequisites = input.prerequisiteScores.map(wholeNonNegative);
  if (score < PIPS_PER_DIE) issues.add("advanced-skill-unrated");
  if (prerequisites.length < 2) {
    issues.add("advanced-skill-prerequisite-count");
  }
  if (
    prerequisites.length > 0 &&
    prerequisites.some((prerequisite) => prerequisite < 3 * PIPS_PER_DIE)
  ) {
    issues.add("advanced-skill-prerequisite-rating");
  }
  if (prerequisites.length > 0 && score > Math.min(...prerequisites)) {
    issues.add("advanced-skill-exceeds-prerequisite");
  }
  return Object.freeze([...issues]);
}

export function specializationScore(
  parentSkillScore: number,
  specializationBonus: number,
): number {
  return (
    wholeNonNegative(parentSkillScore) + wholeNonNegative(specializationBonus)
  );
}

export function advancedSkillAugmentedScore(
  prerequisiteSkillScore: number,
  advancedSkillScore: number,
): number {
  return (
    wholeNonNegative(prerequisiteSkillScore) +
    wholeNonNegative(advancedSkillScore)
  );
}
