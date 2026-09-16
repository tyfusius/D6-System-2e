import type {
  D6CurrencyDefinitionV1,
  D6CurrencyDenominationV1,
  D6CurrencyExchangePreviewV1,
  D6CurrencyExchangeRequestV1,
  D6CurrencyHolderTransferPlanV1,
  D6CurrencyHolderTransferRequestV1,
  D6CurrencyMigrationPreviewV1,
  D6CurrencyOperationReceiptV1,
  D6CurrencyValueV1,
  D6CurrencyWalletV1,
} from "../contracts/currency-denominations";

const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/u;
const UNSIGNED_INTEGER = /^(0|[1-9][0-9]*)$/u;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/u;
const DECIMAL = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u;
const MAX_INTEGER = 10n ** 78n - 1n;
const OPERATION_ID = /^[^\s]{1,128}$/u;

export class D6CurrencyError extends RangeError {
  constructor(readonly code: string) {
    super(code);
    this.name = "D6CurrencyError";
  }
}

function fail(code: string): never {
  throw new D6CurrencyError(code);
}

export function currencyInteger(
  value: unknown,
  options: { readonly positive?: boolean } = {},
): bigint {
  if (typeof value !== "string") fail("currency.integer.string-required");
  const normalized = value.trim();
  const expression = options.positive ? POSITIVE_INTEGER : UNSIGNED_INTEGER;
  if (!expression.test(normalized)) fail("currency.integer.invalid");
  const parsed = BigInt(normalized);
  if (parsed > MAX_INTEGER) fail("currency.integer.overflow");
  return parsed;
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 80) fail(code);
  return normalized;
}

function normalizeDenomination(
  value: D6CurrencyDenominationV1,
  index: number,
): D6CurrencyDenominationV1 {
  const id = value.id.trim();
  if (!IDENTIFIER.test(id)) fail("currency.denomination.id");
  const ratio = currencyInteger(value.ratioToParent, { positive: true });
  if (index === 0 && ratio !== 1n) fail("currency.denomination.main-ratio");
  if (
    !Number.isSafeInteger(value.displayPrecision) ||
    value.displayPrecision < 0 ||
    value.displayPrecision > 12
  )
    fail("currency.denomination.precision");
  return Object.freeze({
    displayPrecision: value.displayPrecision,
    id,
    pluralName: requiredText(
      value.pluralName,
      "currency.denomination.plural-name",
    ),
    ratioToParent: ratio.toString(),
    singularName: requiredText(
      value.singularName,
      "currency.denomination.singular-name",
    ),
    symbol: value.symbol.trim().slice(0, 16),
  });
}

export function normalizeCurrencyDefinition(
  value: D6CurrencyDefinitionV1,
): D6CurrencyDefinitionV1 {
  const id = value.id.trim();
  if (!IDENTIFIER.test(id)) fail("currency.definition.id");
  if (!Number.isSafeInteger(value.revision) || value.revision < 1)
    fail("currency.definition.revision");
  if (value.denominations.length < 1 || value.denominations.length > 16)
    fail("currency.definition.denominations");
  const denominations = value.denominations.map(normalizeDenomination);
  if (
    new Set(denominations.map((entry) => entry.id)).size !==
    denominations.length
  )
    fail("currency.denomination.duplicate-id");
  currencyUnitFactors({ ...value, id, denominations });
  return Object.freeze({
    denominations: Object.freeze(denominations),
    id,
    revision: value.revision,
    version: 1,
  });
}

/** Smallest-unit value of one unit of each denomination. */
export function currencyUnitFactors(
  definition: D6CurrencyDefinitionV1,
): Readonly<Record<string, bigint>> {
  const ratios = definition.denominations.map((entry, index) =>
    index === 0 ? 1n : currencyInteger(entry.ratioToParent, { positive: true }),
  );
  const factors: Record<string, bigint> = {};
  let factor = 1n;
  for (let index = ratios.length - 1; index >= 0; index -= 1) {
    const denomination = definition.denominations[index];
    if (!denomination) fail("currency.definition.denominations");
    factors[denomination.id] = factor;
    if (index > 0) {
      const ratio = ratios[index] ?? fail("currency.denomination.ratio");
      factor *= ratio;
      if (factor > MAX_INTEGER) fail("currency.integer.overflow");
    }
  }
  return Object.freeze(factors);
}

