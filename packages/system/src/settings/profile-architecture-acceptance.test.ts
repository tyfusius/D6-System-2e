import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableProfilePresets,
  registerProfilePresetContribution,
  resetProfilePresetRegistryForTests,
} from "../registries/profile-presets";
import {
  availableRulesProfiles,
  currentConfiguredRulesProfile,
  ensureWorldRulesProfilesStored,
  normalizeRulesProfile,
  registerRulesProfileContribution,
  resetRulesProfileLibraryForTests,
} from "./rules-profile-library";
import {
  currentSettingProfileSelection,
  ensureWorldSettingProfilesStored,
  normalizeSettingProfile,
  registerSettingProfileContribution,
  resetSettingProfileRegistryForTests,
} from "./setting-profile";

const stored = new Map<string, unknown>();

beforeEach(() => {
  stored.clear();
  resetRulesProfileLibraryForTests();
  resetSettingProfileRegistryForTests();
  resetProfilePresetRegistryForTests();
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    settings: {
      get: (_system: string, key: string) => stored.get(key),
      set: (_system: string, key: string, value: unknown) => {
        stored.set(key, value);
        return Promise.resolve(value);
      },
    },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
});

describe("Profile Architecture acceptance", () => {
  it("boots a clean world with independent bundled Rules and Setting authority", async () => {
    const rules = await ensureWorldRulesProfilesStored();
    const setting = await ensureWorldSettingProfilesStored();

    expect(rules).toMatchObject({
      activeProfileId: "second-edition",
      profiles: {},
      version: 3,
    });
    expect(setting).toMatchObject({
      activeProfileId: "d6-system-second-edition",
      profiles: {},
      version: 5,
    });
    expect(currentConfiguredRulesProfile().id).toBe("second-edition");
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "d6-system-second-edition",
      available: true,
      resolved: { source: "bundled" },
    });
    expect(availableProfilePresets().map(({ preset }) => preset.id)).toEqual([
      "second-edition-default",
      "open-d6-default",
    ]);
  });

  it("preserves beta selections while module profiles register after startup", async () => {
    const tableRules = normalizeRulesProfile({
      id: "table-rules",
      label: "Table Rules",
      source: { kind: "world" },
    });
    const tableSetting = normalizeSettingProfile({
      id: "table-setting",
      label: "Table Setting",
      skills: [],
    });
    stored.set("worldRulesProfiles", {
      activeProfileId: "echo-d6",
      profiles: { "table-rules": tableRules },
      version: 1,
    });
    stored.set("worldSettingProfiles", {
      activeProfileId: "echo-d6",
      profiles: { "table-setting": tableSetting },
      version: 3,
    });

    await ensureWorldRulesProfilesStored();
    await ensureWorldSettingProfilesStored();

    expect(stored.get("worldRulesProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
      profiles: { "table-rules": { label: "Table Rules" } },
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
      profiles: { "table-setting": { label: "Table Setting" } },
    });
    expect(currentConfiguredRulesProfile().id).toBe("second-edition");
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "echo-d6",
      available: false,
      resolved: { source: "bundled" },
    });

    registerRulesProfileContribution("echo-d6", {
      id: "echo-d6",
      label: "Echo D6",
    });
    registerSettingProfileContribution(
      "echo-d6",
      normalizeSettingProfile({
        id: "echo-d6",
        label: "Echo D6",
        skills: [],
      }),
    );
    registerProfilePresetContribution("echo-d6", {
      description: "Use Echo rules and presentation.",
      id: "echo-d6-recommended",
      label: "Echo D6 Recommended",
      selection: {
        rulesProfileId: "echo-d6",
        settingProfileId: "echo-d6",
        version: 1,
      },
      version: 1,
    });

    expect(currentConfiguredRulesProfile()).toMatchObject({
      id: "echo-d6",
      source: { kind: "module", ownerId: "echo-d6" },
    });
    expect(currentSettingProfileSelection()).toMatchObject({
      activeProfileId: "echo-d6",
      available: true,
      resolved: { ownerId: "echo-d6", source: "module" },
    });
    expect(availableRulesProfiles().map(({ id }) => id)).toContain(
      "table-rules",
    );
    expect(availableProfilePresets().at(-1)).toMatchObject({
      ownerId: "echo-d6",
      preset: { id: "echo-d6-recommended" },
      source: "module",
    });
    expect(stored.get("worldRulesProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
    expect(stored.get("worldSettingProfiles")).toMatchObject({
      activeProfileId: "echo-d6",
    });
  });
});
