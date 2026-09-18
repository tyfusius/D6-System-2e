import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  enabled: true,
  heartbeat: vi.fn(() => Promise.resolve()),
}));
vi.mock("./destiny-crypto", () => ({
  heartbeatDestinyCrypto: state.heartbeat,
}));
vi.mock("./destiny-service", () => ({ destinyEnabled: () => state.enabled }));
vi.mock("./rolls/roll-service", () => ({
  retryD6MatchingResultReward: vi.fn(),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("uses wound maintenance only while Destiny's shared heartbeat is inactive", async () => {
  vi.resetModules();
  vi.useFakeTimers();
  state.enabled = true;
  vi.stubGlobal("window", {});
  const user = { isGM: true };
  vi.stubGlobal("game", { user, socket: { on: vi.fn() } });
  const { registerWoundRootSocket } =
    await import("./first-edition-wound-authority");
  registerWoundRootSocket();
  await vi.advanceTimersByTimeAsync(20000);
  expect(state.heartbeat).not.toHaveBeenCalled();
  state.enabled = false;
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.heartbeat).toHaveBeenCalledTimes(1);
  state.enabled = true;
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.heartbeat).toHaveBeenCalledTimes(1);
  state.enabled = false;
  user.isGM = false;
  await vi.advanceTimersByTimeAsync(10000);
  expect(state.heartbeat).toHaveBeenCalledTimes(1);
});
