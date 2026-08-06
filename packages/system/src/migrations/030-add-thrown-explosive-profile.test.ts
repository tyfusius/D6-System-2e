import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addThrownExplosiveProfile } from "./030-add-thrown-explosive-profile";

function weapon(system: Record<string, unknown>): ItemSource {
  return { _id: "weapon", name: "Grenade", type: "weapon", system };
}

describe("schema 30 thrown-explosive profile", () => {
  it("adds safe defaults to existing weapons", () => {
    const source = weapon({ range: { short: 4, medium: 7, long: 12 } });
    addThrownExplosiveProfile(source);
    expect(source.system.weaponKind).toBe("standard");
    expect(source.system.range).toEqual({
      short: 4,
      medium: 7,
      long: 12,
      shortMinimum: 0,
    });
  });

  it("preserves an authored thrown-explosive profile", () => {
    const source = weapon({
      weaponKind: "thrown-explosive",
      range: { shortMinimum: 3 },
    });
    addThrownExplosiveProfile(source);
    expect(source.system.weaponKind).toBe("thrown-explosive");
    expect(source.system.range).toEqual({ shortMinimum: 3 });
  });
});
