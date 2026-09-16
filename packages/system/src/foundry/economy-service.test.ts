/* eslint-disable @typescript-eslint/unbound-method -- Foundry document methods are Vitest mocks asserted without invocation. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __testing,
  canTransferEquipmentItem,
  economyRecipients,
  registerEconomySocket,
  submitEconomyRequest,
} from "./economy-service";
import {
  activeD6PendingInteractions,
  reopenD6PendingInteraction,
} from "../application/pending-interactions";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import {
  createCurrencyWallet,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import { actorCurrencyWalletState } from "./currency-state";

function transactionSettings(options: {
  readonly currency: boolean;
  readonly equipment: boolean;
}): { get(namespace: string, key: string): unknown } {
  return {
    get: (_namespace, key) =>
      key === SHARED_SETTING_KEYS.characterCurrencyTransactions
        ? options.currency
        : key === SHARED_SETTING_KEYS.characterEquipmentTransfers
          ? options.equipment
          : false,
  };
}

function item(
  overrides: Partial<FoundryItemDocument> = {},
): FoundryItemDocument {
  return {
    createEmbeddedDocuments: vi.fn(),
    deleteEmbeddedDocuments: vi.fn(),
    effects: { contents: [], get: vi.fn() },
    id: "gear-1",
    img: "gear.svg",
    name: "Medpack",
    sheet: { render: vi.fn() },
    system: { equipped: true, quantity: 3 },
    toObject: () => ({
      _id: "gear-1",
      name: "Medpack",
      system: { equipped: true, quantity: 3 },
      type: "gear",
    }),
    type: "gear",
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function actor(
  id: string,
  options: {
    readonly currency?: number;
    readonly item?: FoundryItemDocument;
    readonly name?: string;
    readonly owner?: boolean;
    readonly ownerUserIds?: readonly string[];
    readonly type?: string;
  } = {},
): FoundryActorDocument {
  const items = options.item ? [options.item] : [];
  const profile: {
    currency: number;
    currencyWallet?: D6CurrencyWalletV1;
  } = { currency: options.currency ?? 0 };
  const value = {
    createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
    getFlag: vi.fn(),
    id,
    img: "actor.svg",
    isOwner: options.owner ?? true,
    items: {
      contents: items,
      get: (itemId: string) => items.find((entry) => entry.id === itemId),
    },
    name: options.name ?? id,
    sheet: {
      _configureRenderOptions: vi.fn(),
      _onRender: vi.fn(),
      element: {} as HTMLElement,
      isEditable: true,
      render: vi.fn(),
    },
    system: { profile },
    testUserPermission: vi.fn((user: FoundryUser) =>
      options.ownerUserIds
        ? options.ownerUserIds.includes(user.id)
        : (options.owner ?? true),
    ),
    toObject: vi.fn(),
    type: options.type ?? "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      const currency = changes["system.profile.currency"];
      if (typeof currency === "number")
        value.system.profile.currency = currency;
      const wallet = changes["system.profile.currencyWallet"];
      if (wallet)
        value.system.profile.currencyWallet = wallet as D6CurrencyWalletV1;
      return Promise.resolve();
    }),
    updateEmbeddedDocuments: vi.fn(),
  } satisfies FoundryActorDocument;
  return value;
}

describe("rules-neutral character economy", () => {
  const gm = {
    active: true,
    getFlag: vi.fn(),
    id: "gm-1",
    isGM: true,
    name: "GM",
    setFlag: vi.fn(),
  } satisfies FoundryUser;
  const player = {
    active: true,
    getFlag: vi.fn(),
    id: "player-1",
    isGM: false,
    name: "Player",
    setFlag: vi.fn(),
  } satisfies FoundryUser;

  beforeEach(() => {
    vi.restoreAllMocks();
    __testing.resetQueue();
    vi.stubGlobal("canvas", {
      scene: { id: "scene-1" },
      tokens: { placeables: [] },
    });
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: { renderTemplate: vi.fn().mockResolvedValue("audit") },
      },
      utils: { randomID: vi.fn(() => "economy-request") },
    });
    vi.stubGlobal("ChatMessage", {
      create: vi.fn().mockResolvedValue({}),
      getSpeaker: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal("fromUuid", vi.fn().mockResolvedValue(null));
    vi.stubGlobal("window", { setTimeout: vi.fn() });
  });

  it("lists assigned PCs plus only visible scene NPCs when the sender has a scene token", () => {
    const sender = actor("sender", { currency: 10 });
    const ally = actor("ally", { name: "Ally" });
    const npc = actor("npc", { name: "Merchant", type: "creature" });
    const hidden = actor("hidden", { type: "creature" });
    Object.assign(player, { character: sender });
    const allyUser = { ...player, character: ally, id: "player-2" };
    vi.stubGlobal("game", {
      actors: { contents: [sender, ally, npc, hidden], get: vi.fn() },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      user: player,
      users: { contents: [gm, player, allyUser] },
    });
    vi.stubGlobal("canvas", {
      scene: { id: "scene-1" },
      tokens: {
        placeables: [
          { actor: sender, id: "sender-token", visible: true },
          {
            actor: npc,
            id: "npc-token",
            name: "Visible merchant",
            visible: true,
          },
          { actor: hidden, id: "hidden-token", visible: false },
        ],
      },
    });

    expect(economyRecipients(sender)).toEqual([
      expect.objectContaining({ actorId: "ally", kind: "pc" }),
      expect.objectContaining({
        actorId: "npc",
        kind: "scene-npc",
        sourceTokenId: "sender-token",
        targetTokenId: "npc-token",
      }),
    ]);
  });

  it("submits player currency and equipment transfers without Web Crypto randomUUID", async () => {
    const ids = ["currency-request", "equipment-request"];
    const randomID = vi.fn(() => ids.shift() ?? "unexpected-request");
    const emit = vi.fn();
    vi.stubGlobal("crypto", {});
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: { renderTemplate: vi.fn().mockResolvedValue("audit") },
      },
      utils: { randomID },
    });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: true, equipment: true }),
      socket: { emit },
      user: player,
      users: { contents: [gm, player] },
    });

    const currencyCompletion = submitEconomyRequest({
      amount: 2,
      recipient: { actorId: "npc", kind: "scene-npc", label: "Merchant" },
      sourceActorId: "sender",
      type: "currency-transfer",
    });
    expect(emit).toHaveBeenLastCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({
        requestId: "currency-request",
        requesterUserId: player.id,
        type: "economy-request",
      }),
    );
    await __testing.receive({
      requestId: "currency-request",
      requesterUserId: player.id,
      type: "economy-response",
    });
    await currencyCompletion;

    const equipmentCompletion = submitEconomyRequest({
      itemId: "gear-1",
      quantity: 1,
      recipient: { actorId: "npc", kind: "scene-npc", label: "Merchant" },
      sourceActorId: "sender",
      type: "item-transfer",
    });
    expect(emit).toHaveBeenLastCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({
        requestId: "equipment-request",
        requesterUserId: player.id,
        type: "economy-request",
      }),
    );
    await __testing.receive({
      requestId: "equipment-request",
      requesterUserId: player.id,
      type: "economy-response",
    });
    await equipmentCompletion;

    expect(randomID).toHaveBeenNthCalledWith(1, 24);
    expect(randomID).toHaveBeenNthCalledWith(2, 24);
  });

  it("spends currency authoritatively and whispers a receipt to the initiator and GMs", async () => {
    const sender = actor("sender", { currency: 12 });
    vi.stubGlobal("game", {
      actors: { contents: [sender], get: () => sender },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      users: { contents: [gm, player] },
    });

    await __testing.executeRequest(
      { amount: 5, note: "Supplies", sourceActorId: sender.id, type: "spend" },
      player,
    );

    expect(sender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.profile.currency": 7,
      }),
    );
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "audit",
        whisper: ["player-1", "gm-1"],
      }),
    );
  });

  it("limits transfer receipts to the initiator, target owners, and every GM", () => {
    const target = actor("ally", {
      ownerUserIds: ["player-2", "co-owner"],
    });
    const secondGm = { ...gm, id: "gm-2", name: "Second GM" };
    const targetOwner = { ...player, id: "player-2", name: "Recipient" };
    const coOwner = { ...player, id: "co-owner", name: "Co-owner" };
    const unrelated = { ...player, id: "uninvolved", name: "Uninvolved" };
    vi.stubGlobal("game", {
      users: {
        contents: [gm, player, targetOwner, unrelated, coOwner, secondGm],
      },
    });

    const recipients = __testing.economyAuditRecipients(player, target);
    expect(recipients).toEqual([
      "player-1",
      "player-2",
      "co-owner",
      "gm-1",
      "gm-2",
    ]);
    expect(Object.isFrozen(recipients)).toBe(false);
  });

  it("waits for the receiving PC owner to accept before committing currency", async () => {
    const sender = actor("sender", { currency: 9, name: "Rook" });
    const ally = actor("ally", {
      currency: 2,
      name: "Vale",
      ownerUserIds: ["player-2"],
    });
    const targetOwner = {
      ...player,
      character: ally,
      id: "player-2",
      name: "Recipient",
    };
    const emit = vi.fn();
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: true, equipment: true }),
      socket: { emit },
      user: gm,
      users: {
        contents: [gm, player, targetOwner],
        get: (id: string) =>
          [gm, player, targetOwner].find((user) => user.id === id),
      },
    });

    const completion = submitEconomyRequest({
      amount: 4,
      recipient: { actorId: ally.id, kind: "pc", label: ally.name },
      sourceActorId: sender.id,
      type: "currency-transfer",
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    const approval = emit.mock.calls[0]?.[1] as {
      readonly requestId: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: string;
    };
    expect(approval).toMatchObject({
      requesterUserId: gm.id,
      targetUserId: targetOwner.id,
      type: "economy-approval-request",
      version: 1,
    });
    expect(sender.update).not.toHaveBeenCalled();
    expect(ally.update).not.toHaveBeenCalled();

    await __testing.receive({
      accepted: true,
      requestId: approval.requestId,
      requesterUserId: gm.id,
      targetUserId: targetOwner.id,
      type: "economy-approval-response",
    });
    await completion;

    expect(sender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.profile.currency": 5,
      }),
    );
    expect(ally.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.profile.currency": 6,
      }),
    );
  });

  it("leaves both characters unchanged when the receiving owner declines", async () => {
    const sender = actor("sender", { currency: 9 });
    const ally = actor("ally", {
      currency: 2,
      ownerUserIds: ["player-2"],
    });
    const targetOwner = {
      ...player,
      character: ally,
      id: "player-2",
      name: "Recipient",
    };
    const emit = vi.fn();
    vi.stubGlobal("game", {
      actors: { get: (id: string) => (id === sender.id ? sender : ally) },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: true, equipment: true }),
      socket: { emit },
      user: gm,
      users: { contents: [gm, targetOwner] },
    });

    const completion = submitEconomyRequest({
      amount: 4,
      recipient: { actorId: ally.id, kind: "pc", label: ally.name },
      sourceActorId: sender.id,
      type: "currency-transfer",
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    const approval = emit.mock.calls[0]?.[1] as {
      readonly requestId: string;
    };
    await __testing.receive({
      accepted: false,
      requestId: approval.requestId,
      requesterUserId: gm.id,
      targetUserId: targetOwner.id,
      type: "economy-approval-response",
    });

    await expect(completion).rejects.toThrow(
      "D6E2.Economy.Error.RecipientDeclined",
    );
    expect(sender.update).not.toHaveBeenCalled();
    expect(ally.update).not.toHaveBeenCalled();
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  it("shows the receiving owner who is sending what before replying", async () => {
    const sender = actor("sender", { currency: 9, name: "Rook" });
    const ally = actor("ally", {
      currency: 2,
      name: "Vale",
      ownerUserIds: ["player-2"],
    });
    const targetOwner = {
      ...player,
      character: ally,
      id: "player-2",
      name: "Recipient",
    };
    const emit = vi.fn();
    const wait = vi.fn().mockResolvedValue(true);
    const renderTemplate = vi.fn().mockResolvedValue("approval");
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { wait } },
        handlebars: { renderTemplate },
      },
    });
    vi.stubGlobal("game", {
      actors: { get: (id: string) => (id === sender.id ? sender : ally) },
      i18n: { localize: (key: string) => key },
      settings: {
        get: (_namespace: string, key: string) =>
          key === SHARED_SETTING_KEYS.autoOpenPendingPrompts
            ? true
            : key === "pendingInteractionDeliveryLedger"
              ? "[]"
              : true,
        set: vi.fn().mockResolvedValue(undefined),
      },
      socket: { emit },
      user: targetOwner,
      users: { contents: [gm, targetOwner] },
    });

    await __testing.receive({
      amount: 4,
      approvalType: "currency-transfer",
      assetLabel: "D6E2.Economy.DefaultCurrency",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      gmUserId: gm.id,
      requestId: "approval-1",
      requesterName: "Sending Player",
      requesterUserId: player.id,
      sourceActorId: sender.id,
      sourceName: sender.name,
      targetActorId: ally.id,
      targetName: ally.name,
      targetUserId: targetOwner.id,
      type: "economy-approval-request",
      version: 1,
    });

    expect(renderTemplate).toHaveBeenCalledWith(
      "systems/d6-system-2e/templates/actor/character/economy-approval-dialog.hbs",
      expect.objectContaining({
        amount: 4,
        denominationLabel: "D6E2.Economy.DefaultCurrency",
        requesterName: "Sending Player",
        sourceName: "Rook",
        targetName: "Vale",
      }),
    );
    expect(wait).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { width: 520 },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asymmetric matcher deliberately inspects the nested ApplicationV2 window options.
        window: expect.objectContaining({
          title: "D6E2.Economy.ApprovalTitle",
        }),
      }),
    );
    expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
      accepted: true,
      requestId: "approval-1",
      requesterUserId: player.id,
      targetUserId: targetOwner.id,
      type: "economy-approval-response",
    });
  });

  it("also waits for recipient acceptance before copying equipment", async () => {
    const medpack = item();
    const sender = actor("sender", { item: medpack, name: "Rook" });
    const ally = actor("ally", {
      name: "Vale",
      ownerUserIds: ["player-2"],
    });
    const targetOwner = {
      ...player,
      character: ally,
      id: "player-2",
      name: "Recipient",
    };
    const emit = vi.fn();
    vi.stubGlobal("game", {
      actors: { get: (id: string) => (id === sender.id ? sender : ally) },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: true, equipment: true }),
      socket: { emit },
      user: gm,
      users: { contents: [gm, targetOwner] },
    });

    const completion = submitEconomyRequest({
      itemId: medpack.id,
      quantity: 2,
      recipient: { actorId: ally.id, kind: "pc", label: ally.name },
      sourceActorId: sender.id,
      type: "item-transfer",
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    expect(ally.createEmbeddedDocuments).not.toHaveBeenCalled();
    const approval = emit.mock.calls[0]?.[1] as {
      readonly requestId: string;
    };
    await __testing.receive({
      accepted: true,
      requestId: approval.requestId,
      requesterUserId: gm.id,
      targetUserId: targetOwner.id,
      type: "economy-approval-response",
    });
    await completion;

    expect(ally.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asymmetric matcher deliberately inspects nested Item source data.
        system: expect.objectContaining({ equipped: false, quantity: 2 }),
      }),
    ]);
    expect(medpack.update).toHaveBeenCalledWith({ "system.quantity": 1 });
  });

  it("lets a GM spend from an unowned character", async () => {
    const sender = actor("unowned-sender", { currency: 8, owner: false });
    vi.stubGlobal("game", {
      actors: { contents: [sender], get: () => sender },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: true, equipment: false }),
      users: { contents: [gm, player] },
    });

    await __testing.executeRequest(
      {
        amount: 3,
        note: "GM adjustment",
        sourceActorId: sender.id,
        type: "spend",
      },
      gm,
    );

    expect(sender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.profile.currency": 5,
      }),
    );
  });

  it("enforces currency and equipment capabilities independently", async () => {
    const medpack = item();
    const sender = actor("sender", { currency: 8, item: medpack });
    const ally = actor("ally");
    const requestContext = {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      users: { contents: [gm, player] },
    };
    vi.stubGlobal("game", {
      ...requestContext,
      settings: transactionSettings({ currency: false, equipment: true }),
    });
    await expect(
      __testing.executeRequest(
        { amount: 1, note: "", sourceActorId: sender.id, type: "spend" },
        gm,
      ),
    ).rejects.toThrow("D6E2.Economy.Error.CurrencyDisabled");

    vi.stubGlobal("game", {
      ...requestContext,
      settings: transactionSettings({ currency: true, equipment: false }),
    });
    await expect(
      __testing.executeRequest(
        {
          itemId: medpack.id,
          quantity: 1,
          recipient: { actorId: ally.id, kind: "pc", label: ally.name },
          sourceActorId: sender.id,
          type: "item-transfer",
        },
        gm,
      ),
    ).rejects.toThrow("D6E2.Economy.Error.EquipmentDisabled");
  });

  it("recovers an interrupted currency transfer without a second debit", async () => {
    const onSocket = vi.fn();
    const onHook = vi.fn();
    vi.stubGlobal("Hooks", { on: onHook });
    const sender = actor("sender", { currency: 9 });
    const ally = actor("ally", {
      currency: 2,
      ownerUserIds: ["player-2"],
    });
    vi.mocked(ally.update).mockRejectedValueOnce(new Error("locked"));
    Object.assign(player, { character: sender });
    const allyUser = { ...player, character: ally, id: "player-2" };
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      socket: { on: onSocket },
      user: gm,
      users: {
        contents: [gm, player, allyUser],
        get: (id: string) =>
          [gm, player, allyUser].find((entry) => entry.id === id),
      },
    });

    await expect(
      __testing.executeRequest(
        {
          amount: 4,
          recipient: { actorId: ally.id, kind: "pc", label: ally.name },
          sourceActorId: sender.id,
          type: "currency-transfer",
        },
        player,
      ),
    ).rejects.toThrow("locked");
    expect(sender.system.profile).toMatchObject({
      currency: 5,
      currencyWallet: {
        operationReceipts: {
          "economy-request": { status: "pending-transfer" },
        },
      },
    });
    expect(ChatMessage.create).not.toHaveBeenCalled();

    await expect(
      __testing.executeRequest(
        {
          amount: 3,
          recipient: { actorId: ally.id, kind: "pc", label: ally.name },
          sourceActorId: sender.id,
          type: "currency-transfer",
        },
        player,
        "economy-request",
      ),
    ).rejects.toThrow("D6E2.Economy.Error.DuplicateRequest");

    registerEconomySocket();
    expect(onSocket).toHaveBeenCalledOnce();
    expect(onHook).toHaveBeenCalledTimes(7);
    const [recovery] = activeD6PendingInteractions(gm.id);
    expect(recovery).toMatchObject({
      actorId: sender.id,
      controllerUserId: gm.id,
      kind: "economy-approval",
      reopenable: true,
      subjectLabel: "sender → ally",
    });
    expect(recovery?.label).toContain("4");
    expect(recovery?.label).toContain("Currency");
    expect(recovery?.label).toContain("ally");
    await reopenD6PendingInteraction(recovery?.id ?? "");
    expect(sender.system.profile).toMatchObject({
      currency: 5,
      currencyWallet: {
        operationReceipts: {
          "economy-request": { status: "complete" },
        },
      },
    });
    expect(
      (ally.system.profile as { readonly currency: number }).currency,
    ).toBe(6);
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ whisper: ["player-1", "player-2", "gm-1"] }),
    );
    expect(activeD6PendingInteractions(gm.id)).toHaveLength(0);
  });

  it("resumes the exact same socket transfer without repeating recipient consent", async () => {
    const sender = actor("sender", { currency: 9 });
    const ally = actor("ally", {
      currency: 2,
      ownerUserIds: ["player-2"],
    });
    vi.mocked(ally.update).mockRejectedValueOnce(new Error("locked"));
    Object.assign(player, { character: sender });
    const allyUser = { ...player, character: ally, id: "player-2" };
    const emit = vi.fn();
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      socket: { emit },
      user: gm,
      users: {
        contents: [gm, player, allyUser],
        get: (id: string) =>
          [gm, player, allyUser].find((entry) => entry.id === id),
      },
    });
    vi.stubGlobal("window", {
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    });
    const request = {
      amount: 4,
      expectedTotalSmallestUnit: "9",
      recipient: { actorId: ally.id, kind: "pc" as const, label: ally.name },
      sourceActorId: sender.id,
      type: "currency-transfer" as const,
    };

    await expect(
      __testing.executeRequest(request, player, "same-socket-transfer"),
    ).rejects.toThrow("locked");
    await __testing.receive({
      request,
      requesterUserId: player.id,
      requestId: "same-socket-transfer",
      type: "economy-request",
    });

    expect((sender.system.profile as { currency: number }).currency).toBe(5);
    expect((ally.system.profile as { currency: number }).currency).toBe(6);
    expect(emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({
        requestId: "same-socket-transfer",
        type: "economy-response",
      }),
    );
    expect(emit.mock.calls.at(-1)?.[1]).not.toHaveProperty("error");
  });

  it("rejects an incompatible target wallet before debiting the source", async () => {
    const sender = actor("sender", { currency: 9 });
    const ally = actor("ally", { currency: 2 });
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      users: { contents: [gm, player] },
    });
    const validTargetWallet = actorCurrencyWalletState(ally).wallet;
    (
      ally.system.profile as { currencyWallet?: D6CurrencyWalletV1 }
    ).currencyWallet = {
      ...validTargetWallet,
      totalSmallestUnit: "invalid",
    };

    await expect(
      __testing.executeRequest(
        {
          amount: 4,
          recipient: { actorId: ally.id, kind: "pc", label: ally.name },
          sourceActorId: sender.id,
          type: "currency-transfer",
        },
        gm,
        "invalid-target",
      ),
    ).rejects.toThrow("D6E2.Economy.Error.IncompatibleWallet");
    expect(sender.update).not.toHaveBeenCalled();
    expect((sender.system.profile as { currency: number }).currency).toBe(9);
  });

  it("preserves a concurrent GM source edit while finalizing a transfer", async () => {
    const sender = actor("sender", { currency: 9 });
    const ally = actor("ally", { currency: 2 });
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      users: { contents: [gm, player] },
    });
    vi.mocked(ally.update).mockImplementationOnce(
      (changes: Record<string, unknown>) => {
        const allyProfile = ally.system.profile as {
          currency: number;
          currencyWallet?: D6CurrencyWalletV1;
        };
        const senderProfile = sender.system.profile as {
          currency: number;
          currencyWallet?: D6CurrencyWalletV1;
        };
        const targetWallet = changes[
          "system.profile.currencyWallet"
        ] as D6CurrencyWalletV1;
        allyProfile.currencyWallet = targetWallet;
        allyProfile.currency = 6;
        const sourceState = actorCurrencyWalletState(sender);
        const main = sourceState.wallet.definition.denominations[0];
        if (!main) throw new Error("main denomination required");
        senderProfile.currencyWallet = createCurrencyWallet(
          sourceState.wallet.definition,
          { ...sourceState.wallet.counts, [main.id]: "8" },
          sourceState.wallet.recentOperationIds,
          sourceState.wallet.operationReceipts,
        );
        senderProfile.currency = 8;
        return Promise.resolve();
      },
    );

    await __testing.executeRequest(
      {
        amount: 4,
        recipient: { actorId: ally.id, kind: "pc", label: ally.name },
        sourceActorId: sender.id,
        type: "currency-transfer",
      },
      gm,
      "concurrent-source-edit",
    );

    const senderProfile = sender.system.profile as {
      currency: number;
      currencyWallet?: D6CurrencyWalletV1;
    };
    expect(senderProfile.currency).toBe(8);
    expect(
      senderProfile.currencyWallet?.operationReceipts["concurrent-source-edit"]
        ?.status,
    ).toBe("complete");
    expect((ally.system.profile as { currency: number }).currency).toBe(6);
  });

  it("transfers a requested equipment quantity unequipped and keeps the remainder", async () => {
    const medpack = item();
    const sender = actor("sender", { item: medpack });
    const ally = actor("ally", { ownerUserIds: ["player-2"] });
    const created = item({
      id: "created-1",
      system: { equipped: false, quantity: 2 },
    });
    vi.mocked(ally.createEmbeddedDocuments).mockResolvedValueOnce([created]);
    Object.assign(player, { character: sender });
    const allyUser = { ...player, character: ally, id: "player-2" };
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      users: { contents: [gm, player, allyUser] },
    });

    await __testing.executeRequest(
      {
        itemId: medpack.id,
        quantity: 2,
        recipient: { actorId: ally.id, kind: "pc", label: ally.name },
        sourceActorId: sender.id,
        type: "item-transfer",
      },
      player,
    );

    expect(ally.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asymmetric matcher deliberately inspects nested Item source data.
        system: expect.objectContaining({ equipped: false, quantity: 2 }),
      }),
    ]);
    expect(medpack.update).toHaveBeenCalledWith({ "system.quantity": 1 });
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        whisper: ["player-1", "player-2", "gm-1"],
      }),
    );
  });

  it("rejects participating storage Items before the legacy economy transfer writes", async () => {
    const medpack = item({
      system: { equipped: false, quantity: 3, storageInstanceId: "stored" },
    });
    const sender = actor("sender", { item: medpack });
    const ally = actor("ally", { ownerUserIds: ["player-2"] });
    Object.assign(player, { character: sender });
    const allyUser = { ...player, character: ally, id: "player-2" };
    vi.stubGlobal("game", {
      actors: {
        contents: [sender, ally],
        get: (id: string) => (id === sender.id ? sender : ally),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true },
      users: { contents: [gm, player, allyUser] },
    });

    await expect(
      __testing.executeRequest(
        {
          itemId: medpack.id,
          quantity: 2,
          recipient: { actorId: ally.id, kind: "pc", label: ally.name },
          sourceActorId: sender.id,
          type: "item-transfer",
        },
        player,
      ),
    ).rejects.toThrow("D6E2.Storage.Error.AuthorityRequired");
    expect(ally.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(medpack.update).not.toHaveBeenCalled();
  });

  it("lets an owner drop part of an equipment stack through the audited GM boundary", async () => {
    const medpack = item();
    const sender = actor("sender", { item: medpack });
    vi.stubGlobal("game", {
      actors: { contents: [sender], get: () => sender },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: false, equipment: true }),
      users: { contents: [gm, player] },
    });

    await __testing.executeRequest(
      {
        itemId: medpack.id,
        quantity: 2,
        sourceActorId: sender.id,
        type: "item-drop",
      },
      player,
    );

    expect(medpack.update).toHaveBeenCalledWith({ "system.quantity": 1 });
    expect(sender.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ whisper: ["player-1", "gm-1"] }),
    );
  });

  it("deletes the embedded Item when its full quantity is dropped", async () => {
    const medpack = item({ system: { equipped: false, quantity: 2 } });
    const sender = actor("sender", { item: medpack });
    vi.stubGlobal("game", {
      actors: { contents: [sender], get: () => sender },
      i18n: { localize: (key: string) => key },
      settings: transactionSettings({ currency: false, equipment: true }),
      users: { contents: [gm, player] },
    });

    await __testing.executeRequest(
      {
        itemId: medpack.id,
        quantity: 2,
        sourceActorId: sender.id,
        type: "item-drop",
      },
      player,
    );

    expect(sender.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", [
      medpack.id,
    ]);
    expect(medpack.update).not.toHaveBeenCalled();
  });

  it("rejects installed cybernetics from equipment transfers", () => {
    expect(
      canTransferEquipmentItem(
        item({ type: "cybernetic", system: { installed: true, quantity: 1 } }),
      ),
    ).toBe(false);
  });
});
