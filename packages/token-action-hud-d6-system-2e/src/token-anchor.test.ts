import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectScreenTokenRectangles,
  createBoundedFrameRetry,
  createFrameCoalescer,
  placeFlyout,
  positionBesideToken,
  rememberedTokenAnchorPlacement,
  selectTokenAnchorPosition,
} from "./token-anchor";

describe("token-relative HUD positioning", () => {
  it("uses the fixed Above, Below, Left, Right order for empty candidates", () => {
    expect(
      positionBesideToken(
        { x: 400, y: 300, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({ left: 305, top: 108 });
  });

  it("clamps at an edge without covering the controlled token", () => {
    expect(
      positionBesideToken(
        { x: 940, y: 10, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({ left: 752, top: 72 });
  });

  it("moves to the left when another rendered token blocks the right side", () => {
    expect(
      positionBesideToken(
        { x: 400, y: 300, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
        [
          { x: 350, y: 150, width: 100, height: 80 },
          { x: 350, y: 380, width: 100, height: 80 },
          { x: 470, y: 300, width: 100, height: 60 },
        ],
      ),
    ).toEqual({ left: 148, top: 235 });
  });

  it("finds the remaining empty candidate among multiple blockers", () => {
    expect(
      selectTokenAnchorPosition(
        { x: 400, y: 300, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
        [
          { x: 350, y: 150, width: 100, height: 80 },
          { x: 350, y: 380, width: 100, height: 80 },
          { x: 250, y: 300, width: 100, height: 50 },
        ],
      ),
    ).toEqual({
      placement: "right",
      position: { left: 462, top: 235 },
    });
  });

  it("falls back deterministically to the candidate with least overlap", () => {
    const selection = selectTokenAnchorPosition(
      { x: 400, y: 300, width: 50, height: 50 },
      { width: 240, height: 180 },
      { width: 1000, height: 700 },
      [
        { x: 0, y: 0, width: 1000, height: 700 },
        { x: 350, y: 150, width: 20, height: 20 },
      ],
    );

    expect(selection).toEqual({
      placement: "below",
      position: { left: 305, top: 362 },
    });
  });

  it("keeps a near-equal prior placement instead of alternating", () => {
    const token = { x: 400, y: 300, width: 50, height: 50 };
    const hud = { width: 240, height: 180 };
    const viewport = { width: 1000, height: 700 };
    const nearlyEqual = [{ x: 170, y: 50, width: 540, height: 600 }];

    expect(
      selectTokenAnchorPosition(token, hud, viewport, nearlyEqual, "right")
        ?.placement,
    ).toBe("right");
    expect(
      selectTokenAnchorPosition(token, hud, viewport, nearlyEqual, "right")
        ?.placement,
    ).toBe("right");
  });

  it("switches when the crowded alternative reduces overlap by at least twenty percent", () => {
    expect(
      selectTokenAnchorPosition(
        { x: 400, y: 300, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
        [{ x: 220, y: 50, width: 490, height: 600 }],
        "right",
      )?.placement,
    ).toBe("left");
  });

  it("retains a side only for the same controlled token and nearby viewport", () => {
    const memory = {
      placement: "left" as const,
      position: { left: 148, top: 235 },
      tokenId: "token-a",
      viewport: { width: 1000, height: 700 },
    };

    expect(
      rememberedTokenAnchorPlacement(memory, "token-a", {
        width: 1016,
        height: 684,
      }),
    ).toBe("left");
    expect(
      rememberedTokenAnchorPlacement(memory, "token-b", {
        width: 1000,
        height: 700,
      }),
    ).toBeUndefined();
    expect(
      rememberedTokenAnchorPlacement(memory, "token-a", {
        width: 1017,
        height: 700,
      }),
    ).toBeUndefined();
  });

  it("collects PC and NPC screen rectangles while excluding the anchor token", () => {
    const controlled = {
      getBounds: () => ({ x: 100, y: 100, width: 50, height: 50 }),
      id: "anchor",
      visible: true,
    };
    const pc = {
      actor: { type: "character" },
      getBounds: () => ({ x: 200, y: 100, width: 60, height: 60 }),
      renderable: true,
      visible: true,
    };
    const npc = {
      actor: { type: "npc" },
      getBounds: () => ({ x: 400, y: 200, width: 80, height: 80 }),
      renderable: true,
      visible: true,
    };
    const hidden = {
      document: { hidden: true },
      getBounds: () => ({ x: 300, y: 300, width: 40, height: 40 }),
      renderable: true,
      visible: true,
    };

    const rectangles = collectScreenTokenRectangles({
      app: {
        renderer: { screen: { width: 1000, height: 500 } },
        view: {
          getBoundingClientRect: () => ({
            height: 250,
            left: 100,
            top: 50,
            width: 500,
          }),
        },
      },
      tokens: {
        controlled: [controlled],
        placeables: [controlled, pc, npc, hidden],
      },
    });

    expect(rectangles).toEqual({
      anchor: { x: 150, y: 100, width: 25, height: 25 },
      blockers: [
        { x: 200, y: 100, width: 30, height: 30 },
        { x: 300, y: 150, width: 40, height: 40 },
      ],
      controlled,
      tokenId: "anchor",
    });
  });

  it("coalesces repeated refresh signals to one pending animation frame", () => {
    const queued: (() => void)[] = [];
    let refreshes = 0;
    const refresh = createFrameCoalescer(
      (callback) => queued.push(callback),
      () => {
        refreshes += 1;
      },
    );

    refresh();
    refresh();
    refresh();
    expect(queued).toHaveLength(1);
    expect(refreshes).toBe(0);

    queued.shift()?.();
    expect(refreshes).toBe(1);
    refresh();
    expect(queued).toHaveLength(1);
  });

  it("waits through the real selection-before-HUD-render boundary once", () => {
    const queued: (() => void)[] = [];
    let anchorRefreshes = 0;
    let hudRendered = false;
    const refreshAnchor = createFrameCoalescer(
      (callback) => queued.push(callback),
      () => {
        anchorRefreshes += 1;
      },
    );
    const stabilizeAfterControl = createBoundedFrameRetry(
      (callback) => queued.push(callback),
      () => {
        if (!hudRendered) return false;
        refreshAnchor();
        return true;
      },
      60,
    );

    stabilizeAfterControl();
    stabilizeAfterControl();
    expect(queued).toHaveLength(1);

    queued.shift()?.();
    expect(anchorRefreshes).toBe(0);
    expect(queued).toHaveLength(1);

    hudRendered = true;
    queued.shift()?.();
    expect(anchorRefreshes).toBe(0);
    expect(queued).toHaveLength(1);

    queued.shift()?.();
    expect(anchorRefreshes).toBe(1);
    expect(queued).toHaveLength(0);
  });

  it("keeps pointer refreshes flyout-only and removes positional transitions", () => {
    const source = readFileSync(
      new URL("./token-anchor.ts", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL("../styles/token-action-hud-d6-system-2e.css", import.meta.url),
      "utf8",
    );

    expect(source).toContain('Hooks.on("controlToken", stabilizeAfterControl)');
    expect(styles).not.toMatch(/transition:\s*(?:[\s\S]*?\b)?(?:left|top)\b/u);
  });
});

describe("expanded HUD flyout placement", () => {
  it("keeps a flyout below when the full menu fits", () => {
    expect(placeFlyout({ y: 100, height: 30 }, 180, 700)).toEqual({
      direction: "down",
      maxHeight: 562,
    });
  });

  it("flips a flyout above the hotbar-safe viewport edge", () => {
    expect(placeFlyout({ y: 560, height: 30 }, 360, 650)).toEqual({
      direction: "up",
      maxHeight: 552,
    });
  });

  it("chooses the larger side and exposes a scroll-height cap", () => {
    expect(placeFlyout({ y: 290, height: 30 }, 600, 500)).toEqual({
      direction: "up",
      maxHeight: 282,
    });
  });
});
