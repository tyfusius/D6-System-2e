import { afterEach, expect, it, vi } from "vitest";
const branding = vi.hoisted(() => ({
  applyEchoBranding: vi.fn(),
  hasEchoBrandingSurface: vi.fn(() => true),
  removeEchoBranding: vi.fn(),
}));
vi.mock("./branding", () => branding);
vi.mock("./configurator", () => ({ registerEchoConfigurator: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("only synchronizes contributions when effective Echo selection changes", async () => {
  vi.resetModules();
  const hooks = new Map<string, (...args: unknown[]) => void>();
  vi.stubGlobal("Hooks", {
    once: (name: string, fn: (...args: unknown[]) => void) =>
      hooks.set(name, fn),
    on: (name: string, fn: (...args: unknown[]) => void) => hooks.set(name, fn),
  });
  let selected = true;
  const registry = () => ({ register: vi.fn(), unregisterOwner: vi.fn() });
  const terminology = registry();
  const api = {
    apiVersion: 2,
    systemId: "d6-system-2e",
    terminology,
    themes: registry(),
    rulesProfileRegistry: registry(),
    settingProfileRegistry: registry(),
    profilePresetRegistry: registry(),
    rules: { activate: vi.fn() },
    profilePreset: { activate: vi.fn() },
    setting: {
      activate: vi.fn(),
      selection: vi.fn(() => ({
        activeProfileId: selected ? "echo-d6" : "generic",
        available: true,
      })),
    },
  };
  vi.stubGlobal("game", {
    system: { api },
    i18n: { localize: (key: string) => key },
  });
  await import("./main");
  hooks.get("ready")?.();
  await Promise.resolve();
  expect(terminology.register).toHaveBeenCalledTimes(1);
  for (let n = 0; n < 20; n++)
    hooks.get("updateSetting")?.({ key: "unrelated" });
  expect(terminology.register).toHaveBeenCalledTimes(1);
  selected = false;
  terminology.unregisterOwner.mockImplementationOnce(() => {
    throw new Error("temporary registry failure");
  });
  expect(() => hooks.get("updateSetting")?.()).toThrow(
    "temporary registry failure",
  );
  hooks.get("updateSetting")?.();
  expect(terminology.unregisterOwner).toHaveBeenCalledTimes(2);
  expect(branding.removeEchoBranding).toHaveBeenCalledTimes(1);
  hooks.get("updateSetting")?.();
  expect(branding.removeEchoBranding).toHaveBeenCalledTimes(1);
  selected = true;
  hooks.get("updateSetting")?.();
  expect(terminology.register).toHaveBeenCalledTimes(2);
  api.setting.selection.mockClear();
  branding.hasEchoBrandingSurface.mockReturnValue(false);
  for (let i = 0; i < 100; i += 1) hooks.get("renderApplicationV2")?.({});
  expect(api.setting.selection).not.toHaveBeenCalled();
  branding.hasEchoBrandingSurface.mockReturnValue(true);
  hooks.get("renderApplicationV2")?.({});
  expect(api.setting.selection).toHaveBeenCalledOnce();
  expect(branding.applyEchoBranding).toHaveBeenCalledOnce();
});
