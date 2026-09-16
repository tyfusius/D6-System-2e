import type {
  D6StorageApprovalV1,
  D6StorageAvailability,
  D6StorageObjectV1,
  D6StorageOperationRequestV1,
  D6StorageMovePreviewV1,
  D6StorageMoveRequestV1,
  D6StoragePackPreviewV1,
  D6StorageParentV1,
  D6StorageSafeMoveResultV1,
  D6StorageSpaceV1,
} from "@d6-system-2e/core";
import type { D6GridStorageWorkspaceVM } from "./grid-storage-view-model.js";
import { SYSTEM_ID } from "../constants.js";
import {
  destinyActiveAuthority,
  destinyClientIsAuthority,
  heartbeatDestinyCrypto,
} from "./destiny-crypto.js";
import { foundryRandomId } from "./foundry-random-id.js";

const CHANNEL = `system.${SYSTEM_ID}`;
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 512;
const CONFIGURATION_ERROR_KEYS = new Set([
  "D6E2.Storage.Error.Authority",
  "D6E2.Storage.Error.AuthorityBusy",
  "D6E2.Storage.Error.Deleted",
  "D6E2.Storage.Error.InvalidLedger",
  "D6E2.Storage.Error.RootBoundary",
  "D6E2.Storage.Error.RootRemovalUnavailable",
  "D6E2.Storage.Error.RootUnavailable",
  "D6E2.Storage.Error.Stale",
  "D6E2.Storage.Error.WitnessMismatch",
  "D6E2.Storage.Currency.Error.FundsPresent",
]);

function configurationErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return CONFIGURATION_ERROR_KEYS.has(message)
    ? message
    : "D6E2.Storage.Error.RootRemovalUnavailable";
}

export type GridStorageOperationProcessor = (
  request: D6StorageOperationRequestV1,
  requester: FoundryUser,
) => Promise<D6StorageSafeMoveResultV1>;

export interface GridStorageClientProjection {
  readonly workspace: D6GridStorageWorkspaceVM | null;
  readonly objects: Readonly<Record<string, D6StorageObjectV1>>;
  readonly latestUndo: {
    readonly operationId: string;
    readonly afterRevision: number;
    readonly instanceIds: readonly string[];
  } | null;
  readonly destinations: readonly GridStorageDestinationOption[];
}

export interface GridStorageDestinationOption {
  readonly label: string;
  readonly parent: D6StorageParentV1;
  readonly space: D6StorageSpaceV1;
}

export interface GridStorageProjectionRequest {
  readonly actorUuid: string;
  readonly parent?: D6StorageParentV1;
  readonly viewMode?: "grid" | "list";
}

export interface GridStoragePackPreviewRequest {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly parent: D6StorageParentV1;
  readonly maxSearchNodes: number;
  readonly witnesses: Readonly<Record<string, string>>;
}
export type GridStorageMovePreviewRequest = D6StorageMoveRequestV1;
export interface GridStorageConfigurationRequest {
  readonly kind: "root" | "space" | "item" | "remove-root";
  readonly documentUuid: string;
  readonly form: Readonly<Record<string, unknown>>;
  readonly baseRevision?: number;
  readonly spaceId?: string;
  readonly scaleId?: string;
  readonly containerInstanceId?: string;
}

type GridStorageProjectionProcessor = (
  request: GridStorageProjectionRequest,
  requester: FoundryUser,
) => Promise<GridStorageClientProjection>;
type GridStoragePackPreviewProcessor = (
  request: GridStoragePackPreviewRequest,
  requester: FoundryUser,
) => Promise<D6StoragePackPreviewV1>;
type GridStorageMovePreviewProcessor = (
  request: GridStorageMovePreviewRequest,
  requester: FoundryUser,
) => Promise<D6StorageMovePreviewV1>;
type GridStorageAvailabilityProcessor = (
  actorUuid: string,
  instanceId: string,
  requester: FoundryUser,
) => Promise<D6StorageAvailability>;
type GridStorageConfigurationProcessor = (
  request: GridStorageConfigurationRequest,
  requester: FoundryUser,
) => Promise<void>;
type GridStorageRefreshHandler = (
  rootUuids: readonly string[],
) => Promise<void> | void;

let operationProcessor: GridStorageOperationProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let projectionProcessor: GridStorageProjectionProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let packPreviewProcessor: GridStoragePackPreviewProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let movePreviewProcessor: GridStorageMovePreviewProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let availabilityProcessor: GridStorageAvailabilityProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let configurationProcessor: GridStorageConfigurationProcessor = () =>
  Promise.reject(new Error("D6E2.Storage.Error.Authority"));
