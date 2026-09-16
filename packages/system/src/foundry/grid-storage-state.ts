import {
  D6_GRID_STORAGE_CONTRACT_VERSION,
  type D6CurrencyHolderTransferRecoveryV1,
  type D6StorageAuthorityStateV1,
  type D6StorageConfigurationReceiptV1,
  type D6StorageLedgerV1,
  type D6StorageTransactionReceiptV1,
  type D6StorageWriteV1,
  validateStorageLedger,
} from "@d6-system-2e/core";

import { SYSTEM_ID } from "../constants.js";
import {
  destinyClientIsAuthority,
  destinyEnrolledGMIds,
  openDestinyEnvelope,
  sealDestiny,
  type DestinyEnvelopeV1,
} from "./destiny-crypto.js";
import { notifyGridStorageCommittedRoots } from "./grid-storage-authority.js";

export const GRID_STORAGE_LEDGER_SETTING = "gridStorageLedgerV1";
export const GRID_STORAGE_LEDGER_TOPIC = "grid-storage-ledger";

export function initialGridStorageLedger(): D6StorageLedgerV1 {
  return { version: 1, revision: 0, roots: {}, objects: {} };
}

export function initialGridStorageAuthorityState(): D6StorageAuthorityStateV1 {
  return {
    version: 1,
    ledger: initialGridStorageLedger(),
    receipts: {},
    configurationReceipts: {},
    currencyTransferRecoveries: {},
  };
}

function envelope(value: unknown): DestinyEnvelopeV1 | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 1
  )
    return undefined;
  return value as DestinyEnvelopeV1;
}

export function requireGridStorageLedger(value: unknown): D6StorageLedgerV1 {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !==
      D6_GRID_STORAGE_CONTRACT_VERSION
  )
    throw new TypeError("D6E2.Storage.Error.UnsupportedLedger");
  const ledger = value as D6StorageLedgerV1;
  const validation = validateStorageLedger(ledger);
  if (!validation.valid)
    throw new TypeError("D6E2.Storage.Error.InvalidLedger");
  return ledger;
}

function validReceipt(
  operationId: string,
  value: unknown,
): value is D6StorageTransactionReceiptV1 {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<D6StorageTransactionReceiptV1>;
  const beforeRevision = receipt.beforeRevision;
  const afterRevision = receipt.afterRevision;
  return (
    receipt.version === 1 &&
    receipt.operationId === operationId &&
    typeof receipt.intentHash === "string" &&
    receipt.intentHash.length > 0 &&
    typeof receipt.planHash === "string" &&
    typeof receipt.requesterUserId === "string" &&
    typeof receipt.authorityUserId === "string" &&
    typeof beforeRevision === "number" &&
    Number.isSafeInteger(beforeRevision) &&
    beforeRevision >= 0 &&
    (afterRevision === null ||
      (typeof afterRevision === "number" &&
        Number.isSafeInteger(afterRevision) &&
        afterRevision >= beforeRevision)) &&
    Array.isArray(receipt.approvals) &&
    Array.isArray(receipt.reservedIdentities) &&
    Array.isArray(receipt.writes) &&
    !!receipt.request &&
    typeof receipt.request === "object" &&
    !!receipt.beforeLocations &&
    typeof receipt.beforeLocations === "object" &&
    !!receipt.afterLocations &&
    typeof receipt.afterLocations === "object"
  );
}

function validConfigurationReceipt(
  operationId: string,
  value: unknown,
): value is D6StorageConfigurationReceiptV1 {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<D6StorageConfigurationReceiptV1>;
  const beforeRevision = receipt.beforeRevision;
  if (
    receipt.version !== 1 ||
    receipt.operationId !== operationId ||
    !["root", "root-removal", "item"].includes(String(receipt.kind)) ||
    ![
      "intent-recorded",
      "reserved",
      "documents-applied",
      "ledger-applied",
      "completed",
      "compensated",
      "needs-attention",
    ].includes(String(receipt.state)) ||
    typeof beforeRevision !== "number" ||
    !Number.isSafeInteger(beforeRevision) ||
    beforeRevision < 0 ||
    receipt.afterLedger?.revision !== beforeRevision + 1 ||
    !Array.isArray(receipt.writes) ||
    receipt.writes.some((write: unknown) => !validConfigurationWrite(write)) ||
    (receipt.disabledUndoReceiptOperationIds !== undefined &&
      (!Array.isArray(receipt.disabledUndoReceiptOperationIds) ||
        receipt.disabledUndoReceiptOperationIds.length > 4096 ||
        receipt.disabledUndoReceiptOperationIds.some(
          (id: unknown) => typeof id !== "string" || id.length === 0,
        )))
  )
    return false;
  try {
    requireGridStorageLedger(receipt.afterLedger);
  } catch {
    return false;
  }
  const actor = receipt.actorConfigured;
  return (
    actor === null ||
    (typeof actor?.actorUuid === "string" &&
      actor.actorUuid.length > 0 &&
      typeof actor.before === "boolean" &&
      typeof actor.after === "boolean")
  );
}

