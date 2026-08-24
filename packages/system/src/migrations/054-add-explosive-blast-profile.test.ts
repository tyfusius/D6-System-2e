import { describe, expect, it } from "vitest";
import { addExplosiveBlastProfile } from "./054-add-explosive-blast-profile";

describe("migration 054 explosive blast profiles", () => {
  it("adds an intentionally unauthored profile without inventing blast radii", () => {
    const source = {
      system: { weaponKind: "thrown-explosive" },
      type: "weapon",
    } as { system: Record<string, unknown>; type: "weapon" };
    addExplosiveBlastProfile(source);
    expect(source.system.blast).toEqual({
      activeZoneCount: 3,
      damageKind: "physical",
      damageMode: "falloff",
      detonationTiming: "immediate",
      zones: [1, 2, 3, 4].map((index) => ({
        damageScore: 0,
        index,
        radiusMeters: 0,
      })),
    });
  });

  it("preserves an authored profile idempotently", () => {
    const blast = {
      activeZoneCount: 4,
      damageKind: "stun",
      damageMode: "per-zone",
      detonationTiming: "end-of-round",
      zones: [{ damageScore: 12, index: 1, radiusMeters: 2 }],
    };
    const source = { system: { blast }, type: "weapon" } as {
      system: Record<string, unknown>;
      type: "weapon";
    };
    addExplosiveBlastProfile(source);
    addExplosiveBlastProfile(source);
    expect(source.system.blast).toEqual(blast);
  });
});
