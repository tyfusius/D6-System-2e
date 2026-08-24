import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_ID } from "../constants";
import { refreshRenderedDocumentSheets } from "./rendered-document-sheets";
import { persistSystemSettingsSave } from "./settings-save";

describe("system settings save", () => {
  const stored = new Map<string, boolean | number | string>();
  const onChange = new Map<string, () => void>();
  const set = vi.fn(
    (_namespace: string, key: string, value: boolean | number | string) => {
      stored.set(key, value);
      onChange.get(key)?.();
      return Promise.resolve(value);
    },
  );

  beforeEach(() => {
    stored.clear();
    onChange.clear();
    set.mockClear();
    Object.assign(globalThis, {
      game: {
        settings: {
          get: (_namespace: string, key: string) => stored.get(key),
          set,
        },
      },
    });
  });

  it("writes only changed typed values and persists the strength-grenade toggle", async () => {
    stored.set("unchanged", 5);
    stored.set("firstEditionStrengthGrenadeRanges", false);

    const changed = await persistSystemSettingsSave([
      { key: "unchanged", value: 5 },
      { key: "firstEditionStrengthGrenadeRanges", value: true },
    ]);

    expect(changed).toBe(1);
    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      SYSTEM_ID,
      "firstEditionStrengthGrenadeRanges",
      true,
    );
    expect(stored.get("firstEditionStrengthGrenadeRanges")).toBe(true);
  });

  it("coalesces multi-setting callbacks without opening closed sheets", async () => {
    const openActorSheet = { rendered: true, render: vi.fn() };
    const closedActorSheet = { rendered: false, render: vi.fn() };
    const windows = { 1: openActorSheet, 2: closedActorSheet };
    const refresh = () => refreshRenderedDocumentSheets(windows, () => true);
    stored.set("healthMode", "body-points");
    stored.set("trackStuns", false);
    onChange.set("healthMode", refresh);
    onChange.set("trackStuns", refresh);

    await persistSystemSettingsSave([
      { key: "healthMode", value: "wounds" },
      { key: "trackStuns", value: true },
    ]);

    expect(set).toHaveBeenCalledTimes(2);
    expect(openActorSheet.render).toHaveBeenCalledOnce();
    expect(closedActorSheet.render).not.toHaveBeenCalled();
  });
});
