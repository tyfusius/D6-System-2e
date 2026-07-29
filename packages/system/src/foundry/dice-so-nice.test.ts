import { describe, expect, it, vi } from "vitest";

import {
  D6_SYSTEM_2E_DICE_SYSTEM_ID,
  D6_SYSTEM_2E_STANDARD_DICE_TYPES,
  D6_SYSTEM_2E_STANDARD_DICE_FONT,
  D6_SYSTEM_2E_STANDARD_COLORSET_ID,
  D6_SYSTEM_2E_WILD_COLORSET_ID,
  d6System2eDiceAppearance,
  installD6System2eDicePresets,
} from "./dice-so-nice";

describe("Dice So Nice integration", () => {
  it("forces the system colors and Amiri at roll level", () => {
    expect(d6System2eDiceAppearance()).toEqual({
      colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
    });
    expect(d6System2eDiceAppearance("dw")).toEqual({
      colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
    });
  });

  it("registers gold standard dice and a distinct dark Wild Die", async () => {
    const addColorset = vi.fn();
    const addDicePreset = vi.fn(
      (preset: { values: { max: number; min: number; step?: number } }) => {
        // Dice So Nice normalizes caller-owned values in place.
        preset.values.step ??= 1;
      },
    );
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
    expect(addColorset).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        background: "#c89b45",
        edge: "#f0c96c",
        foreground: "#0a0d12",
        name: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
      }),
      "default",
    );
    expect(addColorset).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        background: "#090a0c",
        foreground: "#e3b85f",
        name: D6_SYSTEM_2E_WILD_COLORSET_ID,
      }),
      "default",
    );
    D6_SYSTEM_2E_STANDARD_DICE_TYPES.forEach((dieType, index) => {
      expect(addDicePreset).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
          font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
          type: dieType.shape,
          values: {
            max: dieType.values.max,
            min: dieType.values.min,
            step: 1,
          },
        }),
        dieType.shape,
      );
    });
    expect(addDicePreset).toHaveBeenLastCalledWith(
      {
        colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        labelScale: 1,
        labels: ["1", "2", "3", "4", "5", "6"],
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
        type: "dw",
        values: { min: 1, max: 6, step: 1 },
      },
      "dw",
    );
    expect(addDicePreset).toHaveBeenCalledTimes(
      D6_SYSTEM_2E_STANDARD_DICE_TYPES.length + 1,
    );
  });
});
