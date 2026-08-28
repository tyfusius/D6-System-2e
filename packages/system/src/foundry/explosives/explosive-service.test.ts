import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6ExplosiveRegionStateV1 } from "../../application/explosive-workflow";

const mocks = vi.hoisted(() => ({
  activeGm: vi.fn(),
  append: vi.fn(),
  aim: vi.fn(),
  attack: vi.fn(),
  chatCreate: vi.fn(),
  d8Deviation: false,
  events: [] as string[],
  mutation: vi.fn(),
  targets: vi.fn(),
  thread: vi.fn(),
  reveal: vi.fn(),
  zoneDamage: vi.fn(),
}));

vi.mock("../initiating-action-message", () => ({
  appendD6InitiatingActionPresentation: mocks.append,
  D6_INITIATING_ACTION_RESULTS_FLAG: "initiatingActionResults",
  hydrateD6FoundryRolls: vi.fn(
    (
      values: readonly {
        readonly evidence: {
          readonly faces: readonly number[];
          readonly formula: string;
          readonly total: number;
        };
      }[],
    ) =>
      Promise.resolve(
        values.map(({ evidence }) => ({
          dice: [{ results: evidence.faces.map((result) => ({ result })) }],
          formula: evidence.formula,
          total: evidence.total,
          toJSON: () => evidence,
        })),
      ),
  ),
  serializeD6FoundryRolls: vi.fn(
    (rolls: readonly { readonly formula: string; readonly total: number }[]) =>
      Promise.resolve(
        rolls.map((roll, index) => ({
          evidence: {
            faces: [roll.total],
            fingerprint: String(index + 1).repeat(64),
            formula: roll.formula,
            total: roll.total,
          },
          serialized: "{}",
          version: 1,
        })),
      ),
  ),
}));

vi.mock("../../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: vi.fn(() => ({
    homebrew: { tyfusiusD8ExplosiveDeviation: mocks.d8Deviation },
  })),
}));

vi.mock("./explosive-visualization", () => ({
  registerD6ExplosiveVisualizationLifecycle: vi.fn(),
  revealD6ExplosiveVisualization: mocks.reveal,
}));

vi.mock("./explosive-attack-thread", () => ({
  createD6ExplosiveAttackThreadForDetonation: mocks.thread,
  registerD6ExplosiveAttackThreadLifecycle: vi.fn(),
}));

vi.mock("./explosive-aim-controller", () => ({
  D6ExplosiveAimController: class {
    readonly aim = mocks.aim;
  },
}));

vi.mock("../../settings/defenses", () => ({
  currentDefenseRuntimeStrategy: vi.fn(() => ({ family: "active" })),
}));

vi.mock("./explosive-rules", () => ({
  currentD6ExplosiveThrowRanges: vi.fn(() => ({
    long: 40,
    medium: 20,
    short: 10,
    shortMinimum: 1,
  })),
  resolveD6ExplosivePlacement: vi.fn(() => ({
    difficulty: 20,
    range: {
      band: "long",
      distance: 32.5,
      maximumDistance: 40,
      outOfRange: false,
    },
  })),
}));

vi.mock("./explosive-region", async () => {
  const actual = await vi.importActual("./explosive-region");
  return {
    ...actual,
    activeD6ExplosiveGm: mocks.activeGm,
    assertD6ExplosiveCoordinatorAvailable: vi.fn(),
    requestD6ExplosiveMutation: mocks.mutation,
  };
});

vi.mock("./explosive-canvas", () => ({
  D6ExplosiveBlastOverlay: class {
    readonly update = vi.fn();
  },
  currentSceneExplosiveTargets: mocks.targets,
}));

vi.mock("../rolls/roll-service", () => ({
  explosiveWeaponDamageScore: vi.fn(() => 12),
  rollExplosiveZoneDamageAgainst: mocks.zoneDamage,
  rollPlacedThrownExplosiveAttack: mocks.attack,
  rollPlacedThrownExplosiveAttackWithMessage: mocks.attack,
}));

import {
  D6_EXPLOSIVE_REVEAL_MS,
  beginD6ThrownExplosiveThrow,
  currentD6ExplosiveDeviationDieSides,
  detonateD6ExplosiveRegion,
  presentD6ExplosiveDeviation,
  recoverD6ExplosiveLifecycle,
} from "./explosive-service";

