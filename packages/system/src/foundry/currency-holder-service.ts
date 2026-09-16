import {
  createCurrencyWallet,
  currencyInteger,
  currencyWalletFingerprint,
  effectiveStorageAvailability,
  planCurrencyHolderTransfer,
  type D6CurrencyHolderRefV1,
  type D6CurrencyHolderTransferRecoveryV1,
  type D6CurrencyHolderTransferRequestV1,
  type D6CurrencyOperationReceiptV1,
  type D6CurrencyWalletV1,
  type D6StorageLocationV1,
} from "@d6-system-2e/core";
import { canonical } from "../application/first-edition-action-validation.js";
import { currentSettingProfile } from "../settings/setting-profile.js";
import {
  actorCurrencyWalletState,
  currencyWalletChanges,
  currencyWalletEditFingerprint,
  storageCurrencyWalletChanges,
  storageCurrencyWalletState,
  walletWithOperation,
  walletWithUpdatedOperation,
  type D6CurrencyWalletState,
} from "./currency-state.js";
import { gridStorageItemParticipates } from "./grid-storage-document-adapter.js";
import {
  readCurrencyHolderTransferRecoveries,
  readGridStorageLedger,
  recordCurrencyHolderTransferRecovery,
  removeCurrencyHolderTransferRecovery,
  runGridStorageAuthorityEffect,
} from "./grid-storage-state.js";
import { synchronizeGridStorageItemWitness } from "./grid-storage-mutation-guard.js";
import { GRID_STORAGE_AUTHORITY_WRITE_OPTION } from "./grid-storage-mutation-guard.js";
import type { GridStorageClientProjection } from "./grid-storage-authority.js";
import {
  registerD6PendingInteraction,
  resolveD6PendingInteraction,
} from "../application/pending-interactions.js";

const ROOT_TYPES = new Set([
  "character",
  "vehicle",
  "starship",
  "storage-location",
]);
const registeredRecoveries = new Set<string>();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function locationRoot(location: D6StorageLocationV1): string {
  return location.state === "unplaced"
    ? location.rootUuid
    : location.parent.rootUuid;
}

function owns(actor: FoundryActorDocument, user: FoundryUser): boolean {
  return user.isGM || actor.testUserPermission(user, "OWNER");
}

function holderReferenceKey(reference: D6CurrencyHolderRefV1): string {
  return `${reference.kind}:${reference.id}`;
}

export function rootCurrencyHolderRef(
  actor: FoundryActorDocument & { readonly uuid: string },
): D6CurrencyHolderRefV1 {
  return Object.freeze({ id: actor.uuid, kind: "root", version: 1 });
}

export function containerCurrencyHolderRef(
  instanceId: string,
): D6CurrencyHolderRefV1 {
  if (!instanceId.trim())
    throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  return Object.freeze({ id: instanceId, kind: "container", version: 1 });
}

export interface D6ResolvedCurrencyHolder {
  readonly custodyRoot: FoundryActorDocument & { readonly uuid: string };
  readonly document: FoundryActorDocument | FoundryItemDocument;
  readonly label: string;
  readonly ownerRoot: FoundryActorDocument & { readonly uuid: string };
  readonly reachable: boolean;
  readonly reference: D6CurrencyHolderRefV1;
  readonly state: D6CurrencyWalletState;
}

async function actorDocument(
  uuid: string,
): Promise<(FoundryActorDocument & { readonly uuid: string }) | null> {
  const document = (await fromUuid(uuid)) as FoundryActorDocument | null;
  return document?.uuid === uuid && ROOT_TYPES.has(document.type)
    ? (document as FoundryActorDocument & { readonly uuid: string })
    : null;
}

