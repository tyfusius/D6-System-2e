import { describe, expect, it, vi } from "vitest";

import {
  D6_SYSTEM_2E_DICE_SYSTEM_ID,
  D6_SYSTEM_2E_WILD_COLORSET_ID,
  installD6System2eDicePresets,
} from "./dice-so-nice";

describe("Dice So Nice integration", () => {
  it("registers a distinct Wild Die term and dark-metal colorset", async () => {
    const addColorset = vi.fn();
    const addDicePreset = vi.fn();
    const addSystem = vi.fn();
    const preloadPresets = vi.fn();

    await installD6System2eDicePresets({
      addColorset,
      addDicePreset,
      addSystem,
      preloadPresets,
    });

    expect(addSystem).toHaveBeenCalledWith(
      { id: D6_SYSTEM_2E_DICE_SYSTEM_ID, name: "D6 System Second Edition" },
      "default",
    );
    expect(addColorset).toHaveBeenCalledWith(
      expect.objectContaining({
        background: "#090a0c",
        foreground: "#e3b85f",
        name: D6_SYSTEM_2E_WILD_COLORSET_ID,
      }),
      "default",
    );
    expect(addDicePreset).toHaveBeenCalledWith(
      {
        colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
        labelScale: 1,
        labels: ["1", "2", "3", "4", "5", "6"],
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
        type: "dw",
        values: { min: 1, max: 6 },
      },
      "dw",
    );
  });
});
