import { beforeEach, expect, it, vi } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";

const f = vi.hoisted(() => ({
  callbacks: new Map<string, (...args: unknown[]) => unknown>(),
  warn: vi.fn(),
}));
vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => false,
}));
vi.mock("./grid-storage-state.js", () => ({
  readGridStorageAuthorityState: vi.fn(),
  mutateGridStorageAuthorityState: vi.fn(),
}));

import { migrateD6System2eWorld } from "./migrate-world";
import { registerGridStorageMutationGuards } from "./grid-storage-mutation-guard";

beforeEach(() => {
  f.callbacks.clear();
  f.warn.mockClear();
  vi.stubGlobal("Hooks", {
    on: (name: string, callback: (...args: unknown[]) => unknown) =>
      f.callbacks.set(name, callback),
  });
  vi.stubGlobal("ui", { notifications: { warn: f.warn } });
  vi.stubGlobal("game", {
    user: { isGM: true },
    i18n: { localize: (key: string) => key },
    system: { version: "0.1.0-beta.24" },
    version: "14.368",
  });
  registerGridStorageMutationGuards();
});

function fixture() {
  const items: ItemSource[] = ["knife", "blaster", "pack"].map((id) => ({
    _id: id,
    type: "gear",
    name: id,
    system: {
      _migration: { schema: 60, foundry: "14.368", system: "0.1.0-beta.24" },
      hasStorage: false,
      quantity: 1,
      gearCategory: "general",
      storageInstanceId: id === "pack" ? "pack-instance" : "",
      storageInterior: { configured: id === "pack", columns: 4, rows: 3 },
    },
  }));
  const source: ActorSource = {
    _id: "owner",
    type: "character",
    system: {
      _migration: { schema: 61, foundry: "14.368", system: "0.1.0-beta.24" },
    },
    items,
  };
  const documents = items.map((item) => ({
    id: item._id,
    type: item.type,
    system: item.system,
    parent: { uuid: "Actor.owner" },
  }));
  const updateEmbeddedDocuments = vi.fn(
    (
      _name: string,
      changes: Record<string, unknown>[],
      options: Record<string, unknown>,
    ) => {
      const updated = [];
      for (const change of changes) {
        const document = documents.find((item) => item.id === change._id);
        if (!document) throw new Error("missing item");
        if (
          f.callbacks.get("preUpdateItem")?.(document, change, {
            ...options,
          }) === false
        )
          continue;
        document.system = structuredClone(
          change.system,
        ) as ItemSource["system"];
        updated.push(document);
      }
      return Promise.resolve(updated);
    },
  );
  const actor = {
    id: "owner",
    type: "character",
    system: source.system,
    items: { get: (id: string) => documents.find((item) => item.id === id) },
    toObject: () => ({
      ...structuredClone(source),
      items: documents.map((document, index) => ({
        ...items[index],
        system: structuredClone(document.system),
      })),
    }),
    updateEmbeddedDocuments,
    update: vi.fn((changes: { system: ActorSource["system"] }) => {
      actor.system = structuredClone(changes.system);
      source.system = actor.system;
      return Promise.resolve(actor);
    }),
  };
  Object.assign(game, {
    actors: { contents: [actor] },
    items: { contents: [] },
  });
  return { actor, documents, updateEmbeddedDocuments };
}

it("migrates schema60 equipment before authority election without three rejected writes", async () => {
  const { actor, documents, updateEmbeddedDocuments } = fixture();
  await migrateD6System2eWorld();
  expect(f.warn).not.toHaveBeenCalled();
  expect(documents.map((item) => item.system._migration?.schema)).toEqual([
    62, 62, 62,
  ]);
  expect(documents.map((item) => item.system.hasStorage)).toEqual([
    false,
    false,
    true,
  ]);
  expect(documents[2]?.system.storageInterior).toEqual({
    configured: true,
    columns: 4,
    rows: 3,
    interiorHeightMm: null,
  });
  await migrateD6System2eWorld();
  expect(updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
  expect(actor.update).toHaveBeenCalledTimes(1);
  expect(actor.system._migration?.schema).toBe(62);
});

it("does not accept migration flags outside the registered migration call", () => {
  const { documents } = fixture();
  expect(
    f.callbacks.get("preUpdateItem")?.(
      documents[2],
      { "system.hasStorage": false },
      { d6System2eMigration: true, d6GridStorageAuthorityWrite: true },
    ),
  ).toBe(false);
});

it("retries only rejected items when the actor and a sibling already reached schema62", async () => {
  const { actor, documents, updateEmbeddedDocuments } = fixture();
  if (!actor.system._migration) throw new Error("missing migration metadata");
  actor.system._migration.schema = 62;
  const accepted = documents[0];
  if (!accepted) throw new Error("missing fixture");
  accepted.system.storageInterior = {
    ...(accepted.system.storageInterior as Record<string, unknown>),
    interiorHeightMm: null,
  };
  accepted.system._migration = {
    schema: 62,
    foundry: "14.368",
    system: "0.1.0-beta.24",
  };
  await migrateD6System2eWorld();
  expect(
    updateEmbeddedDocuments.mock.calls[0]?.[1].map((update) => update._id),
  ).toEqual(["blaster", "pack"]);
  expect(documents.map((item) => item.system._migration?.schema)).toEqual([
    62, 62, 62,
  ]);
  await migrateD6System2eWorld();
  expect(updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
});

it("requires GM, targets only scoped documents, and revokes migration scope on failure", async () => {
  const { withGridStorageItemMigration } =
    await import("./grid-storage-mutation-guard");
  const { documents } = fixture();
  const document = documents[2];
  if (!document) throw new Error("missing fixture");
  const changes = { "system.hasStorage": false };
  const options = { d6System2eMigration: true };
  await expect(
    withGridStorageItemMigration([document], async () => {
      await Promise.resolve();
      expect(
        f.callbacks.get("preUpdateItem")?.(document, changes, options),
      ).toBeUndefined();
      expect(
        f.callbacks.get("preUpdateItem")?.(documents[0], changes, options),
      ).toBe(false);
      expect(f.callbacks.get("preUpdateItem")?.(document, changes, {})).toBe(
        false,
      );
      throw new Error("write failed");
    }),
  ).rejects.toThrow("write failed");
  expect(f.callbacks.get("preUpdateItem")?.(document, changes, options)).toBe(
    false,
  );
  Object.assign(game, { user: { isGM: false } });
  const write = vi.fn();
  await expect(withGridStorageItemMigration([document], write)).rejects.toThrow(
    "Authority",
  );
  expect(write).not.toHaveBeenCalled();
});