export async function resolveCurrencyHolder(
  reference: D6CurrencyHolderRefV1,
): Promise<D6ResolvedCurrencyHolder> {
  if ((reference as { readonly version?: unknown }).version !== 1)
    throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  const ledger = await readGridStorageLedger();
  if (reference.kind === "root") {
    if (!ledger.roots[reference.id])
      throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
    const actor = await actorDocument(reference.id);
    if (!actor)
      throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
    return Object.freeze({
      custodyRoot: actor,
      document: actor,
      label: actor.name,
      ownerRoot: actor,
      reachable: true,
      reference: rootCurrencyHolderRef(actor),
      state:
        actor.type === "character"
          ? actorCurrencyWalletState(actor)
          : storageCurrencyWalletState(actor),
    });
  }
  const object = ledger.objects[reference.id];
  if (!object) throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  const item = (await fromUuid(
    object.documentUuid,
  )) as FoundryItemDocument | null;
  if (
    item?.uuid !== object.documentUuid ||
    !item.parent?.uuid ||
    !gridStorageItemParticipates(item) ||
    record(item.system.storageInterior).configured !== true ||
    record(item.system).storageInstanceId !== reference.id
  )
    throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  const ownerRoot = await actorDocument(object.ownerActorUuid);
  const custodyRoot = await actorDocument(locationRoot(object.location));
  if (!ownerRoot || !custodyRoot || item.parent.uuid !== ownerRoot.uuid)
    throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  return Object.freeze({
    custodyRoot,
    document: item,
    label: item.name,
    ownerRoot,
    reachable: effectiveStorageAvailability(
      ledger,
      reference.id,
      custodyRoot.uuid,
    ).reachable,
    reference: containerCurrencyHolderRef(reference.id),
    state: storageCurrencyWalletState(item),
  });
}

export function userMayControlCurrencyHolder(
  holder: D6ResolvedCurrencyHolder,
  user: FoundryUser,
): boolean {
  return (
    user.active &&
    owns(holder.ownerRoot, user) &&
    owns(holder.custodyRoot, user)
  );
}

async function writeHolderWallet(
  holder: D6ResolvedCurrencyHolder,
  wallet: D6CurrencyWalletV1,
): Promise<void> {
  const containerDocument =
    "parent" in holder.document &&
    (holder.document as { readonly parent?: unknown }).parent
      ? holder.document
      : null;
  await holder.document.update(
    holder.document.type === "character"
      ? currencyWalletChanges(wallet)
      : storageCurrencyWalletChanges(wallet),
    containerDocument
      ? { [GRID_STORAGE_AUTHORITY_WRITE_OPTION]: true }
      : undefined,
  );
  if (containerDocument)
    await synchronizeGridStorageItemWitness(containerDocument);
}

async function transferIntent(
  request: D6CurrencyHolderTransferRequestV1,
  requesterUserId: string,
  targetControllerUserId: string | null,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      canonical({ requesterUserId, targetControllerUserId, ...request }),
    ),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function transferCounts(
  wallet: D6CurrencyWalletV1,
  denominationId: string,
  delta: bigint,
): Readonly<Record<string, string>> {
  if (!Object.hasOwn(wallet.counts, denominationId))
    throw new Error("D6E2.Economy.Error.UnknownDenomination");
  const next = currencyInteger(wallet.counts[denominationId] ?? "0") + delta;
  if (next < 0n) throw new Error("D6E2.Economy.Error.InsufficientDenomination");
  return Object.freeze({
    ...wallet.counts,
    [denominationId]: next.toString(),
  });
}

function matchingReceipt(
  wallet: D6CurrencyWalletV1,
  operationId: string,
  intent: string,
  status: D6CurrencyOperationReceiptV1["status"],
): boolean {
  const receipt = wallet.operationReceipts[operationId];
  return receipt?.intent === intent && receipt.status === status;
}

function walletWithoutOperation(
  wallet: D6CurrencyWalletV1,
  operationId: string,
): D6CurrencyWalletV1 {
  const receipts = { ...wallet.operationReceipts };
  Reflect.deleteProperty(receipts, operationId);
  return createCurrencyWallet(
    wallet.definition,
    wallet.counts,
    wallet.recentOperationIds.filter((id) => id !== operationId),
    receipts,
  );
}

export interface D6CurrencyHolderTransferResult {
  readonly amount: string;
  readonly denominationId: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly valueSmallestUnit: string;
}

/** Elected-authority execution. A retry with the same operation and intent
 * resumes debit -> credit -> finalize without applying either side twice. */
