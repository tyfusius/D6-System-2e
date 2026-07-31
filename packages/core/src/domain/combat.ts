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

export function secondEditionStaticDefense(attributeScore: number): number {
  return Math.floor(pipScore(attributeScore) / PIPS_PER_DIE) * 5;
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
  "staggered" | "wounded" | "mortally-wounded";

export interface SecondEditionDamageResolution {
  readonly damageTotal: number;
  readonly incoming: SecondEditionDamageOutcome;
  readonly nextCondition: SecondEditionCondition;
  readonly previousCondition: SecondEditionCondition;
  readonly resistanceComplication: boolean;
  readonly resistanceTotal: number;
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

export function secondEditionDamageResolution(
  damageTotal: number,
  resistanceTotal: number,
  resistanceComplication: boolean,
  previousCondition: SecondEditionCondition,
): SecondEditionDamageResolution {
  const damage = normalizedRollTotal(damageTotal);
  const resistance = normalizedRollTotal(resistanceTotal);
  const incoming: SecondEditionDamageOutcome =
    resistance > damage
      ? "staggered"
      : resistanceComplication
        ? "mortally-wounded"
        : "wounded";
  const nextCondition =
    previousCondition === "dead"
      ? "dead"
      : incoming === "mortally-wounded"
        ? "mortally-wounded"
        : incoming === "wounded"
          ? conditionAfterWounded(previousCondition)
          : conditionAfterStaggered(previousCondition);
  return Object.freeze({
    damageTotal: damage,
    incoming,
    nextCondition,
    previousCondition,
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
  readonly legal: boolean;
  readonly movementSkillPenaltyScore: number;
  readonly pools: readonly SecondEditionDeclarationPoolPlan[];
}

export function secondEditionDeclarationPlan(
  actionCount: number,
  condition: SecondEditionCondition,
  movementMode: SecondEditionMovementMode,
  pools: readonly SecondEditionDeclaredPool[],
): SecondEditionDeclarationPlan {
  if (!Number.isSafeInteger(actionCount) || actionCount < 1) {
    throw new RangeError("A declaration must contain at least one action.");
  }
  const actionPenaltyScore = multipleActionPenaltyScore(actionCount);
  const conditionPenaltyScore = secondEditionConditionPenaltyScore(condition);
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
    legal:
      secondEditionConditionAllowsActions(condition) &&
      plannedPools.every((pool) => pool.legal),
    movementSkillPenaltyScore,
    pools: Object.freeze(plannedPools),
  });
}

export type SecondEditionAttackKind = "melee" | "ranged";
export type SecondEditionDefenseKind = "dodge" | "parry";
export type SecondEditionRangeBand = "melee" | "short" | "medium" | "long";
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
  return Object.freeze({
    armorScore,
    brawnScore: normalizedBrawn,
    contributors,
    score: normalizedBrawn + armorScore,
  });
}
