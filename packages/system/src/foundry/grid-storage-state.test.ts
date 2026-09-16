import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6CurrencyHolderTransferRecoveryV1,
  D6StorageConfigurationReceiptV1,
  D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";

const f = vi.hoisted(() => ({
  authority: true,
  open: vi.fn((_topic: string, value: unknown) =>
    Promise.resolve((value as { payload?: unknown }).payload),
  ),
  seal: vi.fn((_topic: string, value: unknown, recipients: string[]) =>
    Promise.resolve({
      version: 1,
      payload: value,
      recipients,
    }),
  ),
  notify: vi.fn(() => Promise.resolve()),
}));

vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => f.authority,
  destinyEnrolledGMIds: () => ["gm", "retired"],
  openDestinyEnvelope: f.open,
  sealDestiny: f.seal,
}));
vi.mock("./grid-storage-authority.js", () => ({
  notifyGridStorageCommittedRoots: f.notify,
}));

import {
  GRID_STORAGE_LEDGER_SETTING,
  changedGridStorageRoots,
  initialGridStorageAuthorityState,
  initialGridStorageLedger,
  mutateGridStorageAuthorityState,
  mutateGridStorageLedger,
  readCurrencyHolderTransferRecoveries,
  readGridStorageAuthorityState,
  readGridStorageLedger,
  requireGridStorageAuthorityState,
  requireGridStorageLedger,
  recordCurrencyHolderTransferRecovery,
  removeCurrencyHolderTransferRecovery,
  resetGridStorageStateForTests,
  writeGridStorageLedger,
} from "./grid-storage-state.js";

const receipt = (operationId: string): D6StorageTransactionReceiptV1 => ({
  version: 1,
  operationId,
  intentHash: `intent:${operationId}`,
  request: {
    kind: "unpack",
    value: {
      version: 1,
      operationId,
      baseRevision: 0,
      containerInstanceId: "container",
      destination: {
        rootUuid: "Actor.owner",
        spaceId: "inventory",
        containerInstanceId: null,
        spaceOwnerActorUuid: "Actor.owner",
      },
      witnesses: {},
    },
  },
  planHash: "",
  requesterUserId: "player",
  authorityUserId: "gm",
  state: "intent-recorded",
  approvals: [],
  reservedIdentities: [],
  writes: [],
  beforeRevision: 0,
  afterRevision: null,
  beforeLocations: {},
  afterLocations: {},
  response: null,
  responseHash: null,
  undoEligible: false,
});

const configurationReceipt = (
  operationId: string,
): D6StorageConfigurationReceiptV1 => ({
  version: 1,
  operationId,
  kind: "item",
  state: "intent-recorded",
  beforeRevision: 0,
  afterLedger: { ...initialGridStorageLedger(), revision: 1 },
  actorConfigured: null,
  writes: [],
});

const settings = new Map<string, unknown>();
const settingKey = (namespace: string, key: string) => `${namespace}.${key}`;

beforeEach(() => {
  settings.clear();
  f.authority = true;
  f.open.mockClear();
  f.seal.mockClear();
  f.notify.mockClear();
  resetGridStorageStateForTests();
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    users: new Map([
      ["gm", { id: "gm", isGM: true }],
      ["retired", { id: "retired", isGM: false }],
    ]),
    settings: {
      get: (namespace: string, key: string) =>
        settings.get(settingKey(namespace, key)),
      set: vi.fn((namespace: string, key: string, value: unknown) => {
        settings.set(settingKey(namespace, key), value);
        return Promise.resolve(value);
      }),
      register: vi.fn(),
    },
  });
});