export function executeCurrencyHolderTransfer(
  request: D6CurrencyHolderTransferRequestV1,
  requester: FoundryUser,
  operationId: string,
  targetControllerValue: string | null | boolean,
): Promise<D6CurrencyHolderTransferResult> {
  return runGridStorageAuthorityEffect(async () => {
    const targetControllerUserId =
      typeof targetControllerValue === "string" ? targetControllerValue : null;
    if (!game.user?.isGM || !requester.active || !operationId.trim())
      throw new Error("D6E2.Economy.Error.NotAuthorized");
    let source = await resolveCurrencyHolder(request.source);
    let target = await resolveCurrencyHolder(request.target);
    if (!userMayControlCurrencyHolder(source, requester))
      throw new Error("D6E2.Economy.Error.NotAuthorized");
    const sameControlBoundary =
      source.ownerRoot.uuid === target.ownerRoot.uuid &&
      source.custodyRoot.uuid === target.custodyRoot.uuid;
    const assertCurrentControl = (
      currentSource: D6ResolvedCurrencyHolder,
      currentTarget: D6ResolvedCurrencyHolder,
    ): void => {
      if (!currentSource.reachable || !currentTarget.reachable)
        throw new Error("D6E2.Storage.Unreachable");
      if (!userMayControlCurrencyHolder(currentSource, requester))
        throw new Error("D6E2.Economy.Error.NotAuthorized");
      if (
        !sameControlBoundary &&
        !userMayControlCurrencyHolder(currentTarget, requester)
      ) {
        const controller = targetControllerUserId
          ? game.users?.get(targetControllerUserId)
          : undefined;
        if (
          !controller ||
          !userMayControlCurrencyHolder(currentTarget, controller)
        )
          throw new Error("D6E2.Economy.Error.NotAuthorized");
      }
    };
    assertCurrentControl(source, target);
    const intent = await transferIntent(
      request,
      requester.id,
      targetControllerUserId,
    );
    const recoveries = await readCurrencyHolderTransferRecoveries();
    const recovery = recoveries[operationId];
    if (
      recovery &&
      (recovery.intent !== intent ||
        recovery.requesterUserId !== requester.id ||
        recovery.targetControllerUserId !== targetControllerUserId ||
        canonical(recovery.request) !== canonical(request))
    )
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    const sourceReceipt = source.state.wallet.operationReceipts[operationId];
    const targetReceipt = target.state.wallet.operationReceipts[operationId];
    if (
      [source.state.wallet, target.state.wallet].some((wallet) =>
        Object.entries(wallet.operationReceipts).some(
          ([id, receipt]) =>
            id !== operationId && receipt.status === "pending-transfer",
        ),
      )
    )
      throw new Error("D6E2.Economy.Error.StaleBalance");
    const resumesExactPendingTransfer =
      Boolean(recovery ?? sourceReceipt ?? targetReceipt) &&
      (!sourceReceipt || sourceReceipt.intent === intent) &&
      (!targetReceipt || targetReceipt.intent === intent) &&
      source.state.wallet.definitionFingerprint ===
        request.definitionFingerprint &&
      target.state.wallet.definitionFingerprint ===
        request.definitionFingerprint;
    if (
      (source.state.stale || target.state.stale) &&
      !resumesExactPendingTransfer
    )
      throw new Error("D6E2.Economy.Error.StaleDefinition");
    if (source.state.unresolvedLegacy || target.state.unresolvedLegacy)
      throw new Error("D6E2.Economy.Error.UnresolvedLegacyValue");
    if (
      matchingReceipt(source.state.wallet, operationId, intent, "complete") &&
      matchingReceipt(target.state.wallet, operationId, intent, "complete")
    ) {
      await removeCurrencyHolderTransferRecovery(operationId, intent);
      return {
        amount: request.amount,
        denominationId: request.denominationId,
        sourceLabel: source.label,
        targetLabel: target.label,
        valueSmallestUnit: "0",
      };
    }
    if (
      (sourceReceipt && sourceReceipt.intent !== intent) ||
      (targetReceipt && targetReceipt.intent !== intent)
    )
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    if (sourceReceipt) {
      const status = (sourceReceipt as { readonly status?: unknown }).status;
      if (status !== "pending-transfer" && status !== "complete")
        throw new Error("D6E2.Economy.Error.DuplicateRequest");
    }
    if (targetReceipt) {
      const status = (targetReceipt as { readonly status?: unknown }).status;
      if (status !== "pending-transfer" && status !== "complete")
        throw new Error("D6E2.Economy.Error.DuplicateRequest");
    }
    if ((sourceReceipt || targetReceipt) && !recovery)
      throw new Error("D6E2.Economy.Error.DuplicateRequest");
    try {
      const targetBase = matchingReceipt(
        target.state.wallet,
        operationId,
        intent,
        "pending-transfer",
      )
        ? walletWithoutOperation(target.state.wallet, operationId)
        : target.state.wallet;
      let valueSmallestUnit = "0";
      if (!sourceReceipt) {
        const validatedPlan = planCurrencyHolderTransfer(
          source.state.wallet.definition,
          source.state.wallet,
          targetBase,
          request,
        );
        valueSmallestUnit = validatedPlan.valueSmallestUnit;
      }
      const recoveryRecord: D6CurrencyHolderTransferRecoveryV1 = recovery ?? {
        createdAt: Date.now(),
        intent,
        operationId,
        request,
        requesterUserId: requester.id,
        targetControllerUserId,
        version: 1,
      };
      if (!recovery) await recordCurrencyHolderTransferRecovery(recoveryRecord);
      const pendingReceipt = {
        createdAt: recoveryRecord.createdAt,
        intent,
        status: "pending-transfer" as const,
      };
      source = await resolveCurrencyHolder(request.source);
      target = await resolveCurrencyHolder(request.target);
      assertCurrentControl(source, target);
      const freshTargetReceipt =
        target.state.wallet.operationReceipts[operationId];
      if (!source.state.wallet.operationReceipts[operationId]) {
        const freshTargetBase = matchingReceipt(
          target.state.wallet,
          operationId,
          intent,
          "pending-transfer",
        )
          ? walletWithoutOperation(target.state.wallet, operationId)
          : target.state.wallet;
        const freshPlan = planCurrencyHolderTransfer(
          source.state.wallet.definition,
          source.state.wallet,
          freshTargetBase,
          request,
        );
        valueSmallestUnit = freshPlan.valueSmallestUnit;
      }
      if (!freshTargetReceipt) {
        await writeHolderWallet(
          target,
          walletWithOperation(
            target.state.wallet,
            operationId,
            target.state.wallet.counts,
            pendingReceipt,
          ),
        );
      }
      target = await resolveCurrencyHolder(request.target);
      source = await resolveCurrencyHolder(request.source);
      assertCurrentControl(source, target);
      if (!source.state.wallet.operationReceipts[operationId]) {
        const currentTargetBase = matchingReceipt(
          target.state.wallet,
          operationId,
          intent,
          "pending-transfer",
        )
          ? walletWithoutOperation(target.state.wallet, operationId)
          : target.state.wallet;
        const plan = planCurrencyHolderTransfer(
          source.state.wallet.definition,
          source.state.wallet,
          currentTargetBase,
          request,
        );
        valueSmallestUnit = plan.valueSmallestUnit;
        await writeHolderWallet(
          source,
          walletWithOperation(
            source.state.wallet,
            operationId,
            plan.sourceAfter.counts,
            pendingReceipt,
          ),
        );
      } else if (
        !matchingReceipt(
          source.state.wallet,
          operationId,
          intent,
          "pending-transfer",
        )
      ) {
        throw new Error("D6E2.Economy.Error.DuplicateRequest");
      }
      target = await resolveCurrencyHolder(request.target);
      source = await resolveCurrencyHolder(request.source);
      assertCurrentControl(source, target);
      if (
        !matchingReceipt(target.state.wallet, operationId, intent, "complete")
      ) {
        if (
          !matchingReceipt(
            target.state.wallet,
            operationId,
            intent,
            "pending-transfer",
          )
        )
          throw new Error("D6E2.Economy.Error.DuplicateRequest");
        await writeHolderWallet(
          target,
          walletWithUpdatedOperation(
            target.state.wallet,
            operationId,
            { intent, status: "complete" },
            transferCounts(
              target.state.wallet,
              request.denominationId,
              currencyInteger(request.amount, { positive: true }),
            ),
          ),
        );
      }
      source = await resolveCurrencyHolder(request.source);
      target = await resolveCurrencyHolder(request.target);
      assertCurrentControl(source, target);
      if (
        !matchingReceipt(source.state.wallet, operationId, intent, "complete")
      ) {
        if (
          !matchingReceipt(
            source.state.wallet,
            operationId,
            intent,
            "pending-transfer",
          )
        )
          throw new Error("D6E2.Economy.Error.DuplicateRequest");
        await writeHolderWallet(
          source,
          walletWithUpdatedOperation(source.state.wallet, operationId, {
            intent,
            status: "complete",
          }),
        );
      }
      await removeCurrencyHolderTransferRecovery(operationId, intent);
      return {
        amount: request.amount,
        denominationId: request.denominationId,
        sourceLabel: source.label,
        targetLabel: target.label,
        valueSmallestUnit,
      };
    } catch (error) {
      try {
        source = await resolveCurrencyHolder(request.source);
        target = await resolveCurrencyHolder(request.target);
        const currentSourceReceipt =
          source.state.wallet.operationReceipts[operationId];
        const currentTargetReceipt =
          target.state.wallet.operationReceipts[operationId];
        if (
          !currentSourceReceipt &&
          currentTargetReceipt?.intent === intent &&
          currentTargetReceipt.status === "pending-transfer"
        ) {
          await writeHolderWallet(
            target,
            walletWithoutOperation(target.state.wallet, operationId),
          );
          await removeCurrencyHolderTransferRecovery(operationId, intent);
        } else if (!currentSourceReceipt && !currentTargetReceipt) {
          await removeCurrencyHolderTransferRecovery(operationId, intent);
        }
      } catch {
        // Keep the encrypted recovery record when safe compensation cannot finish.
      }
      throw error;
    }
  });
}

