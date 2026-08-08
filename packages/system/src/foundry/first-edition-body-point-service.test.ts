import { afterEach, describe, expect, it, vi } from "vitest";
import {
  damageActorFirstEditionBodyPoints,
  setActorFirstEditionBodyPoints,
} from "./first-edition-body-point-service";

afterEach(() => vi.unstubAllGlobals());

function actor(mode: string) {
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) =>
        key === "worldRulesProfiles"
          ? { activeProfileId: "open-d6", profiles: {}, version: 1 }
          : key === "gameMode"
            ? "open-d6"
            : key === "firstEditionBodyPoints"
              ? mode
              : false,
    },
  });
  const updates: Record<string, unknown>[] = [];
  return {
    document: {
      id: "target",
      isOwner: true,
      system: {
        health: {
          firstEditionBodyPoints: { current: 20, maximum: 20 },
          firstEditionState: { source: "none" },
          firstEditionWound: "healthy",
        },
      },
      update: vi.fn((change: Record<string, unknown>) => {
        updates.push(change);
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument,
    updates,
  };
}

describe("First Edition Body Point application service", () => {
  it("applies point damage without mutating inactive Wounds in body-only mode", async () => {
    const subject = actor("body-points");
    const result = await damageActorFirstEditionBodyPoints(subject.document, 9);
    expect(result).toMatchObject({
      current: 11,
      maximum: 20,
      wound: "wounded",
    });
    expect(subject.updates).toEqual([
      {
        "system.health.firstEditionBodyPoints": {
          current: 11,
          maximum: 20,
        },
      },
    ]);
  });

  it("synchronizes the read-only wound band in combined mode", async () => {
    const subject = actor("body-points-with-wounds");
    await damageActorFirstEditionBodyPoints(subject.document, 9);
    expect(subject.updates).toContainEqual({
      "system.health.firstEditionBodyPoints": {
        current: 11,
        maximum: 20,
      },
    });
    expect(subject.updates).toContainEqual(
      expect.objectContaining({
        "system.health.firstEditionWound": "wounded",
      }),
    );
  });

  it("clamps manual healing and maximum edits while preserving negative damage", async () => {
    const subject = actor("body-points");
    await expect(
      setActorFirstEditionBodyPoints(subject.document, {
        current: 99,
        maximum: 30,
      }),
    ).resolves.toEqual({ current: 30, maximum: 30 });
  });
});
