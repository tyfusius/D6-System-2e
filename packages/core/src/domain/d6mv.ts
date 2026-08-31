/** Neutral D6 Magnetic Variant mechanics. No setting content belongs here. */

export type D6MvDegree =
  | "catastrophic-failure"
  | "exceptional-failure"
  | "exceptional-success"
  | "ordinary-failure"
  | "ordinary-success"
  | "partial-success";

export type D6MvInitiativeReadiness = "ready" | "unaware";
export type D6MvInitiativeSkill = "instinct" | "reflex";
export type D6MvScale = "character" | "grand" | "vehicle";
export type D6MvActionType = "basic" | "quick" | "slow";
export type D6MvInjuryLevel =
  | "dead"
  | "healthy"
  | "incapacitated"
  | "mortally-wounded"
  | "stunned"
  | "wounded";
export type D6MvTraumaLevel =
  "none" | "severely-traumatized" | "shaken" | "stunned" | "traumatized";
export type D6MvWildAuthority = "game-master" | "player";
export type D6MvWildChoiceId =
  | "advantage-failure-ally-hero-point"
  | "advantage-failure-explode"
  | "advantage-failure-partial-setback"
  | "advantage-success-ally-hero-point"
  | "advantage-success-exceptional"
  | "advantage-success-two-hero-points"
  | "complication-failure-catastrophic"
  | "complication-failure-exceptional"
  | "complication-failure-setback"
  | "complication-success-failure"
  | "complication-success-partial"
  | "complication-success-setback";

export interface D6MvSrpInput {
  readonly dexterityScore: number;
  readonly perceptionScore: number;
  readonly willpowerScore: number;
}

export interface D6MvSrp {
  readonly psyche: number;
  readonly ready: number;
  readonly surprised: number;
}

export interface D6MvVsmInput {
  readonly frameScore: number;
  readonly maneuverabilityScore: number;
  readonly scale: D6MvScale;
}

export interface D6MvVsm {
  readonly mobile: number;
  readonly static: number;
}

export interface D6MvScaleInteraction {
  readonly multiplier: 1 | 2 | 4;
  readonly side: "none" | "source-damage" | "target-resistance";
}

export interface D6MvDegreeEvidence {
  readonly achieved: boolean;
  readonly consequence: "immediate" | "looming" | "none" | "setback";
  readonly damageMultiplier: 1 | 2;
  readonly degree: D6MvDegree;
  readonly difficulty: number;
  readonly margin: number;
  readonly total: number;
}

export interface D6MvWildDecision {
  readonly authority: D6MvWildAuthority;
  readonly choices: readonly D6MvWildChoiceId[];
  readonly kind: "advantage" | "complication";
}

export interface D6MvWildResolution {
  readonly allyHeroPoints: number;
  readonly degree: D6MvDegree;
  readonly requiresExplosion: boolean;
  readonly selfHeroPoints: number;
  readonly setback: boolean;
}

export interface D6MvInitiativeParticipant {
  readonly id: string;
  readonly kind: "npc" | "player";
  readonly readiness: D6MvInitiativeReadiness;
  readonly sideId: string;
  readonly total: number;
}

export interface D6MvInitiativeSide {
  readonly highest: number;
  readonly representativeId: string;
  readonly sideId: string;
}

export interface D6MvInitiativePlan {
  readonly order: readonly D6MvInitiativeSide[];
  readonly rerollEachRound: true;
}

export interface D6MvFullDefenseInput {
  readonly kind: "mental" | "physical";
  readonly skillScore: number;
  readonly tookOtherBasicAction: boolean;
}

export interface D6MvFatigueState {
  readonly level: number;
  readonly mortallyWounded: boolean;
  readonly penaltyScore: number;
}

export interface D6MvMortalityResolution {
  readonly checkTotal: number;
  readonly died: boolean;
  readonly roundsPassed: number;
}

export interface D6MvRecoveryRule {
  readonly difficulty: number | null;
  readonly next: D6MvInjuryLevel | D6MvTraumaLevel;
  readonly reduction: "full" | "one-level";
}

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
  return value;
}

