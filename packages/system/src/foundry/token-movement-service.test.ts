import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  moveActorToken,
  previewActorTokenMovement,
} from "./token-movement-service";

const mocks = vi.hoisted(() => ({
  blocked: false,
  complete: vi.fn(),
  environmentHalfMove: false,
  firstEditionResolution: vi.fn(),
  firstEditionSegmentPlan: null as { maximumDistance: number } | null,
  round: null as Record<string, unknown> | null,
  strategy: "second-edition-segment-movement",
  update: vi.fn(),
}));

vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    environments: { state: "active" },
    movement: { strategy: mocks.strategy },
  }),
}));

vi.mock("./environment-state", () => ({
  readActorEnvironmentEffect: () =>
    mocks.environmentHalfMove ? { halfMove: true } : null,
}));

vi.mock("./combat-service", () => ({
  completeNextCombatantAction: mocks.complete,
  readCombatantRound: () => mocks.round,
}));

vi.mock("./first-edition-movement-service", () => ({
  firstEditionActorSegmentMovementPlan: () => mocks.firstEditionSegmentPlan,
  resolveFirstEditionActorMovement: mocks.firstEditionResolution,
}));

const actor = {
  id: "actor-1",
  isOwner: true,
  items: { contents: [{ system: { key: "running" }, type: "skill" }] },
  name: "Mover",
  system: { movement: { base: 10, posture: "standing" } },
};

beforeEach(() => {
  mocks.blocked = false;
  mocks.complete.mockReset().mockResolvedValue(undefined);
  mocks.environmentHalfMove = false;
  mocks.firstEditionResolution.mockReset().mockResolvedValue({
    completed: true,
    successful: true,
  });
  mocks.firstEditionSegmentPlan = null;
  mocks.round = null;
  mocks.strategy = "second-edition-segment-movement";
  mocks.update.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("game", { user: { isGM: false } });
  vi.stubGlobal("canvas", {
    grid: {
      measurePath: (points: readonly { x: number; y: number }[]) => ({
        distance: Math.hypot(
          (points[1]?.x ?? 0) - (points[0]?.x ?? 0),
          (points[1]?.y ?? 0) - (points[0]?.y ?? 0),
        ),
      }),
    },
    tokens: {
      placeables: [
        {
          actor,
          center: { x: 50, y: 50 },
          controlled: true,
          document: { update: mocks.update, x: 0, y: 0 },
          id: "token-1",
        },
      ],
    },
  });
  vi.stubGlobal("CONFIG", {
    Canvas: {
      polygonBackends: {
        move: { testCollision: () => mocks.blocked },
      },
    },
  });
});

describe("automatic Token movement", () => {
  it("measures and applies a legal Second Edition destination", async () => {
    const preview = previewActorTokenMovement(actor, {
      destination: { x: 53, y: 54 },
      mode: "walk",
    });
    expect(preview).toMatchObject({
      blocked: false,
      canMove: true,
      distance: 5,
      maximumDistance: 5,
    });

    const result = await moveActorToken(actor, {
      destination: { x: 53, y: 54 },
      mode: "walk",
    });
    expect(result.moved).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it("fails closed for half-rate, over-range, and blocked routes", () => {
    mocks.environmentHalfMove = true;
    expect(
      previewActorTokenMovement(actor, {
        destination: { x: 53, y: 54 },
        mode: "walk",
      }).canMove,
    ).toBe(false);
    mocks.environmentHalfMove = false;
    mocks.blocked = true;
    expect(
      previewActorTokenMovement(actor, {
        destination: { x: 51, y: 50 },
        mode: "walk",
      }),
    ).toMatchObject({ blocked: true, canMove: false });
  });

  it("completes only a matching declared movement and rolls back on conflict", async () => {
    mocks.round = {
      currentAction: { kind: "move", movementMode: "run" },
      revision: 4,
    };
    mocks.complete.mockRejectedValueOnce(
      new Error("D6E2.Combat.Error.RevisionConflict"),
    );
    await expect(
      moveActorToken(actor, {
        destination: { x: 56, y: 58 },
        expectedRevision: 4,
        mode: "run",
      }),
    ).rejects.toThrow("D6E2.Combat.Error.RevisionConflict");
    expect(mocks.update).toHaveBeenNthCalledWith(1, { x: 6, y: 8 });
    expect(mocks.update).toHaveBeenNthCalledWith(2, { x: 0, y: 0 });
  });

  it("moves after a successful First Edition workflow and preserves failed-roll adjudication", async () => {
    mocks.strategy = "open-d6-relative-movement";
    await moveActorToken(actor, {
      destination: { x: 56, y: 58 },
      type: "land",
    });
    expect(mocks.firstEditionResolution).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ baseMove: 10, distance: 10, type: "land" }),
    );
    expect(mocks.update).toHaveBeenCalledWith({ x: 6, y: 8 });

    mocks.update.mockClear();
    mocks.firstEditionResolution.mockResolvedValueOnce({
      completed: true,
      successful: false,
    });
    const failed = await moveActorToken(actor, {
      destination: { x: 56, y: 58 },
      type: "land",
    });
    expect(failed).toMatchObject({ moved: false, movementSucceeded: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
