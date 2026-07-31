import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addBaseMove } from "./016-add-base-move";

function actor(
  system: Record<string, unknown>,
  type = "character",
): ActorSource {
  return { items: [], system, type };
}

describe("schema 16 base Move", () => {
  it("adds the OpenD6 default and preserves movement data", () => {
    const source = actor({ movement: { posture: "prone" } });
    addBaseMove(source);
    expect(source.system.movement).toEqual({ base: 10, posture: "prone" });
  });

  it("preserves valid values, normalizes invalid values, and is idempotent", () => {
    const valid = actor({ movement: { base: 8 } });
    const invalid = actor({ movement: { base: 0 } });
    addBaseMove(valid);
    addBaseMove(valid);
    addBaseMove(invalid);
    expect(valid.system.movement).toEqual({ base: 8 });
    expect(invalid.system.movement).toEqual({ base: 10 });
  });

  it("does not add personal Move to machines", () => {
    const vehicle = actor({ movement: { speed: 40 } }, "vehicle");
    addBaseMove(vehicle);
    expect(vehicle.system.movement).toEqual({ speed: 40 });
  });
});
