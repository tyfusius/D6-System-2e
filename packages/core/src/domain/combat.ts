import { PIPS_PER_DIE, pipScore } from "./die-code";

export type SecondEditionCondition =
  | "healthy"
  | "staggered"
  | "stunned"
  | "wounded"
  | "incapacitated"
  | "mortally-wounded"
  | "dead";

export const SECOND_EDITION_CONDITIONS: readonly SecondEditionCondition[] =
  Object.freeze([
    "healthy",
    "staggered",
    "stunned",
    "wounded",
    "incapacitated",
    "mortally-wounded",
    "dead",
  ]);

export function isSecondEditionCondition(
  value: unknown,
): value is SecondEditionCondition {
  return (
    typeof value === "string" &&
    SECOND_EDITION_CONDITIONS.includes(value as SecondEditionCondition)
  );
}

export type FirstEditionWoundLevel =
  | "healthy"
  | "stunned"
  | "wounded"
  | "severely-wounded"
  | "incapacitated"
  | "mortally-wounded"
  | "dead";

export const FIRST_EDITION_WOUND_LEVELS: readonly FirstEditionWoundLevel[] =
  Object.freeze([
    "healthy",
    "stunned",
    "wounded",
    "severely-wounded",
    "incapacitated",
    "mortally-wounded",
    "dead",
  ]);

export function isFirstEditionWoundLevel(
  value: unknown,
): value is FirstEditionWoundLevel {
  return (
    typeof value === "string" &&
    FIRST_EDITION_WOUND_LEVELS.includes(value as FirstEditionWoundLevel)
  );
}

export type FirstEditionDamageOutcome =
  "none" | Exclude<FirstEditionWoundLevel, "healthy" | "severely-wounded">;

export interface FirstEditionDamageResolution {
  readonly damageTotal: number;
  readonly difference: number;
  readonly incoming: FirstEditionDamageOutcome;
  readonly nextWound: FirstEditionWoundLevel;
  readonly previousWound: FirstEditionWoundLevel;
  readonly resistanceTotal: number;
}

export type FirstEditionStunOutcome =
  "none" | "stunned" | "wounded" | "severely-wounded" | "incapacitated";

export interface FirstEditionStunDamageResolution {
  readonly damageTotal: number;
  readonly difference: number;
  readonly reducedWound: FirstEditionStunOutcome;
  readonly resistanceTotal: number;
  readonly unconsciousMinutes: number;
}

function firstEditionIncomingDamage(
  difference: number,
): FirstEditionDamageOutcome {
  if (difference >= 16) return "dead";
  if (difference >= 13) return "mortally-wounded";
  if (difference >= 9) return "incapacitated";
  if (difference >= 4) return "wounded";
  if (difference >= 1) return "stunned";
  return "none";
}

function progressFirstEditionWound(
  current: FirstEditionWoundLevel,
  incoming: FirstEditionDamageOutcome,
): FirstEditionWoundLevel {
  if (current === "dead" || incoming === "none") return current;
  const currentIndex = FIRST_EDITION_WOUND_LEVELS.indexOf(current);
  const incomingIndex = FIRST_EDITION_WOUND_LEVELS.indexOf(incoming);
  if (incoming === "dead") return "dead";
  if (current === "healthy" || incomingIndex > currentIndex) return incoming;
  return (
    FIRST_EDITION_WOUND_LEVELS[
      Math.min(currentIndex + 1, FIRST_EDITION_WOUND_LEVELS.length - 1)
    ] ?? "dead"
  );
}

/** Resolve the verified OpenD6 Space wound-level difference table (pp. 75-76). */
export function firstEditionDamageResolution(
  damageTotal: number,
  resistanceTotal: number,
  previousWound: FirstEditionWoundLevel,
): FirstEditionDamageResolution {
  const damage = Number.isFinite(damageTotal) ? Math.trunc(damageTotal) : 0;
  const resistance = Number.isFinite(resistanceTotal)
    ? Math.trunc(resistanceTotal)
    : 0;
  const difference = damage - resistance;
  const incoming = firstEditionIncomingDamage(difference);
  return Object.freeze({
    damageTotal: damage,
    difference,
    incoming,
    nextWound: progressFirstEditionWound(previousWound, incoming),
    previousWound,
    resistanceTotal: resistance,
  });
}