describe("explosive detonation presentation boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.events.length = 0;
    mocks.d8Deviation = false;
    mocks.activeGm.mockReset();
    mocks.append.mockReset().mockImplementation(() => {
      mocks.events.push("audit");
      return Promise.reject(new Error("presentation"));
    });
    mocks.aim.mockReset();
    mocks.attack.mockReset();
    mocks.chatCreate.mockReset();
    mocks.mutation.mockReset();
    mocks.targets.mockReset();
    mocks.thread.mockReset();
    mocks.reveal.mockReset().mockImplementation(() => {
      mocks.events.push("reveal");
      return Promise.resolve();
    });
    mocks.zoneDamage.mockReset();
  });

  it("selects d6 by default and d8 only from the active portable profile", () => {
    expect(currentD6ExplosiveDeviationDieSides()).toBe(6);
    mocks.d8Deviation = true;
    expect(currentD6ExplosiveDeviationDieSides()).toBe(8);
  });

  it("persists and detonates failed modified attacks before scatter chat presentation", async () => {
    const state = explosiveState({
      difficulty: 20,
      range: {
        band: "long",
        distance: 32.5,
        maximumDistance: 40,
        outOfRange: false,
      },
      status: "aiming",
    });
    const aim = {
      difficulty: state.difficulty,
      point: state.aimedPoint,
      range: state.range,
      targets: [],
    };
    const actor = {
      getFlag: vi.fn(() => "#65b9ff"),
      id: "thrower",
      isOwner: true,
      items: { get: vi.fn() },
      name: "Thrower",
      uuid: state.actorUuid,
    };
    const item = {
      id: "grenade",
      name: "Grenade, Stun",
      parent: { uuid: actor.uuid },
      system: {
        blast: state.blastProfile,
        weaponKind: "thrown-explosive",
      },
      type: "weapon",
      uuid: state.itemUuid,
    };
    actor.items.get.mockReturnValue(item);
    mocks.aim.mockResolvedValue(aim);
    mocks.attack.mockResolvedValue({
      message: { id: "attack-message" },
      result: {
        request: { resultModifier: -100, rollMode: "publicroll" },
        success: false,
        total: -82,
      },
    });
    mocks.mutation.mockImplementation(
      (request: {
        changes?: Partial<D6ExplosiveRegionStateV1>;
        operation: string;
      }) => {
        if (request.operation === "create") return Promise.resolve(state);
        if (request.operation === "update")
          return Promise.resolve({
            ...state,
            ...request.changes,
            revision: 1,
          });
        return Promise.resolve(null);
      },
    );
    vi.stubGlobal(
      "Roll",
      class {
        readonly formula: string;
        readonly total: number;

        constructor(formula: string) {
          this.formula = formula;
          this.total = formula === "1d6" ? 4 : 9;
        }

        evaluate(): Promise<this> {
          return Promise.resolve(this);
        }
      },
    );
    let resultLedger: unknown;
    const region = {
      getFlag: (_scope: string, key: string) =>
        key === "initiatingActionResults" ? resultLedger : undefined,
      update: vi.fn((changes: Record<string, unknown>) => {
        resultLedger = changes["flags.d6-system-2e.initiatingActionResults"];
        return Promise.resolve();
      }),
    };
    const rootMessage = { id: "attack-message" };
    vi.stubGlobal("game", {
      combat: null,
      i18n: {
        format: (key: string) => key,
        localize: (key: string) => key,
      },
      messages: {
        get: (id: string) => (id === rootMessage.id ? rootMessage : undefined),
      },
      scenes: {
        get: (id: string) =>
          id === state.sceneId
            ? {
                regions: {
                  get: (regionId: string) =>
                    regionId === state.regionId ? region : undefined,
                },
              }
            : undefined,
      },
      user: { id: "gm", isGM: true },
      users: { contents: [{ id: "gm", isGM: true }] },
    });
    vi.stubGlobal("canvas", {
      dimensions: { distance: 1, size: 10 },
      scene: { id: state.sceneId },
      tokens: {
        placeables: [
          {
            actor: { id: actor.id },
            center: state.origin,
            controlled: true,
            id: state.tokenId,
          },
        ],
      },
    });
    vi.stubGlobal("CONFIG", {
      Canvas: {
        polygonBackends: { move: { testCollision: vi.fn(() => false) } },
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      beginD6ThrownExplosiveThrow(actor as never, item as never),
    ).resolves.toMatchObject({ success: false, total: -82 });

    const update = mocks.mutation.mock.calls
      .map(
        (call) =>
          call[0] as {
            changes?: Partial<D6ExplosiveRegionStateV1>;
            operation: string;
          },
      )
      .find((request) => request.operation === "update");
    expect(update?.changes).toMatchObject({
      attackHit: false,
      scatter: {
        directionDie: 4,
        directionDieSides: 6,
        distanceDice: 3,
        distanceMeters: 9,
      },
      status: "resolved",
    });
    expect(update?.changes?.resolvedPoint).not.toEqual(state.aimedPoint);
    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "detonate",
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });
    expect(mocks.chatCreate).not.toHaveBeenCalled();
    const presentationRequest = mocks.mutation.mock.calls
      .map((call) => call[0] as { operation: string; presentation?: unknown })
      .find(({ operation }) => operation === "present-deviation");
    expect(presentationRequest).toMatchObject({
      operation: "present-deviation",
      presentation: {
        rollMode: "publicroll",
        rolls: [
          { evidence: { formula: "1d6", total: 4 } },
          { evidence: { formula: "3d6", total: 9 } },
        ],
      },
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });
    expect(region.update).not.toHaveBeenCalled();
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.events).toEqual(["reveal"]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("validates player-evaluated scatter on the active GM before Region-first root presentation", async () => {
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
    let resultLedger: unknown;
    const region = {
      getFlag: (_scope: string, key: string) =>
        key === "initiatingActionResults" ? resultLedger : undefined,
      update: vi.fn((changes: Record<string, unknown>) => {
        resultLedger = changes["flags.d6-system-2e.initiatingActionResults"];
        return Promise.resolve();
      }),
    };
    const rootMessage = {
      getFlag: (_scope: string, key: string) =>
        key === "roll" ? { request: { rollMode: "publicroll" } } : undefined,
      id: state.attackMessageId,
    };
    vi.stubGlobal("game", {
      messages: { get: () => rootMessage },
      scenes: { get: () => ({ regions: { get: () => region } }) },
    });
    mocks.append.mockResolvedValue("appended");
    const presentation = {
      rollMode: "publicroll" as const,
      rolls: [
        serializedRoll("1d6", 4, [4], "a"),
        serializedRoll("3d6", 9, [2, 3, 4], "b"),
      ],
    };

    await presentD6ExplosiveDeviation(state, presentation);

    expect(region.update).toHaveBeenCalledTimes(1);
    expect(mocks.append).toHaveBeenCalledWith(
      expect.objectContaining({
        artifacts: [
          expect.objectContaining({ formula: "1d6", total: 4 }),
          expect.objectContaining({ formula: "3d6", total: 9 }),
        ],
        message: rootMessage,
      }),
    );
    expect(resultLedger).toMatchObject({
      entries: [
        {
          details: { direction: "Backward" },
          kind: "explosive-deviation",
        },
      ],
      requestId: state.requestId,
      rootMessageId: state.attackMessageId,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("publishes the final affected zones and waits for reveal before creating the pending attack thread", async () => {
    const state = explosiveState();
    const target = {
      actorId: "target-actor",
      label: "Target",
      tokenId: "target-token",
      visible: true,
      zone: 1 as const,
    };
    mocks.targets.mockReturnValue([target]);
    mocks.thread.mockImplementation(() => {
      mocks.events.push("thread");
      return Promise.resolve({ requestId: state.requestId });
    });
    mocks.mutation.mockImplementation((request: { operation: string }) => {
      if (request.operation === "delete") {
        mocks.events.push("delete");
        return Promise.resolve(null);
      }
      const changes = (
        request as {
          changes?: Partial<D6ExplosiveRegionStateV1>;
        }
      ).changes;
      if (changes?.affectedTargets) {
        mocks.events.push("publish-targets");
        return Promise.resolve({ ...state, ...changes, revision: 1 });
      }
      mocks.events.push("mark-detonated");
      return Promise.resolve({ ...state, ...changes, revision: 2 });
    });
    const actor = { id: "thrower", uuid: state.actorUuid };
    const item = {
      id: "grenade",
      parent: { uuid: actor.uuid },
      uuid: state.itemUuid,
    };
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === state.actorUuid ? actor : item),
      ),
    );
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
    });
    vi.stubGlobal("canvas", {
      scene: { id: state.sceneId },
      tokens: {
        placeables: [{ actor: { id: target.actorId }, id: target.tokenId }],
      },
    });

    const detonation = detonateD6ExplosiveRegion(state);
    for (let attempt = 0; attempt < 6; attempt += 1) await Promise.resolve();
    expect(mocks.events).toEqual(["publish-targets", "reveal"]);
    expect(mocks.zoneDamage).not.toHaveBeenCalled();
    expect(mocks.events).not.toContain("delete");

    await vi.advanceTimersByTimeAsync(D6_EXPLOSIVE_REVEAL_MS - 1);
    expect(mocks.zoneDamage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await detonation;

    expect(mocks.events).toEqual(["publish-targets", "reveal", "thread"]);
    expect(mocks.zoneDamage).not.toHaveBeenCalled();
    expect(mutationRequests()).not.toContainEqual(
      expect.objectContaining({ operation: "delete" }),
    );
  });

  it("retires stale aims and completed residue, resumes every current-scene resolved thread idempotently, and preserves armed blasts", async () => {
    const aiming = explosiveState({
      regionId: "stale-aiming-flag-id",
      requestId: "aiming",
      status: "aiming",
    });
    const actualAimingRegionId = "actual-aiming-region-id";
    const resumable = explosiveState({
      requestId: "resumable",
      revision: 1,
      status: "resolved",
    });
    const possiblyApplied = explosiveState({
      requestId: "possibly-applied",
      revision: 2,
      status: "resolved",
    });
    const armed = explosiveState({
      blastProfile: {
        ...aiming.blastProfile,
        detonationTiming: "end-of-round",
      },
      requestId: "armed",
      revision: 1,
      status: "armed",
    });
    const detonated = explosiveState({
      requestId: "detonated",
      revision: 3,
      status: "detonated",
    });
    const unrelated = { getFlag: () => undefined };
    const regions = [aiming, resumable, possiblyApplied, armed, detonated].map(
      (state) =>
        regionStateDocument(
          state.requestId === aiming.requestId
            ? actualAimingRegionId
            : state.regionId,
          state,
        ),
    );
    mocks.activeGm.mockReturnValue({ id: "gm" });
    mocks.mutation.mockResolvedValue(null);
    vi.stubGlobal("game", {
      scenes: {
        contents: [{ regions: { contents: [...regions, unrelated] } }],
      },
      user: { id: "gm", isGM: true },
    });
    vi.stubGlobal("canvas", { scene: { id: aiming.sceneId } });

    await recoverD6ExplosiveLifecycle();

    expect(mutationRequests()).toEqual([
      {
        operation: "delete",
        regionId: actualAimingRegionId,
        requestId: aiming.requestId,
        sceneId: aiming.sceneId,
      },
      {
        operation: "delete",
        regionId: detonated.regionId,
        requestId: detonated.requestId,
        sceneId: detonated.sceneId,
      },
      {
        operation: "detonate",
        regionId: possiblyApplied.regionId,
        requestId: possiblyApplied.requestId,
        sceneId: possiblyApplied.sceneId,
      },
      {
        operation: "detonate",
        regionId: resumable.regionId,
        requestId: resumable.requestId,
        sceneId: resumable.sceneId,
      },
    ]);
    expect(
      mutationRequests().some(
        (request) => request.requestId === armed.requestId,
      ),
    ).toBe(false);
  });

  it("preserves an off-canvas resolved thread until its Scene can recover it", async () => {
    const state = explosiveState({
      requestId: "off-canvas",
      revision: 1,
      sceneId: "other-scene",
      status: "resolved",
    });
    mocks.activeGm.mockReturnValue({ id: "gm" });
    mocks.mutation.mockResolvedValue(null);
    vi.stubGlobal("game", {
      scenes: {
        contents: [
          {
            regions: { contents: [regionStateDocument(state.regionId, state)] },
          },
        ],
      },
      user: { id: "gm", isGM: true },
    });
    vi.stubGlobal("canvas", { scene: { id: "current-scene" } });

    await recoverD6ExplosiveLifecycle();

    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
    expect(mocks.zoneDamage).not.toHaveBeenCalled();
  });
});

