/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6StorageTransactionReceiptV1 } from "@d6-system-2e/core";
import { createGridStorageReceipt } from "../application/grid-storage-transactions.js";
import { planGridStorageDocumentWrites } from "./grid-storage-document-adapter.js";
import {
  applyGridStorageDocumentWrites,
  compensateGridStorageDocumentWrites,
} from "./grid-storage-document-executor.js";

const documents = new Map<string, ReturnType<typeof makeItem>>();
function makeActor(id: string) {
  const uuid = `Actor.${id}`;
  const actor = {
    id,
    uuid,
    createEmbeddedDocuments: vi.fn(
      (
        _type: string,
        sources: readonly Record<string, unknown>[],
        options?: Record<string, unknown>,
      ) => {
        if (options) options.parent = actor;
        return Promise.resolve(
          sources.map((source) => {
            const created = makeItem(actor, source);
            documents.set(created.uuid, created);
            return created;
          }),
        );
      },
    ),
    updateEmbeddedDocuments: vi.fn(
      (
        _type: string,
        sources: readonly Record<string, unknown>[],
        options?: Record<string, unknown>,
      ) => {
        if (options) options.parent = actor;
        for (const source of sources) {
          const current = documents.get(`${uuid}.Item.${String(source._id)}`);
          if (current) {
            const normalized = structuredClone(source);
            normalized._stats = {
              ...(normalized._stats ?? {}),
              createdTime: 30,
              modifiedTime: 30,
            };
            const physical = (
              normalized.system as Record<string, unknown> | undefined
            )?.storagePhysical as Record<string, unknown> | undefined;
            if (physical?.presetId === null) physical.presetId = "";
            current.source = normalized;
          }
        }
        return Promise.resolve();
      },
    ),
    deleteEmbeddedDocuments: vi.fn(
      (
        _type: string,
        ids: readonly string[],
        options?: Record<string, unknown>,
      ) => {
        if (options) options.parent = actor;
        for (const itemId of ids) documents.delete(`${uuid}.Item.${itemId}`);
        return Promise.resolve();
      },
    ),
  } as unknown as FoundryActorDocument & { uuid: string };
  return actor;
}
function makeItem(
  actor: FoundryActorDocument & { uuid: string },
  source: Record<string, unknown>,
) {
  const id = String(source._id);
  return {
    id,
    uuid: `${actor.uuid}.Item.${id}`,
    type: typeof source.type === "string" ? source.type : "gear",
    name: typeof source.name === "string" ? source.name : "Item",
    parent: actor,
    system: source.system as Record<string, unknown>,
    source: structuredClone(source),
    toObject() {
      return structuredClone(
        (this as unknown as { source: Record<string, unknown> }).source,
      );
    },
  } as unknown as FoundryItemDocument & {
    uuid: string;
    parent: FoundryActorDocument & { uuid: string };
    source: Record<string, unknown>;
  };
}

beforeEach(() => documents.clear());