function score(value: number, label: string): number {
  const normalized = integer(value, label);
  if (normalized < 0) throw new RangeError(`${label} cannot be negative.`);
  return normalized;
}

/** Six-degree fixed-difficulty result ladder. */
export function d6MvDegree(total: number, difficulty: number): D6MvDegree {
  const resolvedTotal = integer(total, "Roll total");
  const resolvedDifficulty = score(difficulty, "Difficulty");
  if (resolvedTotal > resolvedDifficulty * 2) return "exceptional-success";
  if (resolvedTotal > resolvedDifficulty) return "ordinary-success";
  if (resolvedTotal === resolvedDifficulty) return "partial-success";
  const margin = resolvedTotal - resolvedDifficulty;
  if (margin >= -9) return "ordinary-failure";
  if (margin >= -19) return "exceptional-failure";
  return "catastrophic-failure";
}

export function d6MvDegreeEvidence(
  total: number,
  difficulty: number,
): D6MvDegreeEvidence {
  const degree = d6MvDegree(total, difficulty);
  const achieved = [
    "exceptional-success",
    "ordinary-success",
    "partial-success",
  ].includes(degree);
  return Object.freeze({
    achieved,
    consequence:
      degree === "partial-success"
        ? "setback"
        : degree === "exceptional-failure"
          ? "looming"
          : degree === "catastrophic-failure"
            ? "immediate"
            : "none",
    damageMultiplier: degree === "exceptional-success" ? 2 : 1,
    degree,
    difficulty,
    margin: total - difficulty,
    total,
  });
}

export function d6MvDegreeSucceeded(degree: D6MvDegree): boolean {
  return (
    degree === "exceptional-success" ||
    degree === "ordinary-success" ||
    degree === "partial-success"
  );
}

const ADVANTAGE_SUCCESS_CHOICES = Object.freeze([
  "advantage-success-exceptional",
  "advantage-success-two-hero-points",
  "advantage-success-ally-hero-point",
] as const);
const ADVANTAGE_FAILURE_CHOICES = Object.freeze([
  "advantage-failure-explode",
  "advantage-failure-partial-setback",
  "advantage-failure-ally-hero-point",
] as const);
const COMPLICATION_SUCCESS_CHOICES = Object.freeze([
  "complication-success-setback",
  "complication-success-partial",
  "complication-success-failure",
] as const);
const COMPLICATION_FAILURE_CHOICES = Object.freeze([
  "complication-failure-setback",
  "complication-failure-exceptional",
  "complication-failure-catastrophic",
] as const);

/** Source-defined Advantage/Complication authority and decision set. */
export function d6MvWildDecision(
  wildFace: number,
  degree: D6MvDegree,
): D6MvWildDecision | null {
  const resolvedFace = integer(wildFace, "Wild Die face");
  if (resolvedFace < 1 || resolvedFace > 6) {
    throw new RangeError("Wild Die face must be between 1 and 6.");
  }
  const success = d6MvDegreeSucceeded(degree);
  if (resolvedFace === 6) {
    return Object.freeze({
      authority: "player",
      choices: success ? ADVANTAGE_SUCCESS_CHOICES : ADVANTAGE_FAILURE_CHOICES,
      kind: "advantage",
    });
  }
  if (resolvedFace === 1) {
    return Object.freeze({
      authority: "game-master",
      choices: success
        ? COMPLICATION_SUCCESS_CHOICES
        : COMPLICATION_FAILURE_CHOICES,
      kind: "complication",
    });
  }
  return null;
}

function isD6MvWildChoice(value: string): value is D6MvWildChoiceId {
  return [
    ...ADVANTAGE_SUCCESS_CHOICES,
    ...ADVANTAGE_FAILURE_CHOICES,
    ...COMPLICATION_SUCCESS_CHOICES,
    ...COMPLICATION_FAILURE_CHOICES,
  ].includes(value as D6MvWildChoiceId);
}

