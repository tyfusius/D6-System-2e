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

export type D6BlastDamageMode = "falloff" | "per-zone";
export type D6BlastDamageKind = "physical" | "stun";
export type D6ExplosiveDetonationTiming = "immediate" | "end-of-round";
export type D6BlastZoneIndex = 1 | 2 | 3 | 4;

export interface D6BlastZone {
  readonly damageScore: number;
  readonly index: D6BlastZoneIndex;
  readonly radiusMeters: number;
}

export interface D6BlastProfile {
  readonly activeZoneCount: 3 | 4;
  readonly damageKind: D6BlastDamageKind;
  readonly damageMode: D6BlastDamageMode;
  readonly detonationTiming: D6ExplosiveDetonationTiming;
  readonly zones: readonly D6BlastZone[];
}

export interface D6ExplosiveScatterPlan {
  readonly bearingDegrees: number;
  readonly directionDie: number;
  /** Present on new audits; omitted by pre-Beta-16 persisted regions (d6). */
  readonly directionDieSides?: 6 | 8;
  readonly distanceDice: 1 | 2 | 3;
  readonly distanceMeters: number;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Strictly normalize an authored blast profile. Missing data is never inferred. */
export function normalizeD6BlastProfile(value: unknown): D6BlastProfile {
  const source = object(value);
  if (!source) throw new RangeError("D6E2.Explosive.Error.ProfileRequired");
  const activeZoneCount = Number(source.activeZoneCount);
  const damageMode = source.damageMode;
  const damageKind = source.damageKind;
  const detonationTiming = source.detonationTiming;
  if (activeZoneCount !== 3 && activeZoneCount !== 4)
    throw new RangeError("D6E2.Explosive.Error.ZoneCount");
  if (damageMode !== "falloff" && damageMode !== "per-zone")
    throw new RangeError("D6E2.Explosive.Error.DamageMode");
  if (damageKind !== "physical" && damageKind !== "stun")
    throw new RangeError("D6E2.Explosive.Error.DamageKind");
  if (detonationTiming !== "immediate" && detonationTiming !== "end-of-round")
    throw new RangeError("D6E2.Explosive.Error.DetonationTiming");
  if (!Array.isArray(source.zones) || source.zones.length < activeZoneCount)
    throw new RangeError("D6E2.Explosive.Error.ZonesRequired");
  let priorRadius = 0;
  const zones = source.zones.slice(0, activeZoneCount).map((entry, offset) => {
    const zone = object(entry);
    const index = Number(zone?.index);
    const radiusMeters = Number(zone?.radiusMeters);
    const damageScore = Number(zone?.damageScore);
    if (
      index !== offset + 1 ||
      !Number.isFinite(radiusMeters) ||
      radiusMeters <= priorRadius ||
      !Number.isInteger(damageScore) ||
      damageScore < 0
    ) {
      throw new RangeError("D6E2.Explosive.Error.ZoneInvalid");
    }
    priorRadius = radiusMeters;
    return Object.freeze({
      damageScore,
      index: index as D6BlastZoneIndex,
      radiusMeters,
    });
  });
  if (damageMode === "per-zone" && zones.some((zone) => zone.damageScore < 3))
    throw new RangeError("D6E2.Explosive.Error.ZoneDamageRequired");
  return Object.freeze({
    activeZoneCount,
    damageKind,
    damageMode,
    detonationTiming,
    zones: Object.freeze(zones),
  });
}

/** Resolve the innermost ordered blast zone containing a 2D footprint distance. */
export function d6BlastZoneAtDistance(
  distanceMeters: number,
  profile: D6BlastProfile,
): D6BlastZoneIndex | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  return (
    profile.zones.find((zone) => distanceMeters <= zone.radiusMeters)?.index ??
    null
  );
}

/** Resolve a zone's damage pool score without changing the underlying roll rules. */
export function d6BlastDamageScore(
  baseDamageScore: number,
  zone: D6BlastZoneIndex,
  profile: D6BlastProfile,
): number {
  if (zone > profile.activeZoneCount) return 0;
  if (profile.damageMode === "per-zone")
    return (
      profile.zones.find((entry) => entry.index === zone)?.damageScore ?? 0
    );
  const score = Math.max(0, Math.trunc(baseDamageScore));
  return zone === 1
    ? score
    : zone === 2
      ? Math.floor(score / 2)
      : Math.floor(score / 4);
}

export function d6ScatterDistanceDice(
  band: Exclude<SecondEditionRangeBand, "melee">,
): 1 | 2 | 3 {
  return band === "medium" ? 2 : band === "long" ? 3 : 1;
}

export function planD6ExplosiveScatter(input: {
  readonly directionDie: number;
  readonly directionDieSides?: 6 | 8;
  readonly distanceMeters: number;
  readonly rangeBand: Exclude<SecondEditionRangeBand, "melee">;
}): D6ExplosiveScatterPlan {
  const directionDie = Math.trunc(input.directionDie);
  const directionDieSides = input.directionDieSides ?? 6;
  const bearings = [0, 45, 90, 180, -90, -45, -135, 135] as const;
  if (directionDie < 1 || directionDie > directionDieSides)
    throw new RangeError("D6E2.Explosive.Error.ScatterDirection");
  if (!Number.isFinite(input.distanceMeters) || input.distanceMeters < 0)
    throw new RangeError("D6E2.Explosive.Error.ScatterDistance");
  return Object.freeze({
    bearingDegrees: bearings[directionDie - 1] ?? 0,
    directionDie,
    directionDieSides,
    distanceDice: d6ScatterDistanceDice(input.rangeBand),
    distanceMeters: Math.trunc(input.distanceMeters),
  });
}

function boundary(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function abilityAdjustedThrowRanges(
  ranges: D6ExplosiveThrowRanges,
  abilityScore: number,
): D6ExplosiveThrowRanges {
  const score = Number.isFinite(abilityScore)
    ? Math.max(0, Math.trunc(abilityScore))
    : 0;
  const modifier = score - 6;
  return Object.freeze({
    shortMinimum: boundary(ranges.shortMinimum + modifier),
    short: boundary(ranges.short + modifier),
    medium: boundary(ranges.medium + modifier),
    long: boundary(ranges.long + modifier),
  });
}

/** Shift every printed grenade boundary from the 2D Strength baseline. */
export function firstEditionStrengthAdjustedThrowRanges(
  ranges: D6ExplosiveThrowRanges,
  strengthScore: number,
): D6ExplosiveThrowRanges {
  return abilityAdjustedThrowRanges(ranges, strengthScore);
}

/** Shift every printed grenade boundary from the 2D Brawn baseline. */
export function secondEditionBrawnAdjustedThrowRanges(
  ranges: D6ExplosiveThrowRanges,
  brawnScore: number,
): D6ExplosiveThrowRanges {
  return abilityAdjustedThrowRanges(ranges, brawnScore);
}

function explosiveRangeForDistance(
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

/** Resolve the fixed OpenD6 grenade-targeting band for an aimed distance. */
export function firstEditionExplosiveRangeForDistance(
  distance: number,
  ranges: D6ExplosiveThrowRanges,
): D6ExplosiveRangeResolution {
  return explosiveRangeForDistance(distance, ranges);
}

/** Resolve a typed Second Edition explosive's complete authored range bands. */
export function secondEditionExplosiveRangeForDistance(
  distance: number,
  ranges: D6ExplosiveThrowRanges,
): D6ExplosiveRangeResolution {
  return explosiveRangeForDistance(distance, ranges);
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
