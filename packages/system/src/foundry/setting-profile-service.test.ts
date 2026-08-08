import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeSettingProfile,
  registerSettingProfileContribution,
  resetSettingProfileRegistryForTests,
} from "../settings/setting-profile";
import { activateSettingProfile } from "./setting-profile-service";

const stored = new Map<string, unknown>();

function install(isGM: boolean, assetsAvailable = true): void {
  stored.clear();
  stored.set("worldSettingProfiles", {
    activeProfileId: "d6-system-second-edition",
    profiles: {},
    version: 2,
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    settings: {
      get: (_system: string, key: string) => stored.get(key),
      set: (_system: string, key: string, value: unknown) => {
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
    user: { isGM },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: assetsAvailable })),
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
}

afterEach(() => {
  resetSettingProfileRegistryForTests();
  vi.unstubAllGlobals();
});

describe("protected Setting Profile activation", () => {
  it("activates an available owner-scoped profile after asset validation", async () => {
    install(true);
    await expect(activateSettingProfile("echo-d6")).resolves.toMatchObject({
      profile: {
        ownerId: "echo-d6",
        profile: { id: "echo-d6" },
        source: "module",
      },
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
      profiles: {},
    });
  });

  it("rejects player activation and unavailable assets without changing selection", async () => {
    install(false);
    await expect(activateSettingProfile("echo-d6")).rejects.toThrow(
      "Gamemaster",
    );
    install(true, false);
    await expect(activateSettingProfile("echo-d6")).rejects.toThrow(
      "modules/echo-d6/art/logo.png",
    );
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "d6-system-second-edition",
    });
  });
});