describe("grid storage document write recovery", () => {
  it("persists planned, applied, and verified states around each exact write", async () => {
    const sourceActor = makeActor("source");
    const targetActor = makeActor("target");
    const source = {
      _id: "item",
      type: "gear",
      name: "Ration",
      system: { storageInstanceId: "ration", quantity: 3, equipped: false },
    };
    const item = makeItem(sourceActor, source);
    documents.set(item.uuid, item);
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(
          uuid === sourceActor.uuid
            ? sourceActor
            : uuid === targetActor.uuid
              ? targetActor
              : (documents.get(uuid) ?? null),
        ),
      ),
    );
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: targetActor.uuid,
      destinationDisposition: "stored",
      quantity: 1,
      reservedInstanceId: "split",
      reservedDocumentId: "created",
    });
    const request = {
      kind: "unpack" as const,
      value: {
        version: 1 as const,
        operationId: "operation",
        baseRevision: 0,
        containerInstanceId: "container",
        destination: {
          rootUuid: sourceActor.uuid,
          spaceId: "inventory",
          containerInstanceId: null,
          spaceOwnerActorUuid: sourceActor.uuid,
        },
        witnesses: {},
      },
    };
    const receipt = await createGridStorageReceipt({
      request,
      requesterUserId: "player",
      authorityUserId: "gm",
      planHash: "plan",
      beforeRevision: 0,
      reservedIdentities: plan.reservedIdentities,
      writes: plan.writes,
    });
    const persisted: D6StorageTransactionReceiptV1[] = [];
    const result = await applyGridStorageDocumentWrites(receipt, (next) => {
      persisted.push(structuredClone(next));
      return Promise.resolve(next);
    });
    expect(result.state).toBe("documents-applied");
    expect(result.writes.every(({ state }) => state === "verified")).toBe(true);
    expect(targetActor.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      [plan.writes[0]?.after?.source],
      expect.objectContaining({
        d6GridStorageAuthorityWrite: true,
        keepId: true,
      }),
    );
    expect(sourceActor.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(persisted.map(({ state }) => state)).toContain("reserved");
  });

  it("fails closed to needs-attention when a current witness differs", async () => {
    const actor = makeActor("source");
    const source = {
      _id: "item",
      type: "gear",
      name: "Item",
      system: { storageInstanceId: "item", quantity: 1, equipped: false },
    };
    const item = makeItem(actor, source);
    documents.set(item.uuid, item);
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(
          uuid === actor.uuid ? actor : (documents.get(uuid) ?? null),
        ),
      ),
    );
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: actor.uuid,
      destinationDisposition: "equipped",
      quantity: 1,
    });
    item.source = { ...item.source, name: "Changed concurrently" };
    const receipt = await createGridStorageReceipt({
      request: {
        kind: "unpack",
        value: {
          version: 1,
          operationId: "operation",
          baseRevision: 0,
          containerInstanceId: "container",
          destination: {
            rootUuid: actor.uuid,
            spaceId: "inventory",
            containerInstanceId: null,
            spaceOwnerActorUuid: actor.uuid,
          },
          witnesses: {},
        },
      },
      requesterUserId: "player",
      authorityUserId: "gm",
      planHash: "plan",
      beforeRevision: 0,
      writes: plan.writes,
    });
    let last = receipt;
    await expect(
      applyGridStorageDocumentWrites(receipt, (next) => {
        last = next;
        return Promise.resolve(next);
      }),
    ).rejects.toThrow(/WitnessMismatch/);
    expect(last.state).toBe("needs-attention");
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("reverses an earlier verified write while retaining needs-attention for an unsafe preimage", async () => {
    const sourceActor = makeActor("source");
    const targetActor = makeActor("target");
    const source = {
      _id: "item",
      type: "gear",
      name: "Ration",
      system: { storageInstanceId: "ration", quantity: 3, equipped: false },
    };
    const item = makeItem(sourceActor, source);
    documents.set(item.uuid, item);
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(
          uuid === sourceActor.uuid
            ? sourceActor
            : uuid === targetActor.uuid
              ? targetActor
              : (documents.get(uuid) ?? null),
        ),
      ),
    );
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: targetActor.uuid,
      destinationDisposition: "stored",
      quantity: 1,
      reservedInstanceId: "split",
      reservedDocumentId: "created",
    });
    item.source = { ...item.source, name: "Concurrent source edit" };
    const receipt = await createGridStorageReceipt({
      request: {
        kind: "unpack",
        value: {
          version: 1,
          operationId: "partial-failure",
          baseRevision: 0,
          containerInstanceId: "container",
          destination: {
            rootUuid: sourceActor.uuid,
            spaceId: "inventory",
            containerInstanceId: null,
            spaceOwnerActorUuid: sourceActor.uuid,
          },
          witnesses: {},
        },
      },
      requesterUserId: "player",
      authorityUserId: "gm",
      planHash: "plan",
      beforeRevision: 0,
      writes: plan.writes,
    });
    let latest = receipt;
    const persist = (next: D6StorageTransactionReceiptV1) => {
      latest = next;
      return Promise.resolve(next);
    };
    await expect(
      applyGridStorageDocumentWrites(receipt, persist),
    ).rejects.toThrow(/WitnessMismatch/);
    expect(documents.has(`${targetActor.uuid}.Item.created`)).toBe(true);

    await expect(
      compensateGridStorageDocumentWrites(latest, persist),
    ).rejects.toThrow(/WitnessMismatch/);
    expect(documents.has(`${targetActor.uuid}.Item.created`)).toBe(false);
    expect(latest.state).toBe("needs-attention");
    expect(latest.writes.map(({ state }) => state)).toEqual([
      "compensated",
      "planned",
    ]);
  });
});
