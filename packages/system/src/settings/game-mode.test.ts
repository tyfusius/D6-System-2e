import { describe, expect, it } from "vitest";
import {
  applyGameMode,
  GAME_MODE_SETTING,
  normalizeGameMode,
  type GameModeGateway,
} from "./game-mode";
import {
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
} from "./rules-compatibility";

function gateway(
  initial: Record<string, unknown> = {},
  failingKey?: string,
): { gateway: GameModeGateway; values: Map<string, unknown> } {
  const values = new Map<string, unknown>([
    [GAME_MODE_SETTING, "second-edition"],
    [OPEN_D6_MASTER_SETTING, false],
    ...Object.values(COMPATIBILITY_SETTING_KEYS).map(
      (key) => [key, false] as const,
    ),
    ...Object.entries(initial),
  ]);
  return {
    gateway: {
      get: (key) => values.get(key),
      set: (key, value) => {
        if (key === failingKey)
          return Promise.reject(new Error("write failed"));
        values.set(key, value);
        return Promise.resolve(value);
      },
    },
    values,
  };
}

describe("game system mode", () => {
  it("normalizes unknown values to the Second Edition default", () => {
    expect(normalizeGameMode(undefined)).toBe("second-edition");
    expect(normalizeGameMode("other")).toBe("second-edition");
    expect(normalizeGameMode("open-d6")).toBe("open-d6");
  });

  it("applies the complete Open D6 baseline before changing mode", async () => {
    const state = gateway();
    const result = await applyGameMode("open-d6", state.gateway);

    expect(result.failed).toEqual([]);
    expect(result.modeChanged).toBe(true);
    expect(state.values.get(GAME_MODE_SETTING)).toBe("open-d6");
    expect(state.values.get(OPEN_D6_MASTER_SETTING)).toBe(true);
    for (const key of Object.values(COMPATIBILITY_SETTING_KEYS)) {
      expect(state.values.get(key)).toBe(true);
    }
  });

  it("does not commit the new mode when a baseline write fails", async () => {
    const failingKey = COMPATIBILITY_SETTING_KEYS.firstEditionDamage;
    const state = gateway({}, failingKey);
    const result = await applyGameMode("open-d6", state.gateway);

    expect(result.failed).toEqual([{ error: "write failed", key: failingKey }]);
    expect(result.modeChanged).toBe(false);
    expect(state.values.get(GAME_MODE_SETTING)).toBe("second-edition");
  });
});
