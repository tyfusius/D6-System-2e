import type {
  D6StorageTransactionReceiptV1,
  D6StorageWriteV1,
} from "@d6-system-2e/core";
import { advanceGridStorageReceipt } from "../application/grid-storage-transactions.js";
import { gridStorageDocumentImageMatches } from "./grid-storage-document-adapter.js";
import { GRID_STORAGE_AUTHORITY_WRITE_OPTION } from "./grid-storage-mutation-guard.js";

const authorityWriteOptions = (): Record<string, unknown> => ({
  [GRID_STORAGE_AUTHORITY_WRITE_OPTION]: true,
});

async function deleteItem(
  parent: FoundryActorDocument,
  id: string,
): Promise<void> {
  await (
    parent as FoundryActorDocument & {
      deleteEmbeddedDocuments(
        documentName: "Item",
        ids: readonly string[],
        options: Record<string, unknown>,
      ): Promise<unknown>;
    }
  ).deleteEmbeddedDocuments("Item", [id], authorityWriteOptions());
}

async function actor(
  uuid: string,
): Promise<FoundryActorDocument & { readonly uuid: string }> {
  const document = (await fromUuid(uuid)) as
    (FoundryActorDocument & { readonly uuid?: string }) | null;
  if (!document?.uuid || document.uuid !== uuid)
    throw new Error("D6E2.Storage.Error.Deleted");
  return document as FoundryActorDocument & { readonly uuid: string };
}

async function item(uuid: string): Promise<
  | (FoundryItemDocument & {
      readonly uuid: string;
      readonly parent: FoundryActorDocument & { readonly uuid: string };
    })
  | null
> {
  const document = (await fromUuid(uuid)) as
    | (FoundryItemDocument & {
        readonly uuid?: string;
        readonly parent?: FoundryActorDocument & { readonly uuid?: string };
      })
    | null;
  return document?.uuid === uuid && document.parent?.uuid
    ? (document as FoundryItemDocument & {
        readonly uuid: string;
        readonly parent: FoundryActorDocument & { readonly uuid: string };
      })
    : null;
}

export async function gridStorageWriteAlreadyApplied(
  write: D6StorageWriteV1,
): Promise<boolean> {
  const current = await item(write.documentUuid);
  if (write.kind === "delete") return current === null;
  return current && write.after
    ? gridStorageDocumentImageMatches(
        structuredClone(current.toObject()),
        write.after,
      )
    : false;
}

export async function applyGridStorageDocumentWrite(
  write: D6StorageWriteV1,
): Promise<void> {
  if (await gridStorageWriteAlreadyApplied(write)) return;
  if (write.kind === "create") {
    if (!write.after) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    const parent = await actor(write.after.parentActorUuid);
    const current = await item(write.documentUuid);
    if (current) throw new Error("D6E2.Storage.Error.WitnessMismatch");
    await parent.createEmbeddedDocuments("Item", [write.after.source], {
      ...authorityWriteOptions(),
      keepId: true,
    });
    return;
  }
  if (!write.before) throw new Error("D6E2.Storage.Error.InvalidReceipt");
  const current = await item(write.documentUuid);
  if (
    !current ||
    !(await gridStorageDocumentImageMatches(
      structuredClone(current.toObject()),
      write.before,
    ))
  )
    throw new Error("D6E2.Storage.Error.WitnessMismatch");
  if (write.kind === "delete") {
    await deleteItem(current.parent, current.id);
    return;
  }
  if (!write.after) throw new Error("D6E2.Storage.Error.InvalidReceipt");
  await current.parent.updateEmbeddedDocuments("Item", [write.after.source], {
    ...authorityWriteOptions(),
    diff: false,
    recursive: false,
  });
}

export async function gridStorageWriteBeforeStatePresent(
  write: D6StorageWriteV1,
): Promise<boolean> {
  const current = await item(write.documentUuid);
  if (write.kind === "create") return current === null;
  return current && write.before
    ? gridStorageDocumentImageMatches(
        structuredClone(current.toObject()),
        write.before,
      )
    : false;
}