export interface D6StorageFundsVM {
  readonly aliasedCharacterWallet: boolean;
  readonly canEdit: boolean;
  readonly canTransfer: boolean;
  readonly denominations: readonly {
    readonly count: string;
    readonly id: string;
    readonly inputName: string;
    readonly label: string;
    readonly symbol: string;
  }[];
  readonly empty: boolean;
  readonly guidance: string;
  readonly holderId: string;
  readonly holderKind: "root" | "container";
  readonly holderLabel: string;
  readonly invalid: boolean;
  readonly multiple: boolean;
  readonly stale: boolean;
  readonly totalSmallestUnit: string;
  readonly transferAction: "transferStorageFunds";
  readonly unresolvedLegacy: boolean;
  readonly visible: boolean;
  readonly walletFingerprint: string;
}

export interface D6StorageFundDestinationVM {
  readonly holderId: string;
  readonly kind: "root" | "container";
  readonly label: string;
  readonly ownerActorId: string;
  readonly requiresConsent: boolean;
  readonly rootLabel: string;
}

function denominationLabel(
  entry: D6CurrencyWalletV1["definition"]["denominations"][number],
): string {
  return entry.pluralName;
}

function referenceFromHolderId(holderId: string): D6CurrencyHolderRefV1 {
  const separator = holderId.indexOf(":");
  const kind = holderId.slice(0, separator);
  const id = holderId.slice(separator + 1);
  if ((kind !== "root" && kind !== "container") || !id)
    throw new Error("D6E2.Storage.Currency.Error.HolderUnavailable");
  return { id, kind, version: 1 };
}

