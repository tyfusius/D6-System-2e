export const D6_CURRENCY_CONTRACT_VERSION = 1 as const;

export interface D6CurrencyDenominationV1 {
  readonly displayPrecision: number;
  readonly id: string;
  readonly pluralName: string;
  /** The main denomination uses "1". Every child ratio is relative to its parent. */
  readonly ratioToParent: string;
  readonly singularName: string;
  readonly symbol: string;
}

/** One setting-owned value system. Denominations are ordered main to smallest. */
export interface D6CurrencyDefinitionV1 {
  readonly denominations: readonly D6CurrencyDenominationV1[];
  readonly id: string;
  /** Incremented only when denomination identity, order, or ratios change. */
  readonly revision: number;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyOperationReceiptV1 {
  /** Persisted only while a transfer needs a supported recovery action. */
  readonly createdAt?: number;
  /** Canonical request/source intent. The same operation ID cannot change intent. */
  readonly intent: string;
  readonly recoveryRequest?: string;
  readonly requesterUserId?: string;
  readonly status: "complete" | "pending-transfer";
}

export interface D6CurrencyWalletV1 {
  readonly counts: Readonly<Record<string, string>>;
  /** Durable conversion basis for safe preview/migration after profile edits. */
  readonly definition: D6CurrencyDefinitionV1;
  readonly definitionFingerprint: string;
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly legacyDecimal?: string;
  /** Durable intent and outcome records, including interrupted transfers. */
  readonly operationReceipts: Readonly<
    Record<string, D6CurrencyOperationReceiptV1>
  >;
  /** Durable replay guard for completed currency operations. */
  readonly recentOperationIds: readonly string[];
  readonly status: "active" | "unresolved-legacy";
  /** Derived from counts and checked whenever the wallet is read or changed. */
  readonly totalSmallestUnit: string;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyValueV1 {
  readonly amountSmallestUnit: string;
  /** Latest value authored through the unresolved legacy price control. */
  readonly authoredDecimal?: string;
  /** Durable conversion basis for historical display and safe migration. */
  readonly definition: D6CurrencyDefinitionV1;
  readonly definitionFingerprint: string;
  readonly definitionId: string;
  readonly definitionRevision: number;
  /** Preserved source when a legacy decimal is not representable by this chain. */
  readonly legacyDecimal?: string;
  readonly status: "active" | "unresolved-legacy";
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyHolderRefV1 {
  /** Stable Actor UUID for roots or storage instance ID for containers. */
  readonly id: string;
  readonly kind: "root" | "container";
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyHolderTransferRequestV1 {
  readonly amount: string;
  readonly definitionFingerprint: string;
  readonly definitionRevision: number;
  readonly denominationId: string;
  readonly expectedSourceTotalSmallestUnit: string;
  readonly expectedSourceWalletFingerprint: string;
  readonly expectedTargetTotalSmallestUnit: string;
  readonly expectedTargetWalletFingerprint: string;
  readonly source: D6CurrencyHolderRefV1;
  readonly target: D6CurrencyHolderRefV1;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

/** Authority-private durable context for an interrupted holder transfer.
 * This record is sealed to enrolled GMs and must never be copied into a
 * player-visible wallet receipt or socket approval payload. */
export interface D6CurrencyHolderTransferRecoveryV1 {
  readonly createdAt: number;
  readonly intent: string;
  readonly operationId: string;
  readonly request: D6CurrencyHolderTransferRequestV1;
  readonly requesterUserId: string;
  readonly targetControllerUserId: string | null;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyHolderTransferPlanV1 {
  readonly amount: string;
  readonly denominationId: string;
  readonly sourceAfter: D6CurrencyWalletV1;
  readonly sourceBefore: D6CurrencyWalletV1;
  readonly targetAfter: D6CurrencyWalletV1;
  readonly targetBefore: D6CurrencyWalletV1;
  readonly valueSmallestUnit: string;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyExchangeRequestV1 {
  readonly definitionFingerprint: string;
  readonly definitionRevision: number;
  readonly expectedTotalSmallestUnit: string;
  readonly expectedWalletFingerprint: string;
  readonly fromDenominationId: string;
  readonly quantity: string;
  readonly requestId: string;
  readonly toDenominationId: string;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyExchangePreviewV1 {
  readonly after: D6CurrencyWalletV1;
  readonly before: D6CurrencyWalletV1;
  readonly exactValueSmallestUnit: string;
  readonly fromCount: string;
  readonly fromDenominationId: string;
  readonly receivedCount: string;
  readonly remainderCount: string;
  readonly remainderSmallestUnit: string;
  readonly toCount: string;
  readonly toDenominationId: string;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}

export interface D6CurrencyMigrationPreviewV1<T> {
  readonly exact: boolean;
  readonly reason?:
    | "different-value-system"
    | "invalid-stored-wallet"
    | "nonrepresentable-value"
    | "pending-transfer"
    | "unresolved-legacy";
  readonly source: T;
  readonly target?: T;
  readonly version: typeof D6_CURRENCY_CONTRACT_VERSION;
}
