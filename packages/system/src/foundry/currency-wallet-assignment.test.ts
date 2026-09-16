/* eslint-disable @typescript-eslint/unbound-method -- Foundry methods are behavioral spies. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCurrencyWallet,
  type D6CurrencyDefinitionV1,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations";
import {
  assignCurrentCurrencyWalletFromDialog,
  promptCurrentCurrencyWalletAssignment,
} from "./currency-wallet-assignment";
import { actorCurrencyWalletState } from "./currency-state";

const currentDefinition = vi.hoisted<D6CurrencyDefinitionV1>(() => ({
  denominations: [
    {
      displayPrecision: 2,
      id: "dollar",
      pluralName: "Dollars",
      ratioToParent: "1",
      singularName: "Dollar",
      symbol: "$",
    },
    {
      displayPrecision: 0,
      id: "cent",
      pluralName: "Cents",
      ratioToParent: "100",
      singularName: "Cent",
      symbol: "¢",
    },
  ],
  id: "western-1876-dollar",
  revision: 1,
  version: 1,
}));

vi.mock("../settings/setting-profile", () => ({
  currentSettingProfile: () => ({ currency: currentDefinition }),
}));

function staleActor(): FoundryActorDocument {
  const system = {
    profile: {
      currency: 0,
      currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
    },
  };
  return {
    system,
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      const wallet = changes["system.profile.currencyWallet"];
      if (wallet) system.profile.currencyWallet = wallet as D6CurrencyWalletV1;
      return Promise.resolve();
    }),
  } as unknown as FoundryActorDocument;
}

describe("current currency wallet assignment dialog", () => {
  let actor: FoundryActorDocument;
  let wait: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actor = staleActor();
    wait = vi.fn();
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { wait } } },
    });
  });

  it("keeps Cancel a no-op under DialogV2's nullish action fallback", async () => {
    wait.mockImplementationOnce(
      (options: {
        buttons: readonly {
          action: string;
          callback: (
            event: Event,
            button: { form?: HTMLFormElement },
          ) => unknown;
        }[];
      }) => {
        const cancel = options.buttons.find(
          ({ action }) => action === "cancel",
        );
        if (!cancel) throw new Error("cancel button required");
        const callbackResult = cancel.callback(new Event("click"), {});
        return Promise.resolve(callbackResult ?? cancel.action);
      },
    );

    await expect(
      assignCurrentCurrencyWalletFromDialog(actor, true, "cancel-test"),
    ).resolves.toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actorCurrencyWalletState(actor).stale).toBe(true);
  });

  it("rejects an untagged action string returned on dialog close", async () => {
    wait.mockResolvedValueOnce("cancel");
    await expect(
      promptCurrentCurrencyWalletAssignment(actorCurrencyWalletState(actor)),
    ).resolves.toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("applies only tagged, validated counts from an explicit assignment", async () => {
    await expect(
      assignCurrentCurrencyWalletFromDialog(actor, true, "assign-test", () =>
        Promise.resolve({ cent: "0", dollar: "9" }),
      ),
    ).resolves.toBe(true);
    expect(actor.update).toHaveBeenCalledOnce();
    expect(actorCurrencyWalletState(actor)).toMatchObject({
      stale: false,
      wallet: { counts: { cent: "0", dollar: "9" } },
    });
  });
});