/** Value-only fingerprint: label, symbol and display edits do not stale wallets. */
export function currencyDefinitionFingerprint(
  definition: D6CurrencyDefinitionV1,
): string {
  const normalized = normalizeCurrencyDefinition(definition);
  const input = `${normalized.id}|${normalized.denominations
    .map((entry) => `${entry.id}:${entry.ratioToParent}`)
    .join("|")}`;
  return fnv1a64(input);
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of input) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function currencyWalletFingerprint(wallet: D6CurrencyWalletV1): string {
  const definition = normalizeCurrencyDefinition(wallet.definition);
  return fnv1a64(
    JSON.stringify([
      wallet.definitionFingerprint,
      definition.denominations.map((entry) => [
        entry.id,
        wallet.counts[entry.id] ?? "",
      ]),
      wallet.totalSmallestUnit,
      wallet.recentOperationIds,
      Object.entries(
        (
          wallet as {
            readonly operationReceipts?: D6CurrencyWalletV1["operationReceipts"];
          }
        ).operationReceipts ?? {},
      )
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([id, receipt]) => [id, receipt.intent, receipt.status]),
    ]),
  );
}

function normalizeOperationReceipts(
  receipts: unknown,
): Readonly<Record<string, D6CurrencyOperationReceiptV1>> {
  if (!receipts || typeof receipts !== "object" || Array.isArray(receipts))
    fail("currency.operation.receipts");
  const normalized: Record<string, D6CurrencyOperationReceiptV1> = {};
  for (const [id, rawReceipt] of Object.entries(
    receipts as Record<string, unknown>,
  )) {
    if (!OPERATION_ID.test(id)) fail("currency.operation.id");
    if (!rawReceipt || typeof rawReceipt !== "object")
      fail("currency.operation.receipt");
    const receipt = rawReceipt as Record<string, unknown>;
    const createdAt = receipt.createdAt;
    const intent = receipt.intent;
    const recoveryRequest = receipt.recoveryRequest;
    const requesterUserId = receipt.requesterUserId;
    const status = receipt.status;
    if (
      typeof intent !== "string" ||
      intent.length < 1 ||
      intent.length > 1024 ||
      (status !== "complete" && status !== "pending-transfer") ||
      (createdAt !== undefined &&
        (typeof createdAt !== "number" || !Number.isFinite(createdAt))) ||
      (recoveryRequest !== undefined &&
        (typeof recoveryRequest !== "string" ||
          recoveryRequest.length < 1 ||
          recoveryRequest.length > 4096)) ||
      (requesterUserId !== undefined &&
        (typeof requesterUserId !== "string" ||
          requesterUserId.length < 1 ||
          requesterUserId.length > 128)) ||
      (status === "pending-transfer" && typeof createdAt !== "number")
    )
      fail("currency.operation.receipt");
    normalized[id] = Object.freeze({
      ...(createdAt === undefined ? {} : { createdAt }),
      intent,
      ...(recoveryRequest === undefined ? {} : { recoveryRequest }),
      ...(requesterUserId === undefined ? {} : { requesterUserId }),
      status,
    });
  }
  return Object.freeze(normalized);
}

export function currencyWalletTotal(
  definition: D6CurrencyDefinitionV1,
  counts: Readonly<Record<string, string>>,
): bigint {
  const normalized = normalizeCurrencyDefinition(definition);
  const factors = currencyUnitFactors(normalized);
  let total = 0n;
  for (const denomination of normalized.denominations) {
    const count = currencyInteger(counts[denomination.id] ?? "0");
    total += count * (factors[denomination.id] ?? 0n);
    if (total > MAX_INTEGER) fail("currency.integer.overflow");
  }
  for (const id of Object.keys(counts)) {
    if (!Object.hasOwn(factors, id))
      fail("currency.wallet.unknown-denomination");
  }
  return total;
}