let refreshHandler: GridStorageRefreshHandler = () => undefined;

export function setGridStorageOperationProcessor(
  processor: GridStorageOperationProcessor,
): void {
  operationProcessor = processor;
}

export function setGridStorageProjectionProcessor(
  processor: GridStorageProjectionProcessor,
): void {
  projectionProcessor = processor;
}

export function setGridStoragePackPreviewProcessor(
  processor: GridStoragePackPreviewProcessor,
): void {
  packPreviewProcessor = processor;
}
export function setGridStorageMovePreviewProcessor(
  processor: GridStorageMovePreviewProcessor,
): void {
  movePreviewProcessor = processor;
}

export function setGridStorageAvailabilityProcessor(
  processor: GridStorageAvailabilityProcessor,
): void {
  availabilityProcessor = processor;
}
export function setGridStorageConfigurationProcessor(
  processor: GridStorageConfigurationProcessor,
): void {
  configurationProcessor = processor;
}

export function setGridStorageRefreshHandler(
  handler: GridStorageRefreshHandler,
): void {
  refreshHandler = handler;
}

const pending = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly operationId: string;
    readonly requesterUserId: string;
    readonly resolve: (value: D6StorageSafeMoveResultV1) => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingApprovals = new Map<
  string,
  {
    readonly operationId: string;
    readonly intentHash: string;
    readonly planHash: string;
    readonly actorUuid: string;
    readonly boundary: D6StorageApprovalV1["boundary"];
    readonly scope: D6StorageApprovalV1["scope"];
    readonly targetUserId: string;
    readonly resolve: (approved: boolean) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingProjections = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly resolve: (value: GridStorageClientProjection) => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingPackPreviews = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly operationId: string;
    readonly resolve: (value: D6StoragePackPreviewV1) => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingMovePreviews = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly operationId: string;
    readonly resolve: (value: D6StorageMovePreviewV1) => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingAvailability = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly resolve: (value: D6StorageAvailability) => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();
const pendingConfigurations = new Map<
  string,
  {
    readonly authorityUserId: string;
    readonly resolve: () => void;
    readonly reject: (reason: unknown) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

function emitTargeted(value: Record<string, unknown>, recipient: string): void {
  if (!recipient) throw new Error("D6E2.Storage.Error.InvalidRecipient");
  game.socket?.emit(CHANNEL, value, { recipients: [recipient] });
}

export async function notifyGridStorageCommittedRoots(
  rootUuids: readonly string[],
): Promise<void> {
  if (!destinyClientIsAuthority() || !game.user?.isGM) return;
  const roots = [...new Set(rootUuids)].filter(text);
  if (roots.length === 0) return;
  const documents = new Map<string, FoundryActorDocument>();
  for (const rootUuid of roots) {
    const document = (await fromUuid(rootUuid)) as FoundryActorDocument | null;
    if (document?.uuid === rootUuid) documents.set(rootUuid, document);
  }
  for (const user of game.users?.contents ?? []) {
    if (!user.active) continue;
    const visibleRoots = roots.filter((rootUuid) => {
      const document = documents.get(rootUuid);
      const permissionDocument = document as
        | (FoundryActorDocument & {
            testUserPermission(
              candidate: FoundryUser,
              permission: string,
            ): boolean;
          })
        | undefined;
      return (
        permissionDocument &&
        (user.isGM || permissionDocument.testUserPermission(user, "OBSERVER"))
      );
    });
    if (visibleRoots.length === 0) continue;
    for (let offset = 0; offset < visibleRoots.length; offset += 32) {
      const packetRoots = visibleRoots.slice(offset, offset + 32);
      if (user.id === game.user.id) await refreshHandler(packetRoots);
      else
        emitTargeted(
          { type: "grid-storage-roots-committed", rootUuids: packetRoots },
          user.id,
        );
    }
  }
}

export async function requestGridStorageOperation(
  request: D6StorageOperationRequestV1,
): Promise<D6StorageSafeMoveResultV1> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority()) return operationProcessor(request, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(packetId);
      resolve({
        version: 1,
        operationId: request.value.operationId,
        status: "uncertain",
        issue: "timeout",
        projectionToken: null,
      });
    }, 15_000);
    pending.set(packetId, {
      authorityUserId: authority.userId,
      operationId: request.value.operationId,
      requesterUserId: current.id,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      { type: "grid-storage-operation", packetId, request },
      authority.userId,
    );
  });
}