/** Applies one authorized Wild Die choice without performing the follow-up roll. */
export function applyD6MvWildChoice(
  degree: D6MvDegree,
  wildFace: number,
  choice: D6MvWildChoiceId,
): D6MvWildResolution {
  const decision = d6MvWildDecision(wildFace, degree);
  if (
    !decision ||
    !isD6MvWildChoice(choice) ||
    !decision.choices.includes(choice)
  ) {
    throw new RangeError("Wild Die choice is not available for this result.");
  }
  let resolvedDegree = degree;
  let allyHeroPoints = 0;
  let selfHeroPoints = 0;
  let setback = false;
  let requiresExplosion = false;
  switch (choice) {
    case "advantage-success-exceptional":
      resolvedDegree = "exceptional-success";
      selfHeroPoints = 1;
      break;
    case "advantage-success-two-hero-points":
      selfHeroPoints = 2;
      break;
    case "advantage-success-ally-hero-point":
    case "advantage-failure-ally-hero-point":
      allyHeroPoints = 1;
      break;
    case "advantage-failure-explode":
      requiresExplosion = true;
      selfHeroPoints = 1;
      break;
    case "advantage-failure-partial-setback":
      resolvedDegree = "partial-success";
      setback = true;
      break;
    case "complication-success-setback":
    case "complication-failure-setback":
      setback = true;
      break;
    case "complication-success-partial":
      resolvedDegree = "partial-success";
      selfHeroPoints = 1;
      break;
    case "complication-success-failure":
      resolvedDegree = "ordinary-failure";
      selfHeroPoints = 2;
      break;
    case "complication-failure-exceptional":
      resolvedDegree = "exceptional-failure";
      selfHeroPoints = 1;
      break;
    case "complication-failure-catastrophic":
      resolvedDegree = "catastrophic-failure";
      selfHeroPoints = 2;
      break;
  }
  return Object.freeze({
    allyHeroPoints,
    degree: resolvedDegree,
    requiresExplosion,
    selfHeroPoints,
    setback,
  });
}

function wholeDiceStaticDefense(value: number, label: string): number {
  return Math.floor(score(value, label) / 3) * 3;
}

/** Static Surprised, Ready, and Psyche defenses; attribute pips are dropped. */
export function d6MvSrp(input: D6MvSrpInput): D6MvSrp {
  return Object.freeze({
    psyche: wholeDiceStaticDefense(input.willpowerScore, "Willpower score"),
    ready: wholeDiceStaticDefense(input.dexterityScore, "Dexterity score"),
    surprised: wholeDiceStaticDefense(
      input.perceptionScore,
      "Perception score",
    ),
  });
}

/** Vehicular Static/Mobile defenses. Attribute pips are dropped. */
export function d6MvVsm(input: D6MvVsmInput): D6MvVsm {
  if (input.scale !== "vehicle" && input.scale !== "grand") {
    throw new RangeError("VSM requires Vehicle or Grand scale.");
  }
  const frameDice = Math.floor(score(input.frameScore, "Frame score") / 3);
  const maneuverabilityDice = Math.floor(
    score(input.maneuverabilityScore, "Maneuverability score") / 3,
  );
  const staticDefense = (input.scale === "vehicle" ? 3 : 0) - frameDice;
  return Object.freeze({
    mobile: staticDefense + maneuverabilityDice,
    static: staticDefense,
  });
}

export function d6MvInitiativeSkill(
  readiness: D6MvInitiativeReadiness,
): D6MvInitiativeSkill {
  return readiness === "ready" ? "reflex" : "instinct";
}

/** Highest individual roll represents each side; player sides win cross-kind ties. */
export function d6MvInitiativePlan(
  participants: readonly D6MvInitiativeParticipant[],
): D6MvInitiativePlan {
  const sides = new Map<
    string,
    D6MvInitiativeSide & { readonly kind: "npc" | "player" }
  >();
  for (const participant of participants) {
    const total = integer(participant.total, "Initiative total");
    if (!participant.id || !participant.sideId) {
      throw new RangeError("Initiative participants require stable ids.");
    }
    const current = sides.get(participant.sideId);
    if (
      current === undefined ||
      total > current.highest ||
      (total === current.highest && participant.id < current.representativeId)
    ) {
      sides.set(participant.sideId, {
        highest: total,
        kind: participant.kind,
        representativeId: participant.id,
        sideId: participant.sideId,
      });
    }
  }
  const ordered = [...sides.values()].sort(
    (left, right) =>
      right.highest - left.highest ||
      (left.kind === right.kind ? 0 : left.kind === "player" ? -1 : 1) ||
      left.sideId.localeCompare(right.sideId),
  );
  return Object.freeze({
    order: Object.freeze(
      ordered.map(({ highest, representativeId, sideId }) =>
        Object.freeze({ highest, representativeId, sideId }),
      ),
    ),
    rerollEachRound: true,
  });
}

