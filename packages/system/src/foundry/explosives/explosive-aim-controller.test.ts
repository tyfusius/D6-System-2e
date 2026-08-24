import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6BlastProfile } from "@d6-system-2e/core";
import {
  D6ExplosiveAimController,
  isD6ExplosiveAimActive,
  type D6ExplosiveAimOptions,
} from "./explosive-aim-controller";

const blastProfile: D6BlastProfile = {
  activeZoneCount: 3,
  damageKind: "physical",
  damageMode: "falloff",
  detonationTiming: "immediate",
  zones: [
    { damageScore: 5, index: 1, radiusMeters: 2 },
    { damageScore: 4, index: 2, radiusMeters: 4 },
    { damageScore: 3, index: 3, radiusMeters: 6 },
  ],
};

describe("native explosive aim canvas lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("captures canvas DOM pointer events, converts client coordinates, and confirms the exact valid point", async () => {
    const activateNativeRegionTools = vi.fn();
    const previewChildren: unknown[] = [];
    const preview = {
      addChild: vi.fn((child: unknown) => previewChildren.push(child)),
      removeChild: vi.fn((child: unknown) => {
        const index = previewChildren.indexOf(child);
        if (index >= 0) previewChildren.splice(index, 1);
      }),
    };
    const viewHandlers = new Map<string, EventListener>();
    const view = {
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        viewHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string, handler: EventListener) => {
        if (viewHandlers.get(event) === handler) viewHandlers.delete(event);
      }),
    };
    const canvasCoordinatesFromClient = vi.fn(
      (point: { readonly x: number; readonly y: number }) => ({
        x: point.x - 1_000,
        y: point.y - 500,
      }),
    );
    const snappingModes = Object.freeze({ VERTEX: 0x400 });
    const getSnappedPoint = vi.fn(
      (point: { readonly x: number; readonly y: number }) => ({
        x: Math.round(point.x / 10) * 10,
        y: Math.round(point.y / 10) * 10,
      }),
    );
    const graphics: FakeGraphics[] = [];
    vi.stubGlobal("PIXI", {
      Container: FakeContainer,
      Graphics: class extends FakeGraphics {
        constructor() {
          super();
          graphics.push(this);
        }
      },
      Text: FakeText,
    });
    vi.stubGlobal("canvas", {
      app: { view },
      canvasCoordinatesFromClient,
      dimensions: { distancePixels: 10 },
      grid: {
        getSnappedPoint,
        measurePath: (
          points: readonly { readonly x: number; readonly y: number }[],
        ) => ({
          distance: Math.hypot(
            (points[1]?.x ?? 0) - (points[0]?.x ?? 0),
            (points[1]?.y ?? 0) - (points[0]?.y ?? 0),
          ),
        }),
      },
      interface: preview,
      regions: { activate: activateNativeRegionTools },
      scene: {},
      tokens: { placeables: [] },
    });
    vi.stubGlobal("CONST", { GRID_SNAPPING_MODES: snappingModes });
    const hookHandlers = new Map<string, () => void>();
    vi.stubGlobal("Hooks", {
      off: vi.fn((event: string) => hookHandlers.delete(event)),
      on: vi.fn((event: string, handler: () => void) =>
        hookHandlers.set(event, handler),
      ),
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string, values: Record<string, unknown>) => {
          const distance = values.distance;
          return `${key}:${typeof distance === "string" || typeof distance === "number" ? distance : ""}`;
        },
        localize: (key: string) => key,
      },
    });
    vi.stubGlobal("document", {
      createElement: () => ({ textContent: "" }),
    });
    const addGlobalListener = vi.fn();
    const removeGlobalListener = vi.fn();
    vi.stubGlobal("addEventListener", addGlobalListener);
    vi.stubGlobal("removeEventListener", removeGlobalListener);

    const status = { textContent: "" };
    const affected = {
      childElementCount: 0,
      hidden: false,
      replaceChildren: vi.fn((...children: unknown[]) => {
        affected.childElementCount = children.length;
      }),
    };
    let finishDialog: ((value: unknown) => void) | undefined;
    let dialogOptions:
      | {
          buttons: readonly {
            action: string;
            callback?: () => unknown;
          }[];
          render: (event: unknown, application: { element: unknown }) => void;
        }
      | undefined;
    const confirm = {
      click: vi.fn(() => {
        const callback = dialogOptions?.buttons.find(
          (button) => button.action === "confirm",
        )?.callback;
        finishDialog?.(callback?.());
      }),
      disabled: false,
    };
    const cancel = {
      click: vi.fn(() => finishDialog?.(null)),
    };
    const dialog = {
      querySelector: (selector: string) =>
        selector.includes("status")
          ? status
          : selector.includes("targets")
            ? affected
            : selector.includes("confirm")
              ? confirm
              : selector.includes("cancel")
                ? cancel
                : null,
    };
    const wait = vi.fn((options: typeof dialogOptions) => {
      dialogOptions = options;
      options?.render({}, { element: dialog });
      return new Promise((resolve) => {
        finishDialog = resolve;
      });
    });
    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { wait } } },
    });

    const aimOptions: D6ExplosiveAimOptions = {
      blastProfile,
      color: "#65b9ff",
      origin: { x: 0, y: 0 },
      resolve: (distance) => ({
        difficulty: 10,
        range: {
          band: distance <= 100 ? "short" : null,
          distance,
          maximumDistance: 100,
          outOfRange: distance > 100,
        },
      }),
      targets: (point) =>
        point.x === 40
          ? [
              {
                actorId: "actor",
                label: "Target",
                tokenId: "target",
                visible: true,
                zone: 1,
              },
            ]
          : [],
      title: "Grenade",
    };
    const aiming = new D6ExplosiveAimController().aim(aimOptions);
    await vi.waitFor(() => expect(wait).toHaveBeenCalledOnce());

    expect(isD6ExplosiveAimActive()).toBe(true);
    expect([...viewHandlers.keys()]).toEqual([
      "pointermove",
      "pointerdown",
      "contextmenu",
    ]);
    expect(view.addEventListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
      true,
    );
    expect(view.addEventListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      true,
    );
    expect(activateNativeRegionTools).not.toHaveBeenCalled();
    expect(confirm.disabled).toBe(true);
    expect(status.textContent).toBe("");
    expect(affected.hidden).toBe(true);
    expect(graphics).toHaveLength(0);
    expect(
      dialogOptions?.buttons
        .find((button) => button.action === "confirm")
        ?.callback?.(),
    ).toBeNull();

    const firstMove = pointerEvent({ x: 1_041, y: 500 });
    viewHandlers.get("pointermove")?.(firstMove.event);
    expect(firstMove.preventDefault).toHaveBeenCalledOnce();
    expect(firstMove.stopPropagation).toHaveBeenCalledOnce();
    expect(firstMove.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(canvasCoordinatesFromClient).toHaveBeenLastCalledWith({
      x: 1_041,
      y: 500,
    });
    expect(getSnappedPoint).toHaveBeenLastCalledWith(
      { x: 41, y: 0 },
      { mode: snappingModes.VERTEX },
    );
    expect(lastCircleCenter(graphics)).toEqual({ x: 40, y: 0 });
    const guide = lastText(previewChildren);
    expect(guide).toBeDefined();
    if (!guide) throw new Error("Expected the range guide label");
    expect(guide).toMatchObject({
      text: "40.0 D6E2.Combat.Meters · D6E2.Combat.Range.Short · 10",
    });
    expect(guide.x).toBeLessThan(40 - 60);
    expect(guide.y).toBe(0);
    expect(status.textContent).toBe("D6E2.Explosive.AimStatus:40.0");
    expect(confirm.disabled).toBe(false);
    expect(affected.childElementCount).toBe(1);
    expect(affected.hidden).toBe(false);

    vi.setSystemTime(1_005);
    const throttledMove = pointerEvent({ x: 1_051, y: 500 });
    viewHandlers.get("pointermove")?.(throttledMove.event);
    expect(lastCircleCenter(graphics)).toEqual({ x: 40, y: 0 });

    vi.setSystemTime(2_000);
    const outOfRangeMove = pointerEvent({ x: 1_121, y: 500 });
    viewHandlers.get("pointermove")?.(outOfRangeMove.event);
    expect(lastCircleCenter(graphics)).toEqual({ x: 120, y: 0 });
    expect(confirm.disabled).toBe(true);
    expect(status.textContent).toBe("D6E2.Explosive.OutOfRange:120.0");

    const outOfRangeClick = pointerEvent({ x: 1_131, y: 500 });
    viewHandlers.get("pointerdown")?.(outOfRangeClick.event);
    expect(confirm.click).not.toHaveBeenCalled();

    const confirmAtLatestPoint = pointerEvent({ x: 1_062, y: 500 });
    viewHandlers.get("pointerdown")?.(confirmAtLatestPoint.event);
    await expect(aiming).resolves.toMatchObject({
      difficulty: 10,
      point: { x: 60, y: 0 },
      range: { band: "short", distance: 60, outOfRange: false },
    });
    expect(confirmAtLatestPoint.stopPropagation).toHaveBeenCalledOnce();
    expect(
      confirmAtLatestPoint.stopImmediatePropagation,
    ).toHaveBeenCalledOnce();
    expect(view.removeEventListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
      true,
    );
    expect(view.removeEventListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      true,
    );
    expect(viewHandlers).toEqual(new Map());
    expect(isD6ExplosiveAimActive()).toBe(false);
    expect(previewChildren).toEqual([]);

    const cancelled = new D6ExplosiveAimController().aim(aimOptions);
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(2));
    const registeredContextMenu = viewHandlers.get("contextmenu");
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const stopPropagation = vi.fn();
    const contextEvent = {
      preventDefault,
      stopImmediatePropagation,
      stopPropagation,
    } as unknown as Event;
    registeredContextMenu?.(contextEvent);
    await expect(cancelled).resolves.toBeNull();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(isD6ExplosiveAimActive()).toBe(false);
    expect(previewChildren).toEqual([]);
  });
});

