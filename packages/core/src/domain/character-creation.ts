import { PIPS_PER_DIE } from "./die-code";

export type SecondEditionCreationSkillKind =
  "advanced" | "specialization" | "standard";

export interface SecondEditionCreationSkill {
  readonly kind: SecondEditionCreationSkillKind;
  readonly score: number;
}

export interface SecondEditionCreationFeature {
  readonly cost?: number;
  readonly rank: number;
  readonly type: "flaw" | "perk" | "talent";
}

export interface SecondEditionCreationInput {
  readonly activeAttributeScores: readonly number[];
  readonly features?: readonly SecondEditionCreationFeature[];
  readonly optionalSkillModules: number;
  readonly pipsEnabled: boolean;
  readonly skills: readonly SecondEditionCreationSkill[];
}

export type SecondEditionCreationIssue =
  | "attribute-budget"
  | "attribute-maximum"
  | "attribute-minimum"
  | "advanced-skill-budget"
  | "skill-budget"
  | "skill-maximum"
  | "pips-module-required"
  | "pips-split-limit"
  | "specialization-count"
  | "specialization-score";

export interface SecondEditionCreationProgress {
  readonly attributes: {
    readonly budget: number;
    readonly remaining: number;
    readonly used: number;
  };
  readonly canFinalize: boolean;
  readonly features: {
    readonly flawCredit: number;
    readonly perkCost: number;
    readonly talentCost: number;
    readonly total: number;
  };
  readonly issues: readonly SecondEditionCreationIssue[];
  readonly pips: {
    readonly attributeModifierPips: number;
    readonly enabled: boolean;
    readonly maximumModifierPips: 6;
    readonly skillModifierPips: number;
  };
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
  const featureCosts = (input.features ?? []).reduce(
    (totals, feature) => {
      const rank = Math.max(1, wholeNonNegative(feature.rank));
      if (feature.type === "perk") totals.perkCost += rank * PIPS_PER_DIE;
      if (feature.type === "flaw") totals.flawCredit += rank * PIPS_PER_DIE;
      if (feature.type === "talent") {
        totals.talentCost += wholeNonNegative(feature.cost ?? 0) * PIPS_PER_DIE;
      }
      return totals;
    },
    { flawCredit: 0, perkCost: 0, talentCost: 0 },
  );
  const featureTotal =
    featureCosts.perkCost + featureCosts.talentCost - featureCosts.flawCredit;
  const skillUsed =
    [...standardSkills, ...advancedSkills].reduce(
      (total, skill) => total + skill.score,
      0,
    ) +
    specializationPurchaseCost +
    featureCosts.perkCost +
    featureCosts.talentCost;
  const skillBudget =
    (7 + wholeNonNegative(input.optionalSkillModules) * 2) * PIPS_PER_DIE +
    featureCosts.flawCredit;
  const attributeModifierPips = activeAttributes.reduce(
    (total, score) => total + (score % PIPS_PER_DIE),
    0,
  );
  const skillModifierPips = [...standardSkills, ...advancedSkills].reduce(
    (total, skill) => total + (skill.score % PIPS_PER_DIE),
    0,
  );

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
  if (
    !input.pipsEnabled &&
    (attributeModifierPips > 0 || skillModifierPips > 0)
  ) {
    issues.add("pips-module-required");
  }
  if (
    input.pipsEnabled &&
    (attributeModifierPips > 6 || skillModifierPips > 6)
  ) {
    issues.add("pips-split-limit");
  }
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
    features: Object.freeze({
      ...featureCosts,
      total: featureTotal,
    }),
    issues: Object.freeze([...issues]),
    pips: Object.freeze({
      attributeModifierPips,
      enabled: input.pipsEnabled,
      maximumModifierPips: 6,
      skillModifierPips,
    }),
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

export function nextSecondEditionCreationScore(
  score: number,
  direction: -1 | 1,
  pipsEnabled: boolean,
): number {
  const current = wholeNonNegative(score);
  if (pipsEnabled) return Math.max(0, current + direction);
  const remainder = current % PIPS_PER_DIE;
  if (remainder > 0) {
    return direction > 0
      ? current + (PIPS_PER_DIE - remainder)
      : current - remainder;
  }
  return Math.max(0, current + direction * PIPS_PER_DIE);
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
