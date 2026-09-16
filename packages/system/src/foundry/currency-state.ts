import {
  canonicalCurrencyCounts,
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  currencyInteger,
  currencyUnitFactors,
  currencyWalletFingerprint,
  exactLegacyCurrencyValue,
  normalizeCurrencyDefinition,
  planCurrencyValueMigration,
  planCurrencyWalletMigration,
  validateCurrencyWallet,
  validateCurrencyValue,
  validateUnresolvedCurrencyWallet,
  type D6CurrencyDefinitionV1,
  type D6CurrencyMigrationPreviewV1,
  type D6CurrencyOperationReceiptV1,
  type D6CurrencyValueV1,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import { currentSettingProfile } from "../settings/setting-profile";
import {
  LEGACY_CURRENCY_DEFINITION,
  mutableCurrencyDocumentSource,
} from "../migrations/058-add-currency-denominations";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export interface D6CurrencyWalletState {
  readonly currentDefinition: D6CurrencyDefinitionV1;
  readonly invalidStoredWallet: boolean;
  readonly stale: boolean;
  readonly unresolvedLegacy: boolean;
  readonly wallet: D6CurrencyWalletV1;
}

export function currencyWalletEditFingerprint(
  wallet: D6CurrencyWalletV1,
): string {
  return JSON.stringify([
    currencyWalletFingerprint(wallet),
    wallet.status,
    wallet.legacyDecimal ?? null,
  ]);
}

function invalidStoredWallet(
  stored: Readonly<Record<string, unknown>>,
): D6CurrencyWalletV1 {
  let definition = LEGACY_CURRENCY_DEFINITION;
  try {
    definition = normalizeCurrencyDefinition(
      stored.definition as D6CurrencyDefinitionV1,
    );
  } catch {
    // Keep an inert historical definition when the stored snapshot is corrupt.
  }
  const recentOperationIds = Array.isArray(stored.recentOperationIds)
    ? stored.recentOperationIds.flatMap((id) =>
        typeof id === "string" ? [id] : [],
      )
    : [];
  return Object.freeze({
    ...createCurrencyWallet(definition, {}, recentOperationIds),
    legacyDecimal: "",
    status: "unresolved-legacy" as const,
  });
}

export function currentCurrencyDefinition(): D6CurrencyDefinitionV1 {
  return currentSettingProfile().currency;
}

function fallbackWallet(actor: FoundryActorDocument): D6CurrencyWalletV1 {
  // An Actor without the versioned wallet predates denomination support. Its
  // scalar balance belongs to the historical one-unit definition; interpreting
  // it through the current profile could silently multiply or divide its value.
  const definition = LEGACY_CURRENCY_DEFINITION;
  const main = definition.denominations[0];
  const raw = record(record(actor.system).profile).currency;
  if (
    main &&
    typeof raw === "number" &&
    Number.isSafeInteger(raw) &&
    raw >= 0
  ) {
    return createCurrencyWallet(definition, { [main.id]: raw.toString() });
  }
  return {
    ...createCurrencyWallet(definition),
    legacyDecimal:
      typeof raw === "number" || typeof raw === "string" ? String(raw) : "",
    status: "unresolved-legacy",
  };
}

export function actorCurrencyWalletState(
  actor: FoundryActorDocument,
): D6CurrencyWalletState {
  const currentDefinition = currentCurrencyDefinition();
  const stored = record(record(record(actor.system).profile).currencyWallet);
  const hasStoredWallet = Object.keys(stored).length > 0;
  let invalidStored = false;
  let wallet: D6CurrencyWalletV1;
  try {
    const candidate = stored as unknown as D6CurrencyWalletV1;
    wallet =
      candidate.status === "unresolved-legacy"
        ? validateUnresolvedCurrencyWallet(candidate)
        : validateCurrencyWallet(candidate.definition, candidate);
  } catch {
    invalidStored = hasStoredWallet;
    wallet = hasStoredWallet
      ? invalidStoredWallet(stored)
      : fallbackWallet(actor);
  }
  const currentFingerprint = currencyDefinitionFingerprint(currentDefinition);
  return Object.freeze({
    currentDefinition,
    invalidStoredWallet: invalidStored,
    stale:
      wallet.definitionId !== currentDefinition.id ||
      wallet.definitionRevision !== currentDefinition.revision ||
      wallet.definitionFingerprint !== currentFingerprint,
    unresolvedLegacy: wallet.status === "unresolved-legacy",
    wallet,
  });
}

/** Read the wallet stored directly on a storage root or container. An absent
 * wallet is a new empty holder in the current definition, never a legacy
 * character balance. */
export function storageCurrencyWalletState(
  document: Pick<FoundryActorDocument | FoundryItemDocument, "system">,
): D6CurrencyWalletState {
  const currentDefinition = currentCurrencyDefinition();
  const stored = record(record(document.system).currencyWallet);
  const hasStoredWallet = Object.keys(stored).length > 0;
  let invalidStored = false;
  let wallet: D6CurrencyWalletV1;
  try {
    const candidate = stored as unknown as D6CurrencyWalletV1;
    wallet = hasStoredWallet
      ? candidate.status === "unresolved-legacy"
        ? validateUnresolvedCurrencyWallet(candidate)
        : validateCurrencyWallet(candidate.definition, candidate)
      : createCurrencyWallet(currentDefinition);
  } catch {
    invalidStored = hasStoredWallet;
    wallet = invalidStoredWallet(stored);
  }
  return Object.freeze({
    currentDefinition,
    invalidStoredWallet: invalidStored,
    stale:
      wallet.definitionId !== currentDefinition.id ||
      wallet.definitionRevision !== currentDefinition.revision ||
      wallet.definitionFingerprint !==
        currencyDefinitionFingerprint(currentDefinition),
    unresolvedLegacy: wallet.status === "unresolved-legacy",
    wallet,
  });
}

export function storageCurrencyWalletChanges(
  wallet: D6CurrencyWalletV1,
): Record<string, unknown> {
  return {
    "system.currencyWallet": mutableCurrencyDocumentSource(wallet),
  };
}

export function currencyWalletBlocksHolderRemoval(
  document: Pick<FoundryActorDocument | FoundryItemDocument, "system" | "type">,
): boolean {
  const state =
    document.type === "character"
      ? actorCurrencyWalletState(document as FoundryActorDocument)
      : storageCurrencyWalletState(document);
  if (state.invalidStoredWallet || state.unresolvedLegacy) return true;
  return (
    state.wallet.totalSmallestUnit !== "0" ||
    Object.values(state.wallet.operationReceipts).some(
      ({ status }) => status === "pending-transfer",
    )
  );
}

export function walletWithOperation(
  wallet: D6CurrencyWalletV1,
  operationId: string,
  counts: Readonly<Record<string, string>> = wallet.counts,
  receipt: D6CurrencyOperationReceiptV1 = {
    intent: `legacy:${operationId}`,
    status: "complete",
  },
): D6CurrencyWalletV1 {
  if (!operationId.trim())
    throw new RangeError("currency.operation.id-required");
  if (
    wallet.recentOperationIds.includes(operationId) ||
    Object.hasOwn(wallet.operationReceipts, operationId)
  )
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  return createCurrencyWallet(
    wallet.definition,
    counts,
    receipt.status === "complete"
      ? [...wallet.recentOperationIds, operationId]
      : wallet.recentOperationIds,
    { ...wallet.operationReceipts, [operationId]: receipt },
  );
}

export function walletWithUpdatedOperation(
  wallet: D6CurrencyWalletV1,
  operationId: string,
  receipt: D6CurrencyOperationReceiptV1,
  counts: Readonly<Record<string, string>> = wallet.counts,
): D6CurrencyWalletV1 {
  const existing = wallet.operationReceipts[operationId];
  if (existing?.intent !== receipt.intent)
    throw new Error("D6E2.Economy.Error.DuplicateRequest");
  return createCurrencyWallet(
    wallet.definition,
    counts,
    receipt.status === "complete"
      ? [...wallet.recentOperationIds, operationId]
      : wallet.recentOperationIds,
    { ...wallet.operationReceipts, [operationId]: receipt },
  );
}

export function currencyWalletChanges(
  wallet: D6CurrencyWalletV1,
): Record<string, unknown> {
  const main = wallet.definition.denominations[0];
  const mainCount = main ? currencyInteger(wallet.counts[main.id] ?? "0") : 0n;
  return {
    "system.profile.currencyWallet": mutableCurrencyDocumentSource(wallet),
    ...(wallet.definition.denominations.length === 1 &&
    mainCount <= BigInt(Number.MAX_SAFE_INTEGER)
      ? { "system.profile.currency": Number(mainCount) }
      : {}),
  };
}

export function denominationCountChanges(
  state: D6CurrencyWalletState,
  denominationId: string,
  nextCount: string,
  operationId: string,
): Record<string, unknown> {
  if (state.invalidStoredWallet)
    throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (state.stale && !game.user?.isGM)
    throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (state.unresolvedLegacy && !game.user?.isGM)
    throw new Error("D6E2.Economy.Error.UnresolvedLegacyValue");
  if (
    !Object.hasOwn(currencyUnitFactors(state.wallet.definition), denominationId)
  )
    throw new Error("D6E2.Economy.Error.UnknownDenomination");
  const current = currencyInteger(state.wallet.counts[denominationId] ?? "0");
  const next = currencyInteger(nextCount);
  if (next > current && !game.user?.isGM)
    throw new Error("D6E2.Economy.Error.NotAuthorized");
  const wallet = walletWithOperation(state.wallet, operationId, {
    ...state.wallet.counts,
    [denominationId]: next.toString(),
  });
  return currencyWalletChanges(wallet);
}

export function directCurrencyDenominationId(
  state: D6CurrencyWalletState,
  inputName: string,
): string | null {
  const count = /^system\.profile\.currencyWallet\.counts\.([^.]+)$/.exec(
    inputName,
  )?.[1];
  if (count) return count;
  if (inputName !== "system.profile.currency") return null;
  if (state.wallet.definition.denominations.length !== 1) return null;
  return state.wallet.definition.denominations[0]?.id ?? null;
}

export function currentDefinitionWalletReplacementChanges(
  state: D6CurrencyWalletState,
  counts: Readonly<Record<string, string>>,
  operationId: string,
): Record<string, unknown> {
  if (!game.user?.isGM) throw new Error("D6E2.Economy.Error.NotAuthorized");
  if (state.invalidStoredWallet)
    throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (!state.stale && !state.unresolvedLegacy)
    throw new Error("D6E2.Economy.Error.StaleDefinition");
  if (
    Object.values(state.wallet.operationReceipts).some(
      (receipt) => receipt.status === "pending-transfer",
    )
  )
    throw new Error("D6E2.Economy.Error.StaleBalance");
  const replacementIntent = JSON.stringify({
    source: {
      definitionFingerprint: state.wallet.definitionFingerprint,
      definitionId: state.wallet.definitionId,
      definitionRevision: state.wallet.definitionRevision,
      totalSmallestUnit: state.wallet.totalSmallestUnit,
    },
    type: "currency-wallet-replacement",
  });
  const currentWallet = createCurrencyWallet(
    state.currentDefinition,
    {},
    state.wallet.recentOperationIds,
    state.wallet.operationReceipts,
  );
  return currencyWalletChanges(
    walletWithOperation(currentWallet, operationId, counts, {
      intent: replacementIntent,
      status: "complete",
    }),
  );
}

export function previewCurrencyWalletStateMigration(
  state: D6CurrencyWalletState,
): D6CurrencyMigrationPreviewV1<D6CurrencyWalletV1> {
  if (
    Object.values(state.wallet.operationReceipts).some(
      ({ status }) => status === "pending-transfer",
    )
  )
    return Object.freeze({
      exact: false,
      reason: "pending-transfer",
      source: state.wallet,
      version: 1,
    });
  if (state.invalidStoredWallet)
    return Object.freeze({
      exact: false,
      reason: "invalid-stored-wallet",
      source: state.wallet,
      version: 1,
    });
  if (state.unresolvedLegacy) {
    const sourceMain = state.wallet.definition.denominations[0];
    const main = state.currentDefinition.denominations[0];
    if (
      state.wallet.definitionId !== state.currentDefinition.id ||
      !sourceMain ||
      sourceMain.id !== main?.id
    )
      return Object.freeze({
        exact: false,
        reason: "different-value-system",
        source: state.wallet,
        version: 1,
      });
    const converted = exactLegacyCurrencyValue(
      state.currentDefinition,
      state.wallet.legacyDecimal ?? "",
    );
    if (converted.status !== "active")
      return Object.freeze({
        exact: false,
        reason: "unresolved-legacy",
        source: state.wallet,
        version: 1,
      });
    const amount = currencyInteger(converted.amountSmallestUnit);
    return Object.freeze({
      exact: true,
      source: state.wallet,
      target: createCurrencyWallet(
        state.currentDefinition,
        canonicalCurrencyCounts(state.currentDefinition, amount),
        state.wallet.recentOperationIds,
        state.wallet.operationReceipts,
      ),
      version: 1,
    });
  }
  return planCurrencyWalletMigration(state.wallet, state.currentDefinition);
}

export function previewWalletMigration(
  actor: FoundryActorDocument,
): D6CurrencyMigrationPreviewV1<D6CurrencyWalletV1> {
  return previewCurrencyWalletStateMigration(actorCurrencyWalletState(actor));
}

export function previewCurrencyValueMigration(
  item: FoundryItemDocument,
): D6CurrencyMigrationPreviewV1<D6CurrencyValueV1> {
  const stored = record(
    record(item.system).currencyValue,
  ) as unknown as D6CurrencyValueV1;
  const target = currentCurrencyDefinition();
  if (stored.status === "unresolved-legacy") {
    const source = validateCurrencyValue(stored);
    const sourceMain = source.definition.denominations[0];
    const targetMain = target.denominations[0];
    if (
      source.definitionId !== target.id ||
      !sourceMain ||
      sourceMain.id !== targetMain?.id
    )
      return Object.freeze({
        exact: false,
        reason: "different-value-system",
        source,
        version: 1,
      });
    const currentLegacyValue = record(item.system).value;
    const converted = exactLegacyCurrencyValue(
      target,
      typeof currentLegacyValue === "number" ||
        typeof currentLegacyValue === "string"
        ? currentLegacyValue
        : (source.authoredDecimal ?? source.legacyDecimal ?? ""),
    );
    return converted.status === "active"
      ? Object.freeze({
          exact: true,
          source,
          target: converted,
          version: 1,
        })
      : Object.freeze({
          exact: false,
          reason: "unresolved-legacy",
          source,
          version: 1,
        });
  }
  return planCurrencyValueMigration(stored, target);
}

export interface D6CurrencyValueState {
  readonly currentDefinition: D6CurrencyDefinitionV1;
  readonly stale: boolean;
  readonly value: D6CurrencyValueV1;
}

export function itemCurrencyValueState(
  item: FoundryItemDocument,
): D6CurrencyValueState {
  const currentDefinition = currentCurrencyDefinition();
  const stored = record(record(item.system).currencyValue);
  let value: D6CurrencyValueV1;
  try {
    value = validateCurrencyValue(stored as unknown as D6CurrencyValueV1);
  } catch {
    value = exactLegacyCurrencyValue(
      LEGACY_CURRENCY_DEFINITION,
      record(item.system).value,
    );
  }
  return Object.freeze({
    currentDefinition,
    stale:
      value.definitionId !== currentDefinition.id ||
      value.definitionRevision !== currentDefinition.revision ||
      value.definitionFingerprint !==
        currencyDefinitionFingerprint(currentDefinition),
    value,
  });
}

export function unresolvedCurrencyValueChanges(
  item: FoundryItemDocument,
  legacyValue: number | string,
): Record<string, unknown> {
  const state = itemCurrencyValueState(item);
  if (state.value.status !== "unresolved-legacy")
    return { "system.value": legacyValue };
  return {
    "system.currencyValue": mutableCurrencyDocumentSource({
      ...state.value,
      authoredDecimal: String(legacyValue),
    }),
    "system.value": legacyValue,
  };
}

export function currencyValueChanges(
  definition: D6CurrencyDefinitionV1,
  denominationId: string,
  count: string,
): Record<string, unknown> {
  const factors = currencyUnitFactors(definition);
  const factor = factors[denominationId];
  if (factor === undefined)
    throw new Error("D6E2.Economy.Error.UnknownDenomination");
  const amount = currencyInteger(count) * factor;
  const value: D6CurrencyValueV1 = Object.freeze({
    amountSmallestUnit: amount.toString(),
    definition,
    definitionFingerprint: currencyDefinitionFingerprint(definition),
    definitionId: definition.id,
    definitionRevision: definition.revision,
    status: "active",
    version: 1,
  });
  const main = definition.denominations[0];
  return {
    "system.currencyValue": mutableCurrencyDocumentSource(value),
    ...(definition.denominations.length === 1 &&
    main?.id === denominationId &&
    amount <= BigInt(Number.MAX_SAFE_INTEGER)
      ? { "system.value": Number(amount) }
      : {}),
  };
}
