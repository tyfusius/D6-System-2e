import { describe, expect, it } from "vitest";
import {
  applyFirstEditionAccumulatingStun,
  emptyFirstEditionAccumulatingStuns,
  firstEditionAccumulatingStunThreshold,
  normalizeFirstEditionAccumulatingStuns,
  recoverFirstEditionAccumulatingStunsAtRoundStart,
} from "./first-edition-accumulating-stuns";

describe("First Edition accumulating stuns compatibility extension", () => {
  it("uses whole Strength dice as the unconsciousness threshold", () => {
    expect(firstEditionAccumulatingStunThreshold(3)).toBe(1);
    expect(firstEditionAccumulatingStunThreshold(11)).toBe(3);
    expect(firstEditionAccumulatingStunThreshold(0)).toBe(1);
  });

  it("accumulates hits while keeping the short penalty noncumulative", () => {
    const first = applyFirstEditionAccumulatingStun(null, 2, 9);
    expect(first).toMatchObject({
      state: { total: 1, penaltyDice: 1, roundsRemaining: 2 },
      threshold: 3,
      crossedThreshold: false,
      immediatelyUnconscious: false,
    });
    const second = applyFirstEditionAccumulatingStun(first.state, 6, 9);
    expect(second).toMatchObject({
      state: { total: 2, penaltyDice: 2, roundsRemaining: 2 },
      crossedThreshold: false,
    });
    const third = applyFirstEditionAccumulatingStun(second.state, 1, 9);
    expect(third.crossedThreshold).toBe(true);
  });

  it("marks a nine-point hit as immediately unconscious", () => {
    expect(applyFirstEditionAccumulatingStun(null, 9, 12)).toMatchObject({
      state: { total: 1, penaltyDice: 0, roundsRemaining: 0 },
      immediatelyUnconscious: true,
    });
  });

  it("decays the penalty once per unique round and preserves the count", () => {
    const hit = applyFirstEditionAccumulatingStun(null, 2, 12).state;
    const first = recoverFirstEditionAccumulatingStunsAtRoundStart(hit, "c:2");
    expect(first).toMatchObject({
      total: 1,
      penaltyDice: 1,
      roundsRemaining: 1,
      lastProcessedRoundId: "c:2",
    });
    expect(
      recoverFirstEditionAccumulatingStunsAtRoundStart(first, "c:2"),
    ).toEqual(first);
    expect(
      recoverFirstEditionAccumulatingStunsAtRoundStart(first, "c:3"),
    ).toMatchObject({ total: 1, penaltyDice: 0, roundsRemaining: 0 });
  });

  it("normalizes malformed persisted state", () => {
    expect(
      normalizeFirstEditionAccumulatingStuns({
        version: 1,
        total: -4,
        penaltyDice: 8,
        roundsRemaining: 0,
        lastProcessedRoundId: "round",
      }),
    ).toEqual({
      ...emptyFirstEditionAccumulatingStuns(),
      lastProcessedRoundId: "round",
    });
  });
});