export async function requestGridStorageProjection(
  request: GridStorageProjectionRequest,
): Promise<GridStorageClientProjection> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority()) return projectionProcessor(request, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingProjections.delete(packetId);
      reject(new Error("D6E2.Storage.Error.Authority"));
    }, 15_000);
    pendingProjections.set(packetId, {
      authorityUserId: authority.userId,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      { type: "grid-storage-projection", packetId, request },
      authority.userId,
    );
  });
}

export async function requestGridStoragePackPreview(
  request: GridStoragePackPreviewRequest,
): Promise<D6StoragePackPreviewV1> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority()) return packPreviewProcessor(request, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingPackPreviews.delete(packetId);
      reject(new Error("D6E2.Storage.Error.Authority"));
    }, 15_000);
    pendingPackPreviews.set(packetId, {
      authorityUserId: authority.userId,
      operationId: request.operationId,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      { type: "grid-storage-pack-preview", packetId, request },
      authority.userId,
    );
  });
}

export async function requestGridStorageMovePreview(
  request: GridStorageMovePreviewRequest,
): Promise<D6StorageMovePreviewV1> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority()) return movePreviewProcessor(request, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingMovePreviews.delete(packetId);
      reject(new Error("D6E2.Storage.Error.Authority"));
    }, 15_000);
    pendingMovePreviews.set(packetId, {
      authorityUserId: authority.userId,
      operationId: request.operationId,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      { type: "grid-storage-move-preview", packetId, request },
      authority.userId,
    );
  });
}

export async function requestGridStorageAvailability(
  actorUuid: string,
  instanceId: string,
): Promise<D6StorageAvailability> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority())
    return availabilityProcessor(actorUuid, instanceId, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAvailability.delete(packetId);
      reject(new Error("D6E2.Storage.Error.Authority"));
    }, 15_000);
    pendingAvailability.set(packetId, {
      authorityUserId: authority.userId,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      {
        type: "grid-storage-availability",
        packetId,
        actorUuid,
        instanceId,
      },
      authority.userId,
    );
  });
}

export async function requestGridStorageConfiguration(
  request: GridStorageConfigurationRequest,
): Promise<void> {
  await heartbeatDestinyCrypto();
  const current = game.user;
  const authority = destinyActiveAuthority();
  if (!current || !authority) throw new Error("D6E2.Storage.Error.Authority");
  if (destinyClientIsAuthority())
    return configurationProcessor(request, current);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingConfigurations.delete(packetId);
      reject(new Error("D6E2.Storage.Error.Authority"));
    }, 15_000);
    pendingConfigurations.set(packetId, {
      authorityUserId: authority.userId,
      resolve,
      reject,
      timer,
    });
    emitTargeted(
      { type: "grid-storage-configuration", packetId, request },
      authority.userId,
    );
  });
}

async function controlledActor(
  actorUuid: string,
  user: FoundryUser,
): Promise<boolean> {
  const actor = (await fromUuid(actorUuid)) as FoundryActorDocument | null;
  return (
    actor?.uuid === actorUuid &&
    user.active &&
    (user.isGM || actor.testUserPermission(user, "OWNER"))
  );
}

export async function requestGridStorageApproval(input: {
  readonly operationId: string;
  readonly intentHash: string;
  readonly planHash: string;
  readonly actorUuid: string;
  readonly boundary: D6StorageApprovalV1["boundary"];
  readonly scope: D6StorageApprovalV1["scope"];
  readonly targetUserId: string;
}): Promise<boolean> {
  if (!destinyClientIsAuthority() || !game.user?.isGM)
    throw new Error("D6E2.Storage.Error.Authority");
  const requestId = foundryRandomId();
  const createdAt = Date.now();
  const expiresAt = createdAt + 60_000;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId);
      resolve(false);
    }, 60_000);
    pendingApprovals.set(requestId, { ...input, resolve, timer });
    emitTargeted(
      {
        type: "grid-storage-approval-request",
        requestId,
        authorityUserId: game.user?.id,
        createdAt,
        expiresAt,
        ...input,
      },
      input.targetUserId,
    );
  });
}