export function activeCurrencyHolderControllers(
  holder: D6ResolvedCurrencyHolder,
): readonly FoundryUser[] {
  return (game.users?.contents ?? [])
    .filter(
      (user) =>
        user.active && !user.isGM && userMayControlCurrencyHolder(holder, user),
    )
    .sort((left, right) => {
      const leftAssigned = left.character?.id === holder.ownerRoot.id ? 0 : 1;
      const rightAssigned = right.character?.id === holder.ownerRoot.id ? 0 : 1;
      return leftAssigned - rightAssigned || left.id.localeCompare(right.id);
    });
}

export function parseCurrencyHolderId(holderId: string): D6CurrencyHolderRefV1 {
  return referenceFromHolderId(holderId);
}

export async function storageCurrencyFundsContext(
  actor: FoundryActorDocument & { readonly uuid: string },
  projection: GridStorageClientProjection,
  activeContainerInstanceId: string | null,
): Promise<{
  readonly fundDestinations: readonly D6StorageFundDestinationVM[];
  readonly funds: D6StorageFundsVM | null;
  readonly sourceHolder: D6ResolvedCurrencyHolder | null;
}> {
  const currentUser = game.user;
  if (!currentUser || !projection.workspace)
    return { fundDestinations: [], funds: null, sourceHolder: null };
  let source: D6ResolvedCurrencyHolder | null = null;
  if (!activeContainerInstanceId) {
    source = {
      custodyRoot: actor,
      document: actor,
      label: actor.name,
      ownerRoot: actor,
      reachable: true,
      reference: rootCurrencyHolderRef(actor),
      state:
        actor.type === "character"
          ? actorCurrencyWalletState(actor)
          : storageCurrencyWalletState(actor),
    };
  } else {
    const object = projection.objects[activeContainerInstanceId];
    const item = object
      ? ((await fromUuid(object.documentUuid)) as FoundryItemDocument | null)
      : null;
    const ownerRoot = object
      ? await actorDocument(object.ownerActorUuid)
      : null;
    if (
      object?.definition.interior &&
      item?.uuid === object.documentUuid &&
      item.parent?.uuid === ownerRoot?.uuid &&
      locationRoot(object.location) === actor.uuid &&
      record(item.system).storageInstanceId === activeContainerInstanceId &&
      record(item.system.storageInterior).configured === true &&
      ownerRoot
    ) {
      source = {
        custodyRoot: actor,
        document: item,
        label: item.name,
        ownerRoot,
        reachable: true,
        reference: containerCurrencyHolderRef(activeContainerInstanceId),
        state: storageCurrencyWalletState(item),
      };
    }
  }
  if (!source) return { fundDestinations: [], funds: null, sourceHolder: null };
  if (!userMayControlCurrencyHolder(source, currentUser))
    return { fundDestinations: [], funds: null, sourceHolder: null };
  const destinations = new Map<string, D6StorageFundDestinationVM>();
  const addRoot = (
    candidate: FoundryActorDocument & { readonly uuid: string },
  ) => {
    const reference = rootCurrencyHolderRef(candidate);
    if (holderReferenceKey(reference) === holderReferenceKey(source.reference))
      return;
    const controlled = owns(candidate, currentUser);
    const controllers = (game.users?.contents ?? []).filter(
      (user) => user.active && !user.isGM && owns(candidate, user),
    );
    if (!controlled && controllers.length === 0) return;
    destinations.set(holderReferenceKey(reference), {
      holderId: holderReferenceKey(reference),
      kind: "root",
      label: game.i18n.localize("D6E2.Storage.Funds"),
      ownerActorId: candidate.id,
      requiresConsent: !controlled,
      rootLabel: candidate.name,
    });
  };
  addRoot(actor);
  const rootUuids = new Set<string>([actor.uuid]);
  for (const destination of projection.destinations) {
    rootUuids.add(destination.parent.rootUuid);
  }
  for (const rootUuid of rootUuids) {
    const root = await actorDocument(rootUuid);
    if (root) addRoot(root);
  }
  const containerIds = new Set<string>();
  for (const object of Object.values(projection.objects))
    if (object.definition.interior)
      containerIds.add(object.definition.instanceId);
  for (const destination of projection.destinations)
    if (destination.parent.containerInstanceId)
      containerIds.add(destination.parent.containerInstanceId);
  for (const instanceId of containerIds) {
    const item = (game.actors?.contents ?? [])
      .flatMap((candidate) => candidate.items.contents)
      .find(
        (candidate) =>
          record(candidate.system).storageInstanceId === instanceId &&
          record(candidate.system.storageInterior).configured === true,
      );
    const parent = item?.parent;
    const projectionDestination = projection.destinations.find(
      ({ parent: candidate }) => candidate.containerInstanceId === instanceId,
    );
    const custodyRoot = projectionDestination
      ? await actorDocument(projectionDestination.parent.rootUuid)
      : actor;
    if (!item || !parent?.uuid || !custodyRoot) continue;
    const ownerRoot = await actorDocument(parent.uuid);
    if (
      !ownerRoot ||
      !owns(ownerRoot, currentUser) ||
      !owns(custodyRoot, currentUser)
    )
      continue;
    const reference = containerCurrencyHolderRef(instanceId);
    if (holderReferenceKey(reference) === holderReferenceKey(source.reference))
      continue;
    destinations.set(holderReferenceKey(reference), {
      holderId: holderReferenceKey(reference),
      kind: "container",
      label: item.name,
      ownerActorId: ownerRoot.id,
      requiresConsent: false,
      rootLabel: custodyRoot.name,
    });
  }
  for (const candidate of game.actors?.contents ?? []) {
    if (
      !candidate.uuid ||
      !ROOT_TYPES.has(candidate.type) ||
      record(record(candidate.system).storage).configured !== true
    )
      continue;
    const assignedCharacter = (game.users?.contents ?? []).some(
      (user) => user.active && user.character?.id === candidate.id,
    );
    if (
      !assignedCharacter &&
      (candidate as FoundryActorDocument & { readonly visible?: boolean })
        .visible !== true
    )
      continue;
    addRoot(candidate as FoundryActorDocument & { readonly uuid: string });
  }
  const state = source.state;
  const ready =
    !state.invalidStoredWallet && !state.stale && !state.unresolvedLegacy;
  const guidance = game.i18n.localize(
    state.invalidStoredWallet
      ? "D6E2.Storage.Currency.Invalid"
      : state.unresolvedLegacy
        ? "D6E2.Storage.Currency.Unresolved"
        : state.stale
          ? "D6E2.Storage.Currency.Stale"
          : state.wallet.totalSmallestUnit === "0"
            ? "D6E2.Storage.Currency.Empty"
            : "D6E2.Storage.Currency.Guidance",
  );
  return {
    fundDestinations: Object.freeze([...destinations.values()]),
    funds: Object.freeze({
      aliasedCharacterWallet:
        source.reference.kind === "root" &&
        source.document.type === "character",
      canEdit: currentUser.isGM && ready,
      canTransfer: ready && source.reachable && destinations.size > 0,
      denominations: Object.freeze(
        state.wallet.definition.denominations.map((entry) => ({
          count: state.wallet.counts[entry.id] ?? "0",
          id: entry.id,
          inputName: `holderCurrency.counts.${entry.id}`,
          label: denominationLabel(entry),
          symbol: entry.symbol,
        })),
      ),
      empty: state.wallet.totalSmallestUnit === "0",
      guidance,
      holderId: holderReferenceKey(source.reference),
      holderKind: source.reference.kind,
      holderLabel: source.label,
      invalid: state.invalidStoredWallet,
      multiple: state.wallet.definition.denominations.length > 1,
      stale: state.stale,
      totalSmallestUnit: state.wallet.totalSmallestUnit,
      transferAction: "transferStorageFunds",
      unresolvedLegacy: state.unresolvedLegacy,
      visible: true,
      walletFingerprint: currencyWalletEditFingerprint(state.wallet),
    }),
    sourceHolder: source,
  };
}