describe("grid storage encrypted state", () => {
  it("uses an empty revision-zero ledger until configured", async () => {
    await expect(readGridStorageLedger()).resolves.toEqual(
      initialGridStorageLedger(),
    );
  });

  it("normalizes pre-journal authority state with an empty configuration journal", async () => {
    settings.set(`d6-system-2e.${GRID_STORAGE_LEDGER_SETTING}`, {
      version: 1,
      payload: {
        version: 1,
        ledger: initialGridStorageLedger(),
        receipts: {},
      },
    });

    await expect(readGridStorageAuthorityState()).resolves.toEqual(
      initialGridStorageAuthorityState(),
    );
  });

  it("seals state only to currently authorized GMs", async () => {
    const ledger = { ...initialGridStorageLedger(), revision: 1 };

    await writeGridStorageLedger(ledger);

    expect(f.seal).toHaveBeenCalledWith(
      "grid-storage-ledger",
      { ...initialGridStorageAuthorityState(), ledger },
      ["gm"],
      undefined,
      true,
    );
    expect(settings.get(`d6-system-2e.${GRID_STORAGE_LEDGER_SETTING}`)).toEqual(
      expect.objectContaining({ recipients: ["gm"] }),
    );
  });

  it("stores holder transfer recovery only inside the sealed authority state", async () => {
    const recovery: D6CurrencyHolderTransferRecoveryV1 = {
      createdAt: 42,
      intent: "a".repeat(64),
      operationId: "private-transfer",
      request: {
        amount: "2",
        definitionFingerprint: "definition",
        definitionRevision: 1,
        denominationId: "credit",
        expectedSourceTotalSmallestUnit: "5",
        expectedSourceWalletFingerprint: "source-wallet",
        expectedTargetTotalSmallestUnit: "1",
        expectedTargetWalletFingerprint: "target-wallet",
        source: { id: "Actor.source", kind: "root", version: 1 },
        target: { id: "Actor.target", kind: "root", version: 1 },
        version: 1,
      },
      requesterUserId: "player",
      targetControllerUserId: "recipient",
      version: 1,
    };

    await recordCurrencyHolderTransferRecovery(recovery);
    await expect(readCurrencyHolderTransferRecoveries()).resolves.toEqual({
      "private-transfer": recovery,
    });
    expect(f.seal).toHaveBeenCalledWith(
      "grid-storage-ledger",
      expect.objectContaining({
        currencyTransferRecoveries: { "private-transfer": recovery },
      }),
      ["gm"],
      undefined,
      true,
    );

    await removeCurrencyHolderTransferRecovery(
      recovery.operationId,
      recovery.intent,
    );
    await expect(readCurrencyHolderTransferRecoveries()).resolves.toEqual({});
  });

  it("durably stores receipt-only transitions without advancing the ledger", async () => {
    await mutateGridStorageAuthorityState(0, (state) => [
      {
        ...state,
        receipts: { operation: receipt("operation") },
      },
      undefined,
    ]);

    await expect(readGridStorageAuthorityState()).resolves.toEqual({
      ...initialGridStorageAuthorityState(),
      receipts: { operation: receipt("operation") },
    });
    await expect(readGridStorageLedger()).resolves.toEqual(
      initialGridStorageLedger(),
    );
    expect(f.notify).not.toHaveBeenCalled();
  });

  it("identifies both roots changed by a cross-root object move", () => {
    const object = {
      version: 1 as const,
      definition: {
        version: 1 as const,
        instanceId: "item",
        physical: {
          version: 1 as const,
          provenance: "unknown" as const,
          presetId: null,
          widthMm: null,
          depthMm: null,
          heightMm: null,
          unitTareWeightGrams: null,
          unitExteriorVolumeMillilitres: null,
          rotatable: true,
          footprintsByScale: {},
          stack: { mode: "single" as const, maxQuantityPerPlacement: 1 },
        },
      },
      documentUuid: "Actor.source.Item.item",
      ownerActorUuid: "Actor.source",
      quantity: 1,
      witness: "witness",
      location: {
        state: "unplaced" as const,
        rootUuid: "Actor.source",
        disposition: "carried" as const,
      },
    };
    const before = {
      ...initialGridStorageLedger(),
      objects: { item: object },
    };
    const after = {
      ...before,
      revision: 1,
      objects: {
        item: {
          ...object,
          location: {
            state: "unplaced" as const,
            rootUuid: "Actor.target",
            disposition: "stored" as const,
          },
        },
      },
    };

    expect(changedGridStorageRoots(before, after)).toEqual([
      "Actor.source",
      "Actor.target",
    ]);
  });

  it("preserves durable receipts across a ledger mutation", async () => {
    await mutateGridStorageAuthorityState(0, (state) => [
      { ...state, receipts: { operation: receipt("operation") } },
      undefined,
    ]);

    await mutateGridStorageLedger(0, (ledger) => [
      { ...ledger, revision: 1 },
      undefined,
    ]);

    expect((await readGridStorageAuthorityState()).receipts).toEqual({
      operation: receipt("operation"),
    });
  });

  it("fences ledger advancement while a configuration document effect is active", async () => {
    const active = configurationReceipt("configuration");
    await mutateGridStorageAuthorityState(0, (state) => [
      {
        ...state,
        configurationReceipts: { configuration: active },
      },
      undefined,
    ]);

    await expect(
      mutateGridStorageLedger(0, (ledger) => [
        { ...ledger, revision: 1 },
        undefined,
      ]),
    ).rejects.toThrow(/AuthorityBusy/);
    await expect(readGridStorageLedger()).resolves.toEqual(
      initialGridStorageLedger(),
    );

    await mutateGridStorageAuthorityState(
      0,
      (state) => [
        {
          ...state,
          ledger: active.afterLedger,
          configurationReceipts: {
            configuration: { ...active, state: "ledger-applied" },
          },
        },
        undefined,
      ],
      { configurationOperationId: active.operationId },
    );
    await expect(readGridStorageLedger()).resolves.toMatchObject({
      revision: 1,
    });
  });

  it("fails closed when this client is not the active authority", async () => {
    f.authority = false;

    await expect(
      writeGridStorageLedger({ ...initialGridStorageLedger(), revision: 1 }),
    ).rejects.toThrow(/Authority/);
  });

  it("serializes compare-and-swap mutations and rejects a stale revision", async () => {
    const first = await mutateGridStorageLedger(0, (ledger) => [
      { ...ledger, revision: 1 },
      "first",
    ]);

    expect(first).toBe("first");
    await expect(
      mutateGridStorageLedger(0, (ledger) => [
        { ...ledger, revision: ledger.revision + 1 },
        "stale",
      ]),
    ).rejects.toThrow(/Stale/);
  });

  it("rejects future or malformed plaintext before persistence", () => {
    expect(() => requireGridStorageLedger({ version: 2 })).toThrow(
      /UnsupportedLedger/,
    );
    expect(() =>
      requireGridStorageAuthorityState({
        version: 1,
        ledger: initialGridStorageLedger(),
        receipts: { mismatched: receipt("operation") },
      }),
    ).toThrow(/InvalidAuthorityState/);
  });
});
