import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableProfilePresets,
  bundledProfilePresets,
  profilePresetRegistry,
  registerProfilePresetContribution,
  resetProfilePresetRegistryForTests,
  unregisterProfilePresetOwner,
} from "./profile-presets";
import {
  bundledSettingProfiles,
  normalizeSettingProfile,
} from "../settings/setting-profile";
import {
  bundledRulesProfiles,
  strategyUsesOpenD6,
} from "../settings/rules-profile-library";

const callAllMock = vi.fn();

function preset(id = "echo-recommended") {
  return {
    description: "Recommended Echo profiles.",
    id,
    label: "Echo D6",
    selection: {
      rulesProfileId: "echo-d6",
      settingProfileId: "echo-d6",
      version: 1 as const,
    },
    version: 1 as const,
  };
}

beforeEach(() => {
  callAllMock.mockClear();
  vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });
  vi.stubGlobal("Hooks", { callAll: callAllMock });
});

afterEach(() => {
  resetProfilePresetRegistryForTests();
  vi.unstubAllGlobals();
});

describe("Profile Preset discovery registry", () => {
  it("binds every bundled preset to an available canonical Setting Profile", () => {
    const settingProfileIds = new Set(
      bundledSettingProfiles().map(({ profile }) => profile.id),
    );
    expect(
      bundledProfilePresets().every(({ preset }) =>
        settingProfileIds.has(preset.selection.settingProfileId),
      ),
    ).toBe(true);
    expect(
      bundledProfilePresets().find(
        ({ preset }) => preset.id === "open-d6-default",
      )?.preset.selection,
    ).toMatchObject({
      rulesProfileId: "open-d6",
      settingProfileId: "open-d6-first-edition",
    });
    expect(
      bundledProfilePresets().find(
        ({ preset }) => preset.id === "free-d6-default",
      )?.preset.selection,
    ).toEqual({
      rulesProfileId: "free-d6",
      settingProfileId: "free-d6",
      version: 1,
    });
  });

  it("ships FreeD6 as separate seven-attribute Rules and Setting Profiles with matching Homebrew off", () => {
    const rules = bundledRulesProfiles().find(({ id }) => id === "free-d6");
    const setting = bundledSettingProfiles().find(
      ({ profile }) => profile.id === "free-d6",
    )?.profile;
    expect(rules).toMatchObject({
      homebrew: { tyfusiusD8ExplosiveDeviation: false },
      strategies: {
        actionEconomy: "open-d6.action-economy.flexible",
        activeDefenses: "open-d6.defenses.active",
        advancement: "open-d6.advancement.character-points",
        attributes: "d6e2.attributes.campaign-profile",
        health: "open-d6.health.wounds-or-body-points",
        initiative: "open-d6.initiative.perception",
        movement: "open-d6.movement.relative",
        metaCurrency: "open-d6.meta-currency.character-and-fate-points",
        pips: "open-d6.pips.classic",
        retries: "open-d6.retries.no-general-reroll",
        scale: "open-d6.scale.scalar",
        successEvaluator: "open-d6.success.meets-or-exceeds",
        wildDie: "open-d6.wild-die.critical-one",
      },
    });
    expect(rules?.homebrew.matchingRewards).toBeUndefined();
    expect(rules && strategyUsesOpenD6(rules, "attributes")).toBe(true);
    expect(setting?.attributes.map(({ id }) => id)).toEqual([
      "agility",
      "coordination",
      "strength",
      "knowledge",
      "perception",
      "charisma",
      "technical",
    ]);
    expect(setting).toMatchObject({
      logoAsWatermark: false,
      originRulesFamily: "open-d6-first-edition",
    });
    expect(setting?.skills.length).toBeGreaterThanOrEqual(80);
    expect(setting?.skills.find(({ key }) => key === "firearms")).toMatchObject(
      { attributeId: "coordination", training: "standard" },
    );
    expect(
      setting?.skills.find(({ key }) => key === "willpower"),
    ).toMatchObject({ attributeId: "charisma", training: "standard" });
    expect(
      setting?.skills.find(({ key }) => key === "first-aid"),
    ).toMatchObject({ attributeId: "technical", training: "standard" });
    expect(
      setting?.skills.find(({ key }) => key === "martial-arts"),
    ).toMatchObject({ attributeId: "agility", training: "advanced" });

    const duplicated = normalizeSettingProfile({
      ...setting,
      id: "free-d6-world-copy",
    });
    expect(duplicated.attributes.map(({ id }) => id)).toEqual(
      setting?.attributes.map(({ id }) => id),
    );
    expect(duplicated.skills).toEqual(setting?.skills);
  });

  it("resolves bundled presets before owner-scoped module presets", () => {
    profilePresetRegistry.register("echo-d6", preset());
    expect(profilePresetRegistry.current()).toMatchObject([
      {
        ownerId: "d6-system-2e",
        preset: { id: "second-edition-default" },
        source: "bundled",
      },
      {
        ownerId: "d6-system-2e",
        preset: { id: "open-d6-default" },
        source: "bundled",
      },
      {
        ownerId: "d6-system-2e",
        preset: { id: "d6mv-default" },
        source: "bundled",
      },
      {
        ownerId: "d6-system-2e",
        preset: { id: "free-d6-default" },
        source: "bundled",
      },
      {
        ownerId: "echo-d6",
        preset: { id: "echo-recommended" },
        source: "module",
      },
    ]);
  });

  it("replaces a same-owner registration and unregisters only that owner", () => {
    registerProfilePresetContribution("echo-d6", preset());
    registerProfilePresetContribution("echo-d6", {
      ...preset(),
      label: "Echo D6 Revised",
    });
    expect(availableProfilePresets().at(-1)?.preset.label).toBe(
      "Echo D6 Revised",
    );
    unregisterProfilePresetOwner("echo-d6");
    expect(availableProfilePresets()).toHaveLength(4);
    expect(callAllMock).toHaveBeenCalledWith("d6e2ProfilePresetsChanged");
  });

  it("rejects malformed, reserved, and cross-owner colliding definitions", () => {
    expect(() =>
      registerProfilePresetContribution("bad owner", preset()),
    ).toThrow("Invalid owner id");
    expect(() =>
      registerProfilePresetContribution(
        "echo-d6",
        preset("second-edition-default"),
      ),
    ).toThrow("reserved");
    registerProfilePresetContribution("echo-d6", preset());
    expect(() =>
      registerProfilePresetContribution("other-module", preset()),
    ).toThrow('already registered by "echo-d6"');
    expect(() =>
      registerProfilePresetContribution("echo-d6", {
        ...preset("broken"),
        selection: { ...preset().selection, rulesProfileId: "Bad ID" },
      }),
    ).toThrow("selection contract");
    expect(() =>
      registerProfilePresetContribution("echo-d6", {
        ...preset("extra-field"),
        unexpected: true,
      } as never),
    ).toThrow("lossy");
  });

  it("defensively freezes registered definitions", () => {
    const input = preset();
    registerProfilePresetContribution("echo-d6", input);
    input.label = "Mutated";
    expect(availableProfilePresets().at(-1)?.preset.label).toBe("Echo D6");
    expect(Object.isFrozen(availableProfilePresets())).toBe(true);
    expect(Object.isFrozen(availableProfilePresets().at(-1)?.preset)).toBe(
      true,
    );
  });
});
