import { beforeEach, describe, expect, it, vi } from "vitest";
import { D6_ROLL_CONTRACT_VERSION } from "@d6-system-2e/core";

const transact = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const terminology = vi.hoisted(() => ({
  resourceLabel: "Force",
  strategyId: "d6e2.meta-currency.hero-points",
}));
vi.mock("./hero-point-service", () => ({ transactActorHeroPoints: transact }));
vi.mock("./foundry-random-id", () => ({ foundryRandomId: () => "tx-ally-1" }));
vi.mock("../registries/terminology", () => ({
  currentTerminology: () => ({
    resources: {
      fatePoints: "Fate",
      heroPoints: terminology.resourceLabel,
    },
  }),
  terminologyResourceLabel: (
    resolved: { readonly resources: Readonly<Record<string, string>> },
    resourceId: string,
  ) => resolved.resources[resourceId] ?? resourceId,
}));
vi.mock("../settings/roll-outcome", () => ({
  currentMetaCurrencyRuntimeStrategy: () => ({ id: terminology.strategyId }),
}));

import {
  assignD6MvAllyAward,
  d6MvAllyAwardProjection,
} from "./d6mv-ally-award-service";

describe("D6MV ally award routing", () => {
  const recipient = { id: "ally", name: "Ally", type: "character" };
  let stored: unknown;
  let message: {
    getFlag: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    stored = undefined;
    transact.mockClear();
    terminology.resourceLabel = "Force";
    terminology.strategyId = "d6e2.meta-currency.hero-points";
    vi.stubGlobal("game", {
      actors: { get: (id: string) => (id === "ally" ? recipient : undefined) },
      i18n: { localize: (key: string) => key },
      user: { id: "gm", isGM: true },
    });
    message = {
      getFlag: vi.fn((_namespace: string, key: string) =>
        key === "roll"
          ? {
              contractVersion: D6_ROLL_CONTRACT_VERSION,
              d6mv: { allyHeroPointAward: 1 },
            }
          : stored,
      ),
      update: vi.fn((changes: Record<string, unknown>) => {
        stored = changes["flags.d6-system-2e.d6mvAllyAward"];
        return Promise.resolve();
      }),
    };
  });

  it("applies one GM-authoritative award and is idempotent across duplicate delivery", async () => {
    await assignD6MvAllyAward(message as never, "ally");
    await assignD6MvAllyAward(message as never, "ally");
    expect(transact).toHaveBeenCalledOnce();
    expect(transact).toHaveBeenCalledWith(recipient, 0, 1);
    expect(stored).toMatchObject({
      authorityUserId: "gm",
      recipientActorId: "ally",
      resourceLabel: "Force",
      status: "applied",
      transactionId: "tx-ally-1",
    });
  });

  it("persists the active Fate terminology with the immutable transaction receipt", async () => {
    terminology.strategyId = "open-d6.meta-currency.character-and-fate-points";
    await assignD6MvAllyAward(message as never, "ally");
    expect(stored).toMatchObject({ resourceLabel: "Fate" });
  });

  it("projects pending and applied states mutually exclusively without leaking receipts", async () => {
    expect(
      d6MvAllyAwardProjection(undefined, {
        isGM: false,
        ownsRecipient: false,
      }),
    ).toMatchObject({ showPending: true, showReceipt: false });
    await assignD6MvAllyAward(message as never, "ally");
    expect(
      d6MvAllyAwardProjection(stored, {
        isGM: false,
        ownsRecipient: false,
      }),
    ).toMatchObject({ showPending: false, showReceipt: false });
    const recipientProjection = d6MvAllyAwardProjection(stored, {
      isGM: false,
      ownsRecipient: true,
    });
    expect(recipientProjection).toMatchObject({
      showPending: false,
      showReceipt: true,
    });
    expect(recipientProjection.flag?.resourceLabel).toBe("Force");
    expect(recipientProjection.flag?.transactionId).toBe("tx-ally-1");
  });

  it("rolls back the resource write if chat evidence cannot persist", async () => {
    message.update.mockRejectedValueOnce(new Error("write failed"));
    await expect(assignD6MvAllyAward(message as never, "ally")).rejects.toThrow(
      "write failed",
    );
    expect(transact.mock.calls).toEqual([
      [recipient, 0, 1],
      [recipient, 1, 0],
    ]);
  });

  it("rejects player authority and missing recipients without mutation", async () => {
    vi.stubGlobal("game", {
      actors: { get: () => undefined },
      user: { isGM: false },
    });
    await expect(
      assignD6MvAllyAward(message as never, "missing"),
    ).rejects.toThrow("D6E2.Roll.D6MV.GMRequired");
    expect(transact).not.toHaveBeenCalled();
  });
});
