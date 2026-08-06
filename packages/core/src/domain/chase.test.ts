import { describe, expect, it } from "vitest";
import type { D6ChaseParticipantV1 } from "../contracts/chase";
import {
  createD6Chase,
  resolveD6ChaseExchange,
  submitD6ChaseRoll,
} from "./chase";

const participant = (
  actorId: string,
  actorName: string,
): D6ChaseParticipantV1 => ({
  actorId,
  actorName,
  itemId: `skill-${actorId}`,
  skillName: "Running",
});

function ready(distance = 4) {
  let state = createD6Chase({
    distance,
    fleeing: participant("fleeing", "Runner"),
    id: "chase-1",
    label: "Market pursuit",
    pursuer: participant("pursuer", "Guard"),
  });
  state = submitD6ChaseRoll(
    state,
    {
      requestId: "roll-p",
      side: "pursuer",
      total: 15,
      userId: "gm",
      wildOutcome: "normal",
    },
    0,
  );
  return submitD6ChaseRoll(
    state,
    {
      requestId: "roll-f",
      side: "fleeing",
      total: 12,
      userId: "player",
      wildOutcome: "unresolved-complication",
    },
    1,
  );
}

describe("Second Edition chases", () => {
  it("starts at Distance 4 with two fixed representatives and Skills", () => {
    const state = createD6Chase({
      fleeing: participant("fleeing", "Runner"),
      id: "chase-1",
      label: "Market pursuit",
      pursuer: participant("pursuer", "Guard"),
    });
    expect(state).toMatchObject({
      distance: 4,
      exchange: 1,
      revision: 0,
      status: "active",
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(() =>
      createD6Chase({
        fleeing: participant("same", "Runner"),
        id: "bad",
        label: "Bad chase",
        pursuer: participant("same", "Guard"),
      }),
    ).toThrow(/two different/);
  });

  it("moves toward capture by one and records an auditable exchange", () => {
    const result = resolveD6ChaseExchange(ready(), { expectedRevision: 2 });
    expect(result).toMatchObject({
      distance: 3,
      exchange: 2,
      revision: 3,
      status: "active",
      rolls: {},
    });
    expect(result.history[0]).toMatchObject({
      exceptional: false,
      fleeingTotal: 12,
      fleeingWildOutcome: "unresolved-complication",
      fromDistance: 4,
      pursuerTotal: 15,
      shift: 1,
      toDistance: 3,
      winner: "pursuer",
    });
  });

  it("moves by two on Exceptional Success and ends at the printed endpoints", () => {
    expect(
      resolveD6ChaseExchange(ready(1), {
        exceptional: true,
        expectedRevision: 2,
      }),
    ).toMatchObject({ distance: 0, status: "caught" });
    const fleeingWins = ready(7);
    const pursuerRoll = fleeingWins.rolls.pursuer;
    const fleeingRoll = fleeingWins.rolls.fleeing;
    if (!pursuerRoll || !fleeingRoll)
      throw new Error("Expected completed rolls.");
    const adjusted = {
      ...fleeingWins,
      rolls: {
        pursuer: { ...pursuerRoll, total: 9 },
        fleeing: { ...fleeingRoll, total: 18 },
      },
    };
    expect(
      resolveD6ChaseExchange(adjusted, {
        exceptional: true,
        expectedRevision: 2,
      }),
    ).toMatchObject({ distance: 8, status: "escaped" });
  });

  it("requires both rolls, rejects stale writes, and lets the GM break ties", () => {
    const state = createD6Chase({
      fleeing: participant("fleeing", "Runner"),
      id: "chase-1",
      label: "Market pursuit",
      pursuer: participant("pursuer", "Guard"),
    });
    expect(() =>
      resolveD6ChaseExchange(state, { expectedRevision: 0 }),
    ).toThrow(/Both/);
    expect(() =>
      submitD6ChaseRoll(
        state,
        { requestId: "x", side: "pursuer", total: 10, userId: "gm" },
        1,
      ),
    ).toThrow(/changed/);
    const completed = ready();
    const pursuerRoll = completed.rolls.pursuer;
    const fleeingRoll = completed.rolls.fleeing;
    if (!pursuerRoll || !fleeingRoll)
      throw new Error("Expected completed rolls.");
    const tied = {
      ...completed,
      rolls: {
        pursuer: { ...pursuerRoll, total: 12 },
        fleeing: { ...fleeingRoll, total: 12 },
      },
    };
    expect(() => resolveD6ChaseExchange(tied, { expectedRevision: 2 })).toThrow(
      /break a tied/,
    );
    expect(
      resolveD6ChaseExchange(tied, { expectedRevision: 2, winner: "fleeing" }),
    ).toMatchObject({ distance: 5 });
  });
});
