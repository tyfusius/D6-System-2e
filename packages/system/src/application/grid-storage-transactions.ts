import {
  evaluateStorageMove,
  packStorageSpace,
  storageSpace,
  type D6StorageApprovalV1,
  type D6StorageAuthorityStateV1,
  type D6StorageDocumentImageV1,
  type D6StorageLedgerV1,
  type D6StorageLocationV1,
  type D6StorageOperationRequestV1,
  type D6StoragePackPreviewV1,
  type D6StorageReservedIdentityV1,
  type D6StorageSafeMoveResultV1,
  type D6StorageTransactionReceiptV1,
  type D6StorageWriteV1,
} from "@d6-system-2e/core";
import { canonical } from "./first-edition-action-validation.js";

const receiptTransitions: Readonly<
  Record<
    D6StorageTransactionReceiptV1["state"],
    readonly D6StorageTransactionReceiptV1["state"][]
  >
> = {
  "intent-recorded": [
    "approval-pending",
    "reserved",
    "ledger-applied",
    "completed",
    "compensated",
    "needs-attention",
  ],
  "approval-pending": [
    "reserved",
    "ledger-applied",
    "compensated",
    "needs-attention",
  ],
  reserved: ["documents-applied", "compensated", "needs-attention"],
  "documents-applied": ["ledger-applied", "compensated", "needs-attention"],
  "ledger-applied": ["completed", "needs-attention"],
  completed: [],
  compensated: [],
  "needs-attention": ["compensated", "completed"],
};

export async function storageHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createGridStorageReceipt(input: {
  readonly request: D6StorageOperationRequestV1;
  readonly requesterUserId: string;
  readonly authorityUserId: string;
  readonly planHash: string;
  readonly approvals?: readonly D6StorageApprovalV1[];
  readonly reservedIdentities?: readonly D6StorageReservedIdentityV1[];
  readonly writes?: readonly D6StorageWriteV1[];
  readonly beforeRevision: number;
  readonly beforeLocations?: Readonly<Record<string, D6StorageLocationV1>>;
  readonly afterLocations?: Readonly<Record<string, D6StorageLocationV1>>;
  readonly undoEligible?: boolean;
}): Promise<D6StorageTransactionReceiptV1> {
  const operationId = input.request.value.operationId;
  if (!operationId || input.request.value.baseRevision !== input.beforeRevision)
    throw new TypeError("D6E2.Storage.Error.InvalidIntent");
  return {
    version: 1,
    operationId,
    intentHash: await storageHash(input.request),
    request: structuredClone(input.request),
    planHash: input.planHash,
    requesterUserId: input.requesterUserId,
    authorityUserId: input.authorityUserId,
    state: input.approvals?.some(({ decision }) => decision === "pending")
      ? "approval-pending"
      : "intent-recorded",
    approvals: structuredClone(input.approvals ?? []),
    reservedIdentities: structuredClone(input.reservedIdentities ?? []),
    writes: structuredClone(input.writes ?? []),
    beforeRevision: input.beforeRevision,
    afterRevision: null,
    beforeLocations: structuredClone(input.beforeLocations ?? {}),
    afterLocations: structuredClone(input.afterLocations ?? {}),
    response: null,
    responseHash: null,
    undoEligible: input.undoEligible ?? false,
  };
}

export function recordGridStorageIntent(
  state: D6StorageAuthorityStateV1,
  receipt: D6StorageTransactionReceiptV1,
): D6StorageAuthorityStateV1 {
  const existing = state.receipts[receipt.operationId];
  if (existing) {
    if (
      existing.intentHash !== receipt.intentHash ||
      existing.requesterUserId !== receipt.requesterUserId
    )
      throw new Error("D6E2.Storage.Error.OperationReplay");
    return state;
  }
  if (receipt.beforeRevision !== state.ledger.revision)
    throw new Error("D6E2.Storage.Error.Stale");
  return {
    ...state,
    receipts: { ...state.receipts, [receipt.operationId]: receipt },
  };
}

export async function recordedGridStorageResponse(
  receipt: D6StorageTransactionReceiptV1,
  request: D6StorageOperationRequestV1,
  requesterUserId: string,
): Promise<D6StorageSafeMoveResultV1 | null> {
  if (
    receipt.requesterUserId !== requesterUserId ||
    receipt.intentHash !== (await storageHash(request))
  )
    throw new Error("D6E2.Storage.Error.OperationReplay");
  if (!receipt.response) return null;
  if (
    !receipt.responseHash ||
    receipt.responseHash !== (await storageHash(receipt.response))
  )
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  return structuredClone(receipt.response);
}

