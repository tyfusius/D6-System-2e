import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invokeNarrativeFeature,
  readFeatureSession,
  resetFeatureSession,
} from "./feature-service";

function actorFixture() {
  const flags = new Map<string, unknown>();
  const actor = {
    getFlag: (_namespace: string, key: string) => flags.get(key),
    id: "actor-1",
    isOwner: true,
    items: {
      contents: [],
      get: (id: string) =>
        id === "trouble-1"
          ? {
              id,
              name: "Old Enemy",
              system: {},
              type: "trouble",
            }
          : id === "asset-1"
            ? {
                id,
                name: "Trusted Contact",
                system: {},
                type: "asset",
              }
            : undefined,
    },
    name: "Test Character",
    system: {
      resources: {
        experiencePoints: { value: 2 },
        heroPoints: { value: 1 },
      },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      const state = changes["flags.d6-system-2e.featureSession"];
      if (state) flags.set("featureSession", state);
      const heroPoints = changes["system.resources.heroPoints.value"];
      if (typeof heroPoints === "number") {
        actor.system.resources.heroPoints.value = heroPoints;
      }
      const experiencePoints =
        changes["system.resources.experiencePoints.value"];
      if (typeof experiencePoints === "number") {
        actor.system.resources.experiencePoints.value = experiencePoints;
      }
      return Promise.resolve();
    }),
  };
  return actor;
}

describe("narrative feature service", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_namespace: string, key: string) =>
          key === "secondEditionTroublesAssetsModule",
      },
      user: { isGM: false },
    });
    vi.stubGlobal("ChatMessage", {
      create: vi.fn(() => Promise.resolve(undefined)),
      getSpeaker: vi.fn(() => ({})),
    });
  });

  it("awards a Hero Point, requires a Complication, and enforces two uses", async () => {
    const actor = actorFixture();
    const first = await invokeNarrativeFeature(actor, "trouble-1", {
      expectedRevision: 0,
    });
    const second = await invokeNarrativeFeature(actor, "trouble-1", {
      expectedRevision: 1,
    });

    expect(first).toMatchObject({
      complicationRequired: true,
      heroPointDelta: 1,
      rollBonusScore: 0,
    });
    expect(actor.system.resources.heroPoints.value).toBe(3);
    expect(second.state.uses["trouble-1"]).toBe(2);
    await expect(
      invokeNarrativeFeature(actor, "trouble-1", { expectedRevision: 2 }),
    ).rejects.toThrow("D6E2.Feature.Error.SessionLimit");
  });

  it("returns the Asset +3D authorization and rejects stale revisions", async () => {
    const actor = actorFixture();
    const result = await invokeNarrativeFeature(actor, "asset-1", {
      choice: "roll-bonus",
      expectedRevision: 0,
    });
    expect(result.rollBonusScore).toBe(9);
    expect(result.heroPointDelta).toBe(0);
    await expect(
      invokeNarrativeFeature(actor, "asset-1", {
        choice: "hero-point",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("D6E2.Feature.Error.RevisionConflict");
  });

  it("awards the shared Experience Point balance under Classic", async () => {
    const values = new Map<string, unknown>([
      ["secondEditionTroublesAssetsModule", true],
      ["secondEditionHeroPointStrategy", "classic"],
      ["secondEditionWildDieStrategy", "classic"],
      ["secondEditionAdvancementStrategy", "experience-points"],
    ]);
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: (_namespace: string, key: string) => values.get(key) },
      user: { isGM: false },
    });
    const actor = actorFixture();
    await invokeNarrativeFeature(actor, "asset-1", {
      choice: "hero-point",
      expectedRevision: 0,
    });
    expect(actor.system.resources.experiencePoints.value).toBe(3);
    expect(actor.system.resources.heroPoints.value).toBe(1);
  });

  it("does not report a committed transaction as failed when audit chat fails", async () => {
    const actor = actorFixture();
    vi.spyOn(ChatMessage, "create").mockRejectedValueOnce(
      new Error("chat unavailable"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await invokeNarrativeFeature(actor, "asset-1", {
      choice: "hero-point",
      expectedRevision: 0,
    });
    expect(result.state.revision).toBe(1);
    expect(actor.system.resources.heroPoints.value).toBe(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("lets only a GM reset the authoritative session", async () => {
    const actor = actorFixture();
    expect(readFeatureSession(actor).revision).toBe(0);
    await expect(resetFeatureSession(actor, 0)).rejects.toThrow(
      "D6E2.Feature.Error.ResetRequiresGM",
    );
    await invokeNarrativeFeature(actor, "trouble-1", {
      expectedRevision: 0,
    });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      user: { isGM: true },
    });
    const reset = await resetFeatureSession(actor, 1);
    expect(reset).toMatchObject({
      revision: 2,
      sessionId: "session-3",
      uses: {},
    });
    expect(actor.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        "flags.d6-system-2e.featureSession.contractVersion": 1,
        "flags.d6-system-2e.featureSession.revision": 2,
        "flags.d6-system-2e.featureSession.sessionId": "session-3",
        "flags.d6-system-2e.featureSession.uses.-=trouble-1": null,
      }),
    );
  });
});