async function approvalRequest(
  packet: Record<string, unknown>,
  senderId: string,
): Promise<void> {
  const current = game.user;
  if (
    !current ||
    current.id !== packet.targetUserId ||
    senderId !== packet.authorityUserId ||
    destinyActiveAuthority()?.userId !== senderId ||
    !game.users?.get(senderId)?.isGM ||
    !text(packet.requestId) ||
    !text(packet.operationId) ||
    !text(packet.intentHash) ||
    !text(packet.planHash) ||
    !text(packet.actorUuid) ||
    !["source-location", "destination-location", "ownership"].includes(
      String(packet.boundary),
    ) ||
    !["object-only", "subtree"].includes(String(packet.scope)) ||
    !Number.isFinite(packet.createdAt) ||
    !Number.isFinite(packet.expiresAt) ||
    Number(packet.expiresAt) <= Date.now() ||
    Number(packet.expiresAt) - Number(packet.createdAt) > 60_000 ||
    !(await controlledActor(packet.actorUuid, current))
  )
    return;
  const approved = await foundry.applications.api.DialogV2.wait<boolean>({
    classes: ["d6e2", "d6e2-grid-storage-approval"],
    content: `<p>${game.i18n.localize("D6E2.Storage.ApprovalPrompt")}</p>`,
    modal: true,
    position: { width: 440 },
    rejectClose: false,
    window: { title: game.i18n.localize("D6E2.Storage.ApprovalTitle") },
    buttons: [
      {
        action: "reject",
        label: game.i18n.localize("D6E2.Cancel"),
        callback: () => false,
      },
      {
        action: "approve",
        label: game.i18n.localize("D6E2.Storage.Approve"),
        callback: () => true,
        default: true,
      },
    ],
  });
  emitTargeted(
    {
      type: "grid-storage-approval-response",
      requestId: packet.requestId,
      operationId: packet.operationId,
      intentHash: packet.intentHash,
      planHash: packet.planHash,
      actorUuid: packet.actorUuid,
      boundary: packet.boundary,
      scope: packet.scope,
      targetUserId: current.id,
      approved: approved === true,
    },
    senderId,
  );
}

async function approvalResponse(
  packet: Record<string, unknown>,
  senderId: string,
): Promise<void> {
  if (
    !destinyClientIsAuthority() ||
    !game.user?.isGM ||
    !text(packet.requestId)
  )
    return;
  const approval = pendingApprovals.get(packet.requestId);
  if (
    approval?.targetUserId !== senderId ||
    packet.targetUserId !== senderId ||
    packet.operationId !== approval.operationId ||
    packet.intentHash !== approval.intentHash ||
    packet.planHash !== approval.planHash ||
    packet.actorUuid !== approval.actorUuid ||
    packet.boundary !== approval.boundary ||
    packet.scope !== approval.scope
  )
    return;
  const user = game.users?.get(senderId);
  if (!user || !(await controlledActor(approval.actorUuid, user))) return;
  pendingApprovals.delete(packet.requestId);
  clearTimeout(approval.timer);
  approval.resolve(packet.approved === true);
}

