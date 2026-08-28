import type { D6RollMode } from "@d6-system-2e/core";

export const D6_INITIATING_ACTION_RESULTS_VERSION = 1 as const;

export interface D6InitiatingActionRollEvidenceV1 {
  readonly faces: readonly number[];
  readonly fingerprint: string;
  readonly formula: string;
  readonly total: number;
}

export interface D6InitiatingActionResultV1 {
  readonly appendId: string;
  readonly details: Readonly<Record<string, boolean | number | string>>;
  readonly kind:
    | "explosive-deviation"
    | "explosive-target-resistance"
    | "explosive-zone-damage"
    | "ordinary-riposte-attack"
    | "ordinary-riposte-damage"
    | "ordinary-riposte-resistance"
    | "ordinary-target-resistance"
    | "ordinary-weapon-damage";
  readonly rollMode: D6RollMode;
  readonly rolls: readonly D6InitiatingActionRollEvidenceV1[];
}

export interface D6InitiatingActionResultLedgerV1 {
  readonly entries: readonly D6InitiatingActionResultV1[];
  readonly requestId: string;
  readonly revision: number;
  readonly rootMessageId: string;
  readonly version: typeof D6_INITIATING_ACTION_RESULTS_VERSION;
}

export function createD6InitiatingActionResultLedger(
  rootMessageId: string,
  requestId: string,
): D6InitiatingActionResultLedgerV1 {
  return Object.freeze({
    entries: Object.freeze([]),
    requestId: required(requestId),
    revision: 0,
    rootMessageId: required(rootMessageId),
    version: D6_INITIATING_ACTION_RESULTS_VERSION,
  });
}

export function appendD6InitiatingActionResult(
  ledger: D6InitiatingActionResultLedgerV1,
  entry: D6InitiatingActionResultV1,
): D6InitiatingActionResultLedgerV1 {
  const parsed = parseD6InitiatingActionResult(entry);
  if (!parsed) throw new RangeError("D6E2.ActionThread.ResultInvalid");
  const existing = ledger.entries.find(
    ({ appendId }) => appendId === parsed.appendId,
  );
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(parsed)) {
      throw new RangeError("D6E2.ActionThread.ResultConflict");
    }
    return ledger;
  }
  return Object.freeze({
    ...ledger,
    entries: Object.freeze([...ledger.entries, parsed]),
    revision: ledger.revision + 1,
  });
}

export function parseD6InitiatingActionResultLedger(
  value: unknown,
): D6InitiatingActionResultLedgerV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ledger = value as Partial<D6InitiatingActionResultLedgerV1>;
  if (
    ledger.version !== D6_INITIATING_ACTION_RESULTS_VERSION ||
    !nonEmpty(ledger.rootMessageId) ||
    !nonEmpty(ledger.requestId) ||
    !Number.isInteger(ledger.revision) ||
    Number(ledger.revision) < 0 ||
    !Array.isArray(ledger.entries)
  ) {
    return null;
  }
  const entries = ledger.entries.map(parseD6InitiatingActionResult);
  if (entries.some((entry) => entry === null)) return null;
  const ids = entries.map((entry) => entry?.appendId);
  if (new Set(ids).size !== ids.length) return null;
  return Object.freeze({
    entries: Object.freeze(entries as D6InitiatingActionResultV1[]),
    requestId: ledger.requestId,
    revision: Number(ledger.revision),
    rootMessageId: ledger.rootMessageId,
    version: ledger.version,
  });
}

export function parseD6InitiatingActionResult(
  value: unknown,
): D6InitiatingActionResultV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Partial<D6InitiatingActionResultV1>;
  const kind = resultKind(entry.kind);
  const rollMode = resultRollMode(entry.rollMode);
  if (
    !nonEmpty(entry.appendId) ||
    kind === null ||
    rollMode === null ||
    !Array.isArray(entry.rolls) ||
    entry.rolls.length === 0 ||
    !entry.rolls.every(validRollEvidence) ||
    !validDetails(entry.details)
  ) {
    return null;
  }
  return Object.freeze({
    appendId: entry.appendId,
    details: Object.freeze({ ...entry.details }),
    kind,
    rollMode,
    rolls: Object.freeze(
      entry.rolls.map((roll) =>
        Object.freeze({ ...roll, faces: Object.freeze([...roll.faces]) }),
      ),
    ),
  });
}

function resultKind(value: unknown): D6InitiatingActionResultV1["kind"] | null {
  return [
    "explosive-deviation",
    "explosive-target-resistance",
    "explosive-zone-damage",
    "ordinary-riposte-attack",
    "ordinary-riposte-damage",
    "ordinary-riposte-resistance",
    "ordinary-target-resistance",
    "ordinary-weapon-damage",
  ].includes(String(value))
    ? (value as D6InitiatingActionResultV1["kind"])
    : null;
}

function resultRollMode(value: unknown): D6RollMode | null {
  return ["blindroll", "gmroll", "publicroll", "selfroll"].includes(
    String(value),
  )
    ? (value as D6RollMode)
    : null;
}

function validRollEvidence(
  value: unknown,
): value is D6InitiatingActionRollEvidenceV1 {
  const roll = value as Partial<D6InitiatingActionRollEvidenceV1> | undefined;
  return Boolean(
    roll &&
    nonEmpty(roll.formula) &&
    Number.isFinite(roll.total) &&
    Array.isArray(roll.faces) &&
    roll.faces.length <= 100 &&
    roll.faces.every(
      (face) => Number.isInteger(face) && face >= 1 && face <= 100,
    ) &&
    typeof roll.fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(roll.fingerprint),
  );
}

function validDetails(
  value: unknown,
): value is Readonly<Record<string, boolean | number | string>> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).length <= 24 &&
    Object.entries(value).every(
      ([key, detail]) =>
        nonEmpty(key) &&
        key.length <= 64 &&
        (typeof detail === "boolean" ||
          (typeof detail === "number" && Number.isFinite(detail)) ||
          (typeof detail === "string" && detail.length <= 512)),
    ),
  );
}

function required(value: string): string {
  if (!nonEmpty(value)) throw new RangeError("D6E2.ActionThread.Invalid");
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
