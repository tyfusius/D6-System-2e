import { describe, expect, it, vi } from "vitest";
import {
  applyRulesCompatibilitySelection,
  applyRulesPreset,
  COMPATIBILITY_SETTING_KEYS,
  currentRulesProfile,
  OPEN_D6_MASTER_SETTING,
  registerRulesCompatibilitySettings,
  resetRulesSettingsStateForTests,
  type RulesSettingsGateway,
} from "./rules-compatibility";

function gateway(
  initial: Readonly<Record<string, boolean>> = {},
): RulesSettingsGateway & { readonly values: Map<string, boolean> } {
  const values = new Map(Object.entries(initial));
  return {
    get: (key) => values.get(key) ?? false,
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve(value);
    },
    values,
  };
}

describe("rules compatibility settings", () => {
  it("does not let a player client fan out world-setting writes", async () => {
    const registered = new Map<
      string,
      { onChange?: (value: unknown) => void }
    >();
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("game", {
      settings: {
        get: () => false,
        register: (
          _namespace: string,
          key: string,
          configuration: { onChange?: (value: unknown) => void },
        ) => registered.set(key, configuration),
        set,
      },
      user: { isGM: false },
    });
    resetRulesSettingsStateForTests();
    registerRulesCompatibilitySettings();

    registered.get(OPEN_D6_MASTER_SETTING)?.onChange?.(true);
    await Promise.resolve();

    expect(set).not.toHaveBeenCalled();
  });

  it("applies every OpenD6 compatibility switch from the master preset", async () => {
    const settings = gateway();
    const result = await applyRulesPreset("open-d6", settings);

    expect(result.failed).toEqual([]);
    expect(result.profile.id).toBe("open-d6");
    expect(settings.values.get(OPEN_D6_MASTER_SETTING)).toBe(true);
    expect(
      Object.values(COMPATIBILITY_SETTING_KEYS).every(
        (key) => settings.values.get(key) === true,
      ),
    ).toBe(true);
  });

  it("restores native Second Edition behavior", async () => {
    const settings = gateway();
    await applyRulesPreset("open-d6", settings);
    const result = await applyRulesPreset("second-edition", settings);

    expect(result.profile.id).toBe("second-edition");
    expect(settings.get(OPEN_D6_MASTER_SETTING)).toBe(false);
    expect(
      Object.values(COMPATIBILITY_SETTING_KEYS).every(
        (key) => settings.values.get(key) === false,
      ),
    ).toBe(true);
  });

  it("reads an independently changed switch as a custom profile", () => {
    const settings = gateway({
      [COMPATIBILITY_SETTING_KEYS.firstEditionSuccessEvaluator]: true,
    });
    expect(currentRulesProfile((key) => settings.get(key)).id).toBe("custom");
  });

  it("saves an explicit custom selection and synchronizes the master switch", async () => {
    const settings = gateway();
    const result = await applyRulesCompatibilitySelection(
      {
        firstEditionActionEconomy: false,
        firstEditionActiveDefenses: false,
        firstEditionAdvancement: false,
        firstEditionAttributes: true,
        firstEditionDamage: false,
        firstEditionInitiative: true,
        firstEditionMovement: false,
        firstEditionMetaCurrency: true,
        firstEditionPips: false,
        firstEditionRetries: false,
        firstEditionSuccessEvaluator: true,
        firstEditionWildDie: true,
      },
      settings,
    );

    expect(result.profile.id).toBe("custom");
    expect(settings.get(OPEN_D6_MASTER_SETTING)).toBe(false);
    expect(
      settings.values.get(COMPATIBILITY_SETTING_KEYS.firstEditionAttributes),
    ).toBe(true);
    expect(settings.get(COMPATIBILITY_SETTING_KEYS.firstEditionDamage)).toBe(
      false,
    );
    expect(
      settings.get(COMPATIBILITY_SETTING_KEYS.firstEditionInitiative),
    ).toBe(true);
  });

  it("reports failed writes without hiding successful settings", async () => {
    const settings = gateway();
    const failing: RulesSettingsGateway = {
      get: (key) => settings.get(key),
      set: (key, value) =>
        key === COMPATIBILITY_SETTING_KEYS.firstEditionDamage
          ? Promise.reject(new Error("denied"))
          : settings.set(key, value),
    };
    const result = await applyRulesPreset("open-d6", failing);

    expect(result.failed).toEqual([
      {
        error: "denied",
        key: COMPATIBILITY_SETTING_KEYS.firstEditionDamage,
      },
    ]);
    expect(result.applied).toContain(
      COMPATIBILITY_SETTING_KEYS.firstEditionSuccessEvaluator,
    );
  });
});
