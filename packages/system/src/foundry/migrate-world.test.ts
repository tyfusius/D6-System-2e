import { beforeEach, describe, expect, it, vi } from "vitest";

const migration = vi.hoisted(() => ({
  migrateActor: vi.fn(),
  migrateItem: vi.fn(),
  synchronize: vi.fn(() => Promise.resolve()),
}));

vi.mock("../migrations", () => ({
  migrationRunner: {
    latestVersion: 59,
    migrateActor: migration.migrateActor,
    migrateItem: migration.migrateItem,
  },
}));

vi.mock("./grid-storage-mutation-guard", () => ({
  GRID_STORAGE_AUTHORITY_WRITE_OPTION: "d6GridStorageAuthorityWrite",
  synchronizeGridStorageItemWitness: migration.synchronize,
}));

import { migrateD6System2eWorld } from "./migrate-world";

describe("world migration storage authority writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes an enrolled Item migration and synchronizes its witness", async () => {
    const embedded = {
      id: "qa-kit",
      system: {
        _migration: { schema: 58 },
        storageInstanceId: "qa-kit-instance",
        storageInterior: { configured: true },
      },
    } as unknown as FoundryItemDocument;
    const originalSource = {
      _id: "actor",
      items: [
        {
          _id: embedded.id,
          system: structuredClone(embedded.system),
          type: "gear",
        },
      ],
      system: { _migration: { schema: 59 } },
      type: "character",
    };
    const migratedSource = structuredClone(originalSource);
    const migratedItem = migratedSource.items[0];
    if (!migratedItem) throw new Error("missing migrated fixture item");
    migratedItem.system = {
      ...migratedItem.system,
      _migration: { schema: 59 },
      currencyWallet: {},
    };
    migration.migrateActor.mockResolvedValue({
      report: { toVersion: 59 },
      source: migratedSource,
    });
    const updateEmbeddedDocuments = vi.fn(
      (
        _name: string,
        updates: readonly Record<string, unknown>[],
        _options?: Record<string, unknown>,
      ) => {
        void _options;
        Object.assign(embedded, { system: updates[0]?.system });
        return Promise.resolve([embedded]);
      },
    );
    const actor = {
      id: "actor",
      items: {
        get: (id: string) => (id === embedded.id ? embedded : undefined),
      },
      system: originalSource.system,
      toObject: () => structuredClone(originalSource),
      type: "character",
      update: vi.fn(),
      updateEmbeddedDocuments,
    };
    vi.stubGlobal("game", {
      actors: { contents: [actor] },
      items: { contents: [] },
      system: { version: "0.0.0" },
      user: { isGM: true },
      version: "14.367",
    });

    await migrateD6System2eWorld();

    expect(updateEmbeddedDocuments).toHaveBeenCalledOnce();
    const call = updateEmbeddedDocuments.mock.calls[0];
    expect(call?.[0]).toBe("Item");
    expect(call?.[1]?.[0]).toMatchObject({
      _id: embedded.id,
      system: { currencyWallet: {} },
    });
    expect(call?.[2]).toEqual({
      d6GridStorageAuthorityWrite: true,
      d6System2eMigration: true,
      diff: false,
    });
    expect(migration.synchronize).toHaveBeenCalledWith(embedded);
    expect(embedded.system.currencyWallet).toEqual({});
  });
});
