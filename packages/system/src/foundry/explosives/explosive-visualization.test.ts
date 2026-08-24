import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6BlastProfile } from "@d6-system-2e/core";
import type {
  D6CanvasPoint,
  D6ExplosiveRegionStateV1,
} from "../../application/explosive-workflow";

const mocks = vi.hoisted(() => ({ mutation: vi.fn() }));

vi.mock("./explosive-region", async () => {
  const actual = await vi.importActual("./explosive-region");
  return { ...actual, requestD6ExplosiveMutation: mocks.mutation };
});

import {
  D6ExplosiveBlastOverlay,
  d6BlastOverlayLabelLayout,
  d6BlastZoneVisuals,
  d6VisibleCanvasLabelBounds,
} from "./explosive-canvas";
import {
  cancelD6ExplosiveAtPoint,
  clearD6ExplosiveVisualizations,
  registerD6ExplosiveVisualizationLifecycle,
  revealD6ExplosiveVisualization,
  selectD6ExplosiveFootprint,
  syncD6ExplosiveVisualization,
} from "./explosive-visualization";

const profile: D6BlastProfile = {
  activeZoneCount: 4,
  damageKind: "physical",
  damageMode: "per-zone",
  detonationTiming: "immediate",
  zones: [
    { damageScore: 18, index: 1, radiusMeters: 2 },
    { damageScore: 15, index: 2, radiusMeters: 4 },
    { damageScore: 12, index: 3, radiusMeters: 6 },
    { damageScore: 9, index: 4, radiusMeters: 8 },
  ],
};

