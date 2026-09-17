import { afterEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ migrate: vi.fn(), anchor: vi.fn() }));
vi.mock("@d6-system-2e/core", () => ({ isD6System2eApiV2: () => true }));
vi.mock("./system-adapter", () => ({ createSystemAdapter: vi.fn() }));
vi.mock("./token-anchor", () => ({ installTokenAnchor: f.anchor }));
vi.mock("./layout-migration", () => ({ migrateLegacyHudLayout: f.migrate }));

afterEach(() => vi.unstubAllGlobals());

it("refreshes the ready HUD for each rules save without rerunning layout migration", async () => {
  type Callback = (...args: unknown[]) => unknown;
  const once = new Map<string, Callback>();
  const listeners = new Map<string, Callback>();
  const callAll = vi.fn();
  vi.stubGlobal("Hooks", {
    once: (name: string, callback: Callback) => {
      once.set(name, callback);
      return 1;
    },
    on: (name: string, callback: Callback) => {
      listeners.set(name, callback);
      return 2;
    },
    callAll,
  });
  vi.stubGlobal("game", { system: { api: {} }, modules: { get: () => ({}) } });
  await import("./main");
  await once.get("tokenActionHudCoreApiReady")?.({});
  expect(listeners.has("d6e2RulesProfileChanged")).toBe(false);
  await once.get("tokenActionHudReady")?.();
  expect(f.migrate).toHaveBeenCalledOnce();
  callAll.mockClear();

  // The world-setting onChange broadcasts this for both enabling and disabling
  // the medical rule, including saves to the same active profile ID.
  await listeners.get("d6e2RulesProfileChanged")?.("world-profile");
  await listeners.get("d6e2RulesProfileChanged")?.("world-profile");
  expect(callAll.mock.calls).toEqual([
    ["forceUpdateTokenActionHud"],
    ["forceUpdateTokenActionHud"],
  ]);
  expect(f.migrate).toHaveBeenCalledOnce();
});