/** Resolve Space p. 76 stun-only damage without mutating the physical Wound track. */
export function firstEditionStunDamageResolution(
  damageTotal: number,
  resistanceTotal: number,
): FirstEditionStunDamageResolution {
  const damage = Number.isFinite(damageTotal) ? Math.trunc(damageTotal) : 0;
  const resistance = Number.isFinite(resistanceTotal)
    ? Math.trunc(resistanceTotal)
    : 0;
  const difference = damage - resistance;
  if (difference < 1) {
    return Object.freeze({
      damageTotal: damage,
      difference,
      reducedWound: "none",
      resistanceTotal: resistance,
      unconsciousMinutes: 0,
    });
  }
  const original = firstEditionIncomingDamage(difference);
  const originalIndex =
    original === "none" ? 0 : FIRST_EDITION_WOUND_LEVELS.indexOf(original);
  const reducedIndex = Math.max(1, originalIndex - 2);
  const reduced = FIRST_EDITION_WOUND_LEVELS[reducedIndex] ?? "stunned";
  const reducedWound: FirstEditionStunOutcome =
    reduced === "healthy" ||
    reduced === "mortally-wounded" ||
    reduced === "dead"
      ? "stunned"
      : reduced;
  return Object.freeze({
    damageTotal: damage,
    difference,
    reducedWound,
    resistanceTotal: resistance,
    unconsciousMinutes: difference,
  });
}

export function firstEditionIncapacitationCheck(
  total: number,
): "conscious" | "unconscious" {
  const normalized = Number.isFinite(total) ? Math.trunc(total) : 0;
  return normalized >= 15 ? "conscious" : "unconscious";
}

export function firstEditionWoundPenaltyScore(
  wound: FirstEditionWoundLevel,
): number {
  if (wound === "wounded") return PIPS_PER_DIE;
  if (wound === "severely-wounded") return PIPS_PER_DIE * 2;
  if (wound === "incapacitated") return PIPS_PER_DIE * 3;
  return 0;
}

export type FirstEditionHealingOutcome =
  "automatic" | "improved" | "unchanged" | "worsened" | "dead";

export interface FirstEditionHealingResolution {
  readonly nextWound: FirstEditionWoundLevel;
  readonly outcome: FirstEditionHealingOutcome;
  readonly previousWound: FirstEditionWoundLevel;
}

export interface FirstEditionNaturalHealingRule {
  readonly restAmount: number;
  readonly restUnit: "minute" | "days" | "weeks";
  readonly successDifficulty?: number;
}

const FIRST_EDITION_NATURAL_HEALING_RULES: Readonly<
  Partial<Record<FirstEditionWoundLevel, FirstEditionNaturalHealingRule>>
> = Object.freeze({
  stunned: Object.freeze({ restAmount: 1, restUnit: "minute" }),
  wounded: Object.freeze({
    restAmount: 3,
    restUnit: "days",
    successDifficulty: 6,
  }),
  "severely-wounded": Object.freeze({
    restAmount: 3,
    restUnit: "days",
    successDifficulty: 6,
  }),
  incapacitated: Object.freeze({
    restAmount: 2,
    restUnit: "weeks",
    successDifficulty: 8,
  }),
  "mortally-wounded": Object.freeze({
    restAmount: 5,
    restUnit: "weeks",
    successDifficulty: 8,
  }),
});

export function firstEditionNaturalHealingRule(
  wound: FirstEditionWoundLevel,
): FirstEditionNaturalHealingRule | null {
  return FIRST_EDITION_NATURAL_HEALING_RULES[wound] ?? null;
}

function improveFirstEditionWound(
  wound: FirstEditionWoundLevel,
): FirstEditionWoundLevel {
  const index = FIRST_EDITION_WOUND_LEVELS.indexOf(wound);
  return FIRST_EDITION_WOUND_LEVELS[Math.max(0, index - 1)] ?? "healthy";
}

