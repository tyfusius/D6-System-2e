import { describe, expect, it } from "vitest";
import {
  D6_EXPLOSIVE_REGION_STATE_SCHEMA,
  d6ExplosiveFinalPoint,
  parseD6ExplosiveRegionState,
  transitionD6ExplosiveRegion,
  type D6ExplosiveRegionStateV1,
} from "./explosive-workflow";

const state = {
  actorUuid: "Actor.a",
  affectedTargets: [],
  aimedPoint: { x: 1, y: 2 },
  blastProfile: {
    activeZoneCount: 3,
    damageKind: "physical",
    damageMode: "falloff",
    detonationTiming: "immediate",
    zones: [
      { damageScore: 0, index: 1, radiusMeters: 2 },
      { damageScore: 0, index: 2, radiusMeters: 4 },
      { damageScore: 0, index: 3, radiusMeters: 6 },
    ],
  },
  difficulty: 10,
  itemUuid: "Actor.a.Item.i",
  origin: { x: 0, y: 0 },
  range: { band: "short", distance: 3, maximumDistance: 10, outOfRange: false },
  requestId: "request",
  resolvedPoint: { x: 1, y: 2 },
  revision: 0,
  sceneId: "scene",
  schema: D6_EXPLOSIVE_REGION_STATE_SCHEMA,
  status: "aiming",
  regionId: "region",
  tokenId: "token",
  userId: "user",
  visualColor: "#65b9ff",
} satisfies D6ExplosiveRegionStateV1;

describe("explosive workflow state", () => {
  it("uses revisioned legal transitions", () => {
    expect(parseD6ExplosiveRegionState(state)).toEqual(state);
    expect(
      transitionD6ExplosiveRegion(state, 0, { status: "resolved" }),
    ).toMatchObject({
      revision: 1,
      status: "resolved",
    });
    expect(() => transitionD6ExplosiveRegion(state, 1, {})).toThrow(
      "RevisionConflict",
    );
    expect(() =>
      transitionD6ExplosiveRegion(state, 0, { status: "detonated" }),
    ).toThrow("StateTransition");
  });

  it("rejects malformed persisted ranges, targets, and unauthored profiles", () => {
    expect(
      parseD6ExplosiveRegionState({
        ...state,
        range: { ...state.range, distance: Number.NaN },
      }),
    ).toBeNull();
    expect(
      parseD6ExplosiveRegionState({
        ...state,
        affectedTargets: [
          { actorId: "", label: "", tokenId: "token", visible: true, zone: 1 },
        ],
      }),
    ).toBeNull();
    expect(
      parseD6ExplosiveRegionState({
        ...state,
        blastProfile: { ...state.blastProfile, zones: [] },
      }),
    ).toBeNull();
  });

  it("keeps a hit at the aimed point and moves a miss as one footprint", () => {
    expect(
      d6ExplosiveFinalPoint({
        aimedPoint: { x: 10, y: 0 },
        hit: true,
        origin: { x: 0, y: 0 },
        pixelsPerMeter: 10,
      }),
    ).toEqual({ x: 10, y: 0 });
    const miss = d6ExplosiveFinalPoint({
      aimedPoint: { x: 10, y: 0 },
      hit: false,
      origin: { x: 0, y: 0 },
      pixelsPerMeter: 10,
      scatter: {
        bearingDegrees: 90,
        directionDie: 6,
        distanceDice: 1,
        distanceMeters: 2,
      },
    });
    expect(miss.x).toBeCloseTo(10);
    expect(miss.y).toBeCloseTo(20);
  });
});