function validHolderReference(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const reference = value as {
    id?: unknown;
    kind?: unknown;
    version?: unknown;
  };
  return (
    reference.version === 1 &&
    (reference.kind === "root" || reference.kind === "container") &&
    typeof reference.id === "string" &&
    reference.id.length > 0 &&
    reference.id.length <= 256
  );
}

function validCurrencyTransferRecovery(
  operationId: string,
  value: unknown,
): value is D6CurrencyHolderTransferRecoveryV1 {
  if (!value || typeof value !== "object") return false;
  const recovery = value as Partial<D6CurrencyHolderTransferRecoveryV1>;
  const request = recovery.request;
  return (
    recovery.version === 1 &&
    recovery.operationId === operationId &&
    typeof recovery.intent === "string" &&
    /^[a-f0-9]{64}$/u.test(recovery.intent) &&
    typeof recovery.createdAt === "number" &&
    Number.isFinite(recovery.createdAt) &&
    typeof recovery.requesterUserId === "string" &&
    recovery.requesterUserId.length > 0 &&
    recovery.requesterUserId.length <= 128 &&
    (recovery.targetControllerUserId === null ||
      (typeof recovery.targetControllerUserId === "string" &&
        recovery.targetControllerUserId.length > 0 &&
        recovery.targetControllerUserId.length <= 128)) &&
    !!request &&
    (request as { readonly version?: unknown }).version === 1 &&
    typeof request.amount === "string" &&
    request.amount.length > 0 &&
    request.amount.length <= 80 &&
    typeof request.definitionFingerprint === "string" &&
    request.definitionFingerprint.length > 0 &&
    request.definitionFingerprint.length <= 128 &&
    typeof request.definitionRevision === "number" &&
    Number.isSafeInteger(request.definitionRevision) &&
    request.definitionRevision >= 0 &&
    typeof request.denominationId === "string" &&
    request.denominationId.length > 0 &&
    request.denominationId.length <= 64 &&
    typeof request.expectedSourceTotalSmallestUnit === "string" &&
    request.expectedSourceTotalSmallestUnit.length > 0 &&
    request.expectedSourceTotalSmallestUnit.length <= 80 &&
    typeof request.expectedTargetTotalSmallestUnit === "string" &&
    request.expectedTargetTotalSmallestUnit.length > 0 &&
    request.expectedTargetTotalSmallestUnit.length <= 80 &&
    typeof request.expectedSourceWalletFingerprint === "string" &&
    request.expectedSourceWalletFingerprint.length > 0 &&
    request.expectedSourceWalletFingerprint.length <= 128 &&
    typeof request.expectedTargetWalletFingerprint === "string" &&
    request.expectedTargetWalletFingerprint.length > 0 &&
    request.expectedTargetWalletFingerprint.length <= 128 &&
    validHolderReference(request.source) &&
    validHolderReference(request.target)
  );
}

function validConfigurationWrite(value: unknown): value is D6StorageWriteV1 {
  if (!value || typeof value !== "object") return false;
  const write = value as Partial<D6StorageWriteV1>;
  return (
    write.kind === "update" &&
    !!write.before &&
    !!write.after &&
    write.documentUuid === write.before.documentUuid &&
    write.documentUuid === write.after.documentUuid
  );
}

export function requireGridStorageAuthorityState(
  value: unknown,
): D6StorageAuthorityStateV1 {
  if (!value || typeof value !== "object")
    throw new TypeError("D6E2.Storage.Error.InvalidAuthorityState");
  const state = value as Partial<D6StorageAuthorityStateV1>;
  const configurationReceipts = state.configurationReceipts ?? {};
  const currencyTransferRecoveries = state.currencyTransferRecoveries ?? {};
  if (
    state.version !== 1 ||
    !state.receipts ||
    typeof state.receipts !== "object" ||
    Array.isArray(state.receipts) ||
    Object.keys(state.receipts).length > 4096 ||
    Object.entries(state.receipts).some(
      ([operationId, receipt]) => !validReceipt(operationId, receipt),
    ) ||
    typeof configurationReceipts !== "object" ||
    Array.isArray(configurationReceipts) ||
    Object.keys(configurationReceipts).length > 4096 ||
    Object.entries(configurationReceipts).some(
      ([operationId, receipt]) =>
        !validConfigurationReceipt(operationId, receipt),
    ) ||
    typeof currencyTransferRecoveries !== "object" ||
    Array.isArray(currencyTransferRecoveries) ||
    Object.keys(currencyTransferRecoveries).length > 4096 ||
    Object.entries(currencyTransferRecoveries).some(
      ([operationId, recovery]) =>
        !validCurrencyTransferRecovery(operationId, recovery),
    )
  )
    throw new TypeError("D6E2.Storage.Error.InvalidAuthorityState");
  requireGridStorageLedger(state.ledger);
  return structuredClone({
    ...(state as D6StorageAuthorityStateV1),
    configurationReceipts,
    currencyTransferRecoveries,
  });
}

