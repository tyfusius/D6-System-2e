import { describe, expect, it } from "vitest";
import {
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
