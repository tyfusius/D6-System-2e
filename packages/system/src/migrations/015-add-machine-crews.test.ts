import { describe, expect, it } from "vitest";
import type { ActorSource } from "@d6-system-2e/core";
import { addMachineCrews } from "./015-add-machine-crews";

function actor(type: string, system: Record<string, unknown>): ActorSource {
  return { items: [], system, type };
}

describe("schema 15 machine crews", () => {
  it("adds an empty roster to both machine types", () => {
    const starship = actor("starship", { crew: { minimum: 3 } });
    const vehicle = actor("vehicle", {});
    addMachineCrews(starship);
    addMachineCrews(vehicle);
    expect(starship.system.crew).toEqual({ members: [], minimum: 3 });
    expect(vehicle.system.crew).toEqual({ members: [] });
  });

  it("preserves valid unique members and is idempotent", () => {
    const source = actor("starship", {
      crew: {
        members: [
          { actorId: "a", name: "Ace", retained: true },
          { actorId: "a", name: "Duplicate" },
          { actorId: "", name: "Invalid" },
        ],
        minimum: 2,
      },
    });
    addMachineCrews(source);
    addMachineCrews(source);
    expect(source.system.crew).toEqual({
      members: [{ actorId: "a", name: "Ace" }],
      minimum: 2,
    });
  });

  it("ignores personal actors", () => {
    const source = actor("character", { crew: { retained: true } });
    addMachineCrews(source);
    expect(source.system.crew).toEqual({ retained: true });
  });
});
