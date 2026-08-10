/* eslint-disable @typescript-eslint/unbound-method -- Foundry document methods are Vitest mocks asserted without invocation. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __testing,
  canTransferEquipmentItem,
  economyRecipients,
} from "./economy-service";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";

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
    system: { profile: { currency: options.currency ?? 0 } },
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
    });
    vi.stubGlobal("ChatMessage", {
      create: vi.fn().mockResolvedValue({}),
      getSpeaker: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal("fromUuid", vi.fn().mockResolvedValue(null));
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

    expect(sender.update).toHaveBeenCalledWith({
      "system.profile.currency": 7,
    });
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

    expect(sender.update).toHaveBeenCalledWith({
      "system.profile.currency": 5,
    });
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

  it("rolls the sender balance back if the recipient update fails", async () => {
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
      users: { contents: [gm, player, allyUser] },
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
    expect(sender.update).toHaveBeenLastCalledWith({
      "system.profile.currency": 9,
    });
    expect(ChatMessage.create).not.toHaveBeenCalled();
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
