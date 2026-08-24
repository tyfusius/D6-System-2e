import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6BlastProfile } from "@d6-system-2e/core";
import { currentSceneExplosiveTargets } from "./explosive-canvas";

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

describe("blast footprint targeting", () => {
  beforeEach(() => {
    vi.stubGlobal("CONFIG", {
      Canvas: {
        polygonBackends: { sight: { testCollision: vi.fn(() => false) } },
      },
    });
    vi.stubGlobal("canvas", {
      grid: {
        measurePath: ([from, to]: readonly { x: number; y: number }[]) => ({
          distance: Math.hypot(
            (to?.x ?? 0) - (from?.x ?? 0),
            (to?.y ?? 0) - (from?.y ?? 0),
          ),
        }),
      },
      tokens: {
        placeables: [
          {
            actor: { id: "actor", name: "Visible actor" },
            bounds: { height: 2, width: 2, x: 2, y: -1 },
            center: { x: 3, y: 0 },
            id: "token",
            name: "Visible token",
            visible: true,
          },
        ],
      },
    });
  });

  it("uses nearest footprint distance, not token-center distance", () => {
    expect(currentSceneExplosiveTargets({ x: 0, y: 0 }, profile)).toEqual([
      expect.objectContaining({ tokenId: "token", zone: 1 }),
    ]);
  });

  it("excludes a footprint behind a sight-blocking wall", () => {
    const configuration = CONFIG as unknown as {
      Canvas: {
        polygonBackends: { sight: { testCollision: ReturnType<typeof vi.fn> } };
      };
    };
    configuration.Canvas.polygonBackends.sight.testCollision.mockReturnValue(
      true,
    );
    expect(currentSceneExplosiveTargets({ x: 0, y: 0 }, profile)).toEqual([]);
  });

  it("never projects a hidden token label", () => {
    (canvas.tokens?.placeables[0] as { visible: boolean }).visible = false;
    expect(
      currentSceneExplosiveTargets({ x: 0, y: 0 }, profile)[0],
    ).toMatchObject({
      label: "",
      visible: false,
    });
  });
});
