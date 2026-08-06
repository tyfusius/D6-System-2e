import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addMovementAndScale } from "./014-add-movement-and-scale";

function actor(
  system: Record<string, unknown>,
  type = "character",
): ActorSource {
  return { items: [], system, type };
}

describe("schema 14 movement and scale", () => {
  it("adds standing posture and personal scale defaults", () => {
    const source = actor({});
    addMovementAndScale(source);
    expect(source.system.movement).toEqual({ posture: "standing" });
    expect(source.system.scale).toBe(0);
  });

  it("preserves valid values, unknown movement data, and is idempotent", () => {
    const source = actor({
      movement: { posture: "prone", retained: true },
      scale: 4,
    });
    addMovementAndScale(source);
    addMovementAndScale(source);
    expect(source.system.movement).toEqual({
      posture: "prone",
      retained: true,
    });
    expect(source.system.scale).toBe(4);
  });

  it("normalizes invalid values and ignores machine actors", () => {
    const source = actor({ movement: { posture: "floating" }, scale: 12 });
    const vehicle = actor({ scale: 3 }, "vehicle");
    addMovementAndScale(source);
    addMovementAndScale(vehicle);
    expect(source.system.movement).toEqual({ posture: "standing" });
    expect(source.system.scale).toBe(0);
    expect(vehicle.system).toEqual({ scale: 3 });
  });
});