export async function handleGridStorageSocketPacket(
  raw: unknown,
  senderId?: string,
): Promise<void> {
  const packet = record(raw);
  if (!packet || !senderId) return;
  if (packet.type === "grid-storage-roots-committed") {
    if (senderId !== destinyActiveAuthority()?.userId) return;
    const roots = Array.isArray(packet.rootUuids)
      ? packet.rootUuids.filter(text)
      : [];
    if (roots.length === 0 || roots.length > 32) return;
    await refreshHandler([...new Set(roots)]);
    return;
  }
  if (packet.type === "grid-storage-projection-reply") {
    if (!text(packet.packetId)) return;
    const wait = pendingProjections.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    const value = record(packet.value);
    if (!value || !record(value.objects)) return;
    pendingProjections.delete(packet.packetId);
    clearTimeout(wait.timer);
    wait.resolve(
      structuredClone(value as unknown as GridStorageClientProjection),
    );
    return;
  }
  if (packet.type === "grid-storage-pack-preview-reply") {
    if (!text(packet.packetId)) return;
    const wait = pendingPackPreviews.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    const value = record(packet.value);
    if (
      value?.version !== 1 ||
      value.operationId !== wait.operationId ||
      !["packed", "proven-impossible", "not-found-within-limit"].includes(
        String(value.outcome),
      )
    )
      return;
    pendingPackPreviews.delete(packet.packetId);
    clearTimeout(wait.timer);
    wait.resolve(structuredClone(value as unknown as D6StoragePackPreviewV1));
    return;
  }
  if (packet.type === "grid-storage-move-preview-reply") {
    if (!text(packet.packetId)) return;
    const wait = pendingMovePreviews.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    const value = record(packet.value);
    if (
      value?.version !== 1 ||
      value.operationId !== wait.operationId ||
      typeof value.allowed !== "boolean" ||
      !record(value.capacity) ||
      !record(value.request) ||
      !text(value.planHash)
    )
      return;
    pendingMovePreviews.delete(packet.packetId);
    clearTimeout(wait.timer);
    wait.resolve(structuredClone(value as unknown as D6StorageMovePreviewV1));
    return;
  }
  if (packet.type === "grid-storage-availability-reply") {
    if (!text(packet.packetId)) return;
    const wait = pendingAvailability.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    const value = record(packet.value);
    if (
      !value ||
      typeof value.configured !== "boolean" ||
      typeof value.reachable !== "boolean" ||
      typeof value.canUse !== "boolean" ||
      typeof value.canEquip !== "boolean" ||
      typeof value.effectiveEquipped !== "boolean" ||
      typeof value.effectiveInstalled !== "boolean"
    )
      return;
    pendingAvailability.delete(packet.packetId);
    clearTimeout(wait.timer);
    wait.resolve(structuredClone(value as unknown as D6StorageAvailability));
    return;
  }
  if (packet.type === "grid-storage-configuration-reply") {
    if (!text(packet.packetId)) return;
    const wait = pendingConfigurations.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    pendingConfigurations.delete(packet.packetId);
    clearTimeout(wait.timer);
    if (packet.ok === true) wait.resolve();
    else
      wait.reject(
        new Error(
          text(packet.issue) && CONFIGURATION_ERROR_KEYS.has(packet.issue)
            ? packet.issue
            : "D6E2.Storage.Error.Authority",
        ),
      );
    return;
  }
  if (packet.type === "grid-storage-reply") {
    if (!text(packet.packetId)) return;
    const wait = pending.get(packet.packetId);
    if (
      wait?.authorityUserId !== senderId ||
      destinyActiveAuthority()?.userId !== senderId
    )
      return;
    const value = record(packet.value);
    if (
      value?.version !== 1 ||
      value.operationId !== wait.operationId ||
      ![
        "awaiting-approval",
        "allowed",
        "denied",
        "completed",
        "uncertain",
      ].includes(value.status as string)
    )
      return;
    pending.delete(packet.packetId);
    clearTimeout(wait.timer);
    wait.resolve(
      structuredClone(value as unknown as D6StorageSafeMoveResultV1),
    );
    return;
  }
  if (packet.type === "grid-storage-approval-request") {
    await approvalRequest(packet, senderId);
    return;
  }
  if (packet.type === "grid-storage-approval-response") {
    await approvalResponse(packet, senderId);
    return;
  }
  if (packet.type === "grid-storage-projection") {
    if (!destinyClientIsAuthority() || !text(packet.packetId)) return;
    const requester = game.users?.get(senderId);
    const request = record(packet.request);
    if (!requester?.active || !request || !text(request.actorUuid)) return;
    try {
      const value = await projectionProcessor(
        request as unknown as GridStorageProjectionRequest,
        requester,
      );
      emitTargeted(
        {
          type: "grid-storage-projection-reply",
          packetId: packet.packetId,
          value,
        },
        senderId,
      );
    } catch {
      emitTargeted(
        {
          type: "grid-storage-projection-reply",
          packetId: packet.packetId,
          value: { workspace: null, objects: {}, latestUndo: null },
        },
        senderId,
      );
    }
    return;
  }
  if (packet.type === "grid-storage-pack-preview") {
    if (!destinyClientIsAuthority() || !text(packet.packetId)) return;
    const requester = game.users?.get(senderId);
    const request = record(packet.request);
    if (
      !requester?.active ||
      request?.version !== 1 ||
      !text(request.operationId)
    )
      return;
    try {
      const value = await packPreviewProcessor(
        request as unknown as GridStoragePackPreviewRequest,
        requester,
      );
      emitTargeted(
        {
          type: "grid-storage-pack-preview-reply",
          packetId: packet.packetId,
          value,
        },
        senderId,
      );
    } catch {
      return;
    }
    return;
  }
  if (packet.type === "grid-storage-move-preview") {
    if (!destinyClientIsAuthority() || !text(packet.packetId)) return;
    const requester = game.users?.get(senderId);
    const request = record(packet.request);
    if (
      !requester?.active ||
      request?.version !== 1 ||
      !text(request.operationId)
    )
      return;
    try {
      const value = await movePreviewProcessor(
        request as unknown as GridStorageMovePreviewRequest,
        requester,
      );
      emitTargeted(
        {
          type: "grid-storage-move-preview-reply",
          packetId: packet.packetId,
          value,
        },
        senderId,
      );
    } catch {
      return;
    }
    return;
  }
  if (packet.type === "grid-storage-availability") {
    if (
      !destinyClientIsAuthority() ||
      !text(packet.packetId) ||
      !text(packet.actorUuid) ||
      !text(packet.instanceId)
    )
      return;
    const requester = game.users?.get(senderId);
    if (!requester?.active) return;
    try {
      const value = await availabilityProcessor(
        packet.actorUuid,
        packet.instanceId,
        requester,
      );
      emitTargeted(
        {
          type: "grid-storage-availability-reply",
          packetId: packet.packetId,
          value,
        },
        senderId,
      );
    } catch {
      return;
    }
    return;
  }
  if (packet.type === "grid-storage-configuration") {
    if (!destinyClientIsAuthority() || !text(packet.packetId)) return;
    const requester = game.users?.get(senderId);
    const request = record(packet.request);
    const form = request ? record(request.form) : undefined;
    if (
      !requester?.active ||
      !request ||
      !form ||
      !text(request.documentUuid) ||
      !["root", "space", "item", "remove-root"].includes(
        String(request.kind),
      ) ||
      (request.kind === "remove-root" &&
        (!Number.isSafeInteger(request.baseRevision) ||
          Number(request.baseRevision) < 0)) ||
      (request.containerInstanceId !== undefined &&
        !text(request.containerInstanceId)) ||
      JSON.stringify(form).length > 16_384
    )
      return;
    let ok = false;
    let issue = "D6E2.Storage.Error.Authority";
    try {
      await configurationProcessor(
        request as unknown as GridStorageConfigurationRequest,
        requester,
      );
      ok = true;
    } catch (error) {
      ok = false;
      issue = configurationErrorKey(error);
    }
    emitTargeted(
      {
        type: "grid-storage-configuration-reply",
        packetId: packet.packetId,
        ok,
        ...(ok ? {} : { issue }),
      },
      senderId,
    );
    return;
  }
  if (packet.type !== "grid-storage-operation" || !destinyClientIsAuthority())
    return;
  if (!text(packet.packetId)) return;
  const requester = game.users?.get(senderId);
  const request = record(packet.request) as
    (Record<string, unknown> & D6StorageOperationRequestV1) | undefined;
  if (!requester?.active || !request || !record(request.value)) return;
  try {
    const value = await operationProcessor(request, requester);
    emitTargeted(
      { type: "grid-storage-reply", packetId: packet.packetId, value },
      senderId,
    );
  } catch {
    const operationId = record(request.value)?.operationId;
    emitTargeted(
      {
        type: "grid-storage-reply",
        packetId: packet.packetId,
        value: {
          version: 1,
          operationId: typeof operationId === "string" ? operationId : "",
          status: "uncertain",
          projectionToken: null,
        },
      },
      senderId,
    );
  }
}