export async function compensateGridStorageDocumentWrite(
  write: D6StorageWriteV1,
): Promise<void> {
  if (await gridStorageWriteBeforeStatePresent(write)) return;
  if (!(await gridStorageWriteAlreadyApplied(write)))
    throw new Error("D6E2.Storage.Error.WitnessMismatch");
  if (write.kind === "create") {
    const current = await item(write.documentUuid);
    if (!current) throw new Error("D6E2.Storage.Error.WitnessMismatch");
    await deleteItem(current.parent, current.id);
  } else if (write.kind === "delete") {
    if (!write.before) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    const parent = await actor(write.before.parentActorUuid);
    await parent.createEmbeddedDocuments("Item", [write.before.source], {
      ...authorityWriteOptions(),
      keepId: true,
    });
  } else {
    if (!write.before) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    const current = await item(write.documentUuid);
    if (!current) throw new Error("D6E2.Storage.Error.WitnessMismatch");
    await current.parent.updateEmbeddedDocuments(
      "Item",
      [write.before.source],
      {
        ...authorityWriteOptions(),
        diff: false,
        recursive: false,
      },
    );
  }
  if (!(await gridStorageWriteBeforeStatePresent(write)))
    throw new Error("D6E2.Storage.Error.WitnessMismatch");
}

export async function compensateGridStorageDocumentWrites(
  receipt: D6StorageTransactionReceiptV1,
  persist: (
    value: D6StorageTransactionReceiptV1,
  ) => Promise<D6StorageTransactionReceiptV1>,
): Promise<D6StorageTransactionReceiptV1> {
  let current = receipt;
  let firstError: unknown;
  for (let index = current.writes.length - 1; index >= 0; index -= 1) {
    const write = current.writes[index];
    if (!write || write.state === "compensated") continue;
    try {
      await compensateGridStorageDocumentWrite(write);
      const writes = current.writes.map((candidate, sequence) =>
        sequence === index
          ? { ...candidate, state: "compensated" as const }
          : candidate,
      );
      current = await persist(
        await advanceGridStorageReceipt(current, { writes }),
      );
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError)
    throw firstError instanceof Error
      ? firstError
      : new Error("D6E2.Storage.Error.WitnessMismatch");
  return current;
}

export async function applyGridStorageDocumentWrites(
  receipt: D6StorageTransactionReceiptV1,
  persist: (
    value: D6StorageTransactionReceiptV1,
  ) => Promise<D6StorageTransactionReceiptV1>,
): Promise<D6StorageTransactionReceiptV1> {
  let current = receipt;
  if (current.writes.length === 0) return current;
  if (
    current.state === "intent-recorded" ||
    current.state === "approval-pending"
  )
    current = await persist(
      await advanceGridStorageReceipt(current, { state: "reserved" }),
    );
  for (let index = 0; index < current.writes.length; index += 1) {
    const write = current.writes[index];
    if (!write) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    if (write.state === "verified") continue;
    try {
      if (write.state === "planned") {
        await applyGridStorageDocumentWrite(write);
        const writes = current.writes.map((candidate, sequence) =>
          sequence === index
            ? { ...candidate, state: "applied" as const }
            : candidate,
        );
        current = await persist(
          await advanceGridStorageReceipt(current, { writes }),
        );
      }
      const refreshed = current.writes[index];
      if (!refreshed || !(await gridStorageWriteAlreadyApplied(refreshed)))
        throw new Error("D6E2.Storage.Error.WitnessMismatch");
      const writes = current.writes.map((candidate, sequence) =>
        sequence === index
          ? { ...candidate, state: "verified" as const }
          : candidate,
      );
      current = await persist(
        await advanceGridStorageReceipt(current, { writes }),
      );
    } catch (error) {
      current = await persist(
        await advanceGridStorageReceipt(current, { state: "needs-attention" }),
      );
      throw error;
    }
  }
  return persist(
    await advanceGridStorageReceipt(current, { state: "documents-applied" }),
  );
}
