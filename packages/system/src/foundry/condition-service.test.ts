import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recoverActorRoundStartCondition,
  setActorCondition,
  setActorFirstEditionWound,
  setActorPosture,
} from "./condition-service";

const settings = new Map<string, unknown>();

beforeEach(() => {
  settings.clear();
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) => settings.get(key) ?? false,
    },
  });
});

function actor(condition: string, heroPoints: number) {
  const updates: Record<string, unknown>[] = [];
  return {
    document: {
      id: "actor-1",
      isOwner: true,
      system: {
        health: { condition, firstEditionWound: "healthy" },
        movement: { posture: "standing" },
        resources: { heroPoints: { value: heroPoints } },
      },
      update: (changes: Record<string, unknown>) => {
        updates.push(changes);
        return Promise.resolve();
      },
    },
    updates,
  };
}

describe("Second Edition condition command", () => {
  it("spends one Hero Point and retains the prior condition when preventing Stunned", async () => {
    const subject = actor("staggered", 2);
    await expect(
      setActorCondition(subject.document, "stunned", {
        preventStunnedWithHeroPoint: true,
      }),
    ).resolves.toEqual({
      current: "staggered",
      heroPointSpent: 1,
      previous: "staggered",
      prevented: true,
    });
    expect(subject.updates).toEqual([
      { "system.resources.heroPoints.value": 1 },
    ]);
  });

  it("applies an ordinary condition transition without spending", async () => {
    const subject = actor("healthy", 2);
    await expect(
      setActorCondition(subject.document, "wounded"),
    ).resolves.toEqual({
      current: "wounded",
      heroPointSpent: 0,
      previous: "healthy",
      prevented: false,
    });
    expect(subject.updates).toEqual([
      {
        "system.health.condition": "wounded",
        "system.movement.posture": "prone",
      },
    ]);
  });

  it("rejects prevention without an available Hero Point", async () => {
    const subject = actor("healthy", 0);
    await expect(
      setActorCondition(subject.document, "stunned", {
        preventStunnedWithHeroPoint: true,
      }),
    ).rejects.toThrow("The Hero Point expenditure exceeds the balance.");
    expect(subject.updates).toEqual([]);
  });

  it("persists voluntary posture changes without touching condition", async () => {
    const subject = actor("healthy", 2);
    await expect(setActorPosture(subject.document, "prone")).resolves.toEqual({
      current: "prone",
      previous: "standing",
    });
    expect(subject.updates).toEqual([{ "system.movement.posture": "prone" }]);
  });

  it("persists the independent First Edition wound and forces severe wounds prone", async () => {
    const subject = actor("healthy", 1);
    await expect(
      setActorFirstEditionWound(subject.document, "severely-wounded"),
    ).resolves.toEqual({ current: "severely-wounded", previous: "healthy" });
    expect(subject.updates).toEqual([
      {
        "system.health.firstEditionWound": "severely-wounded",
        "system.movement.posture": "prone",
      },
    ]);
  });

  it("clears Staggered and Stunned at round start but retains Wounded", async () => {
    const stunned = actor("stunned", 1);
    const wounded = actor("wounded", 1);
    await expect(
      recoverActorRoundStartCondition(stunned.document),
    ).resolves.toBe(true);
    await expect(
      recoverActorRoundStartCondition(wounded.document),
    ).resolves.toBe(false);
    expect(stunned.updates).toEqual([{ "system.health.condition": "healthy" }]);
    expect(wounded.updates).toEqual([]);
  });
});
