/* Foundry document fixtures intentionally expose mocked instance methods and
 * partial runtime shapes; assertions inspect those spies directly. */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCurrencyWallet,
  currencyWalletFingerprint,
  type D6CurrencyDefinitionV1,
  type D6StorageLedgerV1,
} from "@d6-system-2e/core";

const dollars: D6CurrencyDefinitionV1 = {
  denominations: [
    {
      displayPrecision: 0,
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
  id: "dollars",
  revision: 1,
  version: 1,
};

let ledger: D6StorageLedgerV1;
const readLedger = vi.hoisted(() => vi.fn<() => Promise<D6StorageLedgerV1>>());
const recoveryStore = vi.hoisted(
  () => new Map<string, Record<string, unknown>>(),
);
const recoveryRecorded = vi.hoisted(() => vi.fn());
vi.mock("../settings/setting-profile", () => ({
  currentSettingProfile: () => ({ currency: dollars }),
}));
vi.mock("./grid-storage-state", () => ({
  readCurrencyHolderTransferRecoveries: () =>
    Promise.resolve(Object.fromEntries(recoveryStore)),
  readGridStorageLedger: () => readLedger(),
  recordCurrencyHolderTransferRecovery: (recovery: { operationId: string }) => {
    recoveryStore.set(recovery.operationId, structuredClone(recovery));
    recoveryRecorded(recovery);
    return Promise.resolve();
  },
  removeCurrencyHolderTransferRecovery: (
    operationId: string,
    intent: string,
  ) => {
    if (recoveryStore.get(operationId)?.intent === intent)
      recoveryStore.delete(operationId);
    return Promise.resolve();
  },
  runGridStorageAuthorityEffect: <T>(effect: () => Promise<T>) => effect(),
}));
const synchronize = vi.fn((document: unknown) => {
  void document;
  return Promise.resolve();
});
vi.mock("./grid-storage-mutation-guard", () => ({
  GRID_STORAGE_AUTHORITY_WRITE_OPTION: "d6GridStorageAuthorityWrite",
  synchronizeGridStorageItemWitness: (document: unknown) =>
    synchronize(document),
}));

function applyWallet(
  document: { system: Record<string, unknown> },
  changes: Record<string, unknown>,
): void {
  if (changes["system.currencyWallet"])
    document.system.currencyWallet = changes["system.currencyWallet"];
  if (changes["system.profile.currencyWallet"])
    (document.system.profile as Record<string, unknown>).currencyWallet =
      changes["system.profile.currencyWallet"];
}

function fixture() {
  const owner = {
    active: true,
    id: "owner",
    isGM: false,
    name: "Owner",
  } as FoundryUser;
  const gm = {
    active: true,
    id: "gm",
    isGM: true,
    name: "GM",
  } as FoundryUser;
  const character = {
    id: "character",
    items: { contents: [], get: () => undefined },
    name: "Mira",
    system: {
      profile: {
        currency: 3,
        currencyWallet: createCurrencyWallet(dollars, {
          cent: "75",
          dollar: "3",
        }),
      },
      storage: { configured: true },
    },
    testUserPermission: (user: FoundryUser) => user.id === owner.id,
    type: "character",
    update: vi.fn(function (
      this: { system: Record<string, unknown> },
      changes,
    ) {
      applyWallet(this, changes);
      return Promise.resolve();
    }),
    uuid: "Actor.character",
  } as unknown as FoundryActorDocument & { readonly uuid: string };
  const pouch = {
    id: "pouch-document",
    name: "Coin pouch",
    parent: character,
    system: {
      currencyWallet: createCurrencyWallet(dollars, {
        cent: "5",
        dollar: "1",
      }),
      quantity: 1,
      storageInstanceId: "pouch-a",
      storageInterior: { configured: true },
    },
    toObject(this: { id: string; system: Record<string, unknown> }) {
      return {
        _id: this.id,
        system: structuredClone(this.system),
        type: "gear",
      };
    },
    type: "gear",
    update: vi.fn(function (
      this: { system: Record<string, unknown> },
      changes,
    ) {
      applyWallet(this, changes);
      return Promise.resolve();
    }),
    uuid: "Actor.character.Item.pouch-document",
  } as unknown as FoundryItemDocument;
  (character.items.contents as FoundryItemDocument[]).push(pouch);
  ledger = {
    version: 1,
    revision: 4,
    roots: {
      [character.uuid]: {
        version: 1,
        rootUuid: character.uuid,
        kind: "character",
        publicSummary: "none",
        revision: 1,
        spaces: {},
      },
    },
    objects: {
      "pouch-a": {
        version: 1,
        definition: {
          version: 1,
          instanceId: "pouch-a",
          physical: {
            version: 1,
            provenance: "unknown",
            presetId: null,
            widthMm: null,
            depthMm: null,
            heightMm: null,
            unitTareWeightGrams: null,
            unitExteriorVolumeMillilitres: null,
            rotatable: true,
            footprintsByScale: {},
            stack: { mode: "single", maxQuantityPerPlacement: 1 },
          },
          interior: {
            id: "container:pouch-a",
            label: "Pouch",
            kind: "container",
            ownerActorUuid: character.uuid,
            configuration: "capacity-only",
            access: "open",
            limits: {
              maxAggregateWeightGrams: null,
              maxOccupiedVolumeMillilitres: null,
              maxDirectChildren: null,
            },
            grid: null,
          },
        },
        documentUuid: pouch.uuid!,
        ownerActorUuid: character.uuid,
        quantity: 1,
        witness: "witness",
        location: {
          state: "unplaced",
          rootUuid: character.uuid,
          disposition: "carried",
        },
      },
    },
  };
  readLedger.mockImplementation(() => Promise.resolve(ledger));
  const documents = new Map<string, unknown>([
    [character.uuid, character],
    [pouch.uuid!, pouch],
  ]);
  vi.stubGlobal("fromUuid", (uuid: string) =>
    Promise.resolve(documents.get(uuid)),
  );
  vi.stubGlobal("game", {
    actors: {
      contents: [character],
      get: (id: string) => (id === character.id ? character : undefined),
    },
    user: gm,
    users: {
      contents: [gm, owner],
      get: (id: string) =>
        id === gm.id ? gm : id === owner.id ? owner : undefined,
    },
    i18n: { localize: (key: string) => key },
  });
  return { character, documents, gm, owner, pouch };
}

beforeEach(() => {
  vi.clearAllMocks();
  recoveryStore.clear();
  recoveryRecorded.mockReset();
  readLedger.mockReset();
  vi.unstubAllGlobals();
});

describe("storage currency holder authority", () => {
  it("aliases the character wallet and exposes configured container destinations", async () => {
    const { character } = fixture();
    const { storageCurrencyFundsContext } =
      await import("./currency-holder-service");
    const context = await storageCurrencyFundsContext(
      character,
      {
        workspace: { canEdit: true } as never,
        objects: ledger.objects,
        destinations: [],
        latestUndo: null,
      },
      null,
    );
    expect(context.funds).toMatchObject({
      aliasedCharacterWallet: true,
      denominations: [
        expect.objectContaining({ label: "Dollars", symbol: "$" }),
        expect.objectContaining({ label: "Cents", symbol: "¢" }),
      ],
      holderId: "root:Actor.character",
      holderLabel: "Mira",
      totalSmallestUnit: "375",
      walletFingerprint: expect.any(String),
    });
    expect(context.fundDestinations).toEqual([
      expect.objectContaining({
        holderId: "container:pouch-a",
        label: "Coin pouch",
      }),
    ]);
  });

  it("offers reachable holders from other controlled storage roots", async () => {
    const { character, documents } = fixture();
    const wagon = {
      id: "wagon",
      items: { contents: [] },
      name: "Wagon",
      system: {
        currencyWallet: createCurrencyWallet(dollars),
        storage: { configured: true },
      },
      testUserPermission: () => true,
      type: "vehicle",
      update: vi.fn(() => Promise.resolve()),
      uuid: "Actor.wagon",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    documents.set(wagon.uuid, wagon);
    (game.actors?.contents as FoundryActorDocument[]).push(wagon);
    ledger = {
      ...ledger,
      roots: {
        ...ledger.roots,
        [wagon.uuid]: {
          version: 1,
          rootUuid: wagon.uuid,
          kind: "vehicle",
          publicSummary: "none",
          revision: 1,
          spaces: {},
        },
      },
    };
    const { storageCurrencyFundsContext } =
      await import("./currency-holder-service");
    const context = await storageCurrencyFundsContext(
      character,
      {
        workspace: { canEdit: true } as never,
        objects: ledger.objects,
        destinations: [
          {
            label: "Wagon · Cargo",
            parent: {
              rootUuid: wagon.uuid,
              spaceId: "cargo",
              containerInstanceId: null,
              spaceOwnerActorUuid: wagon.uuid,
            },
            space: {} as never,
          },
        ],
        latestUndo: null,
      },
      null,
    );
    expect(context.fundDestinations).toContainEqual(
      expect.objectContaining({
        holderId: "root:Actor.wagon",
        label: "D6E2.Storage.Funds",
        rootLabel: "Wagon",
      }),
    );
  });

  it("offers another player's configured root without reading its wallet", async () => {
    const { character, documents, owner } = fixture();
    const recipientOwner = {
      active: true,
      id: "recipient-owner",
      isGM: false,
      name: "Recipient",
    } as FoundryUser;
    const recipient = {
      id: "recipient",
      items: { contents: [] },
      name: "Vale",
      system: {
        currencyWallet: createCurrencyWallet(dollars, { dollar: "99" }),
        profile: {
          currency: 99,
          currencyWallet: createCurrencyWallet(dollars, { dollar: "99" }),
        },
        storage: { configured: true },
      },
      testUserPermission: (user: FoundryUser) => user.id === recipientOwner.id,
      type: "character",
      update: vi.fn(() => Promise.resolve()),
      uuid: "Actor.recipient",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    Object.assign(recipientOwner, { character: recipient });
    documents.set(recipient.uuid, recipient);
    (game.actors?.contents as FoundryActorDocument[]).push(recipient);
    Object.assign(game.actors ?? {}, {
      get: (id: string) =>
        id === character.id
          ? character
          : id === recipient.id
            ? recipient
            : undefined,
    });
    (game.users?.contents as FoundryUser[]).push(recipientOwner);
    Object.assign(game.users ?? {}, {
      get: (id: string) =>
        id === owner.id
          ? owner
          : id === recipientOwner.id
            ? recipientOwner
            : undefined,
    });
    Object.assign(game, { user: owner });
    const { storageCurrencyFundsContext } =
      await import("./currency-holder-service");

    const context = await storageCurrencyFundsContext(
      character,
      {
        workspace: { canEdit: true } as never,
        objects: ledger.objects,
        destinations: [],
        latestUndo: null,
      },
      null,
    );
    expect(context.fundDestinations).toContainEqual(
      expect.objectContaining({
        holderId: "root:Actor.recipient",
        label: "D6E2.Storage.Funds",
        ownerActorId: "recipient",
        requiresConsent: true,
        rootLabel: "Vale",
      }),
    );
    expect(readLedger).not.toHaveBeenCalled();
    expect(recipient.update).not.toHaveBeenCalled();
  });

  it("conserves denomination value and makes a same-intent retry a no-op", async () => {
    const { character, gm, pouch } = fixture();
    const {
      executeCurrencyHolderTransfer,
      holderTransferRequest,
      resolveCurrencyHolder,
      rootCurrencyHolderRef,
      containerCurrencyHolderRef,
    } = await import("./currency-holder-service");
    const source = await resolveCurrencyHolder(
      rootCurrencyHolderRef(character),
    );
    const target = await resolveCurrencyHolder(
      containerCurrencyHolderRef("pouch-a"),
    );
    const request = holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    await executeCurrencyHolderTransfer(
      request,
      gm,
      "holder-transfer-1",
      false,
    );
    await executeCurrencyHolderTransfer(
      request,
      gm,
      "holder-transfer-1",
      false,
    );
    expect(
      (character.system.profile as { currencyWallet: { counts: object } })
        .currencyWallet.counts,
    ).toEqual({ cent: "50", dollar: "3" });
    expect((pouch.system.currencyWallet as { counts: object }).counts).toEqual({
      cent: "30",
      dollar: "1",
    });
    const sourceReceipt = (
      character.system.profile as {
        currencyWallet: {
          operationReceipts: Record<string, Record<string, unknown>>;
        };
      }
    ).currencyWallet.operationReceipts["holder-transfer-1"];
    const targetReceipt = (
      pouch.system.currencyWallet as {
        operationReceipts: Record<string, Record<string, unknown>>;
      }
    ).operationReceipts["holder-transfer-1"];
    expect(sourceReceipt?.intent).toMatch(/^[a-f0-9]{64}$/u);
    expect(targetReceipt?.intent).toBe(sourceReceipt?.intent);
    expect(sourceReceipt).not.toHaveProperty("recoveryRequest");
    expect(targetReceipt).not.toHaveProperty("recoveryRequest");
    expect(recoveryStore.has("holder-transfer-1")).toBe(false);
    expect(character.update).toHaveBeenCalledTimes(2);
    expect(pouch.update).toHaveBeenCalledTimes(2);
  });

  it("resumes after target failure without debiting twice", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(pouch.update)
      .mockImplementationOnce(async (changes) => applyWallet(pouch, changes))
      .mockRejectedValueOnce(new Error("interrupted"));
    await expect(
      service.executeCurrencyHolderTransfer(request, gm, "resume-1", false),
    ).rejects.toThrow("interrupted");
    expect(recoveryStore.get("resume-1")).toMatchObject({
      request,
      requesterUserId: gm.id,
    });
    const pendingSourceReceipt = (
      character.system.profile as {
        currencyWallet: {
          operationReceipts: Record<string, Record<string, unknown>>;
        };
      }
    ).currencyWallet.operationReceipts["resume-1"];
    expect(pendingSourceReceipt).not.toHaveProperty("recoveryRequest");
    expect(
      (
        character.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("50");
    await service.executeCurrencyHolderTransfer(request, gm, "resume-1", false);
    expect(
      (
        character.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("50");
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("30");
  });

  it("registers and reopens durable recovery for an interrupted transfer", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const pending = await import("../application/pending-interactions");
    service.resetCurrencyHolderServiceForTests();
    pending.resetD6PendingInteractionsForTests();
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(pouch.update)
      .mockImplementationOnce(async (changes) => applyWallet(pouch, changes))
      .mockRejectedValueOnce(new Error("interrupted"));
    await expect(
      service.executeCurrencyHolderTransfer(request, gm, "recover-ui-1", false),
    ).rejects.toThrow("interrupted");

    await service.synchronizePendingCurrencyHolderTransfers();
    const recovery = pending
      .activeD6PendingInteractions(gm.id)
      .find(({ id }) => id.includes("recover-ui-1"));
    expect(recovery).toMatchObject({
      controllerUserId: gm.id,
      kind: "economy-approval",
      reopenable: true,
      subjectLabel: "Mira",
    });
    await pending.reopenD6PendingInteraction(recovery?.id ?? "");
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("30");
    expect(
      (
        character.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("50");
  });

  it("safely aborts an inbound reservation when source debit fails", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const pending = await import("../application/pending-interactions");
    service.resetCurrencyHolderServiceForTests();
    pending.resetD6PendingInteractionsForTests();
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(character.update).mockRejectedValueOnce(
      new Error("debit failed"),
    );
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "inbound-recovery-1",
        null,
      ),
    ).rejects.toThrow("debit failed");
    expect(
      pouch.system.currencyWallet as {
        counts: { cent: string };
        operationReceipts: Record<string, { status: string }>;
      },
    ).toMatchObject({
      counts: { cent: "5" },
      operationReceipts: {},
    });
    expect(recoveryStore.has("inbound-recovery-1")).toBe(false);
    await service.synchronizePendingCurrencyHolderTransfers();
    expect(
      pending
        .activeD6PendingInteractions(gm.id)
        .some(({ id }) => id.includes("inbound-recovery-1")),
    ).toBe(false);
  });

  it("recovers a reservation-only interruption after the definition advances", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(character.update).mockRejectedValueOnce(
      new Error("debit failed"),
    );
    vi.mocked(pouch.update)
      .mockImplementationOnce(async (changes) => applyWallet(pouch, changes))
      .mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "reservation-stale-1",
        null,
      ),
    ).rejects.toThrow("debit failed");
    expect(
      (
        pouch.system.currencyWallet as {
          operationReceipts: Record<string, { status: string }>;
        }
      ).operationReceipts["reservation-stale-1"]?.status,
    ).toBe("pending-transfer");
    expect(recoveryStore.has("reservation-stale-1")).toBe(true);

    Object.assign(dollars, { revision: 2 });
    try {
      await service.executeCurrencyHolderTransfer(
        request,
        gm,
        "reservation-stale-1",
        null,
      );
    } finally {
      Object.assign(dollars, { revision: 1 });
    }
    expect(
      (
        character.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("50");
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("30");
    expect(recoveryStore.has("reservation-stale-1")).toBe(false);
  });

  it("preserves a concurrent target correction before writing its reservation", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    recoveryRecorded.mockImplementationOnce(() => {
      pouch.system.currencyWallet = createCurrencyWallet(dollars, {
        cent: "6",
        dollar: "1",
      });
    });

    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "fresh-target-check-1",
        null,
      ),
    ).rejects.toThrow();
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("6");
    expect(pouch.update).not.toHaveBeenCalled();
    expect(character.update).not.toHaveBeenCalled();
    expect(recoveryStore.has("fresh-target-check-1")).toBe(false);
  });

  it("unlocks a stranded target reservation after the source legitimately changes", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(character.update).mockRejectedValueOnce(
      new Error("debit failed"),
    );
    vi.mocked(pouch.update)
      .mockImplementationOnce(async (changes) => applyWallet(pouch, changes))
      .mockRejectedValueOnce(new Error("cleanup failed"));
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "changed-source-abort-1",
        null,
      ),
    ).rejects.toThrow("debit failed");
    expect(recoveryStore.has("changed-source-abort-1")).toBe(true);

    (character.system.profile as Record<string, unknown>).currencyWallet =
      createCurrencyWallet(dollars, { cent: "74", dollar: "3" });
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "changed-source-abort-1",
        null,
      ),
    ).rejects.toThrow();

    expect(
      (
        character.system.profile as {
          currencyWallet: {
            counts: { cent: string };
            operationReceipts: Record<string, unknown>;
          };
        }
      ).currencyWallet,
    ).toMatchObject({ counts: { cent: "74" }, operationReceipts: {} });
    expect(
      pouch.system.currencyWallet as {
        counts: { cent: string };
        operationReceipts: Record<string, unknown>;
      },
    ).toMatchObject({ counts: { cent: "5" }, operationReceipts: {} });
    expect(recoveryStore.has("changed-source-abort-1")).toBe(false);
  });

  it("rejects stale, insufficient, and same-holder requests before any wallet write", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const base = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    const requests = [
      { ...base, expectedSourceTotalSmallestUnit: "999999" },
      { ...base, amount: "999999" },
      {
        ...base,
        expectedTargetTotalSmallestUnit: base.expectedSourceTotalSmallestUnit,
        expectedTargetWalletFingerprint: base.expectedSourceWalletFingerprint,
        target: base.source,
      },
    ];
    for (const [index, request] of requests.entries()) {
      await expect(
        service.executeCurrencyHolderTransfer(
          request,
          gm,
          `prewrite-reject-${index}`,
          null,
        ),
      ).rejects.toThrow();
    }
    expect(character.update).not.toHaveBeenCalled();
    expect(pouch.update).not.toHaveBeenCalled();
    expect(recoveryStore.size).toBe(0);
  });

  it("resumes an exact pending transfer after the world definition advances", async () => {
    const { character, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(pouch.update)
      .mockImplementationOnce(async (changes) => applyWallet(pouch, changes))
      .mockRejectedValueOnce(new Error("interrupted"));
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        gm,
        "resume-stale-1",
        false,
      ),
    ).rejects.toThrow("interrupted");

    Object.assign(dollars, { revision: 2 });
    try {
      await service.executeCurrencyHolderTransfer(
        request,
        gm,
        "resume-stale-1",
        false,
      );
    } finally {
      Object.assign(dollars, { revision: 1 });
    }
    expect(
      (
        character.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("50");
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("30");
  });

  it("rechecks requester authority before crediting and leaves recovery pending", async () => {
    const { character, owner, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(character.update).mockImplementationOnce(async (changes) => {
      applyWallet(character, changes);
      Object.assign(owner, { active: false });
    });

    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        owner,
        "permission-loss-1",
        false,
      ),
    ).rejects.toThrow("D6E2.Economy.Error.NotAuthorized");
    expect(
      (
        character.system.profile as {
          currencyWallet: {
            counts: { cent: string };
            operationReceipts: Record<string, { status: string }>;
          };
        }
      ).currencyWallet,
    ).toMatchObject({
      counts: { cent: "50" },
      operationReceipts: {
        "permission-loss-1": { status: "pending-transfer" },
      },
    });
    expect(
      (pouch.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("5");
  });

  it("rejects a transfer through a closed containing space", async () => {
    const { character, gm, pouch } = fixture();
    const pouchObject = ledger.objects["pouch-a"];
    if (!pouchObject) throw new Error("missing pouch object");
    ledger = {
      ...ledger,
      objects: {
        ...ledger.objects,
        "outer-a": {
          ...pouchObject,
          definition: {
            ...pouchObject.definition,
            instanceId: "outer-a",
            interior: {
              ...pouchObject.definition.interior!,
              id: "container:outer-a",
              access: "closed",
            },
          },
          documentUuid: "Actor.character.Item.outer",
          location: {
            state: "unplaced",
            rootUuid: character.uuid,
            disposition: "carried",
          },
        },
        "pouch-a": {
          ...pouchObject,
          location: {
            state: "listed",
            parent: {
              rootUuid: character.uuid,
              spaceId: "container:outer-a",
              containerInstanceId: "outer-a",
              spaceOwnerActorUuid: character.uuid,
            },
            disposition: "stored",
            pinned: false,
          },
        },
      },
    };
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const target = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const request = service.holderTransferRequest({
      amount: "1",
      denominationId: "cent",
      source,
      target,
    });

    await expect(
      service.executeCurrencyHolderTransfer(request, gm, "closed-1", false),
    ).rejects.toThrow("D6E2.Storage.Unreachable");
    expect(pouch.update).not.toHaveBeenCalled();
    expect(character.update).not.toHaveBeenCalled();
  });

  it("re-resolves a funded container by stable instance ID after custody movement", async () => {
    const { character, documents, gm, pouch } = fixture();
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const target = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const request = service.holderTransferRequest({
      amount: "5",
      denominationId: "cent",
      source,
      target,
    });
    vi.mocked(pouch.update).mockImplementationOnce(async (changes) => {
      applyWallet(pouch, changes);
      const moved = {
        ...pouch,
        system: structuredClone(pouch.system),
        update: vi.fn(async function (
          this: { system: Record<string, unknown> },
          next: Record<string, unknown>,
        ) {
          applyWallet(this, next);
        }),
        uuid: "Actor.character.Item.moved-pouch",
      } as unknown as FoundryItemDocument;
      documents.set(moved.uuid!, moved);
      ledger = {
        ...ledger,
        objects: {
          ...ledger.objects,
          "pouch-a": {
            ...ledger.objects["pouch-a"]!,
            documentUuid: moved.uuid!,
          },
        },
      };
    });
    await service.executeCurrencyHolderTransfer(
      request,
      gm,
      "move-safe-1",
      false,
    );
    const moved = (await fromUuid(
      "Actor.character.Item.moved-pouch",
    )) as FoundryItemDocument;
    expect(
      (moved.system.currencyWallet as { counts: { cent: string } }).counts.cent,
    ).toBe("0");
  });

  it("denies a caller who merely knows the holder identities", async () => {
    const { character, owner, pouch } = fixture();
    const stranger = {
      active: true,
      id: "stranger",
      isGM: false,
      name: "Stranger",
    } as FoundryUser;
    const service = await import("./currency-holder-service");
    const source = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const target = await service.resolveCurrencyHolder(
      service.containerCurrencyHolderRef("pouch-a"),
    );
    const request = service.holderTransferRequest({
      amount: "1",
      denominationId: "cent",
      source,
      target,
    });
    vi.stubGlobal("game", {
      user: { active: true, id: "gm", isGM: true },
      i18n: { localize: (key: string) => key },
    });
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        stranger,
        "denied-1",
        true,
      ),
    ).rejects.toThrow("D6E2.Economy.Error.NotAuthorized");
    expect(character.update).not.toHaveBeenCalled();
    expect(pouch.update).not.toHaveBeenCalled();
    expect(owner.id).toBe("owner");
  });

  it("requires and rechecks the other root owner's exact consent identity", async () => {
    const { character, documents, gm, owner } = fixture();
    const recipientOwner = {
      active: true,
      id: "recipient-owner",
      isGM: false,
      name: "Recipient",
    } as FoundryUser;
    const target = {
      id: "recipient",
      items: { contents: [] },
      name: "Vale",
      system: {
        profile: {
          currency: 0,
          currencyWallet: createCurrencyWallet(dollars),
        },
        storage: { configured: true },
      },
      testUserPermission: (user: FoundryUser) => user.id === recipientOwner.id,
      type: "character",
      update: vi.fn(function (
        this: { system: Record<string, unknown> },
        changes,
      ) {
        applyWallet(this, changes);
        return Promise.resolve();
      }),
      uuid: "Actor.recipient",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    documents.set(target.uuid, target);
    ledger = {
      ...ledger,
      roots: {
        ...ledger.roots,
        [target.uuid]: {
          version: 1,
          rootUuid: target.uuid,
          kind: "character",
          publicSummary: "none",
          revision: 1,
          spaces: {},
        },
      },
    };
    (game.users?.contents as FoundryUser[]).push(recipientOwner);
    Object.assign(game.users ?? {}, {
      get: (id: string) =>
        id === gm.id
          ? gm
          : id === owner.id
            ? owner
            : id === recipientOwner.id
              ? recipientOwner
              : undefined,
    });
    const service = await import("./currency-holder-service");
    const sourceHolder = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(character),
    );
    const targetHolder = await service.resolveCurrencyHolder(
      service.rootCurrencyHolderRef(target),
    );
    const request = service.holderTransferRequest({
      amount: "25",
      denominationId: "cent",
      source: sourceHolder,
      target: targetHolder,
    });
    await expect(
      service.executeCurrencyHolderTransfer(
        request,
        owner,
        "consent-required",
        null,
      ),
    ).rejects.toThrow("D6E2.Economy.Error.NotAuthorized");
    await service.executeCurrencyHolderTransfer(
      request,
      owner,
      "consent-granted",
      recipientOwner.id,
    );
    expect(
      (
        target.system.profile as {
          currencyWallet: { counts: { cent: string } };
        }
      ).currencyWallet.counts.cent,
    ).toBe("25");
  });

  it("writes container denomination migrations through authority and witness sync", async () => {
    const { pouch } = fixture();
    const service = await import("./currency-holder-service");
    const before = pouch.system.currencyWallet as ReturnType<
      typeof createCurrencyWallet
    >;
    await service.writeCurrencyHolderWalletMigration(
      service.containerCurrencyHolderRef("pouch-a"),
      currencyWalletFingerprint(before),
      createCurrencyWallet(dollars, { cent: "105", dollar: "0" }),
    );

    expect(pouch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.currencyWallet": expect.objectContaining({
          totalSmallestUnit: "105",
        }),
      }),
      { d6GridStorageAuthorityWrite: true },
    );
    expect(synchronize).toHaveBeenCalledWith(pouch);
  });
});
