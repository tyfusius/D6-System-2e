import type { D6CurrencyHolderTransferRecoveryV1 } from "./currency-denominations";

export const D6_GRID_STORAGE_CONTRACT_ID = "d6.grid-storage.v1" as const;
export const D6_GRID_STORAGE_CONTRACT_VERSION = 1 as const;

export type D6StorageRootKind =
  "character" | "vehicle" | "starship" | "storage-location";

export type D6StorageDisposition =
  "carried" | "equipped" | "stored" | "installed";

export type D6StorageRotation = "none" | "quarter-turn";
export type D6StorageAccessState = "open" | "closed" | "locked";

export interface D6StorageFootprintV1 {
  readonly columns: number;
  readonly rows: number;
  readonly provenance: "preset" | "user";
}

export interface D6StorageStackPolicyV1 {
  readonly mode: "single" | "bounded";
  readonly maxQuantityPerPlacement: number;
}

export interface D6StoragePhysicalProfileV1 {
  readonly version: 1;
  readonly provenance: "unknown" | "preset" | "measured";
  readonly presetId: string | null;
  readonly widthMm: number | null;
  readonly depthMm: number | null;
  readonly heightMm: number | null;
  readonly unitTareWeightGrams: number | null;
  readonly unitExteriorVolumeMillilitres: number | null;
  readonly rotatable: boolean;
  readonly footprintsByScale: Readonly<Record<string, D6StorageFootprintV1>>;
  readonly stack: D6StorageStackPolicyV1;
}

export interface D6StorageLimitsV1 {
  readonly maxAggregateWeightGrams: number | null;
  readonly maxOccupiedVolumeMillilitres: number | null;
  readonly maxDirectChildren: number | null;
}

export interface D6StorageGridV1 {
  readonly version: 1;
  readonly scaleId: string;
  readonly scaleLabel: string;
  readonly columns: number;
  readonly rows: number;
  readonly cellWidthMm: number;
  readonly cellDepthMm: number;
}

export interface D6StorageSpaceV1 {
  readonly id: string;
  readonly label: string;
  readonly kind: "inventory" | "cargo" | "installation" | "container";
  readonly ownerActorUuid: string;
  readonly configuration: "unconfigured" | "capacity-only" | "grid";
  readonly access: D6StorageAccessState;
  readonly grid: D6StorageGridV1 | null;
  readonly limits: D6StorageLimitsV1;
}

export interface D6StorageRootV1 {
  readonly version: 1;
  readonly rootUuid: string;
  readonly kind: D6StorageRootKind;
  readonly revision: number;
  readonly spaces: Readonly<Record<string, D6StorageSpaceV1>>;
  readonly publicSummary: "none" | "availability-only" | "coarse-percent";
}

export interface D6StorageObjectDefinitionV1 {
  readonly version: 1;
  readonly instanceId: string;
  readonly physical: D6StoragePhysicalProfileV1;
  readonly interior?: D6StorageSpaceV1;
}

export interface D6StorageParentV1 {
  readonly rootUuid: string;
  readonly spaceId: string;
  readonly containerInstanceId: string | null;
  readonly spaceOwnerActorUuid: string;
}

export interface D6StorageRectangleV1 {
  readonly x: number;
  readonly y: number;
  readonly columns: number;
  readonly rows: number;
  readonly rotation: D6StorageRotation;
}

export type D6StorageLocationV1 =
  | {
      readonly state: "unplaced";
      readonly rootUuid: string;
      readonly disposition: D6StorageDisposition;
    }
  | {
      readonly state: "listed";
      readonly parent: D6StorageParentV1;
      readonly disposition: D6StorageDisposition;
      readonly pinned: boolean;
    }
  | {
      readonly state: "placed";
      readonly parent: D6StorageParentV1;
      readonly rectangle: D6StorageRectangleV1;
      readonly disposition: D6StorageDisposition;
      readonly pinned: boolean;
    };