export async function setStorageCurrencyCount(input: {
  readonly count: string;
  readonly denominationId: string;
  readonly expectedWalletFingerprint: string;
  readonly holderId: string;
  readonly operationId: string;
}): Promise<void> {
  return runGridStorageAuthorityEffect(async () => {
    if (!game.user?.isGM) throw new Error("D6E2.Economy.Error.NotAuthorized");
    const holder = await resolveCurrencyHolder(
      referenceFromHolderId(input.holderId),
    );
    if (!userMayControlCurrencyHolder(holder, game.user))
      throw new Error("D6E2.Economy.Error.NotAuthorized");
    if (
      currencyWalletEditFingerprint(holder.state.wallet) !==
      input.expectedWalletFingerprint
    )
      throw new Error("D6E2.Economy.Error.StaleBalance");
    if (
      holder.state.stale ||
      holder.state.unresolvedLegacy ||
      holder.state.invalidStoredWallet
    )
      throw new Error("D6E2.Economy.Error.StaleDefinition");
    if (!Object.hasOwn(holder.state.wallet.counts, input.denominationId))
      throw new Error("D6E2.Economy.Error.UnknownDenomination");
    if (
      Object.values(holder.state.wallet.operationReceipts).some(
        ({ status }) => status === "pending-transfer",
      )
    )
      throw new Error("D6E2.Economy.Error.StaleBalance");
    const wallet = walletWithOperation(holder.state.wallet, input.operationId, {
      ...holder.state.wallet.counts,
      [input.denominationId]: currencyInteger(input.count).toString(),
    });
    await writeHolderWallet(holder, wallet);
  });
}