describe("explosive blast visualization", () => {
  beforeEach(() => {
    mocks.mutation.mockReset();
    mocks.mutation.mockResolvedValue(null);
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { id: "thrower-user", isGM: false },
    });
    vi.stubGlobal("CONFIG", {
      Canvas: {
        polygonBackends: { sight: { testCollision: vi.fn(() => false) } },
      },
    });
    vi.stubGlobal("PIXI", {
      Container: FakeContainer,
      Graphics: FakeGraphics,
      Text: FakeText,
    });
  });

  afterEach(() => {
    clearD6ExplosiveVisualizations();
    vi.unstubAllGlobals();
  });

  it("maps three and four ordered blast zones to the established warm palette", () => {
    expect(d6BlastZoneVisuals(profile).map((zone) => zone.color)).toEqual([
      "#ff2020",
      "#ff5a1f",
      "#ff9800",
      "#ffd400",
    ]);
    expect(
      d6BlastZoneVisuals({
        ...profile,
        activeZoneCount: 3,
        zones: profile.zones.slice(0, 3),
      }).map((zone) => [zone.index, zone.color]),
    ).toEqual([
      [1, "#ff2020"],
      [2, "#ff5a1f"],
      [3, "#ff9800"],
    ]);
  });

  it("stacks 2/4/6/8m zone labels outside the footprint and separates the guide", () => {
    const layout = d6BlastOverlayLabelLayout({ x: 400, y: 220 }, 80, 4, {
      height: 440,
      width: 800,
      x: 0,
      y: 0,
    });

    expect(layout.side).toBe("right");
    expect(layout.zones.map(({ x }) => x)).toEqual([492, 492, 492, 492]);
    expect(layout.zones.map(({ y }) => y)).toEqual([187, 209, 231, 253]);
    expect(
      layout.zones.slice(1).flatMap((zone, index) => {
        const previous = layout.zones[index];
        return previous ? [zone.y - previous.y] : [];
      }),
    ).toEqual([22, 22, 22]);
    expect(layout.zones.every(({ x }) => x > 480)).toBe(true);
    expect(layout.guide.x).toBeLessThan(320);
    expect(layout.guide.align).toBe("right");
  });

  it("flips and clamps the label stack within the scene bounds", () => {
    const layout = d6BlastOverlayLabelLayout({ x: 520, y: 25 }, 80, 4, {
      height: 300,
      width: 600,
      x: 0,
      y: 0,
    });

    expect(layout.side).toBe("left");
    expect(layout.zones.every(({ x }) => x < 440)).toBe(true);
    expect(layout.zones[0]?.y).toBeGreaterThanOrEqual(9);
    expect(layout.zones.at(-1)?.y).toBeLessThanOrEqual(291);
    expect(layout.guide.x).toBe(layout.zones[0]?.x);
    expect(layout.guide.y).toBeGreaterThan(layout.zones.at(-1)?.y ?? 0);
  });

  it("excludes the open right sidebar from the visible canvas label bounds", () => {
    const canvasCoordinatesFromClient = vi.fn(
      ({ x, y }: { readonly x: number; readonly y: number }) => ({ x, y }),
    );
    vi.stubGlobal("canvas", {
      app: {
        view: { getBoundingClientRect: () => clientRect(0, 0, 1366, 768) },
      },
      canvasCoordinatesFromClient,
    });
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === "#sidebar"
          ? {
              getBoundingClientRect: () => clientRect(1038, 0, 320, 768),
              getClientRects: () => [clientRect(1038, 0, 320, 768)],
            }
          : null,
    });

    const bounds = d6VisibleCanvasLabelBounds();
    expect(bounds).toEqual({ height: 768, width: 1038, x: 0, y: 0 });
    expect(canvasCoordinatesFromClient).toHaveBeenCalledWith({
      x: 1038,
      y: 768,
    });
    const layout = d6BlastOverlayLabelLayout({ x: 950, y: 360 }, 80, 4, bounds);
    expect(layout.side).toBe("left");
    expect(layout.zones.every((label) => label.x <= 1026)).toBe(true);
    expect(layout.guide.x).toBeLessThan(1038);
  });

  it("keeps the range guide inside the converted left viewport edge", () => {
    vi.stubGlobal("canvas", {
      app: {
        view: { getBoundingClientRect: () => clientRect(100, 50, 1200, 700) },
      },
      canvasCoordinatesFromClient: ({ x, y }: D6CanvasPoint) => ({
        x: x - 100,
        y: y - 50,
      }),
    });
    vi.stubGlobal("document", { querySelector: () => null });

    const bounds = d6VisibleCanvasLabelBounds();
    expect(bounds).toEqual({ height: 700, width: 1200, x: 0, y: 0 });
    const layout = d6BlastOverlayLabelLayout({ x: 35, y: 300 }, 20, 4, bounds);
    expect(layout.side).toBe("right");
    expect(layout.guide.align).toBe("left");
    expect(layout.guide.x).toBeGreaterThanOrEqual(12);
    expect(layout.zones.every((label) => label.x >= 12)).toBe(true);
  });

  it("selects the innermost eligible overlapping footprint deterministically", () => {
    const outer = {
      ...explosiveState(),
      requestId: "outer-request",
      regionId: "outer-region",
      resolvedPoint: { x: 20, y: 0 },
    };
    const inner = {
      ...explosiveState(),
      requestId: "inner-request",
      regionId: "inner-region",
      resolvedPoint: { x: 0, y: 0 },
    };

    expect(
      selectD6ExplosiveFootprint([outer, inner], { x: 0, y: 0 }, 10)?.requestId,
    ).toBe("inner-request");
    expect(
      selectD6ExplosiveFootprint([inner], { x: 200, y: 200 }, 10),
    ).toBeNull();
  });

  it("deletes only the exact footprint owned by the current thrower", async () => {
    const owned = { ...explosiveState(), regionId: "stale-flag-region-id" };
    const actualRegionId = "actual-owned-region-id";
    const foreign = {
      ...owned,
      requestId: "foreign-request",
      regionId: "foreign-region",
      userId: "foreign-user",
    };
    const unrelated = { getFlag: () => undefined };
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() =>
        Promise.resolve({
          testUserPermission: (user: { readonly id: string }) =>
            user.id === owned.userId,
        }),
      ),
    );
    vi.stubGlobal("canvas", {
      dimensions: { distancePixels: 10 },
      scene: {
        id: owned.sceneId,
        regions: {
          contents: [
            unrelated,
            regionDocument(foreign),
            regionDocument(owned, actualRegionId),
          ],
        },
      },
    });

    await expect(cancelD6ExplosiveAtPoint({ x: 50, y: 50 })).resolves.toBe(
      owned.requestId,
    );
    expect(mocks.mutation).toHaveBeenCalledOnce();
    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "delete",
      regionId: actualRegionId,
      requestId: owned.requestId,
      sceneId: owned.sceneId,
    });
  });

  it("does not delete a footprint after thrower ownership is revoked", async () => {
    const state = explosiveState();
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve({ testUserPermission: () => false })),
    );
    vi.stubGlobal("canvas", {
      dimensions: { distancePixels: 10 },
      scene: {
        id: state.sceneId,
        regions: { contents: [regionDocument(state)] },
      },
    });

    await expect(
      cancelD6ExplosiveAtPoint(state.resolvedPoint),
    ).resolves.toBeNull();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("lets a GM delete an exact explosive footprint without actor disclosure", async () => {
    const state = {
      ...explosiveState(),
      userId: "offline-thrower",
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { id: "gm", isGM: true },
    });
    const fromUuidLookup = vi.fn();
    vi.stubGlobal("fromUuid", fromUuidLookup);
    vi.stubGlobal("canvas", {
      dimensions: { distancePixels: 10 },
      scene: {
        id: state.sceneId,
        regions: { contents: [regionDocument(state)] },
      },
    });

    await expect(cancelD6ExplosiveAtPoint(state.resolvedPoint)).resolves.toBe(
      state.requestId,
    );
    expect(fromUuidLookup).not.toHaveBeenCalled();
    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "delete",
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });
  });

  it("colors and labels affected tokens by zone and shows aimed-to-final deviation", () => {
    const parent = new FakeParent();
    vi.stubGlobal("canvas", {
      dimensions: { distancePixels: 10 },
      tokens: {
        placeables: [
          {
            bounds: { height: 40, width: 40 },
            center: { x: 90, y: 100 },
            id: "target-token",
            visible: true,
          },
        ],
      },
    });
    const overlay = new D6ExplosiveBlastOverlay(parent);
    overlay.update({
      aimedPoint: { x: 50, y: 50 },
      center: { x: 80, y: 80 },
      deviationMeters: 7,
      profile,
      targets: [
        {
          actorId: "target-actor",
          label: "Target",
          tokenId: "target-token",
          visible: true,
          zone: 3,
        },
      ],
      themeColor: "#65b9ff",
    });

    const root = parent.children[0] as FakeContainer;
    const graphics = root.children[0] as FakeGraphics;
    expect(graphics.ringStrokeColors.slice(0, 4)).toEqual([
      0xffd400, 0xff9800, 0xff5a1f, 0xff2020,
    ]);
    expect(graphics.fillColors).toContain(0xff9800);
    expect(graphics.strokeColors).toContain(0xff9800);
    const labels = root.children
      .filter((entry): entry is FakeText => entry instanceof FakeText)
      .map((entry) => entry.text);
    expect(labels).toContain("D6E2.Explosive.Zone 3");
    expect(labels).toContain("D6E2.Explosive.Scatter · 7 D6E2.Combat.Meters");
  });

  it("synchronizes one custom overlay from Region hooks while suppressing native Region chrome", async () => {
    const hooks = new Map<string, (value?: unknown) => void>();
    vi.stubGlobal("Hooks", {
      on: vi.fn((event: string, handler: (value?: unknown) => void) =>
        hooks.set(event, handler),
      ),
    });
    const parent = new FakeParent();
    const state = explosiveState();
    const document = regionDocument(state);
    const stageHandlers = new Map<string, (value: unknown) => void>();
    const viewHandlers = new Map<string, (value: Event) => void>();
    const stage = {
      off: vi.fn((event: string) => stageHandlers.delete(event)),
      on: vi.fn((event: string, handler: (value: unknown) => void) =>
        stageHandlers.set(event, handler),
      ),
    };
    const view = {
      addEventListener: vi.fn(
        (event: string, handler: (value: Event) => void) =>
          viewHandlers.set(event, handler),
      ),
      removeEventListener: vi.fn((event: string) => viewHandlers.delete(event)),
    };
    vi.stubGlobal("canvas", {
      app: { view },
      dimensions: { distancePixels: 10 },
      grid: { measurePath: () => ({ distance: 1 }) },
      interface: parent,
      scene: { id: state.sceneId, regions: { contents: [document] } },
      stage,
      tokens: { placeables: [] },
    });
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve({ testUserPermission: () => true })),
    );

    registerD6ExplosiveVisualizationLifecycle();
    const placeable = { document, visible: true };
    hooks.get("refreshRegion")?.(placeable);
    expect(placeable.visible).toBe(false);
    expect(parent.children).toHaveLength(1);

    hooks.get("updateRegion")?.(
      regionDocument({
        ...state,
        resolvedPoint: { x: 80, y: 80 },
        scatter: {
          bearingDegrees: 45,
          directionDie: 5,
          distanceDice: 2,
          distanceMeters: 7,
        },
        status: "resolved",
      }),
    );
    expect(parent.children).toHaveLength(1);
    const root = parent.children[0] as FakeContainer;
    expect(
      root.children
        .filter((entry): entry is FakeText => entry instanceof FakeText)
        .map((entry) => entry.text),
    ).toContain("D6E2.Explosive.Scatter · 7 D6E2.Combat.Meters");

    hooks.get("canvasReady")?.();
    stageHandlers.get("mousemove")?.({
      getLocalPosition: vi.fn(() => state.resolvedPoint),
    });
    const preventDefault = vi.fn();
    const contextEvent = {
      preventDefault,
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Event;
    viewHandlers.get("contextmenu")?.(contextEvent);
    await vi.waitFor(() => expect(mocks.mutation).toHaveBeenCalledOnce());
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.mutation).toHaveBeenCalledWith({
      operation: "delete",
      regionId: state.regionId,
      requestId: state.requestId,
      sceneId: state.sceneId,
    });

    hooks.get("deleteRegion")?.(document);
    expect(parent.children).toEqual([]);
    hooks.get("canvasTearDown")?.();
    expect(stage.off).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(view.removeEventListener).toHaveBeenCalledWith(
      "contextmenu",
      expect.any(Function),
    );
  });

  it("does not project a hidden thrower's blast to an unauthorized client", () => {
    const parent = new FakeParent();
    const state = explosiveState();
    vi.stubGlobal("canvas", {
      interface: parent,
      scene: { id: state.sceneId },
      tokens: { placeables: [] },
    });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { id: "different-user", isGM: false },
    });

    syncD6ExplosiveVisualization(state, true);
    expect(parent.children).toEqual([]);
  });

  it("draws the persisted final point before resolving the paint boundary", async () => {
    const parent = new FakeParent();
    const state = {
      ...explosiveState(),
      resolvedPoint: { x: 144, y: 233 },
    };
    const frame = vi.fn((callback: FrameRequestCallback) => {
      callback(1);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", frame);
    vi.stubGlobal("canvas", {
      interface: parent,
      scene: { id: state.sceneId },
      tokens: { placeables: [] },
    });

    await revealD6ExplosiveVisualization(state);

    expect(frame).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(1);
  });
});