export interface D6StorageObjectV1 {
  readonly version: 1;
  readonly definition: D6StorageObjectDefinitionV1;
  readonly documentUuid: string;
  readonly ownerActorUuid: string;
  readonly quantity: number;
  readonly witness: string;
  readonly location: D6StorageLocationV1;
}

export interface D6StorageLedgerV1 {
  readonly version: 1;
  readonly revision: number;
  readonly roots: Readonly<Record<string, D6StorageRootV1>>;
  readonly objects: Readonly<Record<string, D6StorageObjectV1>>;
}

export type D6StorageCapacityState =
  "available" | "exceeded" | "unknown-measurement";

export interface D6StorageCapacityResultV1 {
  readonly grid:
    | "available"
    | "not-configured"
    | "overlap"
    | "outside"
    | "unknown-footprint";
  readonly weight: D6StorageCapacityState;
  readonly volume: D6StorageCapacityState;
  readonly count: "available" | "exceeded";
}

export type D6StorageMoveIssue =
  | "authority"
  | "capacity"
  | "container-not-empty"
  | "cycle"
  | "deleted"
  | "destination-unavailable"
  | "hidden"
  | "invalid"
  | "needs-attention"
  | "stale"
  | "unsupported-stack"
  | "unknown-footprint"
  | "unknown-measurement";

export interface D6StorageOwnershipTransferV1 {
  readonly mode: "preserve" | "transfer";
  readonly targetOwnerActorUuid: string | null;
  readonly scope: "object-only" | "subtree";
}

export interface D6StorageMoveRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly instanceId: string;
  readonly quantity: number | "all";
  /** Null only for an authority-validated disposition change while unplaced. */
  readonly destination: D6StorageParentV1 | null;
  readonly rectangle: D6StorageRectangleV1 | null;
  readonly disposition: D6StorageDisposition;
  /** Desired anchored state. Ordinary moves preserve the current value. */
  readonly pinned: boolean;
  readonly ownershipTransfer: D6StorageOwnershipTransferV1;
  readonly witnesses: Readonly<Record<string, string>>;
}

/** Authority-internal preview. This shape is never returned to a partial observer. */
export interface D6StorageMovePreviewV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly allowed: boolean;
  readonly issue?: D6StorageMoveIssue;
  readonly capacity: D6StorageCapacityResultV1;
  readonly planHash: string;
  readonly request: D6StorageMoveRequestV1;
}

export type D6StorageSafeMoveStatus =
  "awaiting-approval" | "allowed" | "denied" | "completed" | "uncertain";

/** Permission-safe reply. It contains no coordinate, occupancy, count, or revision oracle. */
export interface D6StorageSafeMoveResultV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly status: D6StorageSafeMoveStatus;
  readonly issue?:
    | "authority"
    | "cancelled"
    | "destination-unavailable"
    | "no-controller"
    | "stale"
    | "timeout";
  readonly projectionToken: string | null;
}

export type D6StoragePackOutcome =
  "packed" | "proven-impossible" | "not-found-within-limit";

export interface D6StoragePackRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly parent: D6StorageParentV1;
  readonly maxSearchNodes: number;
  readonly witnesses: Readonly<Record<string, string>>;
}

/** Full-visibility authority result only. */
export interface D6StoragePackPreviewV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly outcome: D6StoragePackOutcome;
  readonly visitedNodes: number;
  readonly planHash: string;
  readonly placements: Readonly<Record<string, D6StorageRectangleV1>>;
  readonly eligibleInstanceIds: readonly string[];
  readonly excludedInstanceIds: readonly string[];
}

export interface D6StorageAutoPackApplyRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly parent: D6StorageParentV1;
  readonly planHash: string;
  readonly witnesses: Readonly<Record<string, string>>;
}

export interface D6StorageUndoRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly targetOperationId: string;
  readonly baseRevision: number;
  readonly witnesses: Readonly<Record<string, string>>;
}

export interface D6StorageUnpackRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly containerInstanceId: string;
  readonly destination: D6StorageParentV1;
  readonly witnesses: Readonly<Record<string, string>>;
}