export const D6MV_SURPRISE_ACTION = Object.freeze({
  beforeInitiative: true,
  choices: Object.freeze(["one-basic", "movement-and-basic"] as const),
});

export function d6MvBasicActionPenaltyScore(basicActions: number): number {
  return Math.max(0, integer(basicActions, "Basic action count") - 1) * 3;
}

export function d6MvMovementAction(distanceMeters: number): "basic" | "quick" {
  const distance = score(distanceMeters, "Movement distance");
  if (distance > 12) throw new RangeError("Movement cannot exceed 12 meters.");
  return distance <= 6 ? "quick" : "basic";
}

export function d6MvFullDefenseBonus(input: D6MvFullDefenseInput): number {
  return input.tookOtherBasicAction
    ? 0
    : score(
        input.skillScore,
        input.kind === "physical" ? "Reflex or Instinct score" : "Grit score",
      );
}

export function d6MvInjuryForDamage(
  damageTotal: number,
  strengthTotal: number,
): Exclude<D6MvInjuryLevel, "dead" | "healthy"> {
  const damage = score(damageTotal, "Damage total");
  const strength = score(strengthTotal, "Strength total");
  if (damage < strength) return "stunned";
  if (damage < strength * 2) return "wounded";
  if (damage < strength * 3) return "incapacitated";
  return "mortally-wounded";
}

const INJURY_RANK: Readonly<Record<D6MvInjuryLevel, number>> = Object.freeze({
  healthy: -1,
  stunned: 0,
  wounded: 1,
  incapacitated: 2,
  "mortally-wounded": 3,
  dead: 4,
});

/** Preserves prior damage while applying source-defined repeated-injury escalation. */
export function accumulateD6MvInjury(
  current: D6MvInjuryLevel,
  incoming: Exclude<D6MvInjuryLevel, "dead">,
): D6MvInjuryLevel {
  if (current === "dead") return "dead";
  if (current === "mortally-wounded" && incoming !== "stunned") return "dead";
  if (
    current === "incapacitated" &&
    (incoming === "wounded" || incoming === "incapacitated")
  ) {
    return "mortally-wounded";
  }
  if (current === "wounded" && incoming === "wounded") {
    return "incapacitated";
  }
  return INJURY_RANK[incoming] > INJURY_RANK[current] ? incoming : current;
}

export function d6MvTraumaForAttack(
  attackTotal: number,
  psyche: number,
): D6MvTraumaLevel {
  const attack = score(attackTotal, "Mental attack total");
  const defense = score(psyche, "Psyche");
  if (attack < defense) return "none";
  if (attack < defense * 2) return "stunned";
  if (attack < defense * 3) return "shaken";
  if (attack < defense * 4) return "traumatized";
  return "severely-traumatized";
}

export function d6MvFatigueState(
  level: number,
  strengthScore: number,
): D6MvFatigueState {
  const normalizedLevel = score(level, "Fatigue level");
  const penaltyScore = normalizedLevel * 3;
  return Object.freeze({
    level: normalizedLevel,
    mortallyWounded: penaltyScore >= score(strengthScore, "Strength score"),
    penaltyScore,
  });
}

const INJURY_RECOVERY: Readonly<Record<D6MvInjuryLevel, D6MvRecoveryRule>> =
  Object.freeze({
    dead: Object.freeze({ difficulty: null, next: "dead", reduction: "full" }),
    healthy: Object.freeze({
      difficulty: null,
      next: "healthy",
      reduction: "full",
    }),
    stunned: Object.freeze({
      difficulty: 5,
      next: "healthy",
      reduction: "full",
    }),
    wounded: Object.freeze({
      difficulty: 10,
      next: "healthy",
      reduction: "full",
    }),
    incapacitated: Object.freeze({
      difficulty: 15,
      next: "wounded",
      reduction: "one-level",
    }),
    "mortally-wounded": Object.freeze({
      difficulty: 20,
      next: "incapacitated",
      reduction: "one-level",
    }),
  });

