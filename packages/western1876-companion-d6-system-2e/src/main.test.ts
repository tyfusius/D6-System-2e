import { afterEach, describe, expect, it, vi } from "vitest";
import { isD6ProfileApi } from "./d6-system-api";
import { MODULE_ID } from "./module";

function fixture(apiVersion = 2) {
  const registry = () => ({ register: vi.fn(), unregisterOwner: vi.fn() });
  const api = {
    apiVersion,
    systemId: "d6-system-2e",
    rulesProfileRegistry: registry(),
    settingProfileRegistry: registry(),
    settingProfileFontRegistry: registry(),
    profilePresetRegistry: registry(),
    firstEditionGenreProfiles: registry(),
    profilePreset: { activate: vi.fn() },
  };
  const set = vi.fn();
  const warn = vi.fn();
  let ready: (() => void) | undefined;
  vi.stubGlobal("Hooks", {
    once: (event: string, callback: () => void) => {
      expect(event).toBe("ready");
      ready = callback;
    },
  });
  vi.stubGlobal("game", {
    system: { api },
    settings: { set },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("ui", { notifications: { warn } });
  return {
    api,
    set,
    warn,
    ready: () => {
      if (!ready) throw new Error("Missing ready hook");
      ready();
    },
  };
}

describe("1876 module lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("registers availability on ready without selecting profiles or writing world settings", async () => {
    const f = fixture();
    await import("./main");
    expect(f.api.rulesProfileRegistry.register).not.toHaveBeenCalled();
    f.ready();
    for (const registry of [
      f.api.rulesProfileRegistry,
      f.api.settingProfileFontRegistry,
      f.api.profilePresetRegistry,
      f.api.firstEditionGenreProfiles,
    ]) {
      expect(registry.register).toHaveBeenCalledOnce();
      expect(registry.register).toHaveBeenCalledWith(
        MODULE_ID,
        expect.any(Object),
      );
    }
    expect(f.api.profilePreset.activate).not.toHaveBeenCalled();
    expect(f.api.settingProfileRegistry.register).toHaveBeenCalledTimes(2);
    expect(f.api.settingProfileRegistry.register).toHaveBeenNthCalledWith(
      1,
      MODULE_ID,
      expect.objectContaining({ id: "western-1876" }),
    );
    expect(f.api.settingProfileRegistry.register).toHaveBeenNthCalledWith(
      2,
      MODULE_ID,
      expect.objectContaining({ id: "western-1876-outlaw" }),
    );
    expect(
      f.api.firstEditionGenreProfiles.register.mock.invocationCallOrder[0],
    ).toBeLessThan(
      Number(f.api.rulesProfileRegistry.register.mock.invocationCallOrder[0]),
    );
    expect(
      f.api.settingProfileFontRegistry.register.mock.invocationCallOrder[0],
    ).toBeLessThan(
      Number(f.api.settingProfileRegistry.register.mock.invocationCallOrder[0]),
    );
    expect(f.set).not.toHaveBeenCalled();
    expect(f.warn).not.toHaveBeenCalled();
  });

  it("fails closed on incompatible API versions without partial registration", async () => {
    const f = fixture(1);
    await import("./main");
    f.ready();
    expect(f.warn).toHaveBeenCalledWith("WESTERN1876.ApiUnavailable");
    expect(f.api.rulesProfileRegistry.register).not.toHaveBeenCalled();
    expect(f.api.settingProfileRegistry.register).not.toHaveBeenCalled();
    expect(f.api.settingProfileFontRegistry.register).not.toHaveBeenCalled();
    expect(f.api.profilePresetRegistry.register).not.toHaveBeenCalled();
    expect(f.api.firstEditionGenreProfiles.register).not.toHaveBeenCalled();
    expect(f.set).not.toHaveBeenCalled();
  });

  it("requires all profile registries but no unrelated gameplay API", () => {
    const f = fixture();
    expect(isD6ProfileApi(f.api)).toBe(true);
    expect(isD6ProfileApi({ ...f.api, settingProfileRegistry: {} })).toBe(
      false,
    );
    expect(isD6ProfileApi({ ...f.api, systemId: "other" })).toBe(false);
    expect(isD6ProfileApi({ ...f.api, settingProfileFontRegistry: {} })).toBe(
      false,
    );
    expect(isD6ProfileApi(null)).toBe(false);
    expect(isD6ProfileApi({ ...f.api, firstEditionGenreProfiles: {} })).toBe(
      false,
    );
  });
});
