import {
  D6_FREEFORM_MAGIC_CONTRACT_VERSION,
  D6_MAGIC_POINTS_CONTRACT_VERSION,
  type D6FreeformMagicDesignV1,
  type D6FreeformMagicDifficultyV1,
  type D6MagicPointPoolV1,
} from "../contracts/magic";

const TARGET_MODIFIERS: Readonly<
  Record<D6FreeformMagicDesignV1["target"], number>
> = Object.freeze({
  self: -5,
  one: 0,
  "two-three": 5,
  "four-six": 10,
  "small-crowd": 15,
  "large-crowd": 20,
  object: 0,
  "large-object": 5,
  environment: 10,
  "large-environment": 15,
});

const RESISTANCE_MODIFIERS: Readonly<
  Record<D6FreeformMagicDesignV1["resistance"], number>
> = Object.freeze({
  none: 15,
  partial: 5,
  complete: -5,
});

const DURATION_MODIFIERS: Readonly<
  Record<D6FreeformMagicDesignV1["duration"], number>
> = Object.freeze({
  instant: -5,
  round: 0,
  "ten-minutes": 5,
  hour: 10,
  day: 15,
  week: 20,
  month: 25,
  year: 30,
  century: 35,
  permanent: 40,
});

const CASTING_TIME_MODIFIERS: Readonly<
  Record<D6FreeformMagicDesignV1["castingTime"], number>
> = Object.freeze({
  action: 0,
  "two-turns": -5,
  "four-turns": -10,
  hour: -15,
  day: -20,
  week: -25,
  month: -30,
  year: -40,
});

const RANGE_MODIFIERS: Readonly<
  Record<D6FreeformMagicDesignV1["range"], number>
> = Object.freeze({
  melee: 0,
  senses: 5,
  mile: 10,
  locale: 15,
  "hundred-miles": 20,
  unlimited: 25,
});

export function freeformMagicDifficulty(
  design: D6FreeformMagicDesignV1,
): D6FreeformMagicDifficultyV1 {
  const power = Number.isFinite(design.power)
    ? Math.max(1, Math.trunc(design.power))
    : 1;
  const powerModifier = (power - 1) * 5;
  const targetModifier = TARGET_MODIFIERS[design.target];
  const resistanceModifier = RESISTANCE_MODIFIERS[design.resistance];
  const durationModifier = DURATION_MODIFIERS[design.duration];
  const castingTimeModifier = CASTING_TIME_MODIFIERS[design.castingTime];
  const rangeModifier = RANGE_MODIFIERS[design.range];
  return Object.freeze({
    base: 5,
    castingTimeModifier,
    contractVersion: D6_FREEFORM_MAGIC_CONTRACT_VERSION,
    difficulty: Math.max(
      5,
      5 +
        powerModifier +
        targetModifier +
        resistanceModifier +
        durationModifier +
        castingTimeModifier +
        rangeModifier,
    ),
    durationModifier,
    powerModifier,
    rangeModifier,
    resistanceModifier,
    sourcePages: [145, 159] as const,
    targetModifier,
  });
}

export function freeformMagicResistancePower(
  power: number,
  resistance: D6FreeformMagicDesignV1["resistance"],
  resisted: boolean,
): number {
  const normalized = Number.isFinite(power)
    ? Math.max(1, Math.trunc(power))
    : 1;
  if (!resisted || resistance === "none") return normalized;
  return resistance === "complete" ? 0 : Math.floor(normalized / 2);
}

export function freeformMagicUntrainedPenalty(
  hasSchoolSpecialization: boolean,
  magicAttributeScore: number,
  spellSchoolScore: number,
): 0 | 5 | 10 {
  if (hasSchoolSpecialization) return 0;
  return magicAttributeScore > 0 || spellSchoolScore > 0 ? 5 : 10;
}

function wholeDice(score: number): number {
  return Number.isFinite(score) ? Math.max(0, Math.floor(score / 3)) : 0;
}

export function magicPointMaximum(
  magicAttributeScore: number,
  mysticalAlignmentScore: number,
): number {
  return wholeDice(magicAttributeScore) + wholeDice(mysticalAlignmentScore) * 3;
}

export function magicPointCastingCost(difficulty: number): number {
  if (!Number.isFinite(difficulty)) {
    throw new RangeError("Magic Point casting difficulty must be finite.");
  }
  return Math.max(1, Math.ceil(Math.max(0, Math.trunc(difficulty)) / 10));
}

export function magicPointPool(
  current: number,
  magicAttributeScore: number,
  mysticalAlignmentScore: number,
): D6MagicPointPoolV1 {
  const magicDice = wholeDice(magicAttributeScore);
  const mysticalAlignmentDice = wholeDice(mysticalAlignmentScore);
  const maximum = magicDice + mysticalAlignmentDice * 3;
  return Object.freeze({
    contractVersion: D6_MAGIC_POINTS_CONTRACT_VERSION,
    current: Math.min(
      maximum,
      Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0,
    ),
    magicDice,
    maximum,
    mysticalAlignmentDice,
  });
}

export function recoverMagicPoints(
  pool: D6MagicPointPoolV1,
  hours = 1,
): D6MagicPointPoolV1 {
  if (!Number.isSafeInteger(hours) || hours < 1) {
    throw new RangeError("Magic Point recovery requires whole positive hours.");
  }
  return Object.freeze({
    ...pool,
    current: Math.min(pool.maximum, pool.current + pool.magicDice * hours),
  });
}
