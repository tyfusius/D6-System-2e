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

export type SecondEditionAttackKind = "melee" | "ranged";
export type SecondEditionDefenseKind = "dodge" | "parry";
export type SecondEditionRangeBand = "melee" | "short" | "medium" | "long";

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
