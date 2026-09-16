/* eslint-disable @typescript-eslint/unbound-method -- Foundry methods are behavioral spies. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import {
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  currencyWalletFingerprint,
  type D6CurrencyDefinitionV1,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import {
  resetTerminologyRegistryForTests,
  setSettingProfileTerminology,
} from "../registries/terminology";
import { __testing, actorCurrency } from "./economy-service";
import {
  actorCurrencyWalletState,
  previewWalletMigration,
} from "./currency-state";

const dollars = Object.freeze({
  denominations: Object.freeze([
    Object.freeze({
      displayPrecision: 2,
      id: "dollar",
      pluralName: "Dollars",
      ratioToParent: "1",
      singularName: "Dollar",
      symbol: "$",
    }),
    Object.freeze({
      displayPrecision: 0,
      id: "cent",
      pluralName: "Cents",
      ratioToParent: "100",
      singularName: "Cent",
      symbol: "¢",
    }),
  ]),
  id: "table-currency",
  revision: 1,
  version: 1,
}) satisfies D6CurrencyDefinitionV1;

vi.mock("../settings/setting-profile", () => ({
  currentSettingProfile: () => ({ currency: dollars }),
}));

function actor(wallet: D6CurrencyWalletV1): FoundryActorDocument {
  const system = { profile: { currency: 0, currencyWallet: wallet } };
  const value = {
    createEmbeddedDocuments: vi.fn(),
    deleteEmbeddedDocuments: vi.fn(),
    id: "hero",
    img: "hero.svg",
    isOwner: true,
    items: { contents: [], get: vi.fn() },
    name: "Hero",
    system,
    testUserPermission: vi.fn(() => true),
    update: vi.fn((changes: Record<string, unknown>) => {
      const next = changes["system.profile.currencyWallet"];
      if (next) system.profile.currencyWallet = next as D6CurrencyWalletV1;
      return Promise.resolve();
    }),
    type: "character",
  } as unknown as FoundryActorDocument;
  return value;
}

describe("Foundry denomination exchange authority", () => {
  const gm = {
    active: true,
    id: "gm",
    isGM: true,
    name: "GM",
  } as FoundryUser;
  const player = {
    active: true,
    id: "player",
    isGM: false,
    name: "Player",
  } as FoundryUser;
  let autoApprove = false;
  let source: FoundryActorDocument;
  let emit: ReturnType<typeof vi.fn>;
  let approval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetTerminologyRegistryForTests();
    __testing.resetQueue();
    autoApprove = false;
    source = actor(createCurrencyWallet(dollars, { cent: "287", dollar: "1" }));
    emit = vi.fn();
    approval = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { wait: approval } },
        handlebars: { renderTemplate: vi.fn().mockResolvedValue("preview") },
      },
      utils: { randomID: vi.fn(() => "generated") },
    });
    vi.stubGlobal("ChatMessage", {
      create: vi.fn().mockResolvedValue({}),
      getSpeaker: vi.fn(() => ({})),
    });
    vi.stubGlobal("game", {
      actors: {
        contents: [source],
        get: (id: string) => (id === source.id ? source : undefined),
      },
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_namespace: string, key: string) =>
          key === SHARED_SETTING_KEYS.characterCurrencyTransactions
            ? true
            : key === SHARED_SETTING_KEYS.currencyExchangeAutoApproval
              ? autoApprove
              : false,
      },
      socket: { emit },
      user: gm,
      users: {
        contents: [gm, player],
        get: (id: string) => (id === player.id ? player : gm),
      },
    });
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  function request() {
    return {
      definitionFingerprint: currencyDefinitionFingerprint(dollars),
      definitionRevision: 1,
      expectedTotalSmallestUnit: "387",
      expectedWalletFingerprint: currencyWalletFingerprint(
        actorCurrencyWalletState(source).wallet,
      ),
      fromDenominationId: "cent",
      quantity: "250",
      sourceActorId: source.id,
      toDenominationId: "dollar",
      type: "currency-exchange" as const,
      version: 1 as const,
    };
  }

  it("applies an approved player exchange with the exact retained remainder", async () => {
    await __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "approved-1",
      type: "economy-request",
    });
    const wallet = (
      source.system.profile as { currencyWallet: D6CurrencyWalletV1 }
    ).currencyWallet;
    expect(approval).toHaveBeenCalledOnce();
    expect(wallet.counts).toEqual({ cent: "87", dollar: "3" });
    expect(wallet.recentOperationIds).toContain("approved-1");
  });

  it("changes nothing when the GM rejects and skips the prompt only when autoapproval is enabled", async () => {
    approval.mockResolvedValueOnce(false);
    await __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "rejected-1",
      type: "economy-request",
    });
    expect(source.update).not.toHaveBeenCalled();

    autoApprove = true;
    approval.mockClear();
    await __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "auto-1",
      type: "economy-request",
    });
    expect(approval).not.toHaveBeenCalled();
    expect(source.update).toHaveBeenCalledOnce();
  });

  it("persists replay protection so concurrent retries debit only once", async () => {
    autoApprove = true;
    const message = {
      request: request(),
      requesterUserId: player.id,
      requestId: "same-operation",
      type: "economy-request" as const,
    };
    await Promise.all([__testing.receive(message), __testing.receive(message)]);
    const wallet = (
      source.system.profile as { currencyWallet: D6CurrencyWalletV1 }
    ).currencyWallet;
    expect(wallet.counts).toEqual({ cent: "87", dollar: "3" });
    expect(
      wallet.recentOperationIds.filter((id) => id === "same-operation"),
    ).toHaveLength(1);
    expect(source.update).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("rejects a stale definition fingerprint before asking for approval", async () => {
    await __testing.receive({
      request: { ...request(), definitionFingerprint: "stale" },
      requesterUserId: player.id,
      requestId: "stale-1",
      type: "economy-request",
    });
    expect(approval).not.toHaveBeenCalled();
    expect(source.update).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({
        error: "currency.exchange.stale-definition",
        requestId: "stale-1",
      }),
    );
  });

  it("does not replay a committed exchange when receipt creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(ChatMessage.create).mockRejectedValueOnce(
      new Error("chat locked"),
    );
    await __testing.executeRequest(request(), gm, "receipt-safe");
    await expect(
      __testing.executeRequest(request(), gm, "receipt-safe"),
    ).rejects.toThrow("D6E2.Economy.Error.DuplicateRequest");
    const wallet = (
      source.system.profile as { currencyWallet: D6CurrencyWalletV1 }
    ).currencyWallet;
    expect(wallet.counts).toEqual({ cent: "87", dollar: "3" });
    expect(source.update).toHaveBeenCalledOnce();
  });

  it("rejects a completed exchange replay after more than 64 later operations", async () => {
    source = actor(
      createCurrencyWallet(dollars, { cent: "0", dollar: "1000" }),
    );
    let firstRequest: ReturnType<typeof request> | undefined;
    for (let index = 0; index < 65; index += 1) {
      const next = {
        ...request(),
        expectedTotalSmallestUnit: "100000",
        fromDenominationId: "dollar",
        quantity: "1",
        toDenominationId: "cent",
      };
      firstRequest ??= next;
      await __testing.executeRequest(next, gm, `durable-${index}`);
    }
    __testing.resetQueue();
    await expect(
      __testing.executeRequest(firstRequest ?? request(), gm, "durable-0"),
    ).rejects.toThrow("D6E2.Economy.Error.DuplicateRequest");
  });

  it("invalidates approval after same-total holdings change", async () => {
    const approvedRequest = request();
    approval.mockImplementationOnce(async () => {
      await __testing.executeRequest(
        {
          ...request(),
          fromDenominationId: "dollar",
          quantity: "1",
          toDenominationId: "cent",
        },
        gm,
        "intervening-exchange",
      );
      return true;
    });
    await __testing.receive({
      request: approvedRequest,
      requesterUserId: player.id,
      requestId: "stale-approved",
      type: "economy-request",
    });
    expect(source.update).toHaveBeenCalledTimes(1);
  });

  it("revalidates elected GM authority after the approval wait", async () => {
    approval.mockImplementationOnce(() => {
      const users = game.users;
      if (!users) throw new Error("users required");
      Object.assign(users, {
        contents: [
          gm,
          player,
          { active: true, id: "a-successor", isGM: true, name: "Successor" },
        ],
      });
      return Promise.resolve(true);
    });
    await __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "authority-changed",
      type: "economy-request",
    });
    expect(source.update).not.toHaveBeenCalled();
  });

  it("requires approval when autoapproval is disabled before execution", async () => {
    let autoApprovalReads = 0;
    Object.assign(game.settings, {
      get: (_namespace: string, key: string) =>
        key === SHARED_SETTING_KEYS.characterCurrencyTransactions
          ? true
          : key === SHARED_SETTING_KEYS.currencyExchangeAutoApproval
            ? autoApprovalReads++ === 0
            : false,
    });
    approval.mockResolvedValueOnce(false);
    await __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "policy-changed",
      type: "economy-request",
    });
    expect(approval).toHaveBeenCalledOnce();
    expect(source.update).not.toHaveBeenCalled();
  });

  it("rejects an autoapproved exchange when that policy is revoked while queued", async () => {
    autoApprove = true;
    let releaseReceipt = (): void => undefined;
    const receiptGate = new Promise<void>((resolve) => {
      releaseReceipt = resolve;
    });
    vi.mocked(ChatMessage.create).mockImplementationOnce(
      () => receiptGate as unknown as Promise<FoundryChatMessageDocument>,
    );
    const first = __testing.receive({
      request: request(),
      requesterUserId: player.id,
      requestId: "queue-blocker",
      type: "economy-request",
    });
    await vi.waitFor(() => expect(ChatMessage.create).toHaveBeenCalledOnce());
    const second = __testing.receive({
      request: {
        ...request(),
        fromDenominationId: "dollar",
        quantity: "1",
        toDenominationId: "cent",
      },
      requesterUserId: player.id,
      requestId: "queued-auto",
      type: "economy-request",
    });
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 10));
    autoApprove = false;
    releaseReceipt();
    await Promise.all([first, second]);

    expect(source.update).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({
        error: "D6E2.Economy.Error.GmUnavailable",
        requestId: "queued-auto",
      }),
    );
  });

  it("quarantines an invalid stored multi-unit wallet without reviving its legacy scalar", () => {
    const invalidWallet = {
      ...createCurrencyWallet(dollars, { cent: "25", dollar: "4" }, [
        "already-applied",
      ]),
      totalSmallestUnit: "wrong",
    };
    source = actor(invalidWallet);
    (source.system.profile as { currency: number }).currency = 999;

    const state = actorCurrencyWalletState(source);
    expect(state.invalidStoredWallet).toBe(true);
    expect(state.unresolvedLegacy).toBe(true);
    expect(state.wallet.counts).toEqual({ cent: "0", dollar: "0" });
    expect(state.wallet.recentOperationIds).toContain("already-applied");
    expect(state.wallet.counts.dollar).not.toBe("999");
    expect(previewWalletMigration(source)).toMatchObject({
      exact: false,
      reason: "invalid-stored-wallet",
    });
    expect(actorCurrency(source)).toBe(0);
    expect(source.update).not.toHaveBeenCalled();
  });

  it("shows the exact valid legacy decimal while a wallet awaits resolution", () => {
    source = actor({
      ...createCurrencyWallet(dollars),
      legacyDecimal: "0.25",
      status: "unresolved-legacy",
    });

    expect(actorCurrency(source)).toBe("0.25");
  });

  it("shows stale holdings from their stored definition and uses the active legacy currency name", async () => {
    const legacyDefinition = {
      denominations: [
        {
          displayPrecision: 0,
          id: "currency",
          pluralName: "Currency",
          ratioToParent: "1",
          singularName: "Currency",
          symbol: "",
        },
      ],
      id: "default-currency",
      revision: 1,
      version: 1,
    } satisfies D6CurrencyDefinitionV1;
    source = actor(createCurrencyWallet(legacyDefinition, { currency: "7" }));
    setSettingProfileTerminology({ details: { currency: "Marks" } });

    await __testing.economyDialog({ actor: source, mode: "spend" });

    const renderCall = vi
      .mocked(foundry.applications.handlebars.renderTemplate)
      .mock.calls.at(-1);
    const renderedContext: unknown = renderCall?.[1];
    expect(renderCall?.[0]).toContain("economy-dialog.hbs");
    const context = renderedContext as {
      readonly currencyLabel?: unknown;
      readonly spendHelp?: unknown;
      readonly currencyWallet?: {
        readonly denominations?: readonly unknown[];
        readonly stale?: unknown;
      };
    };
    expect(context.currencyLabel).toBe("Marks");
    expect(context.spendHelp).toBe("D6E2.Economy.SpendSingleUnitHelp");
    expect(context.currencyWallet?.stale).toBe(true);
    expect(context.currencyWallet?.denominations).toEqual([
      { count: "7", id: "currency", isMain: true, label: "Marks" },
    ]);
  });

  it("keeps authored multi-unit denomination labels instead of legacy terminology", async () => {
    setSettingProfileTerminology({ details: { currency: "Credits" } });
    source = actor(
      createCurrencyWallet(
        { ...dollars, id: "default-currency" },
        { cent: "0", dollar: "4" },
      ),
    );

    await __testing.economyDialog({ actor: source, mode: "spend" });

    const context = vi
      .mocked(foundry.applications.handlebars.renderTemplate)
      .mock.calls.at(-1)?.[1] as {
      readonly currencyWallet?: {
        readonly denominations?: readonly { readonly label: string }[];
      };
      readonly spendHelp?: string;
    };
    expect(context.currencyWallet?.denominations).toEqual([
      expect.objectContaining({ label: "$ Dollars" }),
      expect.objectContaining({ label: "¢ Cents" }),
    ]);
    expect(context.spendHelp).toBe("D6E2.Economy.SpendHelp");
  });

  it("uses currency-specific transfer guidance without an equipment Drop action", async () => {
    await __testing.economyDialog({
      actor: source,
      mode: "currency-transfer",
      recipients: [],
    });

    const context = vi
      .mocked(foundry.applications.handlebars.renderTemplate)
      .mock.calls.at(-1)?.[1] as { readonly transferHelp?: string };
    expect(context.transferHelp).toBe("D6E2.Economy.CurrencyTransferHelp");
  });

  it("distinguishes a selected-denomination shortage in a multi-unit wallet", async () => {
    source = actor(createCurrencyWallet(dollars, { cent: "0", dollar: "4" }));

    await expect(
      __testing.executeRequest(
        {
          amount: "25",
          definitionFingerprint: currencyDefinitionFingerprint(dollars),
          denominationId: "cent",
          expectedTotalSmallestUnit: "400",
          note: "",
          sourceActorId: source.id,
          type: "spend",
        },
        gm,
        "insufficient-cents",
      ),
    ).rejects.toThrow("D6E2.Economy.Error.InsufficientDenomination");
    expect(source.update).not.toHaveBeenCalled();
  });

  it("defaults to Spend and rejects a footer action that does not match the selected intent", async () => {
    interface DialogOptions {
      readonly buttons: readonly {
        readonly action: string;
        readonly callback?: (
          event: Event,
          button: FoundryDialogButton,
        ) => unknown;
      }[];
      readonly render?: (
        event: Event,
        dialog: { readonly element: HTMLElement; close(): Promise<void> },
      ) => void;
    }
    let dialogOptions: DialogOptions | undefined;
    approval.mockImplementation((options: unknown) => {
      dialogOptions = options as DialogOptions;
      return Promise.resolve(null);
    });
    await __testing.economyDialog({ actor: source, mode: "spend" });
    expect(dialogOptions).toBeDefined();

    const { document } = parseHTML(`
      <div id="dialog">
        <select name="currencyAction"><option value="spend" selected>Spend</option><option value="exchange">Exchange</option></select>
        <input name="amount" value="250">
        <select name="denominationId"><option value="cent" selected>Cent</option></select>
        <select name="toDenominationId"><option value="dollar" selected>Dollar</option></select>
        <p data-currency-intent-help></p>
        <div data-currency-exchange-panel></div>
        <label data-currency-spend-only></label>
        <button data-action="spend"></button>
        <button data-action="currency-exchange"></button>
      </div>
    `);
    const root = document.querySelector("#dialog") as unknown as HTMLElement;
    dialogOptions?.render?.(new Event("render"), {
      close: () => Promise.resolve(),
      element: root,
    });
    expect(
      root.querySelector<HTMLElement>("[data-currency-exchange-panel]")?.hidden,
    ).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="spend"]')?.hidden,
    ).toBe(false);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="currency-exchange"]')
        ?.disabled,
    ).toBe(true);
    expect(root.querySelector("[data-currency-intent-help]")?.textContent).toBe(
      "D6E2.Economy.SpendHelp",
    );

    const button = (currencyAction: "exchange" | "spend") =>
      ({
        form: {
          elements: {
            namedItem: (name: string) => ({
              value:
                name === "currencyAction"
                  ? currencyAction
                  : name === "denominationId"
                    ? "cent"
                    : name === "toDenominationId"
                      ? "dollar"
                      : name === "amount"
                        ? "250"
                        : "",
            }),
          },
        } as unknown as HTMLFormElement,
      }) satisfies FoundryDialogButton;
    const spend = dialogOptions?.buttons.find(
      ({ action }) => action === "spend",
    );
    const exchange = dialogOptions?.buttons.find(
      ({ action }) => action === "currency-exchange",
    );
    expect(
      spend?.callback?.(new Event("click"), button("exchange")),
    ).toBeNull();
    expect(
      exchange?.callback?.(new Event("click"), button("spend")),
    ).toBeNull();
    expect(
      spend?.callback?.(new Event("click"), button("spend")),
    ).toMatchObject({
      type: "spend",
    });
    expect(
      exchange?.callback?.(new Event("click"), button("exchange")),
    ).toMatchObject({ type: "currency-exchange" });
  });

  it("repositions an expanded Exchange dialog only when it exceeds the viewport", async () => {
    interface DialogOptions {
      readonly render?: (
        event: Event,
        dialog: {
          readonly element: HTMLElement;
          setPosition(position?: Record<string, unknown>): unknown;
        },
      ) => void;
    }
    let dialogOptions: DialogOptions | undefined;
    approval.mockImplementation((options: unknown) => {
      dialogOptions = options as DialogOptions;
      return Promise.resolve(null);
    });
    await __testing.economyDialog({ actor: source, mode: "spend" });

    const { document, window: documentWindow } = parseHTML(`
      <div id="dialog">
        <select name="currencyAction"><option value="spend" selected>Spend</option><option value="exchange">Exchange</option></select>
        <input name="amount" value="250">
        <select name="denominationId"><option value="cent" selected>Cent</option></select>
        <select name="toDenominationId"><option value="dollar" selected>Dollar</option></select>
        <p data-currency-intent-help></p>
        <div data-currency-exchange-panel></div>
        <label data-currency-spend-only></label>
        <button data-action="spend"></button>
        <button data-action="currency-exchange"></button>
      </div>
    `);
    const root = document.querySelector("#dialog") as unknown as HTMLElement;
    const action = root.querySelector<HTMLSelectElement>(
      "[name=currencyAction]",
    );
    if (!action) throw new Error("currency action required");
    Object.defineProperty(root.ownerDocument.documentElement, "clientHeight", {
      configurable: true,
      value: 823,
    });
    Object.assign(root, {
      getBoundingClientRect: () => {
        const height = action.value === "exchange" ? 791 : 529;
        return {
          bottom: 147 + height,
          height,
          left: 582,
          right: 1102,
          top: 147,
          width: 520,
          x: 582,
          y: 147,
          toJSON: () => ({}),
        } satisfies DOMRect;
      },
    });
    const setPosition = vi.fn();
    dialogOptions?.render?.(new Event("render"), {
      element: root,
      setPosition,
    });
    expect(setPosition).not.toHaveBeenCalled();

    Object.defineProperty(action, "value", {
      configurable: true,
      value: "exchange",
    });
    action.dispatchEvent(new documentWindow.Event("change", { bubbles: true }));
    expect(setPosition).toHaveBeenCalledOnce();
    expect(setPosition).toHaveBeenCalledWith({ top: 16 });
  });
});