function worsenFirstEditionWound(
  wound: FirstEditionWoundLevel,
): FirstEditionWoundLevel {
  const index = FIRST_EDITION_WOUND_LEVELS.indexOf(wound);
  return (
    FIRST_EDITION_WOUND_LEVELS[
      Math.min(FIRST_EDITION_WOUND_LEVELS.length - 1, index + 1)
    ] ?? "dead"
  );
}

/** Resolve the OpenD6 Space natural Wounds Healing table (p. 79). */
export function firstEditionNaturalHealingResolution(
  wound: FirstEditionWoundLevel,
  strengthTotal: number,
  criticalFailure = false,
): FirstEditionHealingResolution {
  const rule = firstEditionNaturalHealingRule(wound);
  if (!rule) {
    return Object.freeze({
      nextWound: wound,
      outcome: "unchanged",
      previousWound: wound,
    });
  }
  if (wound === "stunned") {
    return Object.freeze({
      nextWound: "healthy",
      outcome: "automatic",
      previousWound: wound,
    });
  }
  if (criticalFailure) {
    const nextWound = worsenFirstEditionWound(wound);
    return Object.freeze({
      nextWound,
      outcome: nextWound === "dead" ? "dead" : "worsened",
      previousWound: wound,
    });
  }
  const total = Number.isFinite(strengthTotal) ? Math.trunc(strengthTotal) : 0;
  if (total >= (rule.successDifficulty ?? Number.POSITIVE_INFINITY)) {
    return Object.freeze({
      nextWound:
        wound === "wounded" ? "healthy" : improveFirstEditionWound(wound),
      outcome: "improved",
      previousWound: wound,
    });
  }
  return Object.freeze({
    nextWound: wound,
    outcome: "unchanged",
    previousWound: wound,
  });
}

export function firstEditionAssistedHealingDifficulty(
  wound: FirstEditionWoundLevel,
): number | null {
  if (wound === "stunned") return 10;
  if (wound === "wounded" || wound === "severely-wounded") return 15;
  if (wound === "incapacitated") return 20;
  if (wound === "mortally-wounded") return 25;
  return null;
}

/** Successful assisted healing improves exactly one Wound level (p. 79). */
export function firstEditionAssistedHealingResolution(
  wound: FirstEditionWoundLevel,
  medicineTotal: number,
): FirstEditionHealingResolution {
  const difficulty = firstEditionAssistedHealingDifficulty(wound);
  const total = Number.isFinite(medicineTotal) ? Math.trunc(medicineTotal) : 0;
  if (difficulty !== null && total >= difficulty) {
    return Object.freeze({
      nextWound: improveFirstEditionWound(wound),
      outcome: "improved",
      previousWound: wound,
    });
  }
  return Object.freeze({
    nextWound: wound,
    outcome: "unchanged",
    previousWound: wound,
  });
}

/** Convert completed five-second rounds to elapsed whole minutes (12 rounds). */
export function firstEditionMortalityElapsedMinutes(
  completedRounds: number,
): number {
  if (!Number.isSafeInteger(completedRounds) || completedRounds < 0) {
    throw new RangeError(
      "Completed Mortally Wounded rounds must be a non-negative safe integer.",
    );
  }
  return Math.floor(completedRounds / 12);
}

/** A Mortally Wounded character dies when Strength is below elapsed minutes. */
export function firstEditionMortalityResolution(
  minutesMortallyWounded: number,
  strengthTotal: number,
): "survived" | "dead" {
  if (
    !Number.isSafeInteger(minutesMortallyWounded) ||
    minutesMortallyWounded < 0
  ) {
    throw new RangeError(
      "Minutes Mortally Wounded must be a non-negative safe integer.",
    );
  }
  const total = Number.isFinite(strengthTotal) ? Math.trunc(strengthTotal) : 0;
  return total < minutesMortallyWounded ? "dead" : "survived";
}

export function secondEditionStaticDefense(attributeScore: number): number {
  return Math.floor(pipScore(attributeScore) / PIPS_PER_DIE) * 5;
}

export type SecondEditionDodgeBasis = "perception" | "flying";