export async function readCurrencyHolderTransferRecoveries(): Promise<
  Readonly<Record<string, D6CurrencyHolderTransferRecoveryV1>>
> {
  return (
    (await readGridStorageAuthorityState()).currencyTransferRecoveries ?? {}
  );
}

export async function recordCurrencyHolderTransferRecovery(
  recovery: D6CurrencyHolderTransferRecoveryV1,
): Promise<void> {
  await mutateGridStorageAuthorityState(null, (state) => {
    const existing = state.currencyTransferRecoveries?.[recovery.operationId];
    if (existing && JSON.stringify(existing) !== JSON.stringify(recovery))
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    return [
      {
        ...state,
        currencyTransferRecoveries: {
          ...state.currencyTransferRecoveries,
          [recovery.operationId]: recovery,
        },
      },
      undefined,
    ] as const;
  });
}

export async function removeCurrencyHolderTransferRecovery(
  operationId: string,
  intent: string,
): Promise<void> {
  await mutateGridStorageAuthorityState(null, (state) => {
    const existing = state.currencyTransferRecoveries?.[operationId];
    if (existing?.intent !== intent) return [state, undefined] as const;
    const currencyTransferRecoveries = {
      ...state.currencyTransferRecoveries,
    };
    Reflect.deleteProperty(currencyTransferRecoveries, operationId);
    return [{ ...state, currencyTransferRecoveries }, undefined] as const;
  });
}

export async function readGridStorageAuthorityState(): Promise<D6StorageAuthorityStateV1> {
  const stored = game.settings.get(SYSTEM_ID, GRID_STORAGE_LEDGER_SETTING);
  if (stored === null || stored === undefined)
    return initialGridStorageAuthorityState();
  return requireGridStorageAuthorityState(
    await openDestinyEnvelope<D6StorageAuthorityStateV1>(
      GRID_STORAGE_LEDGER_TOPIC,
      stored,
    ),
  );
}

export async function readGridStorageLedger(): Promise<D6StorageLedgerV1> {
  return (await readGridStorageAuthorityState()).ledger;
}

export async function writeGridStorageAuthorityState(
  state: D6StorageAuthorityStateV1,
  previous?: DestinyEnvelopeV1,
): Promise<void> {
  if (!game.user?.isGM || !destinyClientIsAuthority())
    throw new Error("D6E2.Storage.Error.Authority");
  const validated = requireGridStorageAuthorityState(state);
  const recipients = destinyEnrolledGMIds().filter(
    (id) => game.users?.get(id)?.isGM,
  );
  if (!recipients.includes(game.user.id)) recipients.push(game.user.id);
  const sealed = await sealDestiny(
    GRID_STORAGE_LEDGER_TOPIC,
    validated,
    recipients,
    previous,
    true,
  );
  if (!destinyClientIsAuthority())
    throw new Error("D6E2.Storage.Error.Authority");
  await game.settings.set(SYSTEM_ID, GRID_STORAGE_LEDGER_SETTING, sealed);
}

export async function writeGridStorageLedger(
  ledger: D6StorageLedgerV1,
  previous?: DestinyEnvelopeV1,
): Promise<void> {
  requireGridStorageLedger(ledger);
  const current = previous
    ? requireGridStorageAuthorityState(
        await openDestinyEnvelope<D6StorageAuthorityStateV1>(
          GRID_STORAGE_LEDGER_TOPIC,
          previous,
        ),
      )
    : await readGridStorageAuthorityState();
  await writeGridStorageAuthorityState({ ...current, ledger }, previous);
}

let mutationTail: Promise<unknown> = Promise.resolve();
let authorityEffectTail: Promise<unknown> = Promise.resolve();

