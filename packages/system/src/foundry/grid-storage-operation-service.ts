import { validGridStorageAvailabilityBatchIds } from "../application/grid-storage-availability-batch";
import type {
  D6StorageApprovalV1,
  D6StorageAuthorityStateV1,
  D6StorageLedgerV1,
  D6StorageLocationV1,
  D6StorageMovePreviewV1,
  D6StorageMoveRequestV1,
  D6StorageObjectV1,
  D6StorageOperationRequestV1,
  D6StoragePackPreviewV1,
  D6StorageSafeMoveResultV1,
  D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";
import {
  evaluateStorageMove,
  effectiveStorageAvailability,
  validateStorageLedger,
} from "@d6-system-2e/core";
import {
  advanceGridStorageReceipt,
  applyGridStoragePack,
  createGridStorageReceipt,
  planGridStorageMove,
  previewGridStoragePack,
  recordedGridStorageResponse,
  recordGridStorageIntent,
  storageHash,
  undoGridStorageLocations,
  unpackGridStorageContainer,
} from "../application/grid-storage-transactions.js";
import {
  requestGridStorageApproval,
  setGridStorageAvailabilityProcessor,
  setGridStorageConfigurationProcessor,
  setGridStorageMovePreviewProcessor,
  setGridStoragePackPreviewProcessor,
  setGridStorageOperationProcessor,
  setGridStorageProjectionProcessor,
  type GridStorageClientProjection,
  type GridStorageConfigurationRequest,
  type GridStorageProjectionRequest,
} from "./grid-storage-authority.js";
import {
  GRID_STORAGE_ITEM_TYPES,
  gridStorageDocumentMatchesWitness,
  planGridStorageDocumentWrites,
  planGridStorageQuantityWrite,
} from "./grid-storage-document-adapter.js";
import {
  applyGridStorageDocumentWrites,
  compensateGridStorageDocumentWrites,
} from "./grid-storage-document-executor.js";
import {
  mutateGridStorageAuthorityState,
  readGridStorageAuthorityState,
  runGridStorageAuthorityEffect,
} from "./grid-storage-state.js";
import { destinyClientIsAuthority } from "./destiny-crypto.js";
import { foundryRandomId } from "./foundry-random-id.js";
import { requireGridStorageItemAction } from "./grid-storage-availability.js";
import {
  buildGridStorageWorkspace,
  gridStorageRootFullyVisible,
} from "./grid-storage-projection.js";
import {
  configureGridStorageItem,
  configureGridStorageWorldItem,
  setGridStorageItemCapability,
  configureGridStorageRoot,
  removeGridStorageRoot,
  recoverGridStorageConfigurations,
  saveGridStorageInterior,
  saveGridStorageSpace,
} from "./grid-storage-configuration-service.js";
import { reconcileGridStorageItemWitnesses } from "./grid-storage-mutation-guard.js";

const packPreviews = new Map<
  string,
  { readonly requesterUserId: string; readonly value: D6StoragePackPreviewV1 }
>();
const safe = (
  operationId: string,
  status: D6StorageSafeMoveResultV1["status"],
  issue?: D6StorageSafeMoveResultV1["issue"],
): D6StorageSafeMoveResultV1 => ({
  version: 1,
  operationId,
  status,
  ...(issue ? { issue } : {}),
  projectionToken: null,
});

function omitStorageObject(
  objects: Readonly<Record<string, D6StorageObjectV1>>,
  instanceId: string,
): Record<string, D6StorageObjectV1> {
  return Object.fromEntries(
    Object.entries(objects).filter(([key]) => key !== instanceId),
  );
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

function locationRoot(location: D6StorageLocationV1): string {
  return location.state === "unplaced"
    ? location.rootUuid
    : location.parent.rootUuid;
}

async function item(uuid: string) {
  const document = (await fromUuid(uuid)) as
    | (FoundryItemDocument & {
        readonly uuid?: string;
        readonly parent?: FoundryActorDocument & { readonly uuid?: string };
      })
    | null;
  if (!document?.uuid || document.uuid !== uuid || !document.parent?.uuid)
    throw new Error("D6E2.Storage.Error.Deleted");
  return document as FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  };
}

function controls(user: FoundryUser, document: FoundryActorDocument): boolean {
  return (
    user.active && (user.isGM || document.testUserPermission(user, "OWNER"))
  );
}

function observes(user: FoundryUser, document: FoundryActorDocument): boolean {
  const permissionDocument = document as unknown as {
    testUserPermission(user: FoundryUser, permission: string): boolean;
  };
  return (
    user.active &&
    (user.isGM || permissionDocument.testUserPermission(user, "OBSERVER"))
  );
}

function controller(document: FoundryActorDocument): FoundryUser | undefined {
  return (game.users?.contents ?? [])
    .filter(
      (user) =>
        user.active && !user.isGM && document.testUserPermission(user, "OWNER"),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

async function persistReceipt(
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageTransactionReceiptV1> {
  return mutateGridStorageAuthorityState(null, (state) => {
    const current = state.receipts[receipt.operationId];
    if (
      current?.intentHash !== receipt.intentHash ||
      current.requesterUserId !== receipt.requesterUserId
    )
      throw new Error("D6E2.Storage.Error.OperationReplay");
    return [
      {
        ...state,
        receipts: { ...state.receipts, [receipt.operationId]: receipt },
      },
      receipt,
    ];
  });
}

async function finishReceipt(
  receipt: D6StorageTransactionReceiptV1,
  response: D6StorageSafeMoveResultV1,
): Promise<D6StorageTransactionReceiptV1> {
  const next = await advanceGridStorageReceipt(receipt, {
    state: "completed",
    response,
  });
  return persistReceipt(next);
}

async function failReceipt(
  receipt: D6StorageTransactionReceiptV1,
  response: D6StorageSafeMoveResultV1,
): Promise<D6StorageTransactionReceiptV1> {
  const state =
    receipt.state === "needs-attention" &&
    !receipt.writes.every(
      ({ state: writeState }) => writeState === "compensated",
    )
      ? "needs-attention"
      : "compensated";
  return persistReceipt(
    await advanceGridStorageReceipt(receipt, { state, response }),
  );
}

async function compensatePendingWrites(
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageTransactionReceiptV1> {
  const latest = (await readGridStorageAuthorityState()).receipts[
    receipt.operationId
  ];
  if (!latest || latest.writes.length === 0) return latest ?? receipt;
  try {
    return await compensateGridStorageDocumentWrites(latest, persistReceipt);
  } catch {
    return (
      (await readGridStorageAuthorityState()).receipts[receipt.operationId] ??
      latest
    );
  }
}

async function requiredApprovals(
  requester: FoundryUser,
  boundaries: readonly {
    readonly actorUuid: string;
    readonly boundary: D6StorageApprovalV1["boundary"];
    readonly scope: D6StorageApprovalV1["scope"];
  }[],
): Promise<readonly D6StorageApprovalV1[]> {
  const result: D6StorageApprovalV1[] = [];
  const seen = new Set<string>();
  for (const boundary of boundaries) {
    const key = `${boundary.actorUuid}:${boundary.boundary}:${boundary.scope}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const document = await actor(boundary.actorUuid);
    if (controls(requester, document)) {
      result.push({
        userId: requester.id,
        actorUuid: boundary.actorUuid,
        boundary: boundary.boundary,
        scope: boundary.scope,
        decision: "approved",
        decidedAt: Date.now(),
      });
      continue;
    }
    const target = controller(document);
    if (!target) throw new Error("D6E2.Storage.Error.NoController");
    result.push({
      userId: target.id,
      actorUuid: boundary.actorUuid,
      boundary: boundary.boundary,
      scope: boundary.scope,
      decision: "pending",
      decidedAt: null,
    });
  }
  return result;
}

async function collectMoveApprovals(
  ledger: D6StorageLedgerV1,
  request: Extract<D6StorageOperationRequestV1, { kind: "move" }>["value"],
  requester: FoundryUser,
): Promise<readonly D6StorageApprovalV1[]> {
  const object = ledger.objects[request.instanceId];
  if (!object) throw new Error("D6E2.Storage.Error.Deleted");
  const sourceActorUuid =
    object.location.state === "unplaced"
      ? object.location.rootUuid
      : object.location.parent.spaceOwnerActorUuid;
  const boundaries: {
    actorUuid: string;
    boundary: D6StorageApprovalV1["boundary"];
    scope: D6StorageApprovalV1["scope"];
  }[] = [
    {
      actorUuid: sourceActorUuid,
      boundary: "source-location",
      scope: "object-only",
    },
  ];
  if (object.ownerActorUuid !== sourceActorUuid)
    boundaries.push({
      actorUuid: object.ownerActorUuid,
      boundary: "ownership",
      scope: "object-only",
    });
  if (request.destination)
    boundaries.push({
      actorUuid: request.destination.spaceOwnerActorUuid,
      boundary: "destination-location",
      scope: "object-only",
    });
  if (request.ownershipTransfer.mode === "transfer") {
    const owners = new Set<string>([object.ownerActorUuid]);
    if (request.ownershipTransfer.scope === "subtree") {
      const descendants = [request.instanceId];
      while (descendants.length > 0) {
        const parentId = descendants.shift();
        for (const candidate of Object.values(ledger.objects))
          if (
            candidate.location.state !== "unplaced" &&
            candidate.location.parent.containerInstanceId === parentId
          ) {
            descendants.push(candidate.definition.instanceId);
            owners.add(candidate.ownerActorUuid);
          }
      }
    }
    for (const ownerActorUuid of owners)
      boundaries.push({
        actorUuid: ownerActorUuid,
        boundary: "ownership",
        scope: request.ownershipTransfer.scope,
      });
    if (request.ownershipTransfer.targetOwnerActorUuid)
      boundaries.push({
        actorUuid: request.ownershipTransfer.targetOwnerActorUuid,
        boundary: "ownership",
        scope: request.ownershipTransfer.scope,
      });
  }
  return requiredApprovals(requester, boundaries);
}

async function revalidateReceiptApprovals(
  receipt: D6StorageTransactionReceiptV1,
): Promise<void> {
  if (receipt.request.kind === "quantity") {
    const requester = game.users?.get(receipt.requesterUserId);
    if (!requester?.active) throw new Error("D6E2.Storage.Error.Authority");
    const state = await readGridStorageAuthorityState();
    const value = receipt.request.value;
    const source = state.ledger.objects[value.instanceId];
    if (!source) throw new Error("D6E2.Storage.Error.Deleted");
    const actingActor = await actor(value.actingActorUuid);
    const sourceItem = await item(source.documentUuid);
    if (
      !controls(requester, actingActor) ||
      !controls(requester, sourceItem.parent)
    )
      throw new Error("D6E2.Storage.Error.Authority");
    await requireCurrentSourceItem(source, sourceItem);
    if (
      value.targetQuantity < source.quantity &&
      !effectiveStorageAvailability(
        state.ledger,
        value.instanceId,
        actingActor.uuid,
      ).canUse
    )
      throw new Error("D6E2.Storage.Error.DestinationUnavailable");
    return;
  }
  if (receipt.request.kind !== "move") return;
  const state = await readGridStorageAuthorityState();
  const source = state.ledger.objects[receipt.request.value.instanceId];
  if (!source) throw new Error("D6E2.Storage.Error.Deleted");
  const sourceActorUuid =
    source.location.state === "unplaced"
      ? source.location.rootUuid
      : source.location.parent.spaceOwnerActorUuid;
  const required: {
    readonly actorUuid: string;
    readonly boundary: D6StorageApprovalV1["boundary"];
    readonly scope: D6StorageApprovalV1["scope"];
  }[] = [
    {
      actorUuid: sourceActorUuid,
      boundary: "source-location" as const,
      scope: "object-only" as const,
    },
    ...(source.ownerActorUuid === sourceActorUuid
      ? []
      : [
          {
            actorUuid: source.ownerActorUuid,
            boundary: "ownership" as const,
            scope: "object-only" as const,
          },
        ]),
    ...(receipt.request.value.destination === null
      ? []
      : [
          {
            actorUuid: receipt.request.value.destination.spaceOwnerActorUuid,
            boundary: "destination-location" as const,
            scope: "object-only" as const,
          },
        ]),
  ];
  if (receipt.request.value.ownershipTransfer.mode === "transfer") {
    const owners = new Set<string>([source.ownerActorUuid]);
    if (receipt.request.value.ownershipTransfer.scope === "subtree") {
      const descendants = [source.definition.instanceId];
      while (descendants.length > 0) {
        const parentId = descendants.shift();
        for (const candidate of Object.values(state.ledger.objects))
          if (
            candidate.location.state !== "unplaced" &&
            candidate.location.parent.containerInstanceId === parentId
          ) {
            descendants.push(candidate.definition.instanceId);
            owners.add(candidate.ownerActorUuid);
          }
      }
    }
    const target = receipt.request.value.ownershipTransfer.targetOwnerActorUuid;
    if (target) owners.add(target);
    for (const actorUuid of owners)
      required.push({
        actorUuid,
        boundary: "ownership",
        scope: receipt.request.value.ownershipTransfer.scope,
      });
  }
  for (const boundary of required) {
    const approval = receipt.approvals.find(
      (candidate) =>
        candidate.actorUuid === boundary.actorUuid &&
        candidate.boundary === boundary.boundary &&
        candidate.scope === boundary.scope,
    );
    if (approval?.decision !== "approved")
      throw new Error("D6E2.Storage.Error.Authority");
    const user = game.users?.get(approval.userId);
    const document = await actor(approval.actorUuid);
    if (!user || !controls(user, document))
      throw new Error("D6E2.Storage.Error.Authority");
  }
}

async function requireReceiptReadAccess(
  receipt: D6StorageTransactionReceiptV1,
  requester: FoundryUser,
  ledger: D6StorageLedgerV1,
): Promise<void> {
  const actorUuids = new Set<string>();
  const addLocation = (location: D6StorageLocationV1): void => {
    if (location.state === "unplaced") actorUuids.add(location.rootUuid);
    else {
      actorUuids.add(location.parent.rootUuid);
      actorUuids.add(location.parent.spaceOwnerActorUuid);
    }
  };
  for (const location of Object.values(receipt.beforeLocations))
    addLocation(location);
  for (const location of Object.values(receipt.afterLocations))
    addLocation(location);
  for (const approval of receipt.approvals) actorUuids.add(approval.actorUuid);
  for (const write of receipt.writes) {
    if (write.before) actorUuids.add(write.before.parentActorUuid);
    if (write.after) actorUuids.add(write.after.parentActorUuid);
  }
  if (receipt.request.kind === "move") {
    const current = ledger.objects[receipt.request.value.instanceId];
    if (current) {
      actorUuids.add(current.ownerActorUuid);
      addLocation(current.location);
    }
  }
  for (const actorUuid of actorUuids)
    if (!observes(requester, await actor(actorUuid)))
      throw new Error("D6E2.Storage.Error.Authority");
}

async function obtainApprovals(
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageTransactionReceiptV1> {
  let current = receipt;
  for (const [index, approval] of current.approvals.entries()) {
    if (approval.decision !== "pending") continue;
    const approved = await requestGridStorageApproval({
      operationId: current.operationId,
      intentHash: current.intentHash,
      planHash: current.planHash,
      actorUuid: approval.actorUuid,
      boundary: approval.boundary,
      scope: approval.scope,
      targetUserId: approval.userId,
    });
    const approvals = current.approvals.map((candidate, position) =>
      position === index
        ? {
            ...candidate,
            decision: approved ? ("approved" as const) : ("rejected" as const),
            decidedAt: Date.now(),
          }
        : candidate,
    );
    current = await persistReceipt(
      await advanceGridStorageReceipt(current, { approvals }),
    );
    if (!approved) throw new Error("D6E2.Storage.Error.Cancelled");
    const user = game.users?.get(approval.userId);
    const document = await actor(approval.actorUuid);
    if (!user || !controls(user, document))
      throw new Error("D6E2.Storage.Error.Authority");
  }
  return current;
}

async function recordIntent(
  state: D6StorageAuthorityStateV1,
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageTransactionReceiptV1> {
  return mutateGridStorageAuthorityState(receipt.beforeRevision, (current) => {
    if (current.ledger.revision !== state.ledger.revision)
      throw new Error("D6E2.Storage.Error.Stale");
    return [recordGridStorageIntent(current, receipt), receipt];
  });
}

async function commitLedger(
  receipt: D6StorageTransactionReceiptV1,
  ledger: D6StorageLedgerV1,
): Promise<D6StorageTransactionReceiptV1> {
  return mutateGridStorageAuthorityState(
    receipt.beforeRevision,
    async (state) => {
      const durable = state.receipts[receipt.operationId];
      if (durable?.intentHash !== receipt.intentHash)
        throw new Error("D6E2.Storage.Error.InvalidReceipt");
      const applied = await advanceGridStorageReceipt(receipt, {
        state: "ledger-applied",
        afterRevision: ledger.revision,
      });
      return [
        {
          ...state,
          ledger,
          receipts: { ...state.receipts, [receipt.operationId]: applied },
        },
        applied,
      ];
    },
  );
}

async function requireCurrentSourceItem(
  source: D6StorageLedgerV1["objects"][string],
  sourceItem: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
): Promise<void> {
  const system = sourceItem.system;
  const rawQuantity = system.quantity;
  if (!Number.isSafeInteger(rawQuantity) || Number(rawQuantity) <= 0)
    throw new Error("D6E2.Storage.Error.Stale");
  const quantity = Number(rawQuantity);
  if (
    sourceItem.uuid !== source.documentUuid ||
    sourceItem.parent.uuid !== source.ownerActorUuid ||
    system.storageInstanceId !== source.definition.instanceId ||
    quantity !== source.quantity ||
    !(await gridStorageDocumentMatchesWitness(
      structuredClone(sourceItem.toObject()),
      source.witness,
    ))
  )
    throw new Error("D6E2.Storage.Error.Stale");
}

function sameParent(
  left: Exclude<D6StorageLocationV1, { readonly state: "unplaced" }>["parent"],
  right: Exclude<D6StorageLocationV1, { readonly state: "unplaced" }>["parent"],
): boolean {
  return (
    left.rootUuid === right.rootUuid &&
    left.spaceId === right.spaceId &&
    left.containerInstanceId === right.containerInstanceId &&
    left.spaceOwnerActorUuid === right.spaceOwnerActorUuid
  );
}

function pinOnlyMove(
  source: D6StorageLedgerV1["objects"][string],
  request: Extract<D6StorageOperationRequestV1, { kind: "move" }>["value"],
): boolean {
  if (
    source.location.state === "unplaced" ||
    request.destination === null ||
    request.quantity !== "all" ||
    request.disposition !== source.location.disposition ||
    request.pinned === source.location.pinned ||
    request.ownershipTransfer.mode !== "preserve" ||
    !sameParent(source.location.parent, request.destination)
  )
    return false;
  if (source.location.state === "listed") return request.rectangle === null;
  const left = source.location.rectangle;
  const right = request.rectangle;
  return (
    right !== null &&
    left.x === right.x &&
    left.y === right.y &&
    left.columns === right.columns &&
    left.rows === right.rows &&
    left.rotation === right.rotation
  );
}

async function requireDestinationlessSource(
  source: D6StorageLedgerV1["objects"][string],
  sourceItem: FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  },
  desiredDisposition: "carried" | "equipped" | "installed" | "stored",
): Promise<void> {
  if (
    !GRID_STORAGE_ITEM_TYPES.includes(
      sourceItem.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
    ) ||
    source.location.state !== "unplaced" ||
    source.location.disposition === "installed" ||
    sourceItem.system.installed === true
  )
    throw new Error("D6E2.Storage.Error.DestinationUnavailable");
  if (
    source.location.disposition === "equipped" &&
    desiredDisposition === "carried"
  )
    return;
  await requireGridStorageItemAction(
    sourceItem,
    source.ownerActorUuid,
    "equip",
  );
}

async function processMove(
  request: Extract<D6StorageOperationRequestV1, { kind: "move" }>,
  requester: FoundryUser,
  state: D6StorageAuthorityStateV1,
): Promise<D6StorageSafeMoveResultV1> {
  const source = state.ledger.objects[request.value.instanceId];
  if (!source)
    return safe(request.value.operationId, "denied", "destination-unavailable");
  const sourceItem = await item(source.documentUuid);
  await requireCurrentSourceItem(source, sourceItem);
  if (request.value.destination === null)
    await requireDestinationlessSource(
      source,
      sourceItem,
      request.value.disposition,
    );
  const quantity =
    request.value.quantity === "all" ? source.quantity : request.value.quantity;
  const transferTarget =
    request.value.ownershipTransfer.mode === "transfer"
      ? request.value.ownershipTransfer.targetOwnerActorUuid
      : null;
  if (request.value.ownershipTransfer.mode === "transfer" && !transferTarget)
    throw new Error("D6E2.Storage.Error.InvalidIntent");
  const destinationOwnerActorUuid = transferTarget ?? source.ownerActorUuid;
  const destinationRootUuid =
    request.value.destination?.rootUuid ?? locationRoot(source.location);
  if (
    request.value.disposition === "equipped" &&
    source.location.disposition !== "equipped" &&
    destinationRootUuid !== destinationOwnerActorUuid
  )
    throw new Error("D6E2.Storage.Error.DestinationUnavailable");
  const destinationActorUuid = transferTarget ?? sourceItem.parent.uuid;
  const partial = quantity !== source.quantity;
  const documentPlan = await planGridStorageDocumentWrites({
    item: sourceItem,
    destinationActorUuid,
    destinationDisposition: request.value.disposition,
    quantity,
    ...(partial ? { reservedInstanceId: foundryRandomId() } : {}),
    ...(destinationActorUuid !== sourceItem.parent.uuid || partial
      ? { reservedDocumentId: foundryRandomId(16) }
      : {}),
  });
  const plan = await planGridStorageMove(
    state.ledger,
    request.value,
    documentPlan.movedInstanceId,
  );
  const pinOnly = pinOnlyMove(source, request.value);
  const stableDocumentIdentity =
    documentPlan.reservedIdentities.length === 0 &&
    documentPlan.movedInstanceId === source.definition.instanceId &&
    documentPlan.movedDocumentUuid === source.documentUuid &&
    documentPlan.writes.every(
      ({ kind, documentUuid }) =>
        kind === "update" && documentUuid === source.documentUuid,
    );
  if (
    (pinOnly && (documentPlan.writes.length > 0 || !stableDocumentIdentity)) ||
    (request.value.destination === null &&
      (documentPlan.writes.length > 1 || !stableDocumentIdentity))
  )
    throw new Error("D6E2.Storage.Error.InvalidIntent");
  const objects = { ...plan.ledger.objects };
  const moved = objects[documentPlan.movedInstanceId];
  const createdWrite = documentPlan.writes.find(
    ({ kind }) => kind === "create",
  );
  const sourceUpdate = documentPlan.writes.find(
    ({ kind, documentUuid }) =>
      kind === "update" && documentUuid === source.documentUuid,
  );
  if (moved)
    objects[documentPlan.movedInstanceId] = {
      ...moved,
      documentUuid: documentPlan.movedDocumentUuid,
      witness:
        createdWrite?.after?.witness ??
        sourceUpdate?.after?.witness ??
        source.witness,
    };
  const remainingObject = objects[source.definition.instanceId];
  if (partial && sourceUpdate?.after && remainingObject)
    objects[source.definition.instanceId] = {
      ...remainingObject,
      witness: sourceUpdate.after.witness,
    };
  const nextLedger = { ...plan.ledger, objects };
  const approvals = await collectMoveApprovals(
    state.ledger,
    request.value,
    requester,
  );
  const planHash = await storageHash({
    request,
    ledgerRevision: nextLedger.revision,
    beforeLocations: plan.beforeLocations,
    afterLocations: plan.afterLocations,
    reservedIdentities: documentPlan.reservedIdentities,
    writes: documentPlan.writes,
  });
  let receipt = await createGridStorageReceipt({
    request,
    requesterUserId: requester.id,
    authorityUserId: game.user?.id ?? "",
    planHash,
    approvals,
    reservedIdentities: documentPlan.reservedIdentities,
    writes: documentPlan.writes,
    beforeRevision: state.ledger.revision,
    beforeLocations: plan.beforeLocations,
    afterLocations: plan.afterLocations,
    undoEligible:
      documentPlan.writes.length === 0 &&
      request.value.ownershipTransfer.mode === "preserve",
  });
  receipt = await recordIntent(state, receipt);
  try {
    receipt = await obtainApprovals(receipt);
    await revalidateReceiptApprovals(receipt);
    const fresh = await readGridStorageAuthorityState();
    if (fresh.ledger.revision !== receipt.beforeRevision)
      throw new Error("D6E2.Storage.Error.Stale");
    await requireCurrentSourceItem(source, await item(source.documentUuid));
    if (request.value.destination === null)
      await requireDestinationlessSource(
        source,
        await item(source.documentUuid),
        request.value.disposition,
      );
    if (receipt.writes.length)
      receipt = await applyGridStorageDocumentWrites(receipt, persistReceipt);
    receipt = await commitLedger(receipt, nextLedger);
    const response = safe(receipt.operationId, "completed");
    await finishReceipt(receipt, response);
    return response;
  } catch (error) {
    receipt = await compensatePendingWrites(receipt);
    const needsAttention =
      receipt.state === "needs-attention" &&
      !receipt.writes.every(
        ({ state: writeState }) => writeState === "compensated",
      );
    const response = safe(
      receipt.operationId,
      needsAttention ? "uncertain" : "denied",
      error instanceof Error && error.message.includes("Stale")
        ? "stale"
        : error instanceof Error && error.message.includes("Authority")
          ? "authority"
          : "cancelled",
    );
    await failReceipt(receipt, response);
    return response;
  }
}

async function processQuantity(
  request: Extract<D6StorageOperationRequestV1, { kind: "quantity" }>,
  requester: FoundryUser,
  state: D6StorageAuthorityStateV1,
): Promise<D6StorageSafeMoveResultV1> {
  const value = request.value;
  if (
    value.baseRevision !== state.ledger.revision ||
    !value.instanceId ||
    !value.actingActorUuid ||
    !Number.isSafeInteger(value.targetQuantity) ||
    value.targetQuantity < 0
  )
    return safe(value.operationId, "denied", "stale");
  const source = state.ledger.objects[value.instanceId];
  if (
    !source ||
    Object.keys(value.witnesses).length !== 1 ||
    value.witnesses[value.instanceId] !== source.witness
  )
    return safe(value.operationId, "denied", "stale");
  const actingActor = await actor(value.actingActorUuid);
  const sourceItem = await item(source.documentUuid);
  if (
    !controls(requester, actingActor) ||
    !controls(requester, sourceItem.parent)
  )
    return safe(value.operationId, "denied", "authority");
  await requireCurrentSourceItem(source, sourceItem);
  if (value.targetQuantity < source.quantity) {
    const availability = effectiveStorageAvailability(
      state.ledger,
      value.instanceId,
      actingActor.uuid,
    );
    if (!availability.canUse)
      return safe(value.operationId, "denied", "destination-unavailable");
  }
  if (value.targetQuantity === source.quantity)
    return safe(value.operationId, "completed");
  if (
    value.targetQuantity > source.quantity &&
    value.targetQuantity >
      source.definition.physical.stack.maxQuantityPerPlacement
  )
    return safe(value.operationId, "denied", "destination-unavailable");

  const write = await planGridStorageQuantityWrite(
    sourceItem,
    value.targetQuantity,
    source.location.disposition,
  );
  const objects =
    value.targetQuantity === 0
      ? omitStorageObject(state.ledger.objects, value.instanceId)
      : { ...state.ledger.objects };
  if (value.targetQuantity !== 0)
    objects[value.instanceId] = {
      ...source,
      quantity: value.targetQuantity,
      witness: write.after?.witness ?? source.witness,
    };
  const nextLedger = {
    ...state.ledger,
    revision: state.ledger.revision + 1,
    objects,
  };
  if (!validateStorageLedger(nextLedger).valid)
    return safe(value.operationId, "denied", "destination-unavailable");
  const planHash = await storageHash({
    request,
    ledgerRevision: nextLedger.revision,
    writes: [write],
    resultingObject: objects[value.instanceId] ?? null,
  });
  let receipt = await createGridStorageReceipt({
    request,
    requesterUserId: requester.id,
    authorityUserId: game.user?.id ?? "",
    planHash,
    writes: [write],
    beforeRevision: state.ledger.revision,
    beforeLocations: {},
    afterLocations: {},
    undoEligible: false,
  });
  receipt = await recordIntent(state, receipt);
  try {
    const fresh = await readGridStorageAuthorityState();
    if (fresh.ledger.revision !== receipt.beforeRevision)
      throw new Error("D6E2.Storage.Error.Stale");
    await revalidateReceiptApprovals(receipt);
    receipt = await applyGridStorageDocumentWrites(receipt, persistReceipt);
    receipt = await commitLedger(receipt, nextLedger);
    const response = safe(receipt.operationId, "completed");
    await finishReceipt(receipt, response);
    return response;
  } catch (error) {
    receipt = await compensatePendingWrites(receipt);
    const needsAttention =
      receipt.state === "needs-attention" &&
      !receipt.writes.every(
        ({ state: writeState }) => writeState === "compensated",
      );
    const response = safe(
      receipt.operationId,
      needsAttention ? "uncertain" : "denied",
      error instanceof Error && error.message.includes("Stale")
        ? "stale"
        : error instanceof Error && error.message.includes("Authority")
          ? "authority"
          : "cancelled",
    );
    await failReceipt(receipt, response);
    return response;
  }
}

async function recoveredMoveLedger(
  ledger: D6StorageLedgerV1,
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageLedgerV1> {
  if (receipt.request.kind !== "move")
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  const source = ledger.objects[receipt.request.value.instanceId];
  if (!source) throw new Error("D6E2.Storage.Error.Deleted");
  const movedInstanceId =
    receipt.reservedIdentities[0]?.instanceId ?? source.definition.instanceId;
  const plan = await planGridStorageMove(
    ledger,
    receipt.request.value,
    movedInstanceId,
  );
  const objects = { ...plan.ledger.objects };
  const moved = objects[movedInstanceId];
  const movedDocumentUuid =
    receipt.reservedIdentities[0]?.documentUuid ?? source.documentUuid;
  const createdWrite = receipt.writes.find(({ kind }) => kind === "create");
  const sourceUpdate = receipt.writes.find(
    ({ kind, documentUuid }) =>
      kind === "update" && documentUuid === source.documentUuid,
  );
  if (moved)
    objects[movedInstanceId] = {
      ...moved,
      documentUuid: movedDocumentUuid,
      witness:
        createdWrite?.after?.witness ??
        sourceUpdate?.after?.witness ??
        source.witness,
    };
  const remaining = objects[source.definition.instanceId];
  if (
    movedInstanceId !== source.definition.instanceId &&
    sourceUpdate?.after &&
    remaining
  )
    objects[source.definition.instanceId] = {
      ...remaining,
      witness: sourceUpdate.after.witness,
    };
  const next = { ...plan.ledger, objects };
  const planHash = await storageHash({
    request: receipt.request,
    ledgerRevision: next.revision,
    beforeLocations: plan.beforeLocations,
    afterLocations: plan.afterLocations,
    reservedIdentities: receipt.reservedIdentities,
    writes: receipt.writes.map((write) => ({ ...write, state: "planned" })),
  });
  if (planHash !== receipt.planHash)
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  return next;
}

async function recoveredLocationLedger(
  ledger: D6StorageLedgerV1,
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageLedgerV1> {
  const objects = { ...ledger.objects };
  for (const [instanceId, before] of Object.entries(receipt.beforeLocations)) {
    const object = objects[instanceId];
    if (
      !object ||
      (await storageHash(object.location)) !== (await storageHash(before))
    )
      throw new Error("D6E2.Storage.Error.WitnessMismatch");
  }
  for (const [instanceId, location] of Object.entries(receipt.afterLocations)) {
    const object = objects[instanceId];
    if (!object) throw new Error("D6E2.Storage.Error.Deleted");
    objects[instanceId] = { ...object, location };
  }
  const next = { ...ledger, revision: ledger.revision + 1, objects };
  const planHash = await storageHash({
    request: receipt.request,
    beforeLocations: receipt.beforeLocations,
    afterLocations: receipt.afterLocations,
    revision: next.revision,
  });
  if (planHash !== receipt.planHash)
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  return next;
}

async function recoveredQuantityLedger(
  ledger: D6StorageLedgerV1,
  receipt: D6StorageTransactionReceiptV1,
): Promise<D6StorageLedgerV1> {
  if (receipt.request.kind !== "quantity")
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  const source = ledger.objects[receipt.request.value.instanceId];
  const write = receipt.writes[0];
  if (!source || !write?.after)
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  const objects =
    receipt.request.value.targetQuantity === 0
      ? omitStorageObject(ledger.objects, receipt.request.value.instanceId)
      : { ...ledger.objects };
  if (receipt.request.value.targetQuantity !== 0)
    objects[receipt.request.value.instanceId] = {
      ...source,
      quantity: receipt.request.value.targetQuantity,
      witness: write.after.witness,
    };
  const next = { ...ledger, revision: ledger.revision + 1, objects };
  const planHash = await storageHash({
    request: receipt.request,
    ledgerRevision: next.revision,
    writes: receipt.writes.map((candidate) => ({
      ...candidate,
      state: "planned",
    })),
    resultingObject: objects[receipt.request.value.instanceId] ?? null,
  });
  if (planHash !== receipt.planHash)
    throw new Error("D6E2.Storage.Error.InvalidReceipt");
  return next;
}

async function recoverGridStorageReceipt(
  receipt: D6StorageTransactionReceiptV1,
): Promise<void> {
  if (
    receipt.state === "completed" ||
    receipt.state === "compensated" ||
    receipt.state === "needs-attention"
  )
    return;
  if (receipt.state === "ledger-applied") {
    await finishReceipt(receipt, safe(receipt.operationId, "completed"));
    return;
  }
  const state = await readGridStorageAuthorityState();
  if (state.ledger.revision !== receipt.beforeRevision)
    throw new Error("D6E2.Storage.Error.WitnessMismatch");
  const requester = game.users?.get(receipt.requesterUserId);
  if (!requester?.active) throw new Error("D6E2.Storage.Error.Authority");
  let current = await obtainApprovals(receipt);
  await revalidateReceiptApprovals(current);
  const fresh = await readGridStorageAuthorityState();
  if (fresh.ledger.revision !== receipt.beforeRevision)
    throw new Error("D6E2.Storage.Error.WitnessMismatch");
  if (receipt.request.kind === "move") {
    const source = fresh.ledger.objects[receipt.request.value.instanceId];
    if (!source) throw new Error("D6E2.Storage.Error.Deleted");
    const sourceItem = await item(source.documentUuid);
    await requireCurrentSourceItem(source, sourceItem);
    if (receipt.request.value.destination === null)
      await requireDestinationlessSource(
        source,
        sourceItem,
        receipt.request.value.disposition,
      );
  }
  const nextLedger =
    receipt.request.kind === "move"
      ? await recoveredMoveLedger(fresh.ledger, receipt)
      : receipt.request.kind === "quantity"
        ? await recoveredQuantityLedger(fresh.ledger, receipt)
        : await recoveredLocationLedger(fresh.ledger, receipt);
  if (current.writes.length)
    current = await applyGridStorageDocumentWrites(current, persistReceipt);
  current = await commitLedger(current, nextLedger);
  await finishReceipt(current, safe(current.operationId, "completed"));
}

async function recoverGridStorageOperationsOnce(): Promise<void> {
  if (!destinyClientIsAuthority() || !game.user?.isGM) return;
  const state = await readGridStorageAuthorityState();
  for (const receipt of Object.values(state.receipts).sort((left, right) =>
    left.operationId.localeCompare(right.operationId),
  )) {
    try {
      await recoverGridStorageReceipt(receipt);
    } catch (error) {
      let latest = (await readGridStorageAuthorityState()).receipts[
        receipt.operationId
      ];
      if (
        !latest ||
        latest.state === "completed" ||
        latest.state === "compensated"
      )
        continue;
      latest = await compensatePendingWrites(latest);
      const uncertain =
        latest.state === "needs-attention" &&
        !latest.writes.every(
          ({ state: writeState }) => writeState === "compensated",
        );
      await failReceipt(
        latest,
        safe(
          latest.operationId,
          uncertain ? "uncertain" : "denied",
          uncertain
            ? undefined
            : error instanceof Error && error.message.includes("Authority")
              ? "authority"
              : "cancelled",
        ),
      );
      console.error(
        `${latest.operationId}: grid storage recovery failed`,
        error,
      );
    }
  }
}

let recoveryRun: Promise<void> | null = null;
export function recoverGridStorageOperations(): Promise<void> {
  if (recoveryRun) return recoveryRun;
  recoveryRun = recoverGridStorageConfigurations()
    .then(() => recoverGridStorageOperationsOnce())
    .then(() => reconcileGridStorageItemWitnesses())
    .finally(() => {
      recoveryRun = null;
    });
  return recoveryRun;
}

export async function previewGridStorageAutoPack(
  request: {
    readonly version: 1;
    readonly operationId: string;
    readonly baseRevision: number;
    readonly parent: Extract<
      D6StorageOperationRequestV1,
      { kind: "auto-pack" }
    >["value"]["parent"];
    readonly maxSearchNodes: number;
    readonly witnesses: Readonly<Record<string, string>>;
  },
  requester: FoundryUser,
): Promise<D6StoragePackPreviewV1> {
  if (!destinyClientIsAuthority())
    throw new Error("D6E2.Storage.Error.Authority");
  const destination = await actor(request.parent.spaceOwnerActorUuid);
  if (!controls(requester, destination))
    throw new Error("D6E2.Storage.Error.Authority");
  const state = await readGridStorageAuthorityState();
  const rootObjects = Object.values(state.ledger.objects).filter(
    (object) => locationRoot(object.location) === request.parent.rootUuid,
  );
  if (
    !(await gridStorageRootFullyVisible(
      state.ledger,
      request.parent.rootUuid,
      requester,
    ))
  )
    throw new Error("D6E2.Storage.Error.Authority");
  if (
    Object.keys(request.witnesses).length !== rootObjects.length ||
    rootObjects.some(
      (object) =>
        request.witnesses[object.definition.instanceId] !== object.witness,
    )
  )
    throw new Error("D6E2.Storage.Error.Stale");
  const preview = await previewGridStoragePack(state.ledger, request);
  packPreviews.set(request.operationId, {
    requesterUserId: requester.id,
    value: preview,
  });
  return preview;
}

export async function previewGridStorageMove(
  request: D6StorageMoveRequestV1,
  requester: FoundryUser,
): Promise<D6StorageMovePreviewV1> {
  if (!destinyClientIsAuthority() || !game.user?.isGM)
    throw new Error("D6E2.Storage.Error.Authority");
  const state = await readGridStorageAuthorityState();
  const source = state.ledger.objects[request.instanceId];
  if (
    !request.operationId ||
    !source ||
    Object.keys(request.witnesses).length !== 1 ||
    request.witnesses[request.instanceId] !== source.witness
  )
    throw new Error("D6E2.Storage.Error.Authority");
  const relevantRoots = new Set<string>([locationRoot(source.location)]);
  if (request.destination) relevantRoots.add(request.destination.rootUuid);
  for (const rootUuid of relevantRoots) {
    if (
      !state.ledger.roots[rootUuid] ||
      !(await gridStorageRootFullyVisible(state.ledger, rootUuid, requester))
    )
      throw new Error("D6E2.Storage.Error.Authority");
  }
  const evaluated = evaluateStorageMove(state.ledger, request);
  const planHash = await storageHash({
    kind: "move-preview",
    request,
    allowed: evaluated.allowed,
    issue: evaluated.issue ?? null,
    capacity: evaluated.capacity,
    resultingRevision: evaluated.resultingLedger?.revision ?? null,
  });
  return {
    version: 1,
    operationId: request.operationId,
    baseRevision: request.baseRevision,
    allowed: evaluated.allowed,
    ...(evaluated.issue ? { issue: evaluated.issue } : {}),
    capacity: evaluated.capacity,
    planHash,
    request: structuredClone(request),
  };
}

export async function projectGridStorageForUser(
  request: GridStorageProjectionRequest,
  requester: FoundryUser,
): Promise<GridStorageClientProjection> {
  const rootActor = await actor(request.actorUuid);
  if (
    request.parent &&
    (request.parent.rootUuid !== request.actorUuid ||
      !request.parent.spaceId ||
      !request.parent.spaceOwnerActorUuid)
  )
    throw new Error("D6E2.Storage.Error.InvalidIntent");
  const state = await readGridStorageAuthorityState();
  const latestUndo = Object.values(state.receipts)
    .filter(
      ({ state: receiptState, undoEligible, afterRevision, afterLocations }) =>
        receiptState === "completed" &&
        undoEligible &&
        afterRevision === state.ledger.revision &&
        Object.values(afterLocations).every(
          (location) => locationRoot(location) === request.actorUuid,
        ),
    )
    .sort(
      (left, right) => (right.afterRevision ?? 0) - (left.afterRevision ?? 0),
    )[0];
  const canUndo = Boolean(latestUndo && controls(requester, rootActor));
  const workspace = await buildGridStorageWorkspace({
    actor: rootActor,
    ledger: state.ledger,
    user: requester,
    ...(request.parent ? { parent: request.parent } : {}),
    ...(request.viewMode ? { viewMode: request.viewMode } : {}),
    canUndo,
  });
  const visible = workspace?.viewMode !== "redacted";
  const objects = visible
    ? Object.fromEntries(
        Object.entries(state.ledger.objects).filter(
          ([, object]) => locationRoot(object.location) === request.actorUuid,
        ),
      )
    : {};
  const destinations: GridStorageClientProjection["destinations"][number][] =
    [];
  for (const root of Object.values(state.ledger.roots)) {
    const rootDocument = await actor(root.rootUuid);
    if (
      !controls(requester, rootDocument) ||
      !(await gridStorageRootFullyVisible(
        state.ledger,
        root.rootUuid,
        requester,
      ))
    )
      continue;
    for (const space of Object.values(root.spaces))
      destinations.push({
        label: `${rootDocument.name} · ${space.label}`,
        parent: {
          rootUuid: root.rootUuid,
          spaceId: space.id,
          containerInstanceId: null,
          spaceOwnerActorUuid: space.ownerActorUuid,
        },
        space,
      });
    for (const object of Object.values(state.ledger.objects)) {
      if (
        locationRoot(object.location) !== root.rootUuid ||
        !object.definition.interior
      )
        continue;
      const owner = await actor(object.ownerActorUuid);
      if (!controls(requester, owner)) continue;
      const containerItem = await item(object.documentUuid);
      destinations.push({
        label: `${rootDocument.name} · ${containerItem.name} · ${object.definition.interior.label}`,
        parent: {
          rootUuid: root.rootUuid,
          spaceId: object.definition.interior.id,
          containerInstanceId: object.definition.instanceId,
          spaceOwnerActorUuid: object.definition.interior.ownerActorUuid,
        },
        space: object.definition.interior,
      });
    }
  }
  return {
    workspace,
    objects,
    destinations,
    latestUndo:
      canUndo && latestUndo && latestUndo.afterRevision !== null
        ? {
            operationId: latestUndo.operationId,
            afterRevision: latestUndo.afterRevision,
            instanceIds: Object.keys(latestUndo.afterLocations),
          }
        : null,
  };
}

export async function projectGridStorageAvailability(
  actorUuid: string,
  instanceId: string,
  requester: FoundryUser,
) {
  const actingActor = await actor(actorUuid);
  if (!controls(requester, actingActor))
    throw new Error("D6E2.Storage.Error.Authority");
  const state = await readGridStorageAuthorityState();
  return effectiveStorageAvailability(state.ledger, instanceId, actorUuid);
}

export async function projectGridStorageAvailabilityBatch(
  actorUuid: string,
  instanceIds: readonly string[],
  requester: FoundryUser,
) {
  if (!validGridStorageAvailabilityBatchIds(instanceIds))
    throw new Error("D6E2.Storage.Error.Unavailable");
  const actingActor = await actor(actorUuid);
  if (!controls(requester, actingActor))
    throw new Error("D6E2.Storage.Error.Authority");
  const state = await readGridStorageAuthorityState();
  if (!controls(requester, actingActor))
    throw new Error("D6E2.Storage.Error.Authority");
  return Object.freeze(
    Object.fromEntries(
      instanceIds.map((id) => [
        id,
        effectiveStorageAvailability(state.ledger, id, actorUuid),
      ]),
    ),
  );
}

export async function processGridStorageConfiguration(
  request: GridStorageConfigurationRequest,
  requester: FoundryUser,
): Promise<void> {
  if (request.kind === "item-capability") {
    const document = (await fromUuid(request.documentUuid)) as
      (FoundryItemDocument & { readonly uuid: string }) | null;
    if (
      document?.documentName !== "Item" ||
      document.uuid !== request.documentUuid ||
      !GRID_STORAGE_ITEM_TYPES.includes(
        document.type as (typeof GRID_STORAGE_ITEM_TYPES)[number],
      )
    )
      throw new Error("D6E2.Storage.Error.Deleted");
    if (
      !requester.active ||
      (!requester.isGM &&
        !(document.parent ?? document).testUserPermission?.(requester, "OWNER"))
    )
      throw new Error("D6E2.Storage.Error.Authority");
    await setGridStorageItemCapability(document, request.form);
    return;
  }
  if (request.kind === "item") {
    const candidate = (await fromUuid(request.documentUuid)) as
      (FoundryItemDocument & { readonly uuid: string }) | null;
    if (
      candidate?.documentName === "Item" &&
      candidate.uuid === request.documentUuid &&
      !candidate.parent
    ) {
      if (
        !requester.active ||
        (!requester.isGM && !candidate.testUserPermission?.(requester, "OWNER"))
      )
        throw new Error("D6E2.Storage.Error.Authority");
      await configureGridStorageWorldItem(
        candidate,
        request.form,
        request.scaleId ?? "personal-100",
      );
      return;
    }
    const document = await item(request.documentUuid);
    if (!controls(requester, document.parent))
      throw new Error("D6E2.Storage.Error.Authority");
    await configureGridStorageItem(
      document,
      request.form,
      request.scaleId ?? "personal-100",
    );
    return;
  }
  const document = await actor(request.documentUuid);
  if (!controls(requester, document))
    throw new Error("D6E2.Storage.Error.Authority");
  if (request.kind === "remove-root") {
    if (!requester.isGM || !Number.isSafeInteger(request.baseRevision))
      throw new Error("D6E2.Storage.Error.Authority");
    await removeGridStorageRoot(document, Number(request.baseRevision));
    return;
  }
  if (request.kind === "root")
    await configureGridStorageRoot(
      document,
      request.form,
      request.spaceId ?? "primary",
    );
  else if (request.containerInstanceId) {
    const state = await readGridStorageAuthorityState();
    const object = state.ledger.objects[request.containerInstanceId];
    if (!object) throw new Error("D6E2.Storage.Error.InvalidContainer");
    const container = await item(object.documentUuid);
    if (!controls(requester, container.parent))
      throw new Error("D6E2.Storage.Error.Authority");
    await saveGridStorageInterior(container, request.form);
  } else
    await saveGridStorageSpace(
      document,
      request.form,
      request.spaceId ?? "primary",
    );
}

async function processLocationOnly(
  request: Exclude<D6StorageOperationRequestV1, { kind: "move" | "quantity" }>,
  requester: FoundryUser,
  state: D6StorageAuthorityStateV1,
): Promise<D6StorageSafeMoveResultV1> {
  let nextLedger: D6StorageLedgerV1;
  let beforeLocations: Readonly<Record<string, D6StorageLocationV1>> = {};
  let afterLocations: Readonly<Record<string, D6StorageLocationV1>> = {};
  let undoEligible = true;
  if (request.kind === "auto-pack") {
    const cached = packPreviews.get(request.value.operationId);
    if (cached?.requesterUserId !== requester.id)
      return safe(request.value.operationId, "denied", "stale");
    const destination = await actor(request.value.parent.spaceOwnerActorUuid);
    if (!controls(requester, destination))
      return safe(request.value.operationId, "denied", "authority");
    const rootObjects = Object.values(state.ledger.objects).filter(
      (object) =>
        locationRoot(object.location) === request.value.parent.rootUuid,
    );
    if (
      !(await gridStorageRootFullyVisible(
        state.ledger,
        request.value.parent.rootUuid,
        requester,
      )) ||
      Object.keys(request.value.witnesses).length !== rootObjects.length ||
      rootObjects.some(
        (object) =>
          request.value.witnesses[object.definition.instanceId] !==
          object.witness,
      )
    )
      return safe(request.value.operationId, "denied", "authority");
    const applied = applyGridStoragePack(
      state.ledger,
      cached.value,
      request.value,
    );
    nextLedger = applied.ledger;
    beforeLocations = applied.beforeLocations;
    afterLocations = applied.afterLocations;
  } else if (request.kind === "undo") {
    if (request.value.baseRevision !== state.ledger.revision)
      return safe(request.value.operationId, "denied", "stale");
    const target = state.receipts[request.value.targetOperationId];
    if (!target) return safe(request.value.operationId, "denied", "stale");
    if (
      Object.entries(request.value.witnesses).some(
        ([id, witness]) => state.ledger.objects[id]?.witness !== witness,
      )
    )
      return safe(request.value.operationId, "denied", "stale");
    const roots = new Set(
      Object.values(target.afterLocations).map((location) =>
        location.state === "unplaced"
          ? location.rootUuid
          : location.parent.spaceOwnerActorUuid,
      ),
    );
    for (const rootUuid of roots)
      if (!controls(requester, await actor(rootUuid)))
        return safe(request.value.operationId, "denied", "authority");
    nextLedger = undoGridStorageLocations(state.ledger, target);
    beforeLocations = target.afterLocations;
    afterLocations = target.beforeLocations;
    undoEligible = false;
  } else {
    if (request.value.baseRevision !== state.ledger.revision)
      return safe(request.value.operationId, "denied", "stale");
    const container = state.ledger.objects[request.value.containerInstanceId];
    if (
      !container ||
      Object.entries(request.value.witnesses).some(
        ([id, witness]) => state.ledger.objects[id]?.witness !== witness,
      ) ||
      container.witness !==
        request.value.witnesses[request.value.containerInstanceId]
    )
      return safe(request.value.operationId, "denied", "stale");
    const sourceActor = await actor(
      container.location.state === "unplaced"
        ? container.location.rootUuid
        : container.location.parent.spaceOwnerActorUuid,
    );
    const destinationActor = await actor(
      request.value.destination.spaceOwnerActorUuid,
    );
    if (
      !controls(requester, sourceActor) ||
      !controls(requester, destinationActor)
    )
      return safe(request.value.operationId, "denied", "authority");
    const unpacked = unpackGridStorageContainer(
      state.ledger,
      request.value.containerInstanceId,
      request.value.destination.rootUuid,
    );
    nextLedger = unpacked.ledger;
    beforeLocations = unpacked.beforeLocations;
    afterLocations = unpacked.afterLocations;
  }
  const planHash = await storageHash({
    request,
    beforeLocations,
    afterLocations,
    revision: nextLedger.revision,
  });
  let receipt = await createGridStorageReceipt({
    request,
    requesterUserId: requester.id,
    authorityUserId: game.user?.id ?? "",
    planHash,
    beforeRevision: state.ledger.revision,
    beforeLocations,
    afterLocations,
    undoEligible,
  });
  receipt = await recordIntent(state, receipt);
  receipt = await commitLedger(receipt, nextLedger);
  const response = safe(receipt.operationId, "completed");
  await finishReceipt(receipt, response);
  packPreviews.delete(request.value.operationId);
  return response;
}

async function processGridStorageOperationUnlocked(
  request: D6StorageOperationRequestV1,
  requester: FoundryUser,
): Promise<D6StorageSafeMoveResultV1> {
  const operationId = request.value.operationId;
  if (
    !destinyClientIsAuthority() ||
    !game.user?.isGM ||
    !requester.active ||
    !operationId
  )
    return safe(operationId, "denied", "authority");
  const state = await readGridStorageAuthorityState();
  const existing = state.receipts[operationId];
  if (existing) {
    try {
      await requireReceiptReadAccess(existing, requester, state.ledger);
      return (
        (await recordedGridStorageResponse(existing, request, requester.id)) ??
        safe(operationId, "uncertain")
      );
    } catch {
      return safe(operationId, "denied", "authority");
    }
  }
  try {
    return request.kind === "move"
      ? await processMove(request, requester, state)
      : request.kind === "quantity"
        ? await processQuantity(request, requester, state)
        : await processLocationOnly(request, requester, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return safe(
      operationId,
      "denied",
      message.includes("Stale")
        ? "stale"
        : message.includes("NoController")
          ? "no-controller"
          : message.includes("Authority")
            ? "authority"
            : "destination-unavailable",
    );
  }
}

export function processGridStorageOperation(
  request: D6StorageOperationRequestV1,
  requester: FoundryUser,
): Promise<D6StorageSafeMoveResultV1> {
  return runGridStorageAuthorityEffect(() =>
    processGridStorageOperationUnlocked(request, requester),
  );
}

export function registerGridStorageOperationService(): void {
  setGridStorageOperationProcessor(processGridStorageOperation);
  setGridStorageProjectionProcessor(projectGridStorageForUser);
  setGridStoragePackPreviewProcessor(previewGridStorageAutoPack);
  setGridStorageMovePreviewProcessor(previewGridStorageMove);
  setGridStorageAvailabilityProcessor(
    projectGridStorageAvailability,
    projectGridStorageAvailabilityBatch,
  );
  setGridStorageConfigurationProcessor(processGridStorageConfiguration);
  for (const hook of ["updateUser", "userConnected"])
    Hooks.on(hook, () => void recoverGridStorageOperations());
}

export function resetGridStorageOperationServiceForTests(): void {
  packPreviews.clear();
  recoveryRun = null;
}
