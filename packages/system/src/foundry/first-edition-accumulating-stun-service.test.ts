import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  duration: vi.fn(),
}));

vi.mock("./rolls/roll-service", () => ({
  rollFirstEditionAccumulatingStunDuration: serviceMocks.duration,
}));

import {
  applyActorFirstEditionAccumulatingStun,
  clearActorFirstEditionAccumulatingStuns,
  recoverActorFirstEditionAccumulatingStunsAtRoundStart,
} from "./first-edition-accumulating-stun-service";

function subject(total = 0, brawn = 9) {
  const update = vi.fn<(data: Record<string, unknown>) => Promise<void>>(() =>
    Promise.resolve(),
  );
  return {
    actor: {
      id: "actor-1",
      isOwner: true,
      system: {
        attributes: { brawn: { score: brawn } },
        health: {
          firstEditionState: { source: "none" },
          firstEditionStuns: {
            version: 1,
            total,
            penaltyDice: total > 0 ? 1 : 0,
            roundsRemaining: total > 0 ? 1 : 0,
            lastProcessedRoundId: "",
          },
        },
      },
      update,
    } as unknown as FoundryActorDocument,
    update,
  };
}

describe("First Edition accumulating-stuns service", () => {
  beforeEach(() => {
    serviceMocks.duration.mockReset();
    serviceMocks.duration.mockResolvedValue({ total: 7 });
  });

  it("persists a noncumulative penalty without rolling duration", async () => {
    const { actor, update } = subject();
    const result = await applyActorFirstEditionAccumulatingStun(actor, {
      damageTotal: 5,
      difference: 2,
      reducedWound: "stunned",
      resistanceTotal: 3,
      unconsciousMinutes: 2,
    });
    expect(result).toMatchObject({
      state: { total: 1, penaltyDice: 1, roundsRemaining: 2 },
      threshold: 3,
      unconsciousMinutes: 0,
    });
    expect(serviceMocks.duration).not.toHaveBeenCalled();
    expect(
      update.mock.calls[0]?.[0]?.["system.health.firstEditionStuns"],
    ).toMatchObject({ total: 1 });
  });

  it("rolls 2D minutes when the Strength threshold is crossed", async () => {
    const { actor, update } = subject(2);
    const result = await applyActorFirstEditionAccumulatingStun(actor, {
      damageTotal: 2,
      difference: 1,
      reducedWound: "stunned",
      resistanceTotal: 1,
      unconsciousMinutes: 1,
    });
    expect(result.unconsciousMinutes).toBe(7);
    expect(serviceMocks.duration).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.health.firstEditionState.consciousness": "unconscious",
        "system.health.firstEditionState.unconsciousMinutes": 7,
        "system.movement.posture": "prone",
      }),
    );
  });

  it("uses the damage difference for an immediate severe stun", async () => {
    const { actor } = subject();
    const result = await applyActorFirstEditionAccumulatingStun(actor, {
      damageTotal: 15,
      difference: 9,
      reducedWound: "incapacitated",
      resistanceTotal: 6,
      unconsciousMinutes: 9,
    });
    expect(result.unconsciousMinutes).toBe(9);
    expect(serviceMocks.duration).not.toHaveBeenCalled();
  });

  it("decays once per round and clears only through explicit rest", async () => {
    const { actor, update } = subject(1);
    expect(
      await recoverActorFirstEditionAccumulatingStunsAtRoundStart(
        actor,
        "combat:2",
      ),
    ).toBe(true);
    expect(
      update.mock.calls[0]?.[0]?.["system.health.firstEditionStuns"],
    ).toMatchObject({ total: 1, roundsRemaining: 0 });
    await clearActorFirstEditionAccumulatingStuns(actor);
    expect(
      update.mock.calls.at(-1)?.[0]?.["system.health.firstEditionStuns"],
    ).toMatchObject({ total: 0 });
  });
});
