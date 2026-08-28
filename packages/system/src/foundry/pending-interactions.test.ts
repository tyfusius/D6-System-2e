import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6PendingInteractions,
  resetD6PendingInteractionsForTests,
} from "../application/pending-interactions";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import {
  PENDING_INTERACTION_DELIVERY_LEDGER,
  registerFoundryPendingInteraction,
  resetFoundryPendingInteractionDeliveryForTests,
} from "./pending-interactions";

afterEach(async () => {
  await resetFoundryPendingInteractionDeliveryForTests();
  resetD6PendingInteractionsForTests();
  vi.unstubAllGlobals();
});

function stubSettings(autoOpen: boolean) {
  const values = new Map<string, unknown>([
    [SHARED_SETTING_KEYS.autoOpenPendingPrompts, autoOpen],
    [PENDING_INTERACTION_DELIVERY_LEDGER, "[]"],
  ]);
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) => values.get(key),
      set: vi.fn((_namespace: string, key: string, value: unknown) =>
        Promise.resolve(values.set(key, value)),
      ),
    },
  });
  return values;
}

function options(reopen: () => Promise<"dismissed">) {
  return {
    controllerUserId: "player",
    createdAt: 100,
    expiresAt: Date.now() + 60_000,
    id: "prompt-1",
    kind: "resistance-roll" as const,
    label: "Resistance",
    reopen,
  };
}

describe("Foundry pending interaction delivery", () => {
  it("keeps automatic delivery off by default while registering a reopenable task", async () => {
    stubSettings(false);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    await registerFoundryPendingInteraction(options(reopen), {
      automaticEligible: true,
    });
    expect(reopen).not.toHaveBeenCalled();
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it("auto-opens once per persisted client delivery lifecycle", async () => {
    const values = stubSettings(true);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const pending = options(reopen);
    await registerFoundryPendingInteraction(pending, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();

    resetD6PendingInteractionsForTests();
    await registerFoundryPendingInteraction(pending, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(String(values.get(PENDING_INTERACTION_DELIVERY_LEDGER))).toContain(
      "prompt-1",
    );
  });

  it("does not auto-open the same stable workflow again when an expired stage is renewed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const values = stubSettings(true);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const first = options(reopen);
    await registerFoundryPendingInteraction(first, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();

    resetD6PendingInteractionsForTests();
    vi.setSystemTime(first.expiresAt + 1);
    const renewedAt = Date.now();
    await registerFoundryPendingInteraction(
      {
        ...first,
        createdAt: renewedAt,
        expiresAt: renewedAt + 60_000,
      },
      { automaticEligible: true },
    );

    expect(reopen).toHaveBeenCalledOnce();
    expect(String(values.get(PENDING_INTERACTION_DELIVERY_LEDGER))).toContain(
      "prompt-1",
    );
    vi.useRealTimers();
  });

  it("never auto-opens a prompt whose delivery lifetime has already expired", async () => {
    stubSettings(true);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const now = Date.now();

    await registerFoundryPendingInteraction(
      {
        ...options(reopen),
        createdAt: now - 60_000,
        expiresAt: now - 1,
      },
      { automaticEligible: true },
    );

    expect(reopen).not.toHaveBeenCalled();
  });

  it("forces an explicitly requested roll window without changing the automatic preference", async () => {
    stubSettings(false);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    await registerFoundryPendingInteraction(options(reopen), {
      forceOpen: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it("serializes automatic prompt opening without resolving or rolling for the user", async () => {
    stubSettings(true);
    let releaseFirst!: () => void;
    const first = vi.fn(
      () =>
        new Promise<"dismissed">((resolve) => {
          releaseFirst = () => resolve("dismissed");
        }),
    );
    const second = vi.fn().mockResolvedValue("dismissed" as const);
    const firstRegistration = registerFoundryPendingInteraction(
      options(first),
      {
        automaticEligible: true,
      },
    );
    await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
    const secondRegistration = registerFoundryPendingInteraction(
      { ...options(second), id: "prompt-2" },
      { automaticEligible: true },
    );
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.all([firstRegistration, secondRegistration]);
    expect(second).toHaveBeenCalledOnce();
    expect(activeD6PendingInteractions("player")).toHaveLength(2);
  });
});
