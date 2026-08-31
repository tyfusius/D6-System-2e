import { describe, expect, it } from "vitest";
import {
  FREE_D6_FATIGUE_CHANNEL_ID,
  applyFreeD6FatigueLevel,
  consequencePenaltyProjection,
  freeD6FatigueProjection,
  normalizeActorConsequenceState,
} from "./consequences";

describe("versioned consequence channels", () => {
  it("keeps Fatigue independent from unrelated physical channel state", () => {
    const physical = Object.freeze({
      channelId: "d6e2.consequence.physical",
      level: 2,
      revision: 4,
      source: "damage",
      unconscious: false,
    });
    const next = applyFreeD6FatigueLevel(
      { channels: { [physical.channelId]: physical }, version: 1 },
      2,
      9,
      { expectedRevision: 0, source: "running" },
    );
    expect(next.channels[physical.channelId]).toStrictEqual(physical);
    expect(next.channels[FREE_D6_FATIGUE_CHANNEL_ID]).toMatchObject({
      level: 2,
      revision: 1,
      source: "running",
      unconscious: false,
    });
  });

  it("adds ordered physical and Fatigue penalties without overwriting either", () => {
    const projection = consequencePenaltyProjection([
      {
        channelId: "physical",
        label: "Wounded",
        penaltyScore: 3,
        scope: "all-rolls",
        stackingGroup: "consequences",
      },
      freeD6FatigueProjection(2, 9).effect,
    ]);
    expect(projection.totalPenaltyScore).toBe(9);
    expect(projection.effects.map(({ channelId }) => channelId)).toEqual([
      "physical",
      FREE_D6_FATIGUE_CHANNEL_ID,
    ]);
  });

  it("uses Stamina or Willpower minus one die and becomes unconscious only after the threshold", () => {
    expect(freeD6FatigueProjection(3, 9)).toMatchObject({
      threshold: { basis: "stamina", thresholdDice: 3 },
      unconscious: false,
    });
    expect(freeD6FatigueProjection(4, 9)).toMatchObject({ unconscious: true });
    expect(freeD6FatigueProjection(4, 6, 18)).toMatchObject({
      threshold: { basis: "willpower", thresholdDice: 5 },
      unconscious: false,
    });
    expect(freeD6FatigueProjection(4, 10)).toMatchObject({
      threshold: { basis: "stamina", thresholdDice: 3 },
      unconscious: true,
    });
  });

  it("normalizes missing legacy state without writing or inventing channels", () => {
    expect(normalizeActorConsequenceState(undefined)).toEqual({
      channels: {},
      version: 1,
    });
  });

  it("rejects stale revisioned writes", () => {
    const current = applyFreeD6FatigueLevel(undefined, 1, 9);
    expect(() =>
      applyFreeD6FatigueLevel(current, 2, 9, { expectedRevision: 0 }),
    ).toThrow("D6E2.Consequences.Error.RevisionConflict");
  });
});