/** Resolve core Dodge or the Science Fiction Skills Flying substitution. */
export function secondEditionDodgeDefense(
  perceptionScore: number,
  agilityScore: number,
  flyingSkillScore: number,
  basis: SecondEditionDodgeBasis,
): number {
  const score =
    basis === "flying"
      ? pipScore(agilityScore) + pipScore(flyingSkillScore)
      : pipScore(perceptionScore);
  return secondEditionStaticDefense(score);
}

export interface SecondEditionFlyingGuidance {
  readonly actionRequired: true;
  readonly flyMeters: number;
  readonly hoverRounds: number;
  readonly score: number;
}

export function secondEditionFlyingGuidance(
  agilityScore: number,
  flyingSkillScore: number,
): SecondEditionFlyingGuidance {
  const score = pipScore(agilityScore) + pipScore(flyingSkillScore);
  const dice = Math.floor(score / PIPS_PER_DIE);
  return Object.freeze({
    actionRequired: true,
    flyMeters: dice,
    hoverRounds: dice,
    score,
  });
}

export function multipleActionPenaltyScore(actionCount: number): number {
  if (!Number.isSafeInteger(actionCount) || actionCount < 1) {
    throw new RangeError("Action count must be a positive safe integer.");
  }
  return (actionCount - 1) * PIPS_PER_DIE;
}

export function secondEditionConditionPenaltyScore(
  condition: SecondEditionCondition,
): number {
  return condition === "staggered" || condition === "wounded"
    ? PIPS_PER_DIE
    : 0;
}

export function secondEditionConditionAllowsActions(
  condition: SecondEditionCondition,
): boolean {
  return !["stunned", "incapacitated", "mortally-wounded", "dead"].includes(
    condition,
  );
}

export type SecondEditionDamageOutcome =
  "staggered" | "stunned" | "wounded" | "mortally-wounded" | "dead";

export interface SecondEditionHyperLethalOptions {
  readonly killingBlows?: boolean;
  readonly removeStunned?: boolean;
  readonly removeWounded?: boolean;
}

export interface SecondEditionDamageResolution {
  readonly damageTotal: number;
  readonly incoming: SecondEditionDamageOutcome;
  readonly nextCondition: SecondEditionCondition;
  readonly previousCondition: SecondEditionCondition;
  readonly resistanceComplication: boolean;
  readonly resistanceTotal: number;
  readonly killingBlow: boolean;
}