export function createCurrencyWallet(
  definition: D6CurrencyDefinitionV1,
  counts: Readonly<Record<string, string>> = {},
  recentOperationIds: readonly string[] = [],
  operationReceipts: Readonly<
    Record<string, D6CurrencyOperationReceiptV1>
  > = {},
): D6CurrencyWalletV1 {
  const normalized = normalizeCurrencyDefinition(definition);
  const normalizedCounts = Object.fromEntries(
    normalized.denominations.map((entry) => [
      entry.id,
      currencyInteger(counts[entry.id] ?? "0").toString(),
    ]),
  );
  const normalizedReceipts = normalizeOperationReceipts(operationReceipts);
  const completedIds = [
    ...recentOperationIds,
    ...Object.entries(normalizedReceipts).flatMap(([id, receipt]) =>
      receipt.status === "complete" ? [id] : [],
    ),
  ].filter(
    (id, index, all) => OPERATION_ID.test(id) && all.indexOf(id) === index,
  );
  return Object.freeze({
    counts: Object.freeze(normalizedCounts),
    definition: normalized,
    definitionFingerprint: currencyDefinitionFingerprint(normalized),
    definitionId: normalized.id,
    definitionRevision: normalized.revision,
    operationReceipts: normalizedReceipts,
    recentOperationIds: Object.freeze(completedIds),
    status: "active",
    totalSmallestUnit: currencyWalletTotal(
      normalized,
      normalizedCounts,
    ).toString(),
    version: 1,
  });
}

export function validateCurrencyWallet(
  definition: D6CurrencyDefinitionV1,
  wallet: D6CurrencyWalletV1,
): D6CurrencyWalletV1 {
  const fingerprint = currencyDefinitionFingerprint(definition);
  if (
    (wallet as { readonly version: unknown }).version !== 1 ||
    wallet.status !== "active" ||
    currencyDefinitionFingerprint(wallet.definition) !==
      wallet.definitionFingerprint ||
    wallet.definitionId !== definition.id ||
    wallet.definitionRevision !== definition.revision ||
    wallet.definitionFingerprint !== fingerprint
  )
    fail("currency.wallet.stale-definition");
  const normalized = createCurrencyWallet(
    definition,
    wallet.counts,
    wallet.recentOperationIds,
    (
      wallet as {
        readonly operationReceipts?: D6CurrencyWalletV1["operationReceipts"];
      }
    ).operationReceipts ?? {},
  );
  if (normalized.totalSmallestUnit !== wallet.totalSmallestUnit)
    fail("currency.wallet.total-mismatch");
  return normalized;
}

export function validateUnresolvedCurrencyWallet(
  wallet: D6CurrencyWalletV1,
): D6CurrencyWalletV1 {
  const definition = normalizeCurrencyDefinition(wallet.definition);
  if (
    (wallet as { readonly version: unknown }).version !== 1 ||
    wallet.status !== "unresolved-legacy" ||
    typeof wallet.legacyDecimal !== "string" ||
    currencyDefinitionFingerprint(definition) !==
      wallet.definitionFingerprint ||
    definition.id !== wallet.definitionId ||
    definition.revision !== wallet.definitionRevision
  )
    fail("currency.wallet.invalid-unresolved");
  const normalized = createCurrencyWallet(
    definition,
    wallet.counts,
    wallet.recentOperationIds,
    (
      wallet as {
        readonly operationReceipts?: D6CurrencyWalletV1["operationReceipts"];
      }
    ).operationReceipts ?? {},
  );
  if (normalized.totalSmallestUnit !== wallet.totalSmallestUnit)
    fail("currency.wallet.total-mismatch");
  return Object.freeze({
    ...normalized,
    legacyDecimal: wallet.legacyDecimal,
    status: "unresolved-legacy" as const,
  });
}