/** Medical and once-per-day natural healing share the current injury DN. */
export function d6MvInjuryRecoveryRule(
  injury: D6MvInjuryLevel,
): D6MvRecoveryRule {
  return INJURY_RECOVERY[injury];
}

const TRAUMA_RECOVERY: Readonly<Record<D6MvTraumaLevel, D6MvRecoveryRule>> =
  Object.freeze({
    none: Object.freeze({ difficulty: null, next: "none", reduction: "full" }),
    stunned: Object.freeze({
      difficulty: null,
      next: "none",
      reduction: "full",
    }),
    shaken: Object.freeze({ difficulty: 10, next: "none", reduction: "full" }),
    traumatized: Object.freeze({
      difficulty: 15,
      next: "none",
      reduction: "full",
    }),
    "severely-traumatized": Object.freeze({
      difficulty: 20,
      next: "none",
      reduction: "full",
    }),
  });

export function d6MvTraumaRecoveryRule(
  trauma: D6MvTraumaLevel,
): D6MvRecoveryRule {
  return TRAUMA_RECOVERY[trauma];
}

const TRAUMA_RANK: Readonly<Record<D6MvTraumaLevel, number>> = Object.freeze({
  none: 0,
  stunned: 1,
  shaken: 2,
  traumatized: 3,
  "severely-traumatized": 4,
});

/** Mental trauma is independent of physical injury and retains the worse level. */
export function accumulateD6MvTrauma(
  current: D6MvTraumaLevel,
  incoming: D6MvTraumaLevel,
): D6MvTraumaLevel {
  return TRAUMA_RANK[incoming] > TRAUMA_RANK[current] ? incoming : current;
}

/** Wounded, Shaken/Traumatized, and Fatigue penalties are independent and cumulative. */
export function d6MvCombinedPenaltyScore(input: {
  readonly fatigueLevel: number;
  readonly injury: D6MvInjuryLevel;
  readonly trauma: D6MvTraumaLevel;
}): number {
  const injuryPenalty = input.injury === "wounded" ? 3 : 0;
  const traumaPenalty =
    input.trauma === "shaken" || input.trauma === "traumatized" ? 3 : 0;
  return (
    injuryPenalty +
    traumaPenalty +
    score(input.fatigueLevel, "Fatigue level") * 3
  );
}

/** Source-defined end-of-round Mortally Wounded check. */
export function d6MvMortalityResolution(
  checkTotal: number,
  roundsPassed: number,
): D6MvMortalityResolution {
  const total = score(checkTotal, "Mortality check total");
  const rounds = score(roundsPassed, "Rounds passed");
  return Object.freeze({
    checkTotal: total,
    died: total < rounds,
    roundsPassed: rounds,
  });
}

const SCALE_RANK: Readonly<Record<D6MvScale, number>> = Object.freeze({
  character: 0,
  vehicle: 1,
  grand: 2,
});

/** Multiplication applies to the larger target's resistance or larger source's damage. */
export function d6MvScaleInteraction(
  source: D6MvScale,
  target: D6MvScale,
): D6MvScaleInteraction {
  const difference = SCALE_RANK[source] - SCALE_RANK[target];
  const magnitude = Math.abs(difference);
  const multiplier: 1 | 2 | 4 = magnitude === 0 ? 1 : magnitude === 1 ? 2 : 4;
  return Object.freeze({
    multiplier,
    side:
      difference === 0
        ? "none"
        : difference > 0
          ? "source-damage"
          : "target-resistance",
  });
}

/** Skill Points required for one pip of improvement. */
export function d6MvSkillImprovementCost(currentScore: number): number {
  return Math.max(1, Math.floor(score(currentScore, "Skill score") / 3));
}

/** Hero Points required for one Attribute pip of improvement. */
export function d6MvAttributeImprovementCost(currentScore: number): number {
  return (
    Math.max(1, Math.floor(score(currentScore, "Attribute score") / 3)) * 6
  );
}