/** Serialized GM-only migration write that preserves the storage witness. */
export async function writeCurrencyHolderWalletMigration(
  reference: D6CurrencyHolderRefV1,
  expectedWalletFingerprint: string,
  wallet: D6CurrencyWalletV1,
): Promise<void> {
  if (!game.user?.isGM) throw new Error("D6E2.Economy.Error.NotAuthorized");
  const holder = await resolveCurrencyHolder(reference);
  if (
    currencyWalletFingerprint(holder.state.wallet) !== expectedWalletFingerprint
  )
    throw new Error("D6E2.Economy.Error.StaleBalance");
  if (
    Object.values(holder.state.wallet.operationReceipts).some(
      ({ status }) => status === "pending-transfer",
    )
  )
    throw new Error("D6E2.Economy.Error.StaleBalance");
  await writeHolderWallet(holder, wallet);
}

export function holderTransferRequest(input: {
  readonly amount: string;
  readonly denominationId: string;
  readonly source: D6ResolvedCurrencyHolder;
  readonly target: D6CurrencyHolderRefV1 | D6ResolvedCurrencyHolder;
}): D6CurrencyHolderTransferRequestV1 {
  const definition = currentSettingProfile().currency;
  const resolvedTarget = "document" in input.target ? input.target : null;
  const targetReference = resolvedTarget
    ? resolvedTarget.reference
    : (input.target as D6CurrencyHolderRefV1);
  return Object.freeze({
    amount: input.amount,
    definitionFingerprint: input.source.state.wallet.definitionFingerprint,
    definitionRevision: definition.revision,
    denominationId: input.denominationId,
    expectedSourceTotalSmallestUnit:
      input.source.state.wallet.totalSmallestUnit,
    expectedSourceWalletFingerprint: currencyWalletFingerprint(
      input.source.state.wallet,
    ),
    expectedTargetTotalSmallestUnit:
      resolvedTarget?.state.wallet.totalSmallestUnit ?? "",
    expectedTargetWalletFingerprint: resolvedTarget
      ? currencyWalletFingerprint(resolvedTarget.state.wallet)
      : "",
    source: input.source.reference,
    target: targetReference,
    version: 1,
  });
}