export async function advanceGridStorageReceipt(
  receipt: D6StorageTransactionReceiptV1,
  update: Partial<
    Pick<
      D6StorageTransactionReceiptV1,
      | "state"
      | "approvals"
      | "reservedIdentities"
      | "writes"
      | "afterRevision"
      | "response"
      | "undoEligible"
    >
  >,
): Promise<D6StorageTransactionReceiptV1> {
  const nextState = update.state ?? receipt.state;
  if (
    nextState !== receipt.state &&
    !receiptTransitions[receipt.state].includes(nextState)
  )
    throw new TypeError("D6E2.Storage.Error.InvalidReceiptTransition");
  const response = update.response ?? receipt.response;
  return {
    ...receipt,
    ...structuredClone(update),
    state: nextState,
    response,
    responseHash: response ? await storageHash(response) : null,
  };
}

function locationRoot(location: D6StorageLocationV1): string {
  return location.state === "unplaced"
    ? location.rootUuid
    : location.parent.rootUuid;
}

function sameParent(
  location: D6StorageLocationV1,
  parent: {
    readonly rootUuid: string;
    readonly spaceId: string;
    readonly containerInstanceId: string | null;
    readonly spaceOwnerActorUuid: string;
  },
): boolean {
  return (
    location.state !== "unplaced" &&
    location.parent.rootUuid === parent.rootUuid &&
    location.parent.spaceId === parent.spaceId &&
    location.parent.containerInstanceId === parent.containerInstanceId &&
    location.parent.spaceOwnerActorUuid === parent.spaceOwnerActorUuid
  );
}

export async function planGridStorageMove(
  ledger: D6StorageLedgerV1,
  request: Extract<
    D6StorageOperationRequestV1,
    { readonly kind: "move" }
  >["value"],
  reservedSplitInstanceId?: string,
): Promise<{
  readonly ledger: D6StorageLedgerV1;
  readonly beforeLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly afterLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly planHash: string;
}> {
  const evaluated = evaluateStorageMove(
    ledger,
    request,
    reservedSplitInstanceId,
  );
  if (!evaluated.allowed || !evaluated.resultingLedger)
    throw new Error(`D6E2.Storage.Error.${evaluated.issue ?? "Invalid"}`);
  const beforeLocations: Record<string, D6StorageLocationV1> = {};
  const afterLocations: Record<string, D6StorageLocationV1> = {};
  for (const [id, object] of Object.entries(
    evaluated.resultingLedger.objects,
  )) {
    const before = ledger.objects[id]?.location;
    if (!before || canonical(before) !== canonical(object.location)) {
      if (before) beforeLocations[id] = before;
      afterLocations[id] = object.location;
    }
  }
  const planHash = await storageHash({
    kind: "move",
    request,
    beforeLocations,
    afterLocations,
    revision: evaluated.resultingLedger.revision,
  });
  return {
    ledger: evaluated.resultingLedger,
    beforeLocations,
    afterLocations,
    planHash,
  };
}

export async function previewGridStoragePack(
  ledger: D6StorageLedgerV1,
  request: {
    readonly version: 1;
    readonly operationId: string;
    readonly baseRevision: number;
    readonly parent: Extract<
      D6StorageOperationRequestV1,
      { readonly kind: "auto-pack" }
    >["value"]["parent"];
    readonly maxSearchNodes: number;
    readonly witnesses: Readonly<Record<string, string>>;
  },
): Promise<D6StoragePackPreviewV1> {
  if (request.baseRevision !== ledger.revision)
    throw new Error("D6E2.Storage.Error.Stale");
  if (!storageSpace(ledger, request.parent))
    throw new Error("D6E2.Storage.Error.DestinationUnavailable");
  if (
    Object.entries(request.witnesses).some(
      ([id, witness]) => ledger.objects[id]?.witness !== witness,
    )
  )
    throw new Error("D6E2.Storage.Error.Stale");
  const ids = Object.values(ledger.objects)
    .filter(
      (object) =>
        locationRoot(object.location) === request.parent.rootUuid &&
        (object.location.state === "unplaced" ||
          sameParent(object.location, request.parent)),
    )
    .map(({ definition }) => definition.instanceId);
  const packed = packStorageSpace(
    ledger,
    request.parent,
    ids,
    request.maxSearchNodes,
  );
  const planHash = await storageHash({
    parent: request.parent,
    baseRevision: request.baseRevision,
    witnesses: request.witnesses,
    placements: packed.placements,
    eligibleInstanceIds: packed.eligibleInstanceIds,
    excludedInstanceIds: packed.excludedInstanceIds,
  });
  return {
    version: 1,
    operationId: request.operationId,
    baseRevision: request.baseRevision,
    ...packed,
    planHash,
  };
}

