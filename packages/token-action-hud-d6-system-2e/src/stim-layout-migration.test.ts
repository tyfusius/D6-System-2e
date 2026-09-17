import { requireDestinyValue as required } from "@d6-system-2e/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateStimHudLayout } from "./stim-layout-migration";
import { MODULE_ID, STIM_LAYOUT_SETTING } from "./settings";
import type { CoreSavedGroup } from "./hud-core-port";

let migrated = false;
let customization = true;
const set = vi.fn((_module: string, _key: string, value: boolean) => {
  migrated = value;
  return Promise.resolve();
});
function fixture() {
  const userGroups = Object.fromEntries(
    ["round", "weapons", "custom", "abilities"].map((id, order) => [
      id,
      {
        id,
        nestId: id,
        name: id === "weapons" ? "My gear" : id,
        level: 1,
        order,
        selected: id !== "custom",
        settings: { showTitle: false },
        type: "system",
      },
    ]),
  );
  userGroups.custom_child = {
    ...required(userGroups.custom),
    id: "child",
    nestId: "custom_child",
    level: 2,
  };
  const handler = {
    userGroups,
    groups: { ...userGroups },
    hudManager: {
      hud: {
        groups: Object.values(userGroups).filter(
          (g) => g.level === 1 && g.selected,
        ),
      },
    },
    dataHandler: {
      canGetData: true,
      canSaveData: true,
      saveDataAsGm: vi.fn().mockResolvedValue(undefined),
    },
    createGroup: vi.fn((data: CoreSavedGroup) => ({ ...data })),
    addGroup: vi.fn(),
  };
  return handler;
}
beforeEach(() => {
  migrated = false;
  customization = true;
  vi.clearAllMocks();
  vi.stubGlobal("game", {
    user: { id: "player" },
    i18n: { localize: () => "Stims" },
    settings: {
      get: (_module: string, key: string) =>
        key === STIM_LAYOUT_SETTING ? migrated : customization,
      set,
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("additive Stims layout migration", () => {
  it("preserves all saved customization including hidden descendants and adds after Weapons", async () => {
    const h = fixture();
    const original = structuredClone(h.userGroups);
    await migrateStimHudLayout(h);
    expect(h.dataHandler.saveDataAsGm).toHaveBeenCalledExactlyOnceWith(
      "user",
      "player",
      expect.objectContaining(original),
    );
    expect(h.userGroups).toMatchObject(original);
    expect(h.userGroups.stims).toMatchObject({ order: 1.5 });
    expect(h.userGroups.stims_stims).toMatchObject({ level: 2 });
    expect(h.hudManager.hud.groups.map((g) => g.id)).toEqual([
      "round",
      "weapons",
      "stims",
      "abilities",
    ]);
    expect(set).toHaveBeenCalledWith(MODULE_ID, STIM_LAYOUT_SETTING, true);
    await migrateStimHudLayout(h);
    expect(h.dataHandler.saveDataAsGm).toHaveBeenCalledOnce();
  });
  it("respects an already hidden Stims group", async () => {
    const h = fixture();
    h.userGroups.stims = {
      ...required(h.userGroups.custom),
      id: "stims",
      nestId: "stims",
    };
    await migrateStimHudLayout(h);
    expect(h.dataHandler.saveDataAsGm).not.toHaveBeenCalled();
    expect(h.createGroup).not.toHaveBeenCalled();
    expect(migrated).toBe(true);
  });
  it.each(["canGetData", "canSaveData", "customization"])(
    "defers when %s is unavailable",
    async (key) => {
      const h = fixture();
      if (key === "customization") customization = false;
      else h.dataHandler[key as "canGetData" | "canSaveData"] = false;
      await migrateStimHudLayout(h);
      expect(h.dataHandler.saveDataAsGm).not.toHaveBeenCalled();
      expect(migrated).toBe(false);
    },
  );
  it("leaves the original layout and migration marker intact on failed persistence", async () => {
    const h = fixture();
    const original = structuredClone(h.userGroups);
    h.dataHandler.saveDataAsGm.mockRejectedValue(new Error("offline"));
    await expect(migrateStimHudLayout(h)).rejects.toThrow("offline");
    expect(h.userGroups).toEqual(original);
    expect(migrated).toBe(false);
  });
});
