import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
vi.stubGlobal("game", {
  settings: { get: (_system: string, key: string) => values.get(key) },
});
vi.stubGlobal("Hooks", { callAll: vi.fn() });

import {
  OPEN_D6_BODY_POINT_HYBRID_MODEL_ID,
  OPEN_D6_BODY_POINT_POOL_MODEL_ID,
  OPEN_D6_LEGACY_HEALTH_MODEL_ID,
  OPEN_D6_WOUND_TRACK_MODEL_ID,
  availableHealthModels,
  configuredHealthDamageModeOverride,
  healthModelForStrategy,
  registerHealthModelContribution,
  resetHealthModelLibraryForTests,
} from "./health-model-library";

describe("neutral health model library", () => {
  beforeEach(() => {
    values.clear();
    resetHealthModelLibraryForTests();
  });

  it("publishes concrete track, pool, and hybrid models", () => {
    expect(availableHealthModels().map(({ kind }) => kind)).toEqual([
      "track",
      "track",
      "pool",
      "hybrid",
    ]);
    expect(healthModelForStrategy(OPEN_D6_WOUND_TRACK_MODEL_ID)?.kind).toBe(
      "track",
    );
    expect(healthModelForStrategy(OPEN_D6_BODY_POINT_POOL_MODEL_ID)?.kind).toBe(
      "pool",
    );
    expect(
      healthModelForStrategy(OPEN_D6_BODY_POINT_HYBRID_MODEL_ID)?.kind,
    ).toBe("hybrid");
  });

  it("keeps the old Open D6 strategy as a lossless setting-backed alias", () => {
    values.set("firstEditionBodyPoints", "body-points-with-wounds");
    expect(healthModelForStrategy(OPEN_D6_LEGACY_HEALTH_MODEL_ID)?.id).toBe(
      OPEN_D6_BODY_POINT_HYBRID_MODEL_ID,
    );
  });

  it("derives explicit Rules Profile damage modes without the legacy toggle", () => {
    const profile = (health: string) => ({ strategies: { health } }) as never;
    expect(
      configuredHealthDamageModeOverride(
        profile(OPEN_D6_BODY_POINT_POOL_MODEL_ID),
      ),
    ).toBe("body-points");
    expect(
      configuredHealthDamageModeOverride(
        profile(OPEN_D6_BODY_POINT_HYBRID_MODEL_ID),
      ),
    ).toBe("body-points-with-wounds");
    expect(
      configuredHealthDamageModeOverride(profile(OPEN_D6_WOUND_TRACK_MODEL_ID)),
    ).toBe("wounds");
  });

  it("accepts owner-scoped module models with supported damage strategies", () => {
    const base = healthModelForStrategy(OPEN_D6_WOUND_TRACK_MODEL_ID);
    expect(base?.kind).toBe("track");
    registerHealthModelContribution("echo-d6", {
      ...(base as Extract<NonNullable<typeof base>, { kind: "track" }>),
      id: "echo-d6.health.wounds",
      label: "Echo wounds",
    });
    expect(
      availableHealthModels().find(({ id }) => id === "echo-d6.health.wounds")
        ?.source,
    ).toEqual({ kind: "module", ownerId: "echo-d6" });
  });

  it("rejects a shape and damage-strategy mismatch", () => {
    const base = healthModelForStrategy(OPEN_D6_BODY_POINT_POOL_MODEL_ID);
    expect(base?.kind).toBe("pool");
    expect(() =>
      registerHealthModelContribution("echo-d6", {
        ...(base as Extract<NonNullable<typeof base>, { kind: "pool" }>),
        damageStrategyId: "open-d6.damage.wounds",
        id: "echo-d6.health.invalid-pool",
      }),
    ).toThrow(/cannot use/u);
  });

  it("rejects track states unsupported by the selected runtime strategy", () => {
    const base = healthModelForStrategy(OPEN_D6_WOUND_TRACK_MODEL_ID);
    expect(base?.kind).toBe("track");
    expect(() =>
      registerHealthModelContribution("echo-d6", {
        ...(base as Extract<NonNullable<typeof base>, { kind: "track" }>),
        id: "echo-d6.health.incompatible-track",
        track: {
          initialStateId: "healthy",
          states: [
            { id: "healthy", label: "Healthy", penaltyScore: 0 },
            { id: "hurt", label: "Hurt", penaltyScore: 3 },
          ],
        },
      }),
    ).toThrow(/canonical states/u);
  });
});
