import type {
  D6FreeD6CreationDraftV1,
  D6FreeD6CreationLedgerV1,
  D6FreeD6CreationTransactionKind,
  D6FreeD6CreationTransactionV1,
} from "../contracts/free-d6-creation";

export const FREE_D6_CREATION_STRATEGY_ID =
  "free-d6.creation.creation-points" as const;
export const FREE_D6_DEFAULT_CREATION_POINTS = 30;
export const FREE_D6_STARTING_CHARACTER_POINTS = 5;

function integer(value: number, label: string): number {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${label} must be an integer.`);
  return value;
}

export function freeD6PointUnits(points: number): number {
  const units = points * 2;
  if (!Number.isSafeInteger(units)) {
    throw new RangeError("Creation Points must use half-point increments.");
  }
  return units;
}

export function freeD6Points(units: number): number {
  return integer(units, "Creation Point units") / 2;
}

export function freeD6CreationTransaction(
  input: Readonly<{
    id: string;
    kind: D6FreeD6CreationTransactionKind;
    label: string;
    points: number;
    sourceId: string;
  }>,
): D6FreeD6CreationTransactionV1 {
  if (!input.id.trim()) throw new RangeError("Transaction ID is required.");
  if (!input.label.trim())
    throw new RangeError("Transaction label is required.");
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    label: input.label,
    pointUnits: freeD6PointUnits(input.points),
    sourceId: input.sourceId,
  });
}

export function freeD6AttributePipCost(deltaPips = 1): number {
  return integer(deltaPips, "Attribute pips") * 10;
}

export function freeD6SkillPipCost(deltaPips = 1): number {
  return integer(deltaPips, "Skill pips");
}

export function freeD6SpecializationAcquisitionCost(): number {
  return 1;
}

export function freeD6AdvancedSkillCreationCost(
  resultingScore: number,
  relatedAttributeScore: number,
  acquiring: boolean,
): number {
  const score = integer(resultingScore, "Advanced Skill score");
  const attribute = integer(relatedAttributeScore, "Related Attribute score");
  if (score < 0 || attribute < 0)
    throw new RangeError("Scores cannot be negative.");
  if (acquiring) return 3;
  return score <= attribute ? 0.5 : 1;
}

export function freeD6CreationLedger(
  draft: D6FreeD6CreationDraftV1,
): D6FreeD6CreationLedgerV1 {
  if (draft.budgetUnits < 0 || !Number.isSafeInteger(draft.budgetUnits)) {
    throw new RangeError(
      "Creation budget must be a non-negative integer unit value.",
    );
  }
  if (!Number.isSafeInteger(draft.templatePointUnits)) {
    throw new RangeError("Template Point value must be an integer unit value.");
  }
  const ids = new Set<string>();
  for (const transaction of draft.transactions) {
    if (!transaction.id.trim() || ids.has(transaction.id)) {
      throw new RangeError("Creation transaction IDs must be unique.");
    }
    ids.add(transaction.id);
    integer(transaction.pointUnits, "Creation transaction units");
  }
  const transactionTotal = draft.transactions.reduce(
    (total, transaction) => total + transaction.pointUnits,
    0,
  );
  const spentUnits = Math.max(0, draft.templatePointUnits + transactionTotal);
  const creditUnits = Math.max(
    0,
    -(draft.templatePointUnits + transactionTotal),
  );
  const remainingUnits =
    draft.budgetUnits - draft.templatePointUnits - transactionTotal;
  return Object.freeze({
    budgetUnits: draft.budgetUnits,
    canFinalize: !draft.finalized && remainingUnits >= 0,
    characterPointSeedUnits:
      freeD6PointUnits(FREE_D6_STARTING_CHARACTER_POINTS) + remainingUnits,
    creditUnits,
    remainingUnits,
    spentUnits,
    templatePointUnits: draft.templatePointUnits,
    transactions: Object.freeze([...draft.transactions]),
    version: 1,
  });
}

export function updateFreeD6CreationDraft(
  draft: D6FreeD6CreationDraftV1,
  transaction: D6FreeD6CreationTransactionV1,
  expectedRevision: number,
): D6FreeD6CreationDraftV1 {
  if (draft.revision !== expectedRevision) {
    throw new Error("D6E2.Creation.Error.RevisionConflict");
  }
  const existing = draft.transactions.find(({ id }) => id === transaction.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(transaction)) return draft;
    throw new Error("D6E2.Creation.Error.TransactionConflict");
  }
  const next = Object.freeze({
    ...draft,
    revision: draft.revision + 1,
    transactions: Object.freeze([...draft.transactions, transaction]),
  });
  freeD6CreationLedger(next);
  return next;
}

export function replaceFreeD6CreationTransaction(
  draft: D6FreeD6CreationDraftV1,
  transaction: D6FreeD6CreationTransactionV1 | null,
  transactionId: string,
  expectedRevision: number,
): D6FreeD6CreationDraftV1 {
  if (draft.revision !== expectedRevision) {
    throw new Error("D6E2.Creation.Error.RevisionConflict");
  }
  const existing = draft.transactions.find(({ id }) => id === transactionId);
  if (transaction && transaction.id !== transactionId) {
    throw new Error("D6E2.Creation.Error.TransactionConflict");
  }
  if (
    (existing === undefined && transaction === null) ||
    (existing &&
      transaction &&
      JSON.stringify(existing) === JSON.stringify(transaction))
  ) {
    return draft;
  }
  const transactions = draft.transactions.filter(
    ({ id }) => id !== transactionId,
  );
  if (transaction) transactions.push(transaction);
  const next = Object.freeze({
    ...draft,
    revision: draft.revision + 1,
    transactions: Object.freeze(transactions),
  });
  freeD6CreationLedger(next);
  return next;
}

export function finalizeFreeD6CreationDraft(
  draft: D6FreeD6CreationDraftV1,
  expectedRevision: number,
): D6FreeD6CreationDraftV1 {
  if (draft.revision !== expectedRevision) {
    throw new Error("D6E2.Creation.Error.RevisionConflict");
  }
  const ledger = freeD6CreationLedger(draft);
  if (!ledger.canFinalize) throw new Error("D6E2.Creation.Error.OverBudget");
  return Object.freeze({
    ...draft,
    finalized: true,
    revision: draft.revision + 1,
  });
}
