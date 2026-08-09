import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeRulesProfile,
  registerRulesProfileContribution,
  resetRulesProfileLibraryForTests,
} from "../settings/rules-profile-library";
import {
  normalizeSettingProfile,
  registerSettingProfileContribution,
  resetSettingProfileRegistryForTests,
} from "../settings/setting-profile";
import {
  activateProfilePreset,
  previewProfilePreset,
} from "./profile-preset-service";

const stored = new Map<string, unknown>();
const profileHook = vi.fn();
let failKey = "";

function selection() {
  return {
    rulesProfileId: "echo-d6",
    settingProfileId: "echo-d6",
    version: 1 as const,
  };
}

beforeEach(() => {
  failKey = "";
  profileHook.mockClear();
  stored.set("worldRulesProfiles", {
    activeProfileId: "second-edition",
    profiles: {},
    version: 1,
  });
  stored.set("worldSettingProfiles", {
    activeProfileId: "d6-system-second-edition",
    profiles: {},
    version: 3,
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    settings: {
      get: (_system: string, key: string) => stored.get(key),
      set: (_system: string, key: string, value: unknown) => {
        if (key === failKey) {
          failKey = "";
          return Promise.reject(new Error(`${key} failed`));
        }
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
    user: { isGM: true },
  });
  vi.stubGlobal("Hooks", { callAll: profileHook });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true })),
  );
  registerRulesProfileContribution(
    "echo-d6",
    normalizeRulesProfile({ id: "echo-d6", label: "Echo D6" }),
  );
  registerSettingProfileContribution(
    "echo-d6",
    normalizeSettingProfile({
      id: "echo-d6",
      label: "Echo D6",
      logo: "modules/echo-d6/art/logo.png",
      skills: [],
    }),
  );
});

afterEach(() => {
  resetRulesProfileLibraryForTests();
  resetSettingProfileRegistryForTests();
  vi.unstubAllGlobals();
});

describe("Foundry Profile Preset transaction", () => {
  it("previews and atomically activates both profiles", async () => {
    await expect(previewProfilePreset(selection())).resolves.toMatchObject({
      changedCount: 2,
      requiresReload: true,
      unchangedCount: 0,
    });
    await expect(activateProfilePreset(selection())).resolves.toMatchObject({
      preview: { changedCount: 2 },
      rulesProfile: { id: "echo-d6" },
      settingProfile: { profile: { id: "echo-d6" } },
    });
    expect(stored.get("worldRulesProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
    expect(profileHook).toHaveBeenCalledWith(
      "d6e2ProfilePresetChanged",
      selection(),
    );
  });

  it("skips both writes when the preset is already active", async () => {
    await activateProfilePreset(selection());
    const set = vi.spyOn(game.settings, "set");
    await expect(activateProfilePreset(selection())).resolves.toMatchObject({
      preview: { changedCount: 0, unchangedCount: 2 },
    });
    expect(set).not.toHaveBeenCalled();
  });

  it("restores both exact prior records when the second write fails", async () => {
    const beforeRules = stored.get("worldRulesProfiles");
    const beforeSetting = stored.get("worldSettingProfiles");
    failKey = "worldSettingProfiles";
    await expect(activateProfilePreset(selection())).rejects.toThrow(
      "worldSettingProfiles failed",
    );
    expect(stored.get("worldRulesProfiles")).toEqual(beforeRules);
    expect(stored.get("worldSettingProfiles")).toEqual(beforeSetting);
    expect(profileHook).not.toHaveBeenCalledWith(
      "d6e2ProfilePresetChanged",
      expect.anything(),
    );
  });

  it("rejects player use and invalid targets before either write", async () => {
    (game.user as { isGM: boolean }).isGM = false;
    const set = vi.spyOn(game.settings, "set");
    await expect(activateProfilePreset(selection())).rejects.toThrow(
      "Gamemaster",
    );
    expect(set).not.toHaveBeenCalled();
    await expect(
      previewProfilePreset({ ...selection(), rulesProfileId: "missing" }),
    ).rejects.toThrow("Unknown Rules Profile");
  });

  it("rejects unavailable Setting assets before either write", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const set = vi.spyOn(game.settings, "set");
    await expect(previewProfilePreset(selection())).rejects.toThrow(
      "modules/echo-d6/art/logo.png",
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("commits the validated selection even if the caller mutates its request during preflight", async () => {
    let releaseAssetCheck: (response: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          releaseAssetCheck = resolve;
        }),
    );
    const request = selection();
    const activation = activateProfilePreset(request);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    request.rulesProfileId = "second-edition";
    request.settingProfileId = "d6-system-second-edition";
    releaseAssetCheck({ ok: true } as Response);

    await expect(activation).resolves.toMatchObject({
      preview: {
        selection: {
          rulesProfileId: "echo-d6",
          settingProfileId: "echo-d6",
        },
      },
    });
    expect(stored.get("worldRulesProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
  });
});
