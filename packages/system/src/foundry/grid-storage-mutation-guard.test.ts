/* eslint-disable @typescript-eslint/unbound-method -- Hook callbacks and Foundry methods are Vitest mocks asserted without invocation. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCurrencyWallet } from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations.js";

const callbacks = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>(),
);
const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  read: vi.fn(),
  witness: vi.fn(() => Promise.resolve("new-witness")),
  requestAvailability: vi.fn(),
}));

vi.mock("./grid-storage-document-adapter.js", () => ({
  GRID_STORAGE_ITEM_TYPES: ["gear"],
  gridStorageInteriorSystem: (space: unknown) => space ?? { configured: false },
  gridStorageItemParticipates: (item: FoundryItemDocument) =>
    typeof item.system.storageInstanceId === "string" &&
    item.system.storageInstanceId.length > 0,
  gridStorageObjectFromItem: async (
    document: FoundryItemDocument,
    location: unknown,
  ) => ({
    version: 1,
    definition: {
      version: 1,
      instanceId: document.system.storageInstanceId,
      physical: document.system.storagePhysical ?? {},
      ...(document.system.storageInterior
        ? { interior: document.system.storageInterior }
        : {}),
    },
    documentUuid: document.uuid,
    ownerActorUuid: document.parent?.uuid,
    quantity: document.system.quantity,
    witness: await state.witness(),
    location,
  }),
  gridStorageWitness: state.witness,
}));
vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => true,
}));
vi.mock("./grid-storage-state.js", () => ({
  mutateGridStorageAuthorityState: state.mutate,
  readGridStorageAuthorityState: state.read,
}));
vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageAvailability: state.requestAvailability,
}));

import {
  assertGridStorageLegacyMutationAllowed,
  GRID_STORAGE_AUTHORITY_WRITE_OPTION,
  reconcileGridStorageItemWitnesses,
  registerGridStorageMutationGuards,
  synchronizeGridStorageItemWitness,
} from "./grid-storage-mutation-guard";
import { requireGridStorageItemAction } from "./grid-storage-availability.js";

const item = (storageInstanceId = "stored-item") =>
  ({
    system: { storageInstanceId },
    type: "gear",
  }) as unknown as FoundryItemDocument;

beforeEach(() => {
  callbacks.clear();
  state.mutate.mockReset();
  state.read.mockReset();
  state.witness.mockReset().mockResolvedValue("new-witness");
  state.requestAvailability.mockReset().mockResolvedValue({
    configured: false,
    reachable: true,
    canUse: true,
    canEquip: true,
    effectiveEquipped: false,
    effectiveInstalled: false,
  });
  vi.stubGlobal("Hooks", {
    on: vi.fn((name: string, callback: (...args: unknown[]) => unknown) => {
      callbacks.set(name, callback);
    }),
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    user: { isGM: true },
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  registerGridStorageMutationGuards();
});

describe("grid-storage direct mutation guard", () => {
  it("rejects create, delete, and compatibility-mirror writes for participating Items", () => {
    expect(callbacks.get("preCreateItem")?.(item(), {}, {})).toBe(false);
    expect(callbacks.get("preDeleteItem")?.(item(), {})).toBe(false);
    expect(
      callbacks.get("preUpdateItem")?.(item(), { "system.quantity": 0 }, {}),
    ).toBe(false);
    expect(
      callbacks.get("preUpdateItem")?.(
        item(),
        { system: { equipped: true } },
        {},
      ),
    ).toBe(false);
    expect(
      callbacks.get("preUpdateItem")?.(
        item(),
        { "system.storagePhysical.widthMm": 20 },
        {},
      ),
    ).toBe(false);
    expect(
      callbacks.get("preUpdateItem")?.(
        item(),
        { system: { storageInterior: { configured: true } } },
        {},
      ),
    ).toBe(false);
    expect(
      callbacks.get("preUpdateItem")?.(
        item(""),
        { "system.storageInstanceId": "orphan" },
        {},
      ),
    ).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith(
      "D6E2.Storage.Error.AuthorityRequired",
    );
  });

  it("allows unrelated, legacy, and explicitly authoritative document writes", () => {
    expect(
      callbacks.get("preUpdateItem")?.(item(), { name: "Renamed" }, {}),
    ).toBeUndefined();
    expect(
      callbacks.get("preUpdateItem")?.(item(""), { "system.quantity": 0 }, {}),
    ).toBeUndefined();
    const options = { [GRID_STORAGE_AUTHORITY_WRITE_OPTION]: true };
    expect(
      callbacks.get("preCreateItem")?.(item(), {}, options),
    ).toBeUndefined();
    expect(
      callbacks.get("preUpdateItem")?.(
        item(),
        { system: { installed: true } },
        options,
      ),
    ).toBeUndefined();
    expect(callbacks.get("preDeleteItem")?.(item(), options)).toBeUndefined();
  });

  it("rejects cloning and deleting funded holders outside storage authority", () => {
    const wallet = createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
      currency: "4",
    });
    const fundedContainer = {
      system: {
        currencyWallet: wallet,
        storageInstanceId: "stored-item",
        storageInterior: { configured: true },
      },
      type: "gear",
    } as unknown as FoundryItemDocument;
    const fundedRoot = {
      items: { contents: [] },
      system: {
        profile: { currency: 4, currencyWallet: wallet },
        storage: { configured: true },
      },
      type: "character",
    } as unknown as FoundryActorDocument;

    expect(callbacks.get("preCreateItem")?.(fundedContainer, {}, {})).toBe(
      false,
    );
    expect(callbacks.get("preDeleteItem")?.(fundedContainer, {})).toBe(false);
    expect(callbacks.get("preDeleteActor")?.(fundedRoot, {})).toBe(false);
    expect(callbacks.get("preCreateActor")?.(fundedRoot, {}, {})).toBe(false);

    const cascadingRoot = {
      items: { contents: [fundedContainer] },
      system: {
        profile: {
          currency: 0,
          currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
        },
        storage: { configured: true },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    expect(callbacks.get("preDeleteActor")?.(cascadingRoot, {})).toBe(false);
    expect(callbacks.get("preCreateActor")?.(cascadingRoot, {}, {})).toBe(
      false,
    );
    const emptyRootDocument = {
      items: { contents: [] },
      system: {
        profile: {
          currency: 0,
          currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
        },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    expect(
      callbacks.get("preCreateActor")?.(
        emptyRootDocument,
        { items: [fundedContainer] },
        {},
      ),
    ).toBe(false);

    const pendingWallet = createCurrencyWallet(
      LEGACY_CURRENCY_DEFINITION,
      {},
      [],
      {
        inbound: {
          createdAt: 1,
          intent: "inbound",
          recoveryRequest: "{}",
          requesterUserId: "owner",
          status: "pending-transfer",
        },
      },
    );
    const pendingRoot = {
      items: { contents: [] },
      system: {
        profile: { currency: 0, currencyWallet: pendingWallet },
        storage: { configured: true },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    expect(callbacks.get("preDeleteActor")?.(pendingRoot, {})).toBe(false);
    expect(callbacks.get("preCreateActor")?.(pendingRoot, {}, {})).toBe(false);
  });

  it("fails legacy mutation entry points closed with an actionable key", () => {
    expect(() => assertGridStorageLegacyMutationAllowed(item())).toThrow(
      "D6E2.Storage.Error.AuthorityRequired",
    );
    expect(() =>
      assertGridStorageLegacyMutationAllowed(item("")),
    ).not.toThrow();
  });

  it("reconciles the full witness after an unrelated authoritative Item edit", async () => {
    const document = {
      uuid: "Actor.owner.Item.item",
      parent: { uuid: "Actor.owner" },
      system: {
        storageInstanceId: "stored-item",
        quantity: 1,
        equipped: false,
        installed: false,
      },
      type: "gear",
      toObject: () => ({
        _id: "item",
        name: "Renamed",
        system: {
          storageInstanceId: "stored-item",
          quantity: 1,
          equipped: false,
          installed: false,
        },
        type: "gear",
      }),
    } as unknown as FoundryItemDocument;
    const authorityState = {
      version: 1,
      ledger: {
        version: 1,
        revision: 4,
        roots: {},
        objects: {
          "stored-item": {
            version: 1,
            definition: {
              version: 1,
              instanceId: "stored-item",
              physical: {},
            },
            documentUuid: document.uuid,
            ownerActorUuid: "Actor.owner",
            quantity: 1,
            witness: "old-witness",
            location: {
              state: "unplaced",
              rootUuid: "Actor.owner",
              disposition: "carried",
            },
          },
        },
      },
      receipts: {},
    };
    state.read.mockResolvedValue(authorityState);
    state.mutate.mockImplementation(
      (_revision: number, mutation: (value: unknown) => unknown) =>
        mutation(authorityState),
    );

    await synchronizeGridStorageItemWitness(document);

    expect(state.mutate).toHaveBeenCalledWith(4, expect.any(Function));
    const mutationCall = state.mutate.mock.calls[0];
    if (!mutationCall) throw new Error("missing state mutation");
    const mutation = mutationCall[1] as (
      value: typeof authorityState,
    ) => readonly [typeof authorityState, unknown];
    const [next] = mutation(authorityState);
    expect(next.ledger.revision).toBe(5);
    expect(next.ledger.objects["stored-item"].witness).toBe("new-witness");
  });

  it("repairs missed unrelated witnesses when a storage authority resumes", async () => {
    const document = {
      uuid: "Actor.owner.Item.item",
      parent: { uuid: "Actor.owner" },
      system: {
        storageInstanceId: "stored-item",
        quantity: 1,
        equipped: false,
        installed: false,
      },
      type: "gear",
      toObject: () => ({ _id: "item", name: "Offline rename" }),
    } as unknown as FoundryItemDocument;
    const authorityState = {
      version: 1,
      ledger: {
        version: 1,
        revision: 6,
        roots: {},
        objects: {
          "stored-item": {
            version: 1,
            definition: {
              version: 1,
              instanceId: "stored-item",
              physical: {},
            },
            documentUuid: document.uuid,
            ownerActorUuid: "Actor.owner",
            quantity: 1,
            witness: "old-witness",
            location: {
              state: "unplaced",
              rootUuid: "Actor.owner",
              disposition: "carried",
            },
          },
        },
      },
      receipts: {},
    };
    state.read.mockResolvedValue(authorityState);
    state.mutate.mockImplementation(
      (_revision: number, mutation: (value: unknown) => unknown) =>
        mutation(authorityState),
    );
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() => Promise.resolve(document)),
    );

    await reconcileGridStorageItemWitnesses();

    expect(state.mutate).toHaveBeenCalledWith(6, expect.any(Function));
  });

  it("preserves unexplained identities and keeps their action path unavailable across authority resume", async () => {
    const contents: FoundryItemDocument[] = [];
    const actor = {
      uuid: "Actor.owner",
      system: { storage: { configured: true } },
      items: { contents },
      update: vi.fn(() => Promise.resolve()),
    };
    const interruptedRoot = {
      uuid: "Actor.interrupted",
      system: { storage: { configured: true } },
      items: { contents: [] },
      update: vi.fn((changes: Record<string, unknown>) => {
        if (Object.hasOwn(changes, "system.storage.configured"))
          interruptedRoot.system.storage.configured = Boolean(
            changes["system.storage.configured"],
          );
        return Promise.resolve();
      }),
    };
    const configured = {
      id: "item",
      uuid: "Actor.owner.Item.item",
      parent: actor,
      system: {
        storageInstanceId: "stored-item",
        storagePhysical: { widthMm: 99 },
        quantity: 1,
        equipped: false,
        installed: false,
      },
      type: "gear",
      update: vi.fn((changes: Record<string, unknown>) => {
        if (Object.hasOwn(changes, "system.storagePhysical"))
          configured.system.storagePhysical = changes["system.storagePhysical"];
        return Promise.resolve();
      }),
      toObject: () => ({
        _id: "item",
        type: "gear",
        system: structuredClone(configured.system),
      }),
    } as unknown as FoundryItemDocument;
    const orphan = {
      id: "orphan",
      uuid: "Actor.owner.Item.orphan",
      parent: actor,
      system: { storageInstanceId: "orphan-id", quantity: 1 },
      type: "gear",
      update: vi.fn((changes: Record<string, unknown>) => {
        if (Object.hasOwn(changes, "system.storageInstanceId"))
          orphan.system.storageInstanceId = String(
            changes["system.storageInstanceId"],
          );
        return Promise.resolve();
      }),
    } as unknown as FoundryItemDocument;
    contents.push(configured, orphan);
    const authorityState = {
      version: 1,
      ledger: {
        version: 1,
        revision: 8,
        roots: { "Actor.owner": { rootUuid: "Actor.owner" } },
        objects: {
          "stored-item": {
            version: 1,
            definition: {
              version: 1,
              instanceId: "stored-item",
              physical: { widthMm: 10 },
            },
            documentUuid: configured.uuid,
            ownerActorUuid: actor.uuid,
            quantity: 1,
            witness: "old-witness",
            location: {
              state: "unplaced",
              rootUuid: actor.uuid,
              disposition: "carried",
            },
          },
        },
      },
      receipts: {
        uncertain: {
          state: "needs-attention",
          reservedIdentities: [
            { instanceId: "orphan-id", documentUuid: orphan.uuid },
          ],
        },
      },
    };
    state.read.mockResolvedValue(authorityState);
    state.mutate.mockImplementation(
      (_revision: number, mutation: (value: unknown) => unknown) =>
        mutation(authorityState),
    );
    state.witness.mockResolvedValue("repaired-witness");
    vi.stubGlobal("game", {
      actors: { contents: [actor, interruptedRoot] },
      i18n: { localize: (key: string) => key },
      user: { isGM: true },
    });
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === configured.uuid ? configured : null),
      ),
    );

    await expect(
      requireGridStorageItemAction(orphan, actor.uuid, "use"),
    ).rejects.toThrow(/Unavailable/);
    await reconcileGridStorageItemWitnesses();

    expect(configured.update).not.toHaveBeenCalled();
    expect(configured.system.storagePhysical).toEqual({ widthMm: 99 });
    expect(orphan.system.storageInstanceId).toBe("orphan-id");
    expect(interruptedRoot.system.storage.configured).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
    await expect(
      requireGridStorageItemAction(orphan, actor.uuid, "use"),
    ).rejects.toThrow(/Unavailable/);
  });
});