export function applyGridStoragePack(
  ledger: D6StorageLedgerV1,
  preview: D6StoragePackPreviewV1,
  request: Extract<
    D6StorageOperationRequestV1,
    { readonly kind: "auto-pack" }
  >["value"],
): {
  readonly ledger: D6StorageLedgerV1;
  readonly beforeLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly afterLocations: Readonly<Record<string, D6StorageLocationV1>>;
} {
  if (
    preview.outcome !== "packed" ||
    preview.operationId !== request.operationId ||
    preview.baseRevision !== ledger.revision ||
    preview.planHash !== request.planHash
  )
    throw new Error("D6E2.Storage.Error.Stale");
  if (
    Object.entries(request.witnesses).some(
      ([id, witness]) => ledger.objects[id]?.witness !== witness,
    )
  )
    throw new Error("D6E2.Storage.Error.Stale");
  const objects = { ...ledger.objects };
  const beforeLocations: Record<string, D6StorageLocationV1> = {};
  const afterLocations: Record<string, D6StorageLocationV1> = {};
  for (const [id, rectangle] of Object.entries(preview.placements)) {
    const object = objects[id];
    if (!object) throw new Error("D6E2.Storage.Error.Stale");
    const next: D6StorageLocationV1 = {
      state: "placed",
      parent: request.parent,
      rectangle,
      disposition: object.location.disposition,
      pinned:
        object.location.state === "placed" ? object.location.pinned : false,
    };
    if (canonical(next) === canonical(object.location)) continue;
    beforeLocations[id] = object.location;
    afterLocations[id] = next;
    objects[id] = { ...object, location: next };
  }
  return {
    ledger: { ...ledger, revision: ledger.revision + 1, objects },
    beforeLocations,
    afterLocations,
  };
}

export function undoGridStorageLocations(
  ledger: D6StorageLedgerV1,
  target: D6StorageTransactionReceiptV1,
): D6StorageLedgerV1 {
  if (!target.undoEligible || target.state !== "completed")
    throw new Error("D6E2.Storage.Error.UndoUnavailable");
  const objects = { ...ledger.objects };
  for (const [id, after] of Object.entries(target.afterLocations)) {
    const object = objects[id];
    if (!object || canonical(object.location) !== canonical(after))
      throw new Error("D6E2.Storage.Error.Stale");
    const before = target.beforeLocations[id];
    if (!before) throw new Error("D6E2.Storage.Error.InvalidReceipt");
    objects[id] = { ...object, location: before };
  }
  return { ...ledger, revision: ledger.revision + 1, objects };
}

export function unpackGridStorageContainer(
  ledger: D6StorageLedgerV1,
  containerInstanceId: string,
  destinationRootUuid: string,
): {
  readonly ledger: D6StorageLedgerV1;
  readonly beforeLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly afterLocations: Readonly<Record<string, D6StorageLocationV1>>;
} {
  const container = ledger.objects[containerInstanceId];
  if (!container?.definition.interior)
    throw new Error("D6E2.Storage.Error.InvalidContainer");
  const objects = { ...ledger.objects };
  const beforeLocations: Record<string, D6StorageLocationV1> = {};
  const afterLocations: Record<string, D6StorageLocationV1> = {};
  for (const [id, object] of Object.entries(objects)) {
    if (
      object.location.state === "unplaced" ||
      object.location.parent.containerInstanceId !== containerInstanceId
    )
      continue;
    const next: D6StorageLocationV1 = {
      state: "unplaced",
      rootUuid: destinationRootUuid,
      disposition: object.location.disposition,
    };
    beforeLocations[id] = object.location;
    afterLocations[id] = next;
    objects[id] = { ...object, location: next };
  }
  return {
    ledger: { ...ledger, revision: ledger.revision + 1, objects },
    beforeLocations,
    afterLocations,
  };
}

export function storageDocumentImage(
  documentUuid: string,
  parentActorUuid: string,
  source: Readonly<Record<string, unknown>>,
  witness: string,
): D6StorageDocumentImageV1 {
  return {
    documentUuid,
    parentActorUuid,
    source: structuredClone(source),
    witness,
  };
}
