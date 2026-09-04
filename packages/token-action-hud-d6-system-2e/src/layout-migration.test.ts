import { afterEach, describe, expect, it, vi } from "vitest";
import {
  layoutMigrationRequired,
  migrateLegacyHudLayout,
} from "./layout-migration";
import {
  LAYOUT_SCHEMA_SETTING,
  LAYOUT_SCHEMA_VERSION,
  MODULE_ID,
} from "./settings";

afterEach(() => vi.unstubAllGlobals());

describe("HUD layout migration", () => {
  it("migrates missing and legacy layouts", () => {
    expect(layoutMigrationRequired(undefined)).toBe(true);
    expect(layoutMigrationRequired(0)).toBe(true);
  });

  it("preserves layouts already created for the combat HUD", () => {
    expect(layoutMigrationRequired(1)).toBe(false);
    expect(layoutMigrationRequired(2)).toBe(false);
  });

  it("resets legacy HUD user data and records the migrated schema", async () => {
    const resetUserData = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockResolvedValue(undefined);
    const callAll = vi.fn();
    vi.stubGlobal("game", {
      settings: { get: vi.fn().mockReturnValue(0), set },
      tokenActionHud: { resetUserData },
    });
    vi.stubGlobal("Hooks", { callAll });

    await migrateLegacyHudLayout();

    expect(resetUserData).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      LAYOUT_SCHEMA_SETTING,
      LAYOUT_SCHEMA_VERSION,
    );
    expect(callAll).toHaveBeenCalledWith("forceUpdateTokenActionHud");
  });

  it("defers migration until HUD Core exposes its user-data reset", async () => {
    const set = vi.fn();
    vi.stubGlobal("game", {
      settings: { get: vi.fn().mockReturnValue(0), set },
    });
    vi.stubGlobal("Hooks", { callAll: vi.fn() });

    await migrateLegacyHudLayout();

    expect(set).not.toHaveBeenCalled();
  });
});
