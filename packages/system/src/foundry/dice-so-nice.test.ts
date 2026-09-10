import {
  currentSettingProfile,
  normalizeSettingProfile,
  saveCurrentSettingProfile,
  resetSettingProfileRegistryForTests,
} from "../settings/setting-profile";
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
  refreshSettingProfileWildDiePresets,
  registerDiceSoNiceIntegration,
  settingProfileWildDieLabels,
  synchronizeDiceSoNiceThemePreference,
  waitForDiceSoNiceRollAnimation,
} from "./dice-so-nice";

afterEach(() => {
  resetSettingProfileRegistryForTests();
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

function wildFaceFixture() {
  const values = new Map<string, unknown>();
  const callbacks = new Map<string, ((value?: unknown) => unknown)[]>();
  const getRoute = vi.fn((path: string) => `/dev/${path}`);
  const setFlag = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("foundry", { utils: { getRoute } });
  vi.stubGlobal("game", {
    user: { id: "face-owner", isGM: true, getFlag: () => undefined, setFlag },
    i18n: { localize: (key: string) => key },
    settings: {
      get: (_scope: string, key: string) => values.get(key),
      set: (_scope: string, key: string, value: unknown) => {
        values.set(key, structuredClone(value));
        return Promise.resolve(value);
      },
    },
  });
  vi.stubGlobal("Hooks", {
    on: (key: string, callback: (value?: unknown) => unknown) => {
      callbacks.set(key, [...(callbacks.get(key) ?? []), callback]);
    },
    callAll: (key: string, value?: unknown) => {
      for (const callback of callbacks.get(key) ?? []) callback(value);
    },
  });
  const classic = themeRegistry.current()[0];
  if (!classic?.dice) throw new Error("Missing classic dice fixture");
  themeRegistry.register("test-wild-faces", {
    ...classic,
    id: "test-wild-faces",
    label: "Test faction",
    cssClass: "test-wild-faces",
    dice: {
      ...classic.dice,
      systemId: "test-wild-faces",
      colorsetId: "test-wild-faces",
      wildDieLabels: [
        "modules/test-wild-faces/imperial-one.png",
        "2",
        "3",
        "4",
        "5",
        "modules/test-wild-faces/imperial-six.png",
      ],
    },
  });
  const theme = themeRegistry.current().find((t) => t.id === "test-wild-faces");
  if (!theme?.dice) throw new Error("Missing contributed dice fixture");
  const profile = normalizeSettingProfile({
    id: theme.id,
    label: "Wild face profile",
  });
  values.set("worldSettingProfiles", {
    version: 5,
    activeProfileId: profile.id,
    profiles: { [profile.id]: profile },
  });
  values.set("userTheme", theme.id);
  const presets = new Map<
    string,
    {
      type: string;
      system: string;
      labels: readonly string[];
      colorset: string;
    }
  >();
  const addDicePreset = vi.fn(
    (preset: {
      type: string;
      system: string;
      labels: readonly string[];
      colorset: string;
    }) => {
      presets.set(`${preset.system}:${preset.type}`, structuredClone(preset));
    },
  );
  const api = {
    addSystem: vi.fn(),
    addColorset: vi.fn(),
    addDicePreset,
    preloadPresets: vi.fn().mockResolvedValue(undefined),
    DiceFactory: { disposeCachedMaterials: vi.fn<(prefix: string) => void>() },
  };
  const saveOne = (kind: "image" | "text", value: string) => {
    const profile = currentSettingProfile();
    return saveCurrentSettingProfile({
      ...profile,
      wildDie: { ...profile.wildDie, one: { kind, value } },
    });
  };
  return {
    values,
    theme,
    profile,
    api,
    presets,
    saveOne,
    getRoute,
    callbacks,
    setFlag,
  };
}

describe("saved Wild Die one image through Dice So Nice", () => {
  it.each(["inherit", "test-wild-faces"])(
    "preserves %s theme selection and applies the saved image after a fresh install/reload without changing six or ordinary dice",
    async (selection) => {
      const f = wildFaceFixture();
      f.values.set("userTheme", selection);
      const beforeAppearance = d6System2eDiceAppearance("dw");
      expect(settingProfileWildDieLabels(f.theme)[0]).toBe(
        "modules/test-wild-faces/imperial-one.png",
      );
      await f.saveOne("image", "worlds/test/skull.png");
      const stored = structuredClone(f.values.get("worldSettingProfiles"));
      f.values.set("worldSettingProfiles", JSON.parse(JSON.stringify(stored)));
      await installD6System2eDicePresets(f.api);
      expect(currentSettingProfile().wildDie.one).toEqual({
        kind: "image",
        value: "worlds/test/skull.png",
      });
      for (const [key, preset] of f.presets) {
        if (preset.type === "dw")
          expect(preset.labels[0]).toBe("/dev/worlds/test/skull.png");
        else
          expect(preset.labels).toEqual(
            D6_SYSTEM_2E_STANDARD_DICE_TYPES.find(
              (t) => t.shape === preset.type,
            )?.labels,
          );
        expect(key).toBe(`${preset.system}:${preset.type}`);
      }
      expect(f.presets.get("test-wild-faces:dw")?.labels[5]).toBe(
        "modules/test-wild-faces/imperial-six.png",
      );
      expect(f.values.get("userTheme")).toBe(selection);
      expect(d6System2eDiceAppearance("dw")).toEqual(beforeAppearance);
      expect(f.setFlag).not.toHaveBeenCalled();
    },
  );
  it("refreshes image A→B on the same profile/personal theme, only Wild presets/materials, and restores the themed one on default text", async () => {
    const f = wildFaceFixture();
    await f.saveOne("image", "worlds/test/a.png");
    await installD6System2eDicePresets(f.api);
    f.api.addDicePreset.mockClear();
    f.api.addSystem.mockClear();
    f.api.addColorset.mockClear();
    f.api.preloadPresets.mockClear();
    await f.saveOne("image", "worlds/test/b.webp");
    await refreshSettingProfileWildDiePresets(f.api);
    expect(f.api.addDicePreset).toHaveBeenCalledTimes(2);
    for (const [preset] of f.api.addDicePreset.mock.calls)
      expect(preset).toMatchObject({
        type: "dw",
        labels: [
          "/dev/worlds/test/b.webp",
          "2",
          "3",
          "4",
          "5",
          expect.any(String),
        ],
      });
    expect(
      new Set(
        f.api.DiceFactory.disposeCachedMaterials.mock.calls.map(
          ([prefix]) => prefix,
        ),
      ),
    ).toEqual(new Set(["boarddw", "showcasedw", "persistentdw"]));
    expect(f.api.addSystem).not.toHaveBeenCalled();
    expect(f.api.addColorset).not.toHaveBeenCalled();
    expect(f.setFlag).not.toHaveBeenCalled();
    f.api.addDicePreset.mockClear();
    await saveCurrentSettingProfile({
      ...currentSettingProfile(),
      label: "Renamed only",
    });
    await refreshSettingProfileWildDiePresets(f.api);
    expect(f.api.addDicePreset).not.toHaveBeenCalled();
    await f.saveOne("text", "1");
    await refreshSettingProfileWildDiePresets(f.api);
    expect(f.presets.get("test-wild-faces:dw")?.labels[0]).toBe(
      "modules/test-wild-faces/imperial-one.png",
    );
    expect(f.presets.get("test-wild-faces:dw")?.labels[5]).toBe(
      "modules/test-wild-faces/imperial-six.png",
    );
    expect(f.values.get("userTheme")).toBe(f.theme.id);
  });
  it.each(["svg", "avif"])(
    "passes the installed DSN image gate for %s while preserving the exact network request",
    async (extension) => {
      const f = wildFaceFixture();
      await f.saveOne("image", `worlds/test/one.${extension}`);
      const label = settingProfileWildDieLabels(f.theme)[0];
      if (!label) throw new Error("Missing one label");
      expect(label).toBe(`/dev/worlds/test/one.${extension}#d6-wild-one.png`);
      // Exact DicePreset.loadTextureType classification from installed DSN6.2.9.
      expect(/\.(png|jpg|jpeg|gif|webp)$/i.test(label)).toBe(true);
      const request = new URL(label, "https://foundry.invalid");
      request.hash = "";
      expect(request.href).toBe(
        `https://foundry.invalid/dev/worlds/test/one.${extension}`,
      );
      f.getRoute.mockReturnValue(
        `/dev/worlds/test/one.${extension}?v=2#original`,
      );
      const routed = settingProfileWildDieLabels(f.theme)[0];
      expect(routed).toBe(
        `/dev/worlds/test/one.${extension}?v=2#original&d6-wild-one.png`,
      );
      const queryRequest = new URL(String(routed), "https://foundry.invalid");
      queryRequest.hash = "";
      expect(queryRequest.search).toBe("?v=2");
    },
  );
  it("uses custom text and treats an empty image as the existing themed default", async () => {
    const f = wildFaceFixture();
    await f.saveOne("text", "!");
    expect(settingProfileWildDieLabels(f.theme)[0]).toBe("!");
    await f.saveOne("image", "");
    expect(settingProfileWildDieLabels(f.theme)[0]).toBe(
      "modules/test-wild-faces/imperial-one.png",
    );
  });
  it("refreshes from the real profile-change hook on each client and retries a failed preload", async () => {
    const f = wildFaceFixture();
    registerDiceSoNiceIntegration();
    for (const callback of f.callbacks.get("diceSoNiceReady") ?? [])
      callback(f.api);
    await vi.waitFor(() =>
      expect(f.presets.has("test-wild-faces:dw")).toBe(true),
    );
    f.api.preloadPresets.mockClear();
    await f.saveOne("image", "worlds/test/live.png");
    await vi.waitFor(() =>
      expect(f.presets.get("test-wild-faces:dw")?.labels[0]).toBe(
        "/dev/worlds/test/live.png",
      ),
    );
    await vi.waitFor(() =>
      expect(f.api.preloadPresets).toHaveBeenCalledWith("test-wild-faces"),
    );
    // Simulate another connected client's saved-setting notification.
    vi.stubGlobal("game", { ...game, user: { isGM: false } });
    const prior = currentSettingProfile();
    f.values.set("worldSettingProfiles", {
      version: 5,
      activeProfileId: prior.id,
      profiles: {
        [prior.id]: {
          ...prior,
          wildDie: {
            ...prior.wildDie,
            one: { kind: "image", value: "worlds/test/player.png" },
          },
        },
      },
    });
    for (const callback of f.callbacks.get("d6e2SettingProfileChanged") ?? [])
      callback();
    await vi.waitFor(() =>
      expect(f.presets.get("test-wild-faces:dw")?.labels[0]).toBe(
        "/dev/worlds/test/player.png",
      ),
    );
    f.api.preloadPresets.mockRejectedValueOnce(
      new Error("temporary texture failure"),
    );
    const next = {
      ...currentSettingProfile(),
      wildDie: {
        ...currentSettingProfile().wildDie,
        one: { kind: "image", value: "worlds/test/retry.png" },
      },
    };
    f.values.set("worldSettingProfiles", {
      version: 5,
      activeProfileId: next.id,
      profiles: { [next.id]: next },
    });
    await expect(refreshSettingProfileWildDiePresets(f.api)).rejects.toThrow(
      "temporary texture failure",
    );
    await refreshSettingProfileWildDiePresets(f.api);
    expect(f.presets.get("test-wild-faces:dw")?.labels[0]).toBe(
      "/dev/worlds/test/retry.png",
    );
  });
});
