import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6GmTasks,
  resetD6ActiveGmTasksForTests,
  runD6ActiveGmTask,
} from "./active-gm-tasks";
import {
  activeD6PendingInteractions,
  cancelD6PendingInteraction,
  registerD6PendingInteraction,
  reopenD6PendingInteraction,
  resetD6PendingInteractionsForTests,
  resolveD6PendingInteraction,
  takeOverD6PendingInteraction,
} from "./pending-interactions";

afterEach(() => {
  resetD6ActiveGmTasksForTests();
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

  it("projects the exact in-flight operation and retains failed retry state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let finish!: (value: "dismissed") => void;
    const reopen = vi
      .fn<() => Promise<"dismissed">>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("builder failed"));
    registerD6PendingInteraction({ ...options(), reopen });

    const opening = reopenD6PendingInteraction("request-1");
    expect(activeD6PendingInteractions("player")).toMatchObject([
      { operation: "reopen", status: "opening" },
    ]);
    finish("dismissed");
    await opening;
    const [pending] = activeD6PendingInteractions("player");
    expect(pending).toMatchObject({ status: "pending" });
    expect(pending).not.toHaveProperty("operation");

    await reopenD6PendingInteraction("request-1");
    expect(activeD6PendingInteractions("player")).toMatchObject([
      { operation: "reopen", status: "failed" },
    ]);
  });

  it("filters recipient projections and exposes no unrelated interaction", () => {
    registerD6PendingInteraction(options());
    expect(activeD6PendingInteractions("other-player")).toEqual([]);
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it("exposes only explicitly registered takeover and cancellation capabilities", () => {
    const playerTask = registerD6PendingInteraction(options()).view;
    expect(playerTask).toMatchObject({ cancellable: false, takeover: false });

    resetD6PendingInteractionsForTests();
    const gmTask = registerD6PendingInteraction({
      ...options(),
      cancel: vi.fn().mockResolvedValue(undefined),
      takeOver: vi.fn().mockResolvedValue("dismissed"),
    }).view;
    expect(gmTask).toMatchObject({ cancellable: true, takeover: true });
  });

  it("retains a rejected legacy takeover as retryable unified pending work", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const takeOver = vi.fn().mockRejectedValue(new Error("takeover rejected"));
    const createdAt = Date.now();
    void runD6ActiveGmTask({
      actorId: "actor",
      actorImg: "actor.webp",
      actorName: "Rook",
      cancelValue: "cancelled",
      controllerName: "Player",
      controllerUserId: "player",
      createdAt,
      delivery: "open-roll-window",
      execute: () => Promise.reject(new Error("controller disconnected")),
      expiresAt: createdAt + 60_000,
      id: "task",
      kind: "requestedRoll",
      label: "Dodge",
      subject: { id: "dodge", kind: "skill" },
      takeOver,
    });
    await vi.waitFor(() =>
      expect(activeD6PendingInteractions()).toMatchObject([
        { status: "failed", takeover: true },
      ]),
    );

    await takeOverD6PendingInteraction("task");

    expect(takeOver).toHaveBeenCalledOnce();
    expect(activeD6GmTasks()).toMatchObject([
      { remoteFailed: true, working: false },
    ]);
    expect(activeD6PendingInteractions()).toMatchObject([
      {
        id: "task",
        operation: "takeOver",
        status: "failed",
        takeover: true,
      },
    ]);
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
