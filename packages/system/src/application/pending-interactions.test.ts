import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6PendingInteractions,
  cancelD6PendingInteraction,
  registerD6PendingInteraction,
  reopenD6PendingInteraction,
  resetD6PendingInteractionsForTests,
  resolveD6PendingInteraction,
} from "./pending-interactions";

afterEach(() => {
  resetD6PendingInteractionsForTests();
  vi.useRealTimers();
});

function options() {
  return {
    controllerUserId: "player",
    createdAt: 1_000,
    expiresAt: 61_000,
    id: "request-1",
    kind: "resistance-roll" as const,
    label: "Resistance",
  };
}

describe("pending interactions", () => {
  it("deduplicates exact socket delivery and rejects identity conflicts", () => {
    expect(registerD6PendingInteraction(options()).created).toBe(true);
    expect(registerD6PendingInteraction(options()).created).toBe(false);
    expect(() =>
      registerD6PendingInteraction({
        ...options(),
        controllerUserId: "other-player",
      }),
    ).toThrow(/conflicts/);
  });

  it("keeps a dismissed prompt pending and removes a resolved prompt", async () => {
    const reopen = vi
      .fn<() => Promise<"dismissed" | "resolved">>()
      .mockResolvedValueOnce("dismissed")
      .mockResolvedValueOnce("resolved");
    registerD6PendingInteraction({ ...options(), reopen });
    await reopenD6PendingInteraction("request-1");
    expect(activeD6PendingInteractions("player")).toMatchObject([
      { status: "pending" },
    ]);
    await reopenD6PendingInteraction("request-1");
    expect(activeD6PendingInteractions()).toHaveLength(0);
  });

  it("filters recipient projections and exposes no unrelated interaction", () => {
    registerD6PendingInteraction(options());
    expect(activeD6PendingInteractions("other-player")).toEqual([]);
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it("removes resolved, cancelled, and expired prompts", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    registerD6PendingInteraction({ ...options(), cancel });
    await cancelD6PendingInteraction("request-1");
    expect(cancel).toHaveBeenCalledOnce();

    registerD6PendingInteraction(options());
    resolveD6PendingInteraction("request-1");
    expect(activeD6PendingInteractions()).toHaveLength(0);

    vi.useFakeTimers();
    const onExpire = vi.fn();
    registerD6PendingInteraction({
      ...options(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 100,
      onExpire,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(activeD6PendingInteractions()).toHaveLength(0);
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
