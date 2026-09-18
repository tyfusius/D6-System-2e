import type * as CurrencyHolderService from "./currency-holder-service";
import { afterEach, expect, it, vi } from "vitest";
const spies = vi.hoisted(() => ({
  holders: vi.fn(() => Promise.resolve()),
  destiny: vi.fn(() => ({})),
}));
vi.mock("./currency-holder-service", async (importOriginal) => ({
  ...(await importOriginal<typeof CurrencyHolderService>()),
  synchronizePendingCurrencyHolderTransfers: spies.holders,
}));
vi.mock("./destiny-service", () => ({
  subscribeDestiny: vi.fn(),
  destinyPrivateView: spies.destiny,
  destinyPublicState: () => ({}),
  destinyPrimaryGM: () => undefined,
  destinyEnabled: () => true,
  destinyOutboxCount: () => 0,
}));
vi.mock("./destiny-workspace", () => ({ destinyText: (key: string) => key }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("skips unrelated actor/item updates but keeps wallet, receipt and ownership recovery triggers", async () => {
  vi.resetModules();
  const hooks = new Map<string, ((...args: unknown[]) => void)[]>();
  const on = (name: string, fn: (...args: unknown[]) => void) =>
    hooks.set(name, [...(hooks.get(name) ?? []), fn]);
  vi.stubGlobal("Hooks", { on, once: on });
  const user = { id: "gm", isGM: true, active: true };
  const actors = vi.fn(() => []);
  vi.stubGlobal("game", {
    user,
    users: { contents: [user] },
    actors: {
      get contents() {
        return actors();
      },
    },
    socket: { on: vi.fn() },
    settings: { get: () => false },
  });
  const { registerEconomySocket } = await import("./economy-service");
  const { registerDestinyPending } = await import("./destiny-pending");
  registerEconomySocket();
  registerDestinyPending();
  spies.holders.mockClear();
  actors.mockClear();
  spies.destiny.mockClear();
  const fire = (name: string, changes: unknown) => {
    for (const fn of hooks.get(name) ?? []) fn({}, changes);
  };
  fire("updateActor", { "system.health.condition": "wounded" });
  fire("updateActor", { system: { movement: { posture: "prone" } } });
  fire("updateItem", { "system.description": "text" });
  expect(spies.holders).not.toHaveBeenCalled();
  expect(actors).not.toHaveBeenCalled();
  expect(spies.destiny).not.toHaveBeenCalled();
  fire("updateActor", {
    "system.profile.currencyWallet.operationReceipts.x": {},
  });
  expect(spies.holders).toHaveBeenCalledTimes(1);
  expect(actors).toHaveBeenCalledTimes(1);
  fire("updateItem", { system: { currencyWallet: { operationReceipts: {} } } });
  expect(spies.holders).toHaveBeenCalledTimes(2);
  fire("updateActor", { "flags.d6-system-2e.-=destinyDamage": null });
  expect(spies.destiny).toHaveBeenCalledTimes(1);
  fire("updateActor", { ownership: { player: 0 } });
  expect(spies.holders).toHaveBeenCalledTimes(3);
  expect(spies.destiny).toHaveBeenCalledTimes(2);
  fire("updateActor", { system: null });
  expect(spies.holders).toHaveBeenCalledTimes(4);
});