class FakeContainer {
  readonly children: unknown[] = [];
  eventMode?: string;
  zIndex?: number;

  addChild(child: unknown): void {
    this.children.push(child);
  }

  readonly destroy = vi.fn();

  removeChildren(): { destroy?(): void }[] {
    return this.children.splice(0) as { destroy?(): void }[];
  }
}

class FakeGraphics {
  readonly circles: { x: number; y: number }[] = [];

  circle(x: number, y: number): this {
    this.circles.push({ x, y });
    return this;
  }

  readonly destroy = vi.fn();

  lineTo(): this {
    return this;
  }

  moveTo(): this {
    return this;
  }

  stroke(): this {
    return this;
  }
}

class FakeText {
  eventMode?: string;
  readonly text: string;
  x = 0;
  y = 0;

  constructor(text: string) {
    this.text = text;
  }

  readonly destroy = vi.fn();
}

function pointerEvent(point: { readonly x: number; readonly y: number }): {
  event: PointerEvent;
  preventDefault: ReturnType<typeof vi.fn>;
  stopImmediatePropagation: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
} {
  const preventDefault = vi.fn();
  const stopImmediatePropagation = vi.fn();
  const stopPropagation = vi.fn();
  return {
    event: {
      button: 0,
      clientX: point.x,
      clientY: point.y,
      preventDefault,
      stopImmediatePropagation,
      stopPropagation,
    } as unknown as PointerEvent,
    preventDefault,
    stopImmediatePropagation,
    stopPropagation,
  };
}

function lastCircleCenter(graphics: readonly FakeGraphics[]): {
  readonly x: number;
  readonly y: number;
} {
  const circles = graphics.at(-1)?.circles ?? [];
  const reticle = circles.at(3);
  if (!reticle) throw new Error("Expected the reticle circle to be drawn.");
  return reticle;
}

function lastText(children: readonly unknown[]): FakeText | undefined {
  const root = children[0] as FakeContainer | undefined;
  return root?.children.findLast((child) => child instanceof FakeText);
}
