import { describe, expect, it } from "vitest";
import { firstEditionSegmentMovementPlan } from "./first-edition-segment-movement";

describe("Tyfusius First Edition segmented movement", () => {
  it("uses the lowest post-MAP pool and caps movement by Move divided by actions", () => {
    expect(
      firstEditionSegmentMovementPlan({
        baseMove: 12,
        effectiveScores: [15, 9, 12],
        plannedActionCount: 3,
      }),
    ).toMatchObject({
      calculable: true,
      diceAllowance: 3,
      lowestEffectiveScore: 9,
      maximumDistance: 3,
      normalDistance: 3,
      runningDifficulty: 15,
    });
  });

  it("lets a reactor use its own shorter queue and therefore move farther", () => {
    const trigger = firstEditionSegmentMovementPlan({
      baseMove: 12,
      effectiveScores: [12, 12, 12, 12],
      plannedActionCount: 4,
    });
    const reactor = firstEditionSegmentMovementPlan({
      baseMove: 12,
      effectiveScores: [12, 12],
      plannedActionCount: 2,
    });
    expect(trigger.normalDistance).toBe(3);
    expect(reactor.normalDistance).toBe(4);
  });

  it("doubles the normal segment distance for Running and uses actions times five", () => {
    expect(
      firstEditionSegmentMovementPlan({
        baseMove: 12,
        effectiveScores: [12, 9, 12],
        plannedActionCount: 3,
        running: true,
      }),
    ).toMatchObject({
      maximumDistance: 6,
      normalDistance: 3,
      runningDifficulty: 15,
    });
  });

  it("requires at least one linked pool for automatic calculation", () => {
    expect(
      firstEditionSegmentMovementPlan({
        baseMove: 10,
        effectiveScores: [],
        plannedActionCount: 2,
      }),
    ).toMatchObject({ calculable: false, maximumDistance: 0 });
  });
});
