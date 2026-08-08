import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableProfilePresets,
  profilePresetRegistry,
  registerProfilePresetContribution,
  resetProfilePresetRegistryForTests,
  unregisterProfilePresetOwner,
} from "./profile-presets";

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
    expect(availableProfilePresets()).toHaveLength(2);
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
