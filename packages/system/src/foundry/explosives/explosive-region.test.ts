import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6BlastProfile } from "@d6-system-2e/core";
import type { D6ExplosiveRegionStateV1 } from "../../application/explosive-workflow";

vi.mock("./explosive-rules", () => ({
  currentD6ExplosiveThrowRanges: vi.fn(() => ({
    long: 40,
    medium: 30,
    short: 10,
    shortMinimum: 0,
  })),
  resolveD6ExplosivePlacement: vi.fn((distance: number) => ({
    difficulty: 15,
    range: {
      band: "medium",
      distance,
      maximumDistance: 40,
      outOfRange: false,
    },
  })),
}));

import {
  d6ExplosiveRegionState,
  registerD6ExplosiveRegionSocket,
  requestD6ExplosiveMutation,
} from "./explosive-region";

const profile: D6BlastProfile = {
  activeZoneCount: 3,
  damageKind: "physical",
  damageMode: "falloff",
  detonationTiming: "immediate",
  zones: [
    { damageScore: 0, index: 1, radiusMeters: 2 },
    { damageScore: 0, index: 2, radiusMeters: 4 },
    { damageScore: 0, index: 3, radiusMeters: 6 },
  ],
};

describe("explosive Region document identity", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "message-id") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reconciles a valid legacy flag to the authoritative document id", () => {
    const flagged = explosiveState({ regionId: "stale-flag-id" });
    const document = regionDocument("actual-region-id", flagged);

    expect(d6ExplosiveRegionState(document)).toEqual({
      ...flagged,
      regionId: "actual-region-id",
    });
    expect(document.getFlag("d6-system-2e", "explosive")?.regionId).toBe(
      "stale-flag-id",
    );
  });

  it("persists Foundry's actual id when embedded creation ignores the requested id, then updates and deletes by that id", async () => {
    const requestedId = "requested-region-id";
    const actualId = "actual-region-id";
    const actor = {
      id: "thrower-actor",
      testUserPermission: vi.fn(() => true),
      uuid: "Actor.thrower",
    };
    const item = {
      parent: { uuid: actor.uuid },
      system: { blast: profile, weaponKind: "thrown-explosive" },
      type: "weapon",
      uuid: "Actor.thrower.Item.grenade",
    };
    const requester = { active: true, id: "gm", isGM: true };
    const regionUpdates: Record<string, unknown>[] = [];
    const deletedIds: string[][] = [];
    const regions = new Map<string, ReturnType<typeof regionDocument>>();
    const scene = {
      createEmbeddedDocuments: vi.fn(
        (_type: "Region", sources: readonly Record<string, unknown>[]) => {
          const source = sources[0] as {
            readonly flags: {
              readonly "d6-system-2e": {
                readonly explosive: D6ExplosiveRegionStateV1;
              };
            };
            readonly shapes: readonly Record<string, unknown>[];
          };
          const document = regionDocument(
            actualId,
            source.flags["d6-system-2e"].explosive,
            source.shapes,
            regionUpdates,
          );
          regions.set(actualId, document);
          return Promise.resolve([document]);
        },
      ),
      deleteEmbeddedDocuments: vi.fn((_type: "Region", ids: string[]) => {
        deletedIds.push(ids);
        for (const id of ids) regions.delete(id);
        return Promise.resolve([]);
      }),
      grid: { distance: 1, size: 10 },
      regions: {
        contents: [] as ReturnType<typeof regionDocument>[],
        get: vi.fn((id: string) => regions.get(id)),
      },
      tokens: { get: vi.fn(() => ({ actorId: actor.id })) },
    };
    vi.stubGlobal("foundry", { utils: { randomID: () => requestedId } });
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === actor.uuid ? actor : item),
      ),
    );
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      scenes: { get: () => scene },
      user: requester,
      users: { contents: [requester], get: () => requester },
    });
    vi.stubGlobal("canvas", {
      grid: { measurePath: () => ({ distance: 20 }) },
      scene: { id: "scene-id" },
      tokens: {
        placeables: [
          {
            center: { x: 0, y: 0 },
            document: { hidden: false },
            id: "thrower-token",
          },
        ],
      },
    });

    const created = (await requestD6ExplosiveMutation({
      aim: {
        difficulty: 15,
        point: { x: 20, y: 0 },
        range: {
          band: "medium",
          distance: 20,
          maximumDistance: 40,
          outOfRange: false,
        },
      },
      operation: "create",
      request: {
        actorUuid: actor.uuid,
        blastProfile: profile,
        itemUuid: item.uuid,
        origin: { x: 0, y: 0 },
        requestId: "request-id",
        sceneId: "scene-id",
        tokenId: "thrower-token",
        userId: requester.id,
        visualColor: "#65b9ff",
      },
    })) as D6ExplosiveRegionStateV1;

    expect(created.regionId).toBe(actualId);
    const persistedWrite = regionUpdates.find(
      (entry) => "flags.d6-system-2e.explosive" in entry,
    );
    expect(persistedWrite?.["flags.d6-system-2e.explosive"]).toMatchObject({
      regionId: actualId,
    });

    const updated = (await requestD6ExplosiveMutation({
      changes: { status: "resolved" },
      expectedRevision: created.revision,
      operation: "update",
      regionId: created.regionId,
      requestId: created.requestId,
      sceneId: created.sceneId,
    })) as D6ExplosiveRegionStateV1;
    expect(updated).toMatchObject({ regionId: actualId, revision: 1 });
    expect(scene.regions.get).toHaveBeenLastCalledWith(actualId);

    await requestD6ExplosiveMutation({
      operation: "delete",
      regionId: updated.regionId,
      requestId: updated.requestId,
      sceneId: updated.sceneId,
    });
    expect(scene.regions.get).toHaveBeenLastCalledWith(actualId);
    expect(deletedIds).toEqual([[actualId]]);
  });

  it("routes deviation presentation through the validated active-GM Region authority", async () => {
    const requester = { active: true, id: "gm", isGM: true };
    const state = explosiveState({
      attackHit: false,
      attackMessageId: "attack-message",
      scatter: {
        bearingDegrees: 270,
        directionDie: 4,
        directionDieSides: 6,
        distanceDice: 3,
        distanceMeters: 9,
      },
      status: "resolved",
    });
    const region = regionDocument(state.regionId, state);
    const presentation = {
      rollMode: "publicroll" as const,
      rolls: [] as const,
    };
    const presentDeviation = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", {
      scenes: {
        get: () => ({ regions: { get: () => region } }),
      },
      socket: { on: vi.fn() },
      user: requester,
      users: {
        contents: [requester],
        get: () => requester,
      },
    });
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve(null)),
    );
    registerD6ExplosiveRegionSocket(
      vi.fn().mockResolvedValue(undefined),
      presentDeviation,
    );

    await requestD6ExplosiveMutation({
      operation: "present-deviation",
      presentation,
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });

    expect(presentDeviation).toHaveBeenCalledWith(state, presentation);
  });
});

