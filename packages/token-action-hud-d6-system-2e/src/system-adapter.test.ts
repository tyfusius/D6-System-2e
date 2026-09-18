import { afterEach, expect, it, vi } from "vitest";
import { createSystemAdapter } from "./system-adapter";

const CORE_ID = "token-action-hud-core";

afterEach(() => vi.unstubAllGlobals());

function setup(saved: string | undefined, isGM = true) {
  let registered = false;
  let selection = saved;
  const get = vi.fn((namespace: string, key: string) => {
    expect(namespace).toBe(CORE_ID);
    expect(key).toBe("rollHandler");
    if (!registered) throw new Error("Setting is not registered yet");
    return selection ?? "core";
  });
  const set = vi.fn(async (namespace: string, key: string, value: string) => {
    expect(namespace).toBe(CORE_ID);
    expect(key).toBe("rollHandler");
    expect(isGM).toBe(true);
    await Promise.resolve();
    selection = value;
  });
  class SystemManager {
    async init(): Promise<void> {
      await Promise.resolve();
      registered = true;
    }
  }
  vi.stubGlobal("game", {
    user: { isGM },
    i18n: { localize: (key: string) => `localized:${key}` },
    settings: { get, set },
  });
  const Adapter = createSystemAdapter({
    api: {
      SystemManager,
      ActionHandler: class {
        readonly testPort = true;
      },
      RollHandler: class {
        readonly testPort = true;
      },
    },
  });
  return { adapter: new Adapter(), get, set, selection: () => selection };
}

it("registers the reserved core choice with the existing localized label", () => {
  const { adapter } = setup(undefined);
  // Core uses this map for the world-setting dropdown.
  expect(
    (
      adapter as unknown as { getAvailableRollHandlers(): object }
    ).getAvailableRollHandlers(),
  ).toEqual({ core: "localized:D6E2_TAH.CoreRollHandler" });
});

it("repairs only the legacy alias after registration and awaits persistence before startup", async () => {
  const { adapter, set, selection } = setup("d6e2");
  await adapter.init();
  expect(selection()).toBe("core");
  expect(set).toHaveBeenCalledExactlyOnceWith(CORE_ID, "rollHandler", "core");

  await adapter.init();
  expect(set).toHaveBeenCalledOnce();
});

it.each([undefined, "core", "active-external-handler", "missing-handler"])(
  "preserves saved %s for Core's normal selection and fallback",
  async (saved) => {
    const { adapter, set, selection } = setup(saved);
    await adapter.init();
    expect(selection()).toBe(saved);
    expect(set).not.toHaveBeenCalled();
  },
);

it("does not attempt a world-setting repair on a player login", async () => {
  const { adapter, set, selection } = setup("d6e2", false);
  await adapter.init();
  expect(selection()).toBe("d6e2");
  expect(set).not.toHaveBeenCalled();
});

it("does not complete initialization when legacy persistence fails", async () => {
  const { adapter, set } = setup("d6e2");
  set.mockRejectedValueOnce(new Error("Persistence failed"));
  await expect(adapter.init()).rejects.toThrow("Persistence failed");
});
