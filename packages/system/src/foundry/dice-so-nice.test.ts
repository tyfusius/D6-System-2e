import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetThemeRegistryForTests,
  themeRegistry,
} from "../registries/themes";

import {
  D6_SYSTEM_2E_DICE_SYSTEM_ID,
  D6_SYSTEM_2E_STANDARD_DICE_TYPES,
  D6_SYSTEM_2E_STANDARD_DICE_FONT,
  D6_SYSTEM_2E_STANDARD_COLORSET_ID,
  D6_SYSTEM_2E_WILD_COLORSET_ID,
  D6_SYSTEM_2E_WILD_SIX_LABEL,
  d6System2eDiceAppearance,
  installD6System2eDicePresets,
  synchronizeDiceSoNiceThemePreference,
  waitForDiceSoNiceRollAnimation,
} from "./dice-so-nice";

afterEach(() => {
  resetThemeRegistryForTests();
  vi.unstubAllGlobals();
});

describe("Dice So Nice integration", () => {
  it("waits for the chat message animation when Dice So Nice is active", async () => {
    const waitFor3DAnimationByMessageID = vi.fn().mockResolvedValue(true);

    await waitForDiceSoNiceRollAnimation("message-1", {
      waitFor3DAnimationByMessageID,
    });

    expect(waitFor3DAnimationByMessageID).toHaveBeenCalledWith("message-1");
    await expect(
      waitForDiceSoNiceRollAnimation("message-2", undefined),
    ).resolves.toBeUndefined();
  });

  it("forces the system colors and a heavy sans-serif font at roll level", () => {
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

  it("registers black standard dice and a distinct bronze Wild Die", async () => {
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
      {
        id: D6_SYSTEM_2E_DICE_SYSTEM_ID,
        name: "D6 System Second Edition dice",
      },
      "default",
    );
    expect(addColorset).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        background: "#090a0c",
        edge: "#c89b45",
        foreground: "#f0c96c",
        labelComposite: "tint",
        name: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
        visibility: "visible",
      }),
      "default",
    );
    expect(addColorset).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        background: "#c89b45",
        edge: "#f0c96c",
        foreground: "#0a0d12",
        labelComposite: "tint",
        name: D6_SYSTEM_2E_WILD_COLORSET_ID,
        visibility: "hidden",
      }),
      "default",
    );
    D6_SYSTEM_2E_STANDARD_DICE_TYPES.forEach((dieType, index) => {
      expect(addDicePreset).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
          font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
          labelScale: 0.72,
          labels: [...dieType.labels],
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
        labelScale: 0.72,
        labels: ["1", "2", "3", "4", "5", D6_SYSTEM_2E_WILD_SIX_LABEL],
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

  it("registers and selects an Echo-colored black standard set", async () => {
    themeRegistry.register("echod6-companion-d6-system-2e", {
      cssClass: "d6e2-theme-echo",
      dice: {
        body: "#0b0908",
        colorsetId: "d6-system-2e-echo-standard",
        edge: "#a57443",
        face: "#d2ad72",
        name: "Echo D6 dice",
        systemId: "d6-system-2e-echo",
        wildDie: {
          body: "#8a6038",
          colorsetId: "d6-system-2e-echo-wild",
          edge: "#b78652",
          face: "#090807",
        },
        wildDieLabels: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png",
        ],
      },
      id: "echo",
      label: "Echo D6",
      tokens: {
        accent: "#a57443",
        accentBright: "#d2ad72",
        background: "#0b0908",
        muted: "#968777",
        text: "#e7e2d8",
      },
    });
    const addColorset = vi.fn();
    const addDicePreset = vi.fn();
    const addSystem = vi.fn();
    await installD6System2eDicePresets({
      addColorset,
      addDicePreset,
      addSystem,
    });

    expect(addColorset).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        background: "#0b0908",
        edge: "#a57443",
        foreground: "#d2ad72",
        labelComposite: "tint",
        name: "d6-system-2e-echo-standard",
        visibility: "visible",
      }),
      "default",
    );
    expect(addColorset).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        background: "#8a6038",
        edge: "#b78652",
        foreground: "#090807",
        labelComposite: "tint",
        name: "d6-system-2e-echo-wild",
        visibility: "hidden",
      }),
      "default",
    );
    expect(addSystem).toHaveBeenCalledWith(
      { id: "d6-system-2e-echo", name: "Echo D6 dice" },
      "default",
    );
    expect(addDicePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["1", "2", "3", "4", "5", "6"],
        system: "d6-system-2e-echo",
        type: "d6",
      }),
      "d6",
    );
    expect(addDicePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        colorset: "d6-system-2e-echo-wild",
        labels: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png",
        ],
        system: "d6-system-2e-echo",
        type: "dw",
      }),
      "dw",
    );

    vi.stubGlobal("document", {
      documentElement: { dataset: { d6System2eTheme: "echo" } },
    });
    expect(d6System2eDiceAppearance()).toEqual({
      colorset: "d6-system-2e-echo-standard",
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: "d6-system-2e-echo",
    });
    expect(d6System2eDiceAppearance("dw")).toEqual({
      colorset: "d6-system-2e-echo-wild",
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: "d6-system-2e-echo",
    });

    vi.stubGlobal("document", {
      documentElement: { dataset: { d6System2eTheme: "echo" } },
    });
    const setFlag = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", {
      modules: new Map([["dice-so-nice", { active: true }]]),
      settings: {
        get: vi.fn(() => "inherit"),
      },
      user: {
        getFlag: vi.fn(() => ({
          d6: { material: "metal", system: "standard" },
          global: { texture: "none", system: "standard" },
        })),
        setFlag,
      },
    });
    expect(d6System2eDiceAppearance()).toEqual({
      colorset: "d6-system-2e-echo-standard",
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: "d6-system-2e-echo",
    });
    expect(d6System2eDiceAppearance("dw")).toEqual({
      colorset: "d6-system-2e-echo-wild",
      font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
      system: "d6-system-2e-echo",
    });
    await synchronizeDiceSoNiceThemePreference("echo");
    expect(setFlag).toHaveBeenCalledWith("dice-so-nice", "appearance", {
      d6: {
        colorset: "d6-system-2e-echo-standard",
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        material: "metal",
        system: "d6-system-2e-echo",
      },
      dw: {
        colorset: "d6-system-2e-echo-wild",
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        system: "d6-system-2e-echo",
      },
      global: {
        colorset: "d6-system-2e-echo-standard",
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        system: "d6-system-2e-echo",
        texture: "none",
      },
    });
  });

  it("does not access Dice So Nice flags while the module is inactive", async () => {
    const getFlag = vi.fn();
    const setFlag = vi.fn();
    vi.stubGlobal("game", {
      modules: new Map([["dice-so-nice", { active: false }]]),
      user: { getFlag, setFlag },
    });

    await synchronizeDiceSoNiceThemePreference("classic");

    expect(getFlag).not.toHaveBeenCalled();
    expect(setFlag).not.toHaveBeenCalled();
  });

  it("writes Dice So Nice only when the effective dice appearance changes", async () => {
    const appearance = {
      global: {
        colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        material: "metal",
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
      },
      d6: {
        colorset: D6_SYSTEM_2E_STANDARD_COLORSET_ID,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
      },
      dw: {
        colorset: D6_SYSTEM_2E_WILD_COLORSET_ID,
        font: D6_SYSTEM_2E_STANDARD_DICE_FONT,
        system: D6_SYSTEM_2E_DICE_SYSTEM_ID,
      },
    };
    const setFlag = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", {
      modules: new Map([["dice-so-nice", { active: true }]]),
      user: {
        getFlag: vi.fn(() => appearance),
        setFlag,
      },
    });

    await synchronizeDiceSoNiceThemePreference("classic");

    expect(setFlag).not.toHaveBeenCalled();
  });
});