export interface D6StorageQuantityRequestV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly baseRevision: number;
  readonly instanceId: string;
  readonly actingActorUuid: string;
  readonly targetQuantity: number;
  readonly witnesses: Readonly<Record<string, string>>;
}

export type D6StorageOperationRequestV1 =
  | { readonly kind: "move"; readonly value: D6StorageMoveRequestV1 }
  | { readonly kind: "quantity"; readonly value: D6StorageQuantityRequestV1 }
  | {
      readonly kind: "auto-pack";
      readonly value: D6StorageAutoPackApplyRequestV1;
    }
  | { readonly kind: "undo"; readonly value: D6StorageUndoRequestV1 }
  | { readonly kind: "unpack"; readonly value: D6StorageUnpackRequestV1 };

export interface D6StorageApprovalV1 {
  readonly userId: string;
  readonly actorUuid: string;
  readonly boundary: "source-location" | "destination-location" | "ownership";
  readonly scope: "object-only" | "subtree";
  readonly decision: "pending" | "approved" | "rejected" | "expired";
  readonly decidedAt: number | null;
}

export interface D6StorageDocumentImageV1 {
  readonly documentUuid: string;
  readonly parentActorUuid: string;
  readonly source: Readonly<Record<string, unknown>>;
  readonly witness: string;
}

export interface D6StorageReservedIdentityV1 {
  readonly instanceId: string;
  readonly parentActorUuid: string;
  readonly documentId: string;
  readonly documentUuid: string;
}

export interface D6StorageWriteV1 {
  readonly sequence: number;
  readonly kind: "create" | "update" | "delete";
  readonly documentUuid: string;
  readonly before: D6StorageDocumentImageV1 | null;
  readonly after: D6StorageDocumentImageV1 | null;
  readonly state: "planned" | "applied" | "verified" | "compensated";
}

export type D6StorageReceiptState =
  | "intent-recorded"
  | "approval-pending"
  | "reserved"
  | "documents-applied"
  | "ledger-applied"
  | "completed"
  | "compensated"
  | "needs-attention";

export interface D6StorageTransactionReceiptV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly intentHash: string;
  readonly request: D6StorageOperationRequestV1;
  readonly planHash: string;
  readonly requesterUserId: string;
  readonly authorityUserId: string;
  readonly state: D6StorageReceiptState;
  readonly approvals: readonly D6StorageApprovalV1[];
  readonly reservedIdentities: readonly D6StorageReservedIdentityV1[];
  readonly writes: readonly D6StorageWriteV1[];
  readonly beforeRevision: number;
  readonly afterRevision: number | null;
  readonly beforeLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly afterLocations: Readonly<Record<string, D6StorageLocationV1>>;
  readonly response: D6StorageSafeMoveResultV1 | null;
  readonly responseHash: string | null;
  readonly undoEligible: boolean;
}

export interface D6StorageConfigurationReceiptV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly kind: "root" | "root-removal" | "item";
  readonly state:
    | "intent-recorded"
    | "reserved"
    | "documents-applied"
    | "ledger-applied"
    | "completed"
    | "compensated"
    | "needs-attention";
  readonly beforeRevision: number;
  readonly afterLedger: D6StorageLedgerV1;
  readonly actorConfigured: {
    readonly actorUuid: string;
    readonly before: boolean;
    readonly after: boolean;
  } | null;
  readonly writes: readonly D6StorageWriteV1[];
  /** Historical receipts whose detached identities can no longer be undone. */
  readonly disabledUndoReceiptOperationIds?: readonly string[];
}

export interface D6StorageAuthorityStateV1 {
  readonly version: 1;
  readonly ledger: D6StorageLedgerV1;
  readonly receipts: Readonly<Record<string, D6StorageTransactionReceiptV1>>;
  readonly configurationReceipts?: Readonly<
    Record<string, D6StorageConfigurationReceiptV1>
  >;
  /** Encrypted, GM-only recovery context for currency held by storage roots. */
  readonly currencyTransferRecoveries?: Readonly<
    Record<string, D6CurrencyHolderTransferRecoveryV1>
  >;
}
