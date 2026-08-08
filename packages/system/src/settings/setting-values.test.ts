import { afterEach, describe, expect, it, vi } from "vitest";
import { currentFirstEditionDamageMode } from "./setting-values";

afterEach(() => vi.unstubAllGlobals());

function useValue(value: unknown): void {
  vi.stubGlobal("game", {
    settings: { get: () => value },
  });
}

describe("First Edition damage mode setting", () => {
  it.each([
    ["wounds", "wounds"],
    ["body-points", "body-points"],
    ["body-points-with-wounds", "body-points-with-wounds"],
    [false, "wounds"],
    [true, "body-points"],
    ["false", "wounds"],
    ["true", "body-points"],
    ["invalid", "wounds"],
  ])("normalizes %j to %s", (stored, expected) => {
    useValue(stored);
    expect(currentFirstEditionDamageMode()).toBe(expected);
  });

  it("lets an explicit Rules Profile health model override the legacy setting", () => {
    const values = new Map<string, unknown>([
      ["firstEditionBodyPoints", "wounds"],
      ["gameMode", "second-edition"],
      [
        "worldRulesProfiles",
        {
          activeProfileId: "pool-table",
          profiles: {
            "pool-table": {
              id: "pool-table",
              label: "Pool table",
              strategies: { health: "open-d6.health.body-points" },
            },
          },
          version: 1,
        },
      ],
    ]);
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: (_system: string, key: string) => values.get(key) },
    });
    expect(currentFirstEditionDamageMode()).toBe("body-points");
  });
});