class FakeParent {
  readonly children: unknown[] = [];

  addChild(child: unknown): void {
    this.children.push(child);
  }

  removeChild(child: unknown): void {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }
}

class FakeContainer extends FakeParent {
  eventMode?: string;
  sortableChildren?: boolean;
  zIndex?: number;
  readonly destroy = vi.fn();

  removeChildren(): { destroy?(): void }[] {
    return this.children.splice(0) as { destroy?(): void }[];
  }
}

class FakeGraphics {
  readonly fillColors: number[] = [];
  readonly ringStrokeColors: number[] = [];
  readonly strokeColors: number[] = [];
  readonly destroy = vi.fn();
  #lastRadius = 0;

  beginFill(color: number): void {
    this.fillColors.push(color);
  }

  circle(_x: number, _y: number, radius: number): this {
    this.#lastRadius = radius;
    return this;
  }

  readonly drawCircle = vi.fn();

  readonly endFill = vi.fn();

  fill(options: { color?: number }): this {
    if (options.color !== undefined) this.fillColors.push(options.color);
    return this;
  }

  readonly lineStyle = vi.fn();

  lineTo(): this {
    return this;
  }

  moveTo(): this {
    this.#lastRadius = 0;
    return this;
  }

  stroke(options: { color?: number }): this {
    if (options.color !== undefined) {
      this.strokeColors.push(options.color);
      if ([20, 40, 60, 80].includes(this.#lastRadius))
        this.ringStrokeColors.push(options.color);
    }
    return this;
  }
}

class FakeText {
  anchor = { set: vi.fn() };
  eventMode?: string;
  readonly text: string;
  x = 0;
  y = 0;
  readonly destroy = vi.fn();

  constructor(text: string) {
    this.text = text;
  }
}

function explosiveState(): D6ExplosiveRegionStateV1 {
  return {
    actorUuid: "Actor.thrower",
    affectedTargets: [],
    aimedPoint: { x: 50, y: 50 },
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
    regionId: "region-id",
    requestId: "request-id",
    resolvedPoint: { x: 50, y: 50 },
    revision: 0,
    sceneId: "scene-id",
    schema: 1,
    status: "aiming",
    tokenId: "thrower-token",
    userId: "thrower-user",
    visualColor: "#65b9ff",
  };
}

function regionDocument(
  state: D6ExplosiveRegionStateV1,
  id = state.regionId,
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

function clientRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