function electedGm(): FoundryUser | undefined {
  return (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

export async function synchronizePendingCurrencyHolderTransfers(): Promise<void> {
  const gm = electedGm();
  if (!gm || game.user?.id !== gm.id) {
    for (const id of registeredRecoveries) resolveD6PendingInteraction(id);
    registeredRecoveries.clear();
    return;
  }
  const ledger = await readGridStorageLedger();
  const recoveries = await readCurrencyHolderTransferRecoveries();
  const references: D6CurrencyHolderRefV1[] = [
    ...Object.keys(ledger.roots).map((id) => ({
      id,
      kind: "root" as const,
      version: 1 as const,
    })),
    ...Object.values(ledger.objects).flatMap((object) =>
      object.definition.interior
        ? [containerCurrencyHolderRef(object.definition.instanceId)]
        : [],
    ),
  ];
  const desired = new Set<string>();
  for (const reference of references) {
    let holder: D6ResolvedCurrencyHolder;
    try {
      holder = await resolveCurrencyHolder(reference);
    } catch {
      continue;
    }
    for (const [operationId, receipt] of Object.entries(
      holder.state.wallet.operationReceipts,
    )) {
      if (receipt.status !== "pending-transfer") continue;
      const recovery = recoveries[operationId];
      if (!recovery) continue;
      if (
        recovery.intent !== receipt.intent ||
        ![recovery.request.source, recovery.request.target].some(
          (candidate) =>
            candidate.kind === reference.kind && candidate.id === reference.id,
        )
      )
        continue;
      const id = `currency-holder-transfer-recovery:${operationId}`;
      if (desired.has(id)) continue;
      desired.add(id);
      registerD6PendingInteraction({
        actorId: holder.ownerRoot.id,
        actorImg: holder.ownerRoot.img,
        actorName: holder.ownerRoot.name,
        controllerName: gm.name ?? gm.id,
        controllerUserId: gm.id,
        createdAt: receipt.createdAt ?? Date.now(),
        id,
        kind: "economy-approval",
        label: game.i18n.localize("D6E2.Economy.TransferCurrency"),
        reopen: async () => {
          const currentGm = electedGm();
          const requester = game.users?.get(recovery.requesterUserId);
          if (
            !currentGm ||
            game.user?.id !== currentGm.id ||
            !requester?.active
          )
            throw new Error("D6E2.Economy.Error.GmUnavailable");
          await executeCurrencyHolderTransfer(
            recovery.request,
            requester,
            operationId,
            recovery.targetControllerUserId,
          );
          registeredRecoveries.delete(id);
          return "resolved";
        },
        subjectLabel: holder.label,
      });
      registeredRecoveries.add(id);
    }
  }
  for (const id of registeredRecoveries) {
    if (desired.has(id)) continue;
    resolveD6PendingInteraction(id);
    registeredRecoveries.delete(id);
  }
}

export function resetCurrencyHolderServiceForTests(): void {
  registeredRecoveries.clear();
}
