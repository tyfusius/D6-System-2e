import { afterEach, describe, expect, it, vi } from "vitest";
import { withRuntimeReadScope } from "../application/runtime-read-scope";
import {
  currentConfiguredRulesProfile,
  registerRulesProfileContribution,
  unregisterRulesProfileOwner,
} from "./rules-profile-library";
import { currentSettingProfile } from "./setting-profile";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const world = {
    version: 7,
    activeProfileId: "performance",
    profiles: {
      performance: {
        id: "performance",
        label: "Before",
        source: { kind: "world" },
        strategies: { pips: "open-d6.pips.classic" },
      },
    },
  };
  let language = "first";
  const get = vi.fn((_scope: string, key: string) =>
    key === "worldRulesProfiles" ? world : undefined,
  );
  vi.stubGlobal("game", {
    settings: { get },
    i18n: { localize: (key: string) => `${language}:${key}` },
  });
  vi.stubGlobal("Hooks", { callAll: vi.fn() });
  return {
    world,
    get,
    language: (value: string) => {
      language = value;
    },
  };
}

describe("profile projection work and freshness", () => {
  it("normalizes world rules once across repeated downstream reads in an operation", () => {
    const { get, world } = setup();
    withRuntimeReadScope(() => {
      for (let i = 0; i < 100; i += 1)
        expect(currentConfiguredRulesProfile().label).toBe("Before");
    });
    expect(
      get.mock.calls.filter(([, key]) => key === "worldRulesProfiles"),
    ).toHaveLength(1);
    world.profiles.performance.label = "After";
    expect(currentConfiguredRulesProfile().label).toBe("After");
  });
  it("reuses setting selection inside a read and refreshes localized data on the next read", () => {
    const fixture = setup();
    let first: ReturnType<typeof currentSettingProfile> | undefined;
    withRuntimeReadScope(() => {
      first = currentSettingProfile();
      expect(currentSettingProfile()).toBe(first);
    });
    fixture.language("second");
    const next = currentSettingProfile();
    expect(next).not.toBe(first);
    expect(next.label).toContain("second:");
  });
  it("observes registration and removal immediately even inside a nested read", () => {
    const { world } = setup();
    world.activeProfileId = "module-performance";
    withRuntimeReadScope(() => {
      expect(currentConfiguredRulesProfile().id).toBe("second-edition");
      registerRulesProfileContribution("performance-owner", {
        id: "module-performance",
        label: "Registered",
      });
      expect(currentConfiguredRulesProfile().label).toBe("Registered");
      unregisterRulesProfileOwner("performance-owner");
      expect(currentConfiguredRulesProfile().id).toBe("second-edition");
    });
  });
});
