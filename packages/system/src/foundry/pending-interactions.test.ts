import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6PendingInteractions,
  resetD6PendingInteractionsForTests,
} from "../application/pending-interactions";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import {
  PENDING_INTERACTION_DELIVERY_LEDGER,
  registerFoundryPendingInteraction,
} from "./pending-interactions";

afterEach(() => {
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

  it("forces an explicitly requested roll window without changing the automatic preference", async () => {
    stubSettings(false);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    await registerFoundryPendingInteraction(options(reopen), {
      forceOpen: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });
});