export function registerGridStorageSocket(): void {
  game.socket?.on(CHANNEL, (raw: unknown, senderId?: string) => {
    void handleGridStorageSocketPacket(raw, senderId);
  });
}

export function resetGridStorageAuthorityForTests(): void {
  for (const wait of pending.values()) clearTimeout(wait.timer);
  for (const approval of pendingApprovals.values())
    clearTimeout(approval.timer);
  for (const wait of pendingProjections.values()) clearTimeout(wait.timer);
  for (const wait of pendingPackPreviews.values()) clearTimeout(wait.timer);
  for (const wait of pendingMovePreviews.values()) clearTimeout(wait.timer);
  for (const wait of pendingAvailability.values()) clearTimeout(wait.timer);
  for (const wait of pendingConfigurations.values()) clearTimeout(wait.timer);
  pending.clear();
  pendingApprovals.clear();
  pendingProjections.clear();
  pendingPackPreviews.clear();
  pendingMovePreviews.clear();
  pendingAvailability.clear();
  pendingConfigurations.clear();
  operationProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  projectionProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  packPreviewProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  movePreviewProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  availabilityProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  configurationProcessor = () =>
    Promise.reject(new Error("D6E2.Storage.Error.Authority"));
  refreshHandler = () => undefined;
}