function normalizedRollTotal(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function conditionAfterStaggered(
  current: SecondEditionCondition,
): SecondEditionCondition {
  if (current === "healthy") return "staggered";
  if (current === "staggered") return "stunned";
  return current;
}

function conditionAfterWounded(
  current: SecondEditionCondition,
): SecondEditionCondition {
  if (current === "dead" || current === "mortally-wounded") return current;
  if (current === "incapacitated") return "mortally-wounded";
  if (current === "wounded") return "incapacitated";
  return "wounded";
}

function hyperLethalCondition(
  current: SecondEditionCondition,
  resisted: boolean,
  options: SecondEditionHyperLethalOptions,
): SecondEditionCondition {
  if (current === "dead") return "dead";
  if (options.removeStunned === true && options.removeWounded === true) {
    return "mortally-wounded";
  }
  if (options.removeWounded === true) {
    return current === "healthy" ? "stunned" : "mortally-wounded";
  }
  if (options.removeStunned === true) return conditionAfterWounded(current);
  return resisted
    ? conditionAfterStaggered(current)
    : conditionAfterWounded(current);
}

export function secondEditionDamageResolution(
  damageTotal: number,
  resistanceTotal: number,
  resistanceComplication: boolean,
  previousCondition: SecondEditionCondition,
  options: SecondEditionHyperLethalOptions = {},
): SecondEditionDamageResolution {
  const damage = normalizedRollTotal(damageTotal);
  const resistance = normalizedRollTotal(resistanceTotal);
  const resisted = resistance > damage;
  const killingBlow = options.killingBlows === true && resistance * 2 < damage;
  const incoming: SecondEditionDamageOutcome = killingBlow
    ? "dead"
    : resisted
      ? options.removeStunned === true
        ? options.removeWounded === true
          ? "mortally-wounded"
          : "wounded"
        : options.removeWounded === true
          ? "stunned"
          : "staggered"
      : resistanceComplication
        ? "mortally-wounded"
        : options.removeStunned === true && options.removeWounded === true
          ? "mortally-wounded"
          : options.removeWounded === true
            ? "stunned"
            : "wounded";
  const nextCondition =
    previousCondition === "dead"
      ? "dead"
      : incoming === "dead"
        ? "dead"
        : incoming === "mortally-wounded"
          ? "mortally-wounded"
          : hyperLethalCondition(previousCondition, resisted, options);
  return Object.freeze({
    damageTotal: damage,
    incoming,
    nextCondition,
    previousCondition,
    killingBlow,
    resistanceComplication,
    resistanceTotal: resistance,
  });
}

export interface SecondEditionDeclaredPool {
  readonly id: string;
  readonly kind: "attribute" | "attack" | "skill";
  readonly label: string;
  readonly score: number;
}

export interface SecondEditionDeclarationPoolPlan extends SecondEditionDeclaredPool {
  readonly effectiveScore: number;
  readonly legal: boolean;
}

export interface SecondEditionDeclarationPlan {
  readonly actionCount: number;
  readonly actionPenaltyScore: number;
  readonly conditionPenaltyScore: number;
  readonly environmentPenaltyScore: number;
  readonly legal: boolean;
  readonly movementSkillPenaltyScore: number;
  readonly pools: readonly SecondEditionDeclarationPoolPlan[];
}

export function secondEditionDeclarationPlan(
  actionCount: number,
  condition: SecondEditionCondition,
  movementMode: SecondEditionMovementMode,
  pools: readonly SecondEditionDeclaredPool[],
  environmentPenaltyScore = 0,
): SecondEditionDeclarationPlan {
  if (!Number.isSafeInteger(actionCount) || actionCount < 1) {
    throw new RangeError("A declaration must contain at least one action.");
  }
  const actionPenaltyScore = multipleActionPenaltyScore(actionCount);
  const conditionPenaltyScore = secondEditionConditionPenaltyScore(condition);
  const normalizedEnvironmentPenalty = Number.isSafeInteger(
    environmentPenaltyScore,
  )
    ? Math.max(0, environmentPenaltyScore)
    : 0;
  const movementSkillPenaltyScore = secondEditionMovementPlan(
    movementMode,
    movementMode === "crawl" || movementMode === "stand" ? "prone" : "standing",
  ).skillPenaltyScore;
  const plannedPools = pools.map((pool) => {
    if (
      !pool.id ||
      !pool.label.trim() ||
      !Number.isSafeInteger(pool.score) ||
      pool.score < 0
    ) {
      throw new RangeError("Declared roll pools must be valid pip scores.");
    }
    const effectiveScore =
      pool.score -
      actionPenaltyScore -
      conditionPenaltyScore -
      normalizedEnvironmentPenalty -
      (pool.kind === "attribute" ? 0 : movementSkillPenaltyScore);
    return Object.freeze({
      ...pool,
      effectiveScore,
      legal: effectiveScore >= PIPS_PER_DIE,
    });
  });
  return Object.freeze({
    actionCount,
    actionPenaltyScore,
    conditionPenaltyScore,
    environmentPenaltyScore: normalizedEnvironmentPenalty,
    legal:
      secondEditionConditionAllowsActions(condition) &&
      plannedPools.every((pool) => pool.legal),
    movementSkillPenaltyScore,
    pools: Object.freeze(plannedPools),
  });
}

export type SecondEditionAttackKind = "melee" | "ranged";
export type SecondEditionDefenseKind = "dodge" | "parry" | "range";
export type SecondEditionRangeBand =
  "melee" | "point-blank" | "short" | "medium" | "long";
export type SecondEditionMovementMode =
  "hold" | "walk" | "run" | "crawl" | "stand";
export type SecondEditionPosture = "standing" | "prone";

export interface SecondEditionWeaponRanges {
  readonly long: number;
  readonly medium: number;
  readonly short: number;
}

export interface SecondEditionRangeResolution {
  readonly attackKind: SecondEditionAttackKind;
  readonly band: SecondEditionRangeBand | null;
  readonly distance: number;
  readonly maximumDistance: number;
  readonly outOfRange: boolean;
}

export interface SecondEditionCoverDefensePlan {
  readonly baseDefense: number;
  readonly coverModifier: number;
  readonly defense: number;
}

export interface SecondEditionNoDodgeDefensePlan {
  readonly defense: 5 | 10 | 15 | 20 | 30;
  readonly rangeBand: Exclude<SecondEditionRangeBand, "melee">;
  readonly sourcePage: 94;
  readonly targetDodging: boolean;
}

export interface SecondEditionArmorContribution {
  readonly id: string;
  readonly label: string;
  readonly score: number;
  readonly stackingTag?: string;
}

export interface SecondEditionResistancePlan {
  readonly armorScore: number;
  readonly brawnScore: number;
  readonly contributors: readonly SecondEditionArmorContribution[];
  readonly score: number;
  readonly capped: boolean;
  readonly maximumScore?: number;
  readonly uncappedScore: number;
}

export interface SecondEditionMovementPlan {
  readonly actionRequired: boolean;
  readonly maximumDistance: number;
  readonly mode: SecondEditionMovementMode;
  readonly postureAfter: SecondEditionPosture;
  readonly requiresProne: boolean;
  readonly skillPenaltyScore: number;
}

export interface SecondEditionScaleInteraction {
  readonly attackerAttackBonusScore: number;
  readonly attackerDamageBonusScore: number;
  readonly difference: number;
  readonly targetDodgeBonus: number;
  readonly targetResistanceBonusScore: number;
}

export type OpenD6ScaleSide = "human" | "larger" | "smaller";

export interface OpenD6ScaleValue {
  readonly magnitude: number;
  readonly side: OpenD6ScaleSide;
}

function openD6ScalePosition(value: OpenD6ScaleValue): number {
  if (!Number.isSafeInteger(value.magnitude) || value.magnitude < 0) {
    throw new RangeError(
      "Open D6 scale magnitude must be a nonnegative integer.",
    );
  }
  if (value.side === "human") {
    if (value.magnitude !== 0) {
      throw new RangeError("Human Open D6 scale must have magnitude zero.");
    }
    return 0;
  }
  if (value.magnitude === 0) {
    throw new RangeError(
      "Non-human Open D6 scale must have a positive magnitude.",
    );
  }
  return value.side === "smaller" ? -value.magnitude : value.magnitude;
}

export function openD6ScaleInteraction(
  attacker: OpenD6ScaleValue,
  target: OpenD6ScaleValue,
): SecondEditionScaleInteraction {
  const attackerPosition = openD6ScalePosition(attacker);
  const targetPosition = openD6ScalePosition(target);
  const difference = Math.abs(attackerPosition - targetPosition);
  if (attackerPosition < targetPosition) {
    return Object.freeze({
      attackerAttackBonusScore: difference,
      attackerDamageBonusScore: 0,
      difference,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: difference,
    });
  }
  if (attackerPosition > targetPosition) {
    return Object.freeze({
      attackerAttackBonusScore: 0,
      attackerDamageBonusScore: difference,
      difference,
      targetDodgeBonus: difference,
      targetResistanceBonusScore: 0,
    });
  }
  return Object.freeze({
    attackerAttackBonusScore: 0,
    attackerDamageBonusScore: 0,
    difference: 0,
    targetDodgeBonus: 0,
    targetResistanceBonusScore: 0,
  });
}

function finiteRange(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function secondEditionWeaponAttackKind(
  ranges: SecondEditionWeaponRanges,
): SecondEditionAttackKind {
  return finiteRange(ranges.long) > 0 ? "ranged" : "melee";
}

export function secondEditionDefenseKind(
  attackKind: SecondEditionAttackKind,
): SecondEditionDefenseKind {
  return attackKind === "ranged" ? "dodge" : "parry";
}

export function secondEditionRangeForDistance(
  distance: number,
  ranges: SecondEditionWeaponRanges,
  meleeReach = 1,
): SecondEditionRangeResolution {
  const normalizedDistance = finiteRange(distance);
  const short = finiteRange(ranges.short);
  const medium = finiteRange(ranges.medium);
  const long = finiteRange(ranges.long);
  const attackKind = secondEditionWeaponAttackKind({ long, medium, short });
  if (attackKind === "melee") {
    const maximumDistance = Math.max(1, finiteRange(meleeReach));
    return Object.freeze({
      attackKind,
      band: normalizedDistance <= maximumDistance ? "melee" : null,
      distance: normalizedDistance,
      maximumDistance,
      outOfRange: normalizedDistance > maximumDistance,
    });
  }
  if (short > medium || medium > long) {
    return Object.freeze({
      attackKind,
      band: null,
      distance: normalizedDistance,
      maximumDistance: long,
      outOfRange: true,
    });
  }
  const band: SecondEditionRangeBand | null =
    normalizedDistance <= short
      ? "short"
      : normalizedDistance <= medium
        ? "medium"
        : normalizedDistance <= long
          ? "long"
          : null;
  return Object.freeze({
    attackKind,
    band,
    distance: normalizedDistance,
    maximumDistance: long,
    outOfRange: band === null,
  });
}

export function secondEditionAttackHits(
  attackTotal: number,
  defense: number,
): boolean {
  const total = Number.isFinite(attackTotal) ? Math.trunc(attackTotal) : 0;
  const target = Number.isFinite(defense)
    ? Math.max(0, Math.trunc(defense))
    : 0;
  return total > target;
}

/** Resolve the fixed ranged difficulties from Module: No Dodge Defense (p. 94). */
export function secondEditionNoDodgeDefensePlan(
  rangeBand: Exclude<SecondEditionRangeBand, "melee">,
  targetDodging = false,
): SecondEditionNoDodgeDefensePlan {
  const dodging = rangeBand === "long" && targetDodging;
  const defense =
    rangeBand === "point-blank"
      ? 5
      : rangeBand === "short"
        ? 10
        : rangeBand === "medium"
          ? 15
          : dodging
            ? 30
            : 20;
  return Object.freeze({
    defense,
    rangeBand,
    sourcePage: 94,
    targetDodging: dodging,
  });
}

export function secondEditionCoverDefensePlan(
  baseDefense: number,
  coverModifier: number,
): SecondEditionCoverDefensePlan {
  const normalizedBase = Number.isFinite(baseDefense)
    ? Math.max(0, Math.trunc(baseDefense))
    : 0;
  const normalizedCover = Number.isFinite(coverModifier)
    ? Math.max(0, Math.trunc(coverModifier))
    : 0;
  return Object.freeze({
    baseDefense: normalizedBase,
    coverModifier: normalizedCover,
    defense: normalizedBase + normalizedCover,
  });
}

export function secondEditionMovementPlan(
  mode: SecondEditionMovementMode,
  posture: SecondEditionPosture = "standing",
  endProne = false,
): SecondEditionMovementPlan {
  const plans: Readonly<
    Record<
      SecondEditionMovementMode,
      Omit<SecondEditionMovementPlan, "mode" | "postureAfter">
    >
  > = {
    hold: {
      actionRequired: false,
      maximumDistance: 0,
      requiresProne: false,
      skillPenaltyScore: 0,
    },
    walk: {
      actionRequired: true,
      maximumDistance: 5,
      requiresProne: false,
      skillPenaltyScore: 0,
    },
    run: {
      actionRequired: true,
      maximumDistance: 10,
      requiresProne: false,
      skillPenaltyScore: PIPS_PER_DIE,
    },
    crawl: {
      actionRequired: true,
      maximumDistance: 2,
      requiresProne: true,
      skillPenaltyScore: PIPS_PER_DIE,
    },
    stand: {
      actionRequired: true,
      maximumDistance: 0,
      requiresProne: true,
      skillPenaltyScore: 0,
    },
  };
  const plan = plans[mode];
  if (plan.requiresProne && posture !== "prone") {
    throw new RangeError("D6E2.Combat.Error.MovementRequiresProne");
  }
  if ((mode === "walk" || mode === "run") && posture !== "standing") {
    throw new RangeError("D6E2.Combat.Error.MovementRequiresStanding");
  }
  return Object.freeze({
    ...plan,
    mode,
    postureAfter:
      mode === "stand"
        ? "standing"
        : endProne && (mode === "walk" || mode === "run")
          ? "prone"
          : posture,
  });
}

export function secondEditionDefenseForPosture(
  defense: number,
  attackKind: SecondEditionAttackKind,
  posture: SecondEditionPosture,
): number {
  const normalized = Number.isFinite(defense)
    ? Math.max(0, Math.trunc(defense))
    : 0;
  if (posture !== "prone") return normalized;
  return attackKind === "ranged" ? normalized + 10 : Math.min(normalized, 10);
}

export function secondEditionRoundStartCondition(
  condition: SecondEditionCondition,
): SecondEditionCondition {
  return condition === "staggered" || condition === "stunned"
    ? "healthy"
    : condition;
}

export function secondEditionScaleInteraction(
  attackerRank: number,
  targetRank: number,
): SecondEditionScaleInteraction {
  if (
    !Number.isSafeInteger(attackerRank) ||
    !Number.isSafeInteger(targetRank) ||
    attackerRank < 0 ||
    attackerRank > 6 ||
    targetRank < 0 ||
    targetRank > 6
  ) {
    throw new RangeError(
      "Second Edition scale ranks must be integers from 0 to 6.",
    );
  }
  const difference = Math.abs(attackerRank - targetRank);
  const bonus = difference * PIPS_PER_DIE;
  return Object.freeze({
    attackerAttackBonusScore: attackerRank < targetRank ? bonus : 0,
    attackerDamageBonusScore: attackerRank > targetRank ? bonus : 0,
    difference,
    targetDodgeBonus: targetRank < attackerRank ? bonus : 0,
    targetResistanceBonusScore: targetRank > attackerRank ? bonus : 0,
  });
}

export function secondEditionResistancePlan(
  brawnScore: number,
  armor: readonly SecondEditionArmorContribution[],
  maximumScore?: number,
): SecondEditionResistancePlan {
  const normalizedBrawn = Math.max(0, pipScore(brawnScore));
  const eligible = armor
    .map((entry) =>
      Object.freeze({
        id: entry.id,
        label: entry.label,
        score: Math.max(0, pipScore(entry.score)),
        ...(entry.stackingTag?.trim()
          ? { stackingTag: entry.stackingTag.trim().toLowerCase() }
          : {}),
      }),
    )
    .filter((entry) => entry.score > 0);
  const strongest = (
    entries: readonly SecondEditionArmorContribution[],
  ): SecondEditionArmorContribution | undefined =>
    [...entries].sort(
      (left, right) =>
        right.score - left.score || left.label.localeCompare(right.label),
    )[0];
  const body = strongest(
    eligible.filter((entry) => entry.stackingTag !== "shield"),
  );
  const shield = strongest(
    eligible.filter((entry) => entry.stackingTag === "shield"),
  );
  const contributors = Object.freeze(
    [body, shield].filter(
      (entry): entry is SecondEditionArmorContribution => entry !== undefined,
    ),
  );
  const armorScore = contributors.reduce(
    (total, entry) => total + entry.score,
    0,
  );
  const uncappedScore = normalizedBrawn + armorScore;
  const normalizedMaximum =
    maximumScore === undefined
      ? undefined
      : Math.max(0, pipScore(maximumScore));
  const score =
    normalizedMaximum === undefined
      ? uncappedScore
      : Math.min(uncappedScore, normalizedMaximum);
  return Object.freeze({
    armorScore,
    brawnScore: normalizedBrawn,
    capped: score < uncappedScore,
    contributors,
    ...(normalizedMaximum === undefined
      ? {}
      : { maximumScore: normalizedMaximum }),
    score,
    uncappedScore,
  });
}
