import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6GmTasks,
  cancelD6ActiveGmTask,
  resetD6ActiveGmTasksForTests,
  runD6ActiveGmTask,
  takeOverD6ActiveGmTask,
} from "./active-gm-tasks";

afterEach(() => {
  resetD6ActiveGmTasksForTests();
  vi.useRealTimers();
});

function options(execute: () => Promise<string>) {
  const createdAt = Date.now();
  return {
    actorId: "actor",
    actorImg: "actor.webp",
    actorName: "Rook",
    cancelValue: "cancelled",
    controllerName: "Player",
    controllerUserId: "player",
    createdAt,
    delivery: "open-roll-window" as const,
    execute,
    expiresAt: createdAt + 60_000,
    id: "task",
    kind: "requestedRoll" as const,
    label: "Dodge",
    subject: { id: "dodge", kind: "skill" as const },
  };
}

describe("active GM tasks", () => {
  it("lists pending work and removes it after remote completion", async () => {
    let finish: ((value: string) => void) | undefined;
    const pending = runD6ActiveGmTask(
      options(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    expect(activeD6GmTasks()).toMatchObject([
      {
        delivery: "open-roll-window",
        subject: { id: "dodge", kind: "skill" },
      },
    ]);
    finish?.("rolled");
    await expect(pending).resolves.toBe("rolled");
    expect(activeD6GmTasks()).toHaveLength(0);
  });

  it("marks failed delivery and lets the GM take over", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const execute = vi.fn().mockRejectedValueOnce(new Error("disconnected"));
    const takeOver = vi.fn().mockResolvedValue("gm-rolled");
    const pending = runD6ActiveGmTask({
      ...options(execute),
      takeOver,
    });
    await vi.waitFor(() =>
      expect(activeD6GmTasks()[0]?.remoteFailed).toBe(true),
    );
    await takeOverD6ActiveGmTask("task");
    await expect(pending).resolves.toBe("gm-rolled");
    expect(takeOver).toHaveBeenCalledOnce();
  });

  it("cancels remotely and expires without retaining stale work", async () => {
    const cancelRemote = vi.fn().mockResolvedValue(undefined);
    const pending = runD6ActiveGmTask({
      ...options(() => new Promise(() => undefined)),
      cancelRemote,
    });
    await cancelD6ActiveGmTask("task");
    await expect(pending).resolves.toBe("cancelled");
    expect(cancelRemote).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    const expiring = runD6ActiveGmTask({
      ...options(() => new Promise(() => undefined)),
      createdAt: Date.now(),
      expiresAt: Date.now() + 100,
      id: "expiring",
    });
    await vi.advanceTimersByTimeAsync(100);
    await expect(expiring).resolves.toBe("cancelled");
  });

  it("allows only the takeover path to settle after remote abort", async () => {
    let finishRemote: ((value: string) => void) | undefined;
    const pending = runD6ActiveGmTask({
      ...options(
        () =>
          new Promise((resolve) => {
            finishRemote = resolve;
          }),
      ),
      cancelRemote: () => Promise.resolve(finishRemote?.("remote-cancelled")),
      takeOver: () => Promise.resolve("gm-rolled"),
    });
    await takeOverD6ActiveGmTask("task");
    await expect(pending).resolves.toBe("gm-rolled");
  });
});
