import { describe, expect, it } from "vitest";
import {
  d6BlastDamageScore,
  d6BlastZoneAtDistance,
  normalizeD6BlastProfile,
  planD6ExplosiveScatter,
  firstEditionExplosiveRangeForDistance,
  firstEditionGrenadeTargetingDifficulty,
  firstEditionStrengthAdjustedThrowRanges,
  secondEditionBrawnAdjustedThrowRanges,
  secondEditionExplosiveRangeForDistance,
} from "./explosives";

const printed = { shortMinimum: 3, short: 4, medium: 7, long: 12 };

describe("First Edition thrown explosives", () => {
  it("keeps printed ranges at the 2D Strength baseline", () => {
    expect(firstEditionStrengthAdjustedThrowRanges(printed, 6)).toEqual(
      printed,
    );
  });

  it("shifts every boundary one meter per Strength pip and clamps at zero", () => {
    expect(firstEditionStrengthAdjustedThrowRanges(printed, 3)).toEqual({
      shortMinimum: 0,
      short: 1,
      medium: 4,
      long: 9,
    });
    expect(firstEditionStrengthAdjustedThrowRanges(printed, 9)).toEqual({
      shortMinimum: 6,
      short: 7,
      medium: 10,
      long: 15,
    });
  });

  it("uses an empty point-blank band when weak Strength shifts Short to zero", () => {
    const ranges = firstEditionStrengthAdjustedThrowRanges(printed, 3);
    expect(firstEditionExplosiveRangeForDistance(0, ranges).band).toBe("short");
    expect(firstEditionExplosiveRangeForDistance(1.1, ranges).band).toBe(
      "medium",
    );
    expect(firstEditionExplosiveRangeForDistance(4.1, ranges).band).toBe(
      "long",
    );
  });

  it("uses the printed grenade targeting difficulties", () => {
    expect(firstEditionGrenadeTargetingDifficulty("point-blank")).toBe(0);
    expect(firstEditionGrenadeTargetingDifficulty("short")).toBe(10);
    expect(firstEditionGrenadeTargetingDifficulty("medium")).toBe(15);
    expect(firstEditionGrenadeTargetingDifficulty("long")).toBe(20);
  });
});

describe("Second Edition thrown explosives", () => {
  it("keeps printed ranges at the 2D Brawn baseline", () => {
    expect(secondEditionBrawnAdjustedThrowRanges(printed, 6)).toEqual(printed);
  });

  it("shifts every boundary one meter per effective Brawn pip", () => {
    expect(secondEditionBrawnAdjustedThrowRanges(printed, 3)).toEqual({
      shortMinimum: 0,
      short: 1,
      medium: 4,
      long: 9,
    });
    expect(secondEditionBrawnAdjustedThrowRanges(printed, 14)).toEqual({
      shortMinimum: 11,
      short: 12,
      medium: 15,
      long: 20,
    });
  });

  it("uses the authored Short minimum without changing native defense rules", () => {
    expect(secondEditionExplosiveRangeForDistance(2, printed).band).toBe(
      "point-blank",
    );
    expect(secondEditionExplosiveRangeForDistance(3, printed).band).toBe(
      "short",
    );
    expect(secondEditionExplosiveRangeForDistance(7, printed).band).toBe(
      "medium",
    );
    expect(secondEditionExplosiveRangeForDistance(12, printed).band).toBe(
      "long",
    );
  });
});

describe("native blast placement", () => {
  const profile = normalizeD6BlastProfile({
    activeZoneCount: 4,
    damageKind: "physical",
    damageMode: "per-zone",
    detonationTiming: "immediate",
    zones: [
      { damageScore: 18, index: 1, radiusMeters: 2 },
      { damageScore: 15, index: 2, radiusMeters: 4 },
      { damageScore: 12, index: 3, radiusMeters: 6 },
      { damageScore: 9, index: 4, radiusMeters: 8 },
    ],
  });

  it("normalizes exactly three or four ordered authored zones", () => {
    expect(profile.zones.map((zone) => zone.index)).toEqual([1, 2, 3, 4]);
    expect(() =>
      normalizeD6BlastProfile({ ...profile, zones: [profile.zones[1]] }),
    ).toThrow("D6E2.Explosive.Error.ZonesRequired");
    expect(() =>
      normalizeD6BlastProfile({
        ...profile,
        zones: [
          profile.zones[0],
          { ...profile.zones[1], radiusMeters: 1 },
          ...profile.zones.slice(2),
        ],
      }),
    ).toThrow("D6E2.Explosive.Error.ZoneInvalid");
    expect(() =>
      normalizeD6BlastProfile({
        ...profile,
        damageMode: "per-zone",
        zones: [
          { ...profile.zones[0], damageScore: 2 },
          ...profile.zones.slice(1),
        ],
      }),
    ).toThrow("D6E2.Explosive.Error.ZoneDamageRequired");
  });

  it("uses exact inclusive zone boundaries and rejects outside points", () => {
    expect(d6BlastZoneAtDistance(2, profile)).toBe(1);
    expect(d6BlastZoneAtDistance(2.01, profile)).toBe(2);
    expect(d6BlastZoneAtDistance(8, profile)).toBe(4);
    expect(d6BlastZoneAtDistance(8.01, profile)).toBeNull();
  });

  it("selects per-zone pools and lawful falloff without changing the roll engine", () => {
    expect(d6BlastDamageScore(21, 3, profile)).toBe(12);
    expect(
      d6BlastDamageScore(21, 2, { ...profile, damageMode: "falloff" }),
    ).toBe(10);
    expect(
      d6BlastDamageScore(21, 3, { ...profile, damageMode: "falloff" }),
    ).toBe(5);
  });

  it("plans deterministic range-band scatter", () => {
    expect(
      planD6ExplosiveScatter({
        directionDie: 1,
        distanceMeters: 7,
        rangeBand: "medium",
      }),
    ).toEqual({
      bearingDegrees: 0,
      directionDie: 1,
      directionDieSides: 6,
      distanceDice: 2,
      distanceMeters: 7,
    });
    expect(
      planD6ExplosiveScatter({
        directionDie: 7,
        directionDieSides: 8,
        distanceMeters: 4,
        rangeBand: "short",
      }),
    ).toMatchObject({ bearingDegrees: -135, directionDieSides: 8 });
    expect(() =>
      planD6ExplosiveScatter({
        directionDie: 7,
        distanceMeters: 4,
        rangeBand: "short",
      }),
    ).toThrow("D6E2.Explosive.Error.ScatterDirection");
  });

  it("maps d6 and optional d8 directions relative to the throw vector", () => {
    const expected = [0, 45, 90, 180, -90, -45, -135, 135];
    expect(
      expected.map(
        (bearing, index) =>
          planD6ExplosiveScatter({
            directionDie: index + 1,
            directionDieSides: 8,
            distanceMeters: 1,
            rangeBand: "short",
          }).bearingDegrees === bearing,
      ),
    ).toEqual(expected.map(() => true));
  });
});