export function planCurrencyExchange(
  definition: D6CurrencyDefinitionV1,
  wallet: D6CurrencyWalletV1,
  request: D6CurrencyExchangeRequestV1,
): D6CurrencyExchangePreviewV1 {
  const before = validateCurrencyWallet(definition, wallet);
  if (
    (request as { readonly version: unknown }).version !== 1 ||
    request.definitionRevision !== definition.revision ||
    request.definitionFingerprint !== before.definitionFingerprint
  )
    fail("currency.exchange.stale-definition");
  if (request.expectedTotalSmallestUnit !== before.totalSmallestUnit)
    fail("currency.exchange.stale-balance");
  if (request.expectedWalletFingerprint !== currencyWalletFingerprint(before))
    fail("currency.exchange.stale-balance");
  if (request.fromDenominationId === request.toDenominationId)
    fail("currency.exchange.same-denomination");
  const quantity = currencyInteger(request.quantity, { positive: true });
  const factors = currencyUnitFactors(definition);
  const fromFactor = factors[request.fromDenominationId];
  const toFactor = factors[request.toDenominationId];
  if (fromFactor === undefined || toFactor === undefined)
    fail("currency.exchange.unknown-denomination");
  const fromBefore = currencyInteger(
    before.counts[request.fromDenominationId] ?? "0",
  );
  if (quantity > fromBefore) fail("currency.exchange.insufficient-funds");
  const exactValue = quantity * fromFactor;
  const received = exactValue / toFactor;
  const remainder = exactValue % toFactor;
  if (received < 1n) fail("currency.exchange.no-whole-destination-unit");
  if (remainder % fromFactor !== 0n)
    fail("currency.exchange.nonrepresentable-remainder");
  const remainderCount = remainder / fromFactor;
  const counts = { ...before.counts };
  counts[request.fromDenominationId] = (
    fromBefore -
    quantity +
    remainderCount
  ).toString();
  const toBefore = currencyInteger(
    before.counts[request.toDenominationId] ?? "0",
  );
  counts[request.toDenominationId] = (toBefore + received).toString();
  const after = createCurrencyWallet(
    definition,
    counts,
    before.recentOperationIds,
    before.operationReceipts,
  );
  if (after.totalSmallestUnit !== before.totalSmallestUnit)
    fail("currency.exchange.value-mismatch");
  return Object.freeze({
    after,
    before,
    exactValueSmallestUnit: exactValue.toString(),
    fromCount: fromBefore.toString(),
    fromDenominationId: request.fromDenominationId,
    receivedCount: received.toString(),
    remainderCount: remainderCount.toString(),
    remainderSmallestUnit: remainder.toString(),
    toCount: toBefore.toString(),
    toDenominationId: request.toDenominationId,
    version: 1,
  });
}

export function planCurrencyHolderTransfer(
  definition: D6CurrencyDefinitionV1,
  sourceWallet: D6CurrencyWalletV1,
  targetWallet: D6CurrencyWalletV1,
  request: D6CurrencyHolderTransferRequestV1,
): D6CurrencyHolderTransferPlanV1 {
  if ((request as { readonly version: unknown }).version !== 1)
    fail("currency.holder-transfer.version");
  if (
    request.source.kind === request.target.kind &&
    request.source.id === request.target.id
  )
    fail("currency.holder-transfer.same-holder");
  const sourceBefore = validateCurrencyWallet(definition, sourceWallet);
  const targetBefore = validateCurrencyWallet(definition, targetWallet);
  if (
    request.definitionRevision !== definition.revision ||
    request.definitionFingerprint !== sourceBefore.definitionFingerprint ||
    targetBefore.definitionFingerprint !== sourceBefore.definitionFingerprint
  )
    fail("currency.holder-transfer.stale-definition");
  if (
    request.expectedSourceTotalSmallestUnit !==
      sourceBefore.totalSmallestUnit ||
    request.expectedTargetTotalSmallestUnit !==
      targetBefore.totalSmallestUnit ||
    request.expectedSourceWalletFingerprint !==
      currencyWalletFingerprint(sourceBefore) ||
    request.expectedTargetWalletFingerprint !==
      currencyWalletFingerprint(targetBefore)
  )
    fail("currency.holder-transfer.stale-balance");
  if (!Object.hasOwn(sourceBefore.counts, request.denominationId))
    fail("currency.holder-transfer.unknown-denomination");
  const amount = currencyInteger(request.amount, { positive: true });
  const sourceCount = currencyInteger(
    sourceBefore.counts[request.denominationId] ?? "0",
  );
  if (amount > sourceCount)
    fail("currency.holder-transfer.insufficient-denomination");
  const targetCount = currencyInteger(
    targetBefore.counts[request.denominationId] ?? "0",
  );
  const sourceAfter = createCurrencyWallet(
    definition,
    {
      ...sourceBefore.counts,
      [request.denominationId]: (sourceCount - amount).toString(),
    },
    sourceBefore.recentOperationIds,
    sourceBefore.operationReceipts,
  );
  const targetAfter = createCurrencyWallet(
    definition,
    {
      ...targetBefore.counts,
      [request.denominationId]: (targetCount + amount).toString(),
    },
    targetBefore.recentOperationIds,
    targetBefore.operationReceipts,
  );
  const factor = currencyUnitFactors(definition)[request.denominationId];
  if (factor === undefined)
    fail("currency.holder-transfer.unknown-denomination");
  if (
    currencyInteger(sourceBefore.totalSmallestUnit) +
      currencyInteger(targetBefore.totalSmallestUnit) !==
    currencyInteger(sourceAfter.totalSmallestUnit) +
      currencyInteger(targetAfter.totalSmallestUnit)
  )
    fail("currency.holder-transfer.value-mismatch");
  return Object.freeze({
    amount: amount.toString(),
    denominationId: request.denominationId,
    sourceAfter,
    sourceBefore,
    targetAfter,
    targetBefore,
    valueSmallestUnit: (amount * factor).toString(),
    version: 1,
  });
}