function storageObjectRoot(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const location = (value as { location?: unknown }).location;
  if (!location || typeof location !== "object") return null;
  const candidate = location as {
    state?: unknown;
    rootUuid?: unknown;
    parent?: { rootUuid?: unknown };
  };
  const rootUuid =
    candidate.state === "unplaced"
      ? candidate.rootUuid
      : candidate.parent?.rootUuid;
  return typeof rootUuid === "string" && rootUuid.length > 0 ? rootUuid : null;
}

export function changedGridStorageRoots(
  before: D6StorageLedgerV1,
  after: D6StorageLedgerV1,
): readonly string[] {
  const roots = new Set<string>();
  for (const rootUuid of new Set([
    ...Object.keys(before.roots),
    ...Object.keys(after.roots),
  ]))
    if (
      JSON.stringify(before.roots[rootUuid]) !==
      JSON.stringify(after.roots[rootUuid])
    )
      roots.add(rootUuid);
  for (const instanceId of new Set([
    ...Object.keys(before.objects),
    ...Object.keys(after.objects),
  ])) {
    const previous = before.objects[instanceId];
    const next = after.objects[instanceId];
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    const previousRoot = storageObjectRoot(previous);
    const nextRoot = storageObjectRoot(next);
    if (previousRoot) roots.add(previousRoot);
    if (nextRoot) roots.add(nextRoot);
  }
  return [...roots].sort();
}

export function runGridStorageAuthorityEffect<T>(
  effect: () => Promise<T>,
): Promise<T> {
  const result = authorityEffectTail.catch(() => undefined).then(effect);
  authorityEffectTail = result;
  return result;
}

export function mutateGridStorageAuthorityState<T>(
  expectedRevision: number | null,
  mutation: (
    state: D6StorageAuthorityStateV1,
  ) =>
    | Promise<readonly [D6StorageAuthorityStateV1, T]>
    | readonly [D6StorageAuthorityStateV1, T],
  options: { readonly configurationOperationId?: string } = {},
): Promise<T> {
  const execute = async (): Promise<T> => {
    const stored = game.settings.get(SYSTEM_ID, GRID_STORAGE_LEDGER_SETTING);
    const previous = envelope(stored);
    const state = previous
      ? requireGridStorageAuthorityState(
          await openDestinyEnvelope<D6StorageAuthorityStateV1>(
            GRID_STORAGE_LEDGER_TOPIC,
            previous,
          ),
        )
      : initialGridStorageAuthorityState();
    if (expectedRevision !== null && state.ledger.revision !== expectedRevision)
      throw new Error("D6E2.Storage.Error.Stale");
    const [next, result] = await mutation(state);
    requireGridStorageAuthorityState(next);
    if (next.ledger.revision < state.ledger.revision)
      throw new TypeError("D6E2.Storage.Error.InvalidRevision");
    const activeConfiguration = Object.values(
      state.configurationReceipts ?? {},
    ).find(
      (receipt) =>
        receipt.state === "intent-recorded" ||
        receipt.state === "reserved" ||
        receipt.state === "documents-applied",
    );
    if (
      next.ledger.revision !== state.ledger.revision &&
      activeConfiguration &&
      activeConfiguration.operationId !== options.configurationOperationId
    )
      throw new Error("D6E2.Storage.Error.AuthorityBusy");
    await writeGridStorageAuthorityState(next, previous);
    if (next.ledger.revision > state.ledger.revision) {
      const changedRoots = changedGridStorageRoots(state.ledger, next.ledger);
      if (changedRoots.length > 0)
        void notifyGridStorageCommittedRoots(changedRoots).catch(
          () => undefined,
        );
    }
    return result;
  };
  const result = mutationTail.catch(() => undefined).then(execute);
  mutationTail = result;
  return result;
}

export function mutateGridStorageLedger<T>(
  expectedRevision: number | null,
  mutation: (
    ledger: D6StorageLedgerV1,
  ) =>
    Promise<readonly [D6StorageLedgerV1, T]> | readonly [D6StorageLedgerV1, T],
): Promise<T> {
  return mutateGridStorageAuthorityState(expectedRevision, async (state) => {
    const [next, result] = await mutation(state.ledger);
    if (next.revision !== state.ledger.revision + 1)
      throw new TypeError("D6E2.Storage.Error.InvalidRevision");
    return [{ ...state, ledger: next }, result] as const;
  });
}

export function registerGridStorageState(): void {
  game.settings.register(SYSTEM_ID, GRID_STORAGE_LEDGER_SETTING, {
    name: "D6E2.Storage.AuthoritySetting",
    hint: "D6E2.Storage.AuthoritySettingHint",
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });
}

export function resetGridStorageStateForTests(): void {
  mutationTail = Promise.resolve();
  authorityEffectTail = Promise.resolve();
}