function explosiveState(
  changes: Partial<D6ExplosiveRegionStateV1> = {},
): D6ExplosiveRegionStateV1 {
  return {
    actorUuid: "Actor.thrower",
    affectedTargets: [],
    aimedPoint: { x: 50, y: 50 },
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
    difficulty: 15,
    itemUuid: "Actor.thrower.Item.grenade",
    origin: { x: 0, y: 0 },
    range: {
      band: "medium",
      distance: 20,
      maximumDistance: 40,
      outOfRange: false,
    },
    regionId: "region-id",
    requestId: "reveal-test-request",
    resolvedPoint: { x: 50, y: 50 },
    revision: 0,
    sceneId: "scene-id",
    schema: 1,
    status: "resolved",
    tokenId: "thrower-token",
    userId: "thrower-user",
    visualColor: "#65b9ff",
    ...changes,
  };
}

function mutationRequests(): readonly {
  readonly operation: string;
  readonly regionId: string;
  readonly requestId: string;
  readonly sceneId: string;
}[] {
  return mocks.mutation.mock.calls.map(
    (call) =>
      call[0] as {
        readonly operation: string;
        readonly regionId: string;
        readonly requestId: string;
        readonly sceneId: string;
      },
  );
}

function regionStateDocument(
  id: string,
  state: D6ExplosiveRegionStateV1,
): {
  getFlag(scope: string, key: string): unknown;
  readonly id: string;
} {
  return {
    getFlag: (scope, key) =>
      scope === "d6-system-2e" && key === "explosive" ? state : undefined,
    id,
  };
}

function serializedRoll(
  formula: string,
  total: number,
  faces: readonly number[],
  fingerprintCharacter: string,
) {
  return {
    evidence: {
      faces,
      fingerprint: fingerprintCharacter.repeat(64),
      formula,
      total,
    },
    serialized: JSON.stringify({ formula, total }),
    version: 1 as const,
  };
}