export function exactLegacyCurrencyValue(
  definition: D6CurrencyDefinitionV1,
  legacyValue: unknown,
): D6CurrencyValueV1 {
  const normalized = normalizeCurrencyDefinition(definition);
  const source =
    typeof legacyValue === "number"
      ? legacyValue.toString()
      : typeof legacyValue === "string"
        ? legacyValue.trim()
        : "";
  const safeNumericSource =
    typeof legacyValue !== "number" ||
    (Number.isFinite(legacyValue) &&
      Math.abs(legacyValue) <= Number.MAX_SAFE_INTEGER);
  const match = safeNumericSource ? DECIMAL.exec(source) : null;
  const fingerprint = currencyDefinitionFingerprint(normalized);
  const base = {
    definition: normalized,
    definitionFingerprint: fingerprint,
    definitionId: normalized.id,
    definitionRevision: normalized.revision,
    version: 1 as const,
  };
  if (!match)
    return Object.freeze({
      ...base,
      amountSmallestUnit: "0",
      legacyDecimal: source,
      status: "unresolved-legacy",
    });
  const fraction = match[2] ?? "";
  const digits = `${match[1] ?? "0"}${fraction}`;
  const numerator = currencyInteger(BigInt(digits).toString());
  const denominator = 10n ** BigInt(fraction.length);
  const main = normalized.denominations[0];
  if (!main) fail("currency.definition.denominations");
  const mainFactor = currencyUnitFactors(normalized)[main.id] ?? 1n;
  const scaled = numerator * mainFactor;
  if (scaled > MAX_INTEGER || scaled % denominator !== 0n)
    return Object.freeze({
      ...base,
      amountSmallestUnit: "0",
      legacyDecimal: source,
      status: "unresolved-legacy",
    });
  return Object.freeze({
    ...base,
    amountSmallestUnit: (scaled / denominator).toString(),
    status: "active",
  });
}

function exactTargetSmallestUnit(
  sourceDefinition: D6CurrencyDefinitionV1,
  sourceSmallestUnit: bigint,
  targetDefinition: D6CurrencyDefinitionV1,
): bigint | null {
  if (sourceDefinition.id !== targetDefinition.id) return null;
  const sourceMain = sourceDefinition.denominations[0];
  const targetMain = targetDefinition.denominations[0];
  if (!sourceMain || !targetMain) fail("currency.definition.denominations");
  if (sourceMain.id !== targetMain.id) return null;
  const sourceMainFactor =
    currencyUnitFactors(sourceDefinition)[sourceMain.id] ?? 1n;
  const targetMainFactor =
    currencyUnitFactors(targetDefinition)[targetMain.id] ?? 1n;
  const scaled = sourceSmallestUnit * targetMainFactor;
  if (scaled > MAX_INTEGER || scaled % sourceMainFactor !== 0n) return null;
  return scaled / sourceMainFactor;
}

export function canonicalCurrencyCounts(
  definition: D6CurrencyDefinitionV1,
  totalSmallestUnit: bigint,
): Readonly<Record<string, string>> {
  const factors = currencyUnitFactors(definition);
  let remainder = totalSmallestUnit;
  const counts: Record<string, string> = {};
  for (const denomination of definition.denominations) {
    const factor =
      factors[denomination.id] ?? fail("currency.denomination.ratio");
    counts[denomination.id] = (remainder / factor).toString();
    remainder %= factor;
  }
  if (remainder !== 0n) fail("currency.migration.nonrepresentable-value");
  return Object.freeze(counts);
}

