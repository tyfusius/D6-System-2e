import type { SecondEditionRangeBand } from "./combat";

export interface D6ExplosiveThrowRanges {
  readonly shortMinimum: number;
  readonly short: number;
  readonly medium: number;
  readonly long: number;
}

export interface D6ExplosiveRangeResolution {
  readonly band: Exclude<SecondEditionRangeBand, "melee"> | null;
  readonly distance: number;
  readonly maximumDistance: number;
  readonly outOfRange: boolean;
}

function boundary(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Shift every printed grenade boundary from the 2D Strength baseline. */
export function firstEditionStrengthAdjustedThrowRanges(
  ranges: D6ExplosiveThrowRanges,
  strengthScore: number,
): D6ExplosiveThrowRanges {
  const score = Number.isFinite(strengthScore)
    ? Math.max(0, Math.trunc(strengthScore))
    : 0;
  const modifier = score - 6;
  return Object.freeze({
    shortMinimum: boundary(ranges.shortMinimum + modifier),
    short: boundary(ranges.short + modifier),
    medium: boundary(ranges.medium + modifier),
    long: boundary(ranges.long + modifier),
  });
}

/** Resolve the fixed OpenD6 grenade-targeting band for an aimed distance. */
export function firstEditionExplosiveRangeForDistance(
  distance: number,
  ranges: D6ExplosiveThrowRanges,
): D6ExplosiveRangeResolution {
  const normalizedDistance = Number.isFinite(distance)
    ? Math.max(0, distance)
    : 0;
  const shortMinimum = boundary(ranges.shortMinimum);
  const short = Math.max(shortMinimum, boundary(ranges.short));
  const medium = Math.max(short, boundary(ranges.medium));
  const long = Math.max(medium, boundary(ranges.long));
  const band =
    normalizedDistance < shortMinimum
      ? "point-blank"
      : normalizedDistance <= short
        ? "short"
        : normalizedDistance <= medium
          ? "medium"
          : normalizedDistance <= long
            ? "long"
            : null;
  return Object.freeze({
    band,
    distance: normalizedDistance,
    maximumDistance: long,
    outOfRange: band === null,
  });
}

export function firstEditionGrenadeTargetingDifficulty(
  band: Exclude<SecondEditionRangeBand, "melee">,
): 0 | 10 | 15 | 20 {
  return band === "point-blank"
    ? 0
    : band === "short"
      ? 10
      : band === "medium"
        ? 15
        : 20;
}
