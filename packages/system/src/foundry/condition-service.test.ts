import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActorCondition } from "./condition-service";

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
        health: { condition },
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
    expect(subject.updates).toEqual([{ "system.health.condition": "wounded" }]);
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
});
