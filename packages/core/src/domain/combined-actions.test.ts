import { describe, expect, it } from "vitest";
import {
  combinedActionBonus,
  combinedActionRoles,
  validateCombinedActionAllocation,
} from "./combined-actions";

describe("optional combined actions", () => {
  const candidate = (
    actorId: string,
    commandScore: number,
    perceptionScore: number,
    taskScore: number,
    commandTrained = true,
  ) => ({
    actorId,
    actorName: actorId,
    commandScore,
    commandTrained,
    perceptionScore,
    taskScore,
  });

  it("selects the strongest trained Command leader and highest task worker", () => {
    const roles = combinedActionRoles([
      candidate("leader", 20, 9, 10),
      candidate("worker", 12, 12, 24),
      candidate("untrained", 0, 21, 15, false),
    ]);

    expect(roles).toMatchObject({
      capacity: 7,
      leader: { actorId: "untrained" },
      leaderScore: 21,
      primaryWorker: { actorId: "worker" },
    });
  });

  it("turns each participant into one pip and removes 1D per missed point", () => {
    expect(combinedActionBonus(3, 15, 15).finalBonusScore).toBe(3);
    expect(combinedActionBonus(4, 15, 15).finalBonusScore).toBe(4);
    expect(combinedActionBonus(5, 15, 15).finalBonusScore).toBe(5);
    expect(combinedActionBonus(8, 15, 15)).toMatchObject({
      commandSucceeded: true,
      finalBonusScore: 8,
      potentialBonusScore: 8,
    });
    expect(combinedActionBonus(8, 14, 15)).toMatchObject({
      commandSucceeded: false,
      finalBonusScore: 5,
    });
    expect(combinedActionBonus(8, 11, 15).finalBonusScore).toBe(0);
  });

  it("requires the complete bonus to be allocated without creating pips", () => {
    expect(validateCombinedActionAllocation(8, [4, 2, 2])).toEqual([4, 2, 2]);
    expect(() => validateCombinedActionAllocation(8, [4, 3])).toThrow(
      RangeError,
    );
  });
});