function regionDocument(
  id: string,
  initialState: D6ExplosiveRegionStateV1,
  initialShapes: readonly Record<string, unknown>[] = [],
  updates: Record<string, unknown>[] = [],
) {
  let state = structuredClone(initialState);
  let shapes = structuredClone(initialShapes);
  return {
    getFlag: (scope: string, key: string) =>
      scope === "d6-system-2e" && key === "explosive" ? state : undefined,
    id,
    toObject: () => ({ shapes }),
    update: vi.fn((changes: Record<string, unknown>) => {
      updates.push(changes);
      const nextState = changes["flags.d6-system-2e.explosive"];
      if (nextState)
        state = structuredClone(nextState as D6ExplosiveRegionStateV1);
      if (Array.isArray(changes.shapes))
        shapes = structuredClone(changes.shapes as Record<string, unknown>[]);
      return Promise.resolve(undefined);
    }),
  };
}

function explosiveState(
  changes: Partial<D6ExplosiveRegionStateV1> = {},
): D6ExplosiveRegionStateV1 {
  return {
    actorUuid: "Actor.thrower",
    affectedTargets: [],
    aimedPoint: { x: 20, y: 0 },
    blastProfile: profile,
    difficulty: 15,
    itemUuid: "Actor.thrower.Item.grenade",
    origin: { x: 0, y: 0 },
    range: {
      band: "medium",
      distance: 20,
      maximumDistance: 40,
      outOfRange: false,
    },
    regionId: "flag-region-id",
    requestId: "request-id",
    resolvedPoint: { x: 20, y: 0 },
    revision: 0,
    sceneId: "scene-id",
    schema: 1,
    status: "aiming",
    tokenId: "thrower-token",
    userId: "gm",
    visualColor: "#65b9ff",
    ...changes,
  };
}