export function planCurrencyWalletMigration(
  wallet: D6CurrencyWalletV1,
  targetDefinition: D6CurrencyDefinitionV1,
): D6CurrencyMigrationPreviewV1<D6CurrencyWalletV1> {
  const sourceDefinition = normalizeCurrencyDefinition(wallet.definition);
  const source = validateCurrencyWallet(sourceDefinition, wallet);
  const target = normalizeCurrencyDefinition(targetDefinition);
  if (sourceDefinition.id !== target.id)
    return Object.freeze({
      exact: false,
      reason: "different-value-system",
      source,
      version: 1,
    });
  const targetTotal = exactTargetSmallestUnit(
    sourceDefinition,
    currencyInteger(source.totalSmallestUnit),
    target,
  );
  if (targetTotal === null)
    return Object.freeze({
      exact: false,
      reason: "nonrepresentable-value",
      source,
      version: 1,
    });
  return Object.freeze({
    exact: true,
    source,
    target: createCurrencyWallet(
      target,
      canonicalCurrencyCounts(target, targetTotal),
      source.recentOperationIds,
      source.operationReceipts,
    ),
    version: 1,
  });
}

export function validateCurrencyValue(
  value: D6CurrencyValueV1,
): D6CurrencyValueV1 {
  const definition = normalizeCurrencyDefinition(value.definition);
  const status = (value as { readonly status: unknown }).status;
  if (
    (value as { readonly version: unknown }).version !== 1 ||
    currencyDefinitionFingerprint(definition) !== value.definitionFingerprint ||
    definition.id !== value.definitionId ||
    definition.revision !== value.definitionRevision ||
    (status !== "active" && status !== "unresolved-legacy") ||
    (value.authoredDecimal !== undefined &&
      typeof value.authoredDecimal !== "string") ||
    (value.legacyDecimal !== undefined &&
      typeof value.legacyDecimal !== "string") ||
    (status === "unresolved-legacy" && typeof value.legacyDecimal !== "string")
  )
    fail("currency.value.invalid-definition-snapshot");
  const amountSmallestUnit = currencyInteger(
    value.amountSmallestUnit,
  ).toString();
  return Object.freeze({
    amountSmallestUnit,
    ...(value.authoredDecimal === undefined
      ? {}
      : { authoredDecimal: value.authoredDecimal }),
    definition,
    definitionFingerprint: value.definitionFingerprint,
    definitionId: value.definitionId,
    definitionRevision: value.definitionRevision,
    ...(value.legacyDecimal === undefined
      ? {}
      : { legacyDecimal: value.legacyDecimal }),
    status,
    version: 1,
  });
}

export function planCurrencyValueMigration(
  value: D6CurrencyValueV1,
  targetDefinition: D6CurrencyDefinitionV1,
): D6CurrencyMigrationPreviewV1<D6CurrencyValueV1> {
  if (value.status === "unresolved-legacy")
    return Object.freeze({
      exact: false,
      reason: "unresolved-legacy",
      source: value,
      version: 1,
    });
  const sourceDefinition = normalizeCurrencyDefinition(value.definition);
  if (
    currencyDefinitionFingerprint(sourceDefinition) !==
      value.definitionFingerprint ||
    sourceDefinition.id !== value.definitionId ||
    sourceDefinition.revision !== value.definitionRevision
  )
    fail("currency.value.invalid-definition-snapshot");
  const target = normalizeCurrencyDefinition(targetDefinition);
  if (sourceDefinition.id !== target.id)
    return Object.freeze({
      exact: false,
      reason: "different-value-system",
      source: value,
      version: 1,
    });
  const targetAmount = exactTargetSmallestUnit(
    sourceDefinition,
    currencyInteger(value.amountSmallestUnit),
    target,
  );
  if (targetAmount === null)
    return Object.freeze({
      exact: false,
      reason: "nonrepresentable-value",
      source: value,
      version: 1,
    });
  return Object.freeze({
    exact: true,
    source: value,
    target: Object.freeze({
      amountSmallestUnit: targetAmount.toString(),
      definition: target,
      definitionFingerprint: currencyDefinitionFingerprint(target),
      definitionId: target.id,
      definitionRevision: target.revision,
      status: "active",
      version: 1,
    }),
    version: 1,
  });
}
