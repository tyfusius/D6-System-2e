import type { D6RollMode } from "@d6-system-2e/core";
import {
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultLedgerV1,
  type D6InitiatingActionResultV1,
  type D6InitiatingActionRollEvidenceV1,
} from "../application/initiating-action-results";
import { SYSTEM_ID } from "../constants";
import { chatVisibilityForMode } from "./rolls/chat-visibility";

export const D6_INITIATING_ACTION_RESULTS_FLAG = "initiatingActionResults";
const PRESENTED_RESULTS_FLAG = "initiatingActionPresentedResults";
const SERIALIZED_ROLL_VERSION = 1 as const;

export interface D6SerializedFoundryRollV1 {
  readonly evidence: D6InitiatingActionRollEvidenceV1;
  readonly serialized: string;
  readonly version: typeof SERIALIZED_ROLL_VERSION;
}

export async function serializeD6FoundryRolls(
  rolls: readonly FoundryRoll[],
): Promise<readonly D6SerializedFoundryRollV1[]> {
  return Object.freeze(
    await Promise.all(
      rolls.map(async (roll) => {
        const serialized = JSON.stringify(roll.toJSON());
        if (serialized.length === 0 || serialized.length > 100_000) {
          throw new Error("D6E2.ActionThread.RollArtifactInvalid");
        }
        return Object.freeze({
          evidence: Object.freeze({
            faces: Object.freeze(rollFaces(roll)),
            fingerprint: await sha256(serialized),
            formula: requiredFormula(roll.formula),
            total: requiredTotal(roll.total),
          }),
          serialized,
          version: SERIALIZED_ROLL_VERSION,
        });
      }),
    ),
  );
}

export async function hydrateD6FoundryRolls(
  values: readonly unknown[],
): Promise<readonly FoundryRoll[]> {
  return Object.freeze(
    await Promise.all(
      values.map(async (rawValue) => {
        const value = serializedRollValue(rawValue);
        if (
          value.serialized.length === 0 ||
          value.serialized.length > 100_000 ||
          (await sha256(value.serialized)) !== value.evidence.fingerprint
        ) {
          throw new Error("D6E2.ActionThread.RollArtifactInvalid");
        }
        const roll = Roll.fromJSON(value.serialized);
        if (
          roll.formula !== value.evidence.formula ||
          roll.total !== value.evidence.total ||
          JSON.stringify(rollFaces(roll)) !==
            JSON.stringify(value.evidence.faces)
        ) {
          throw new Error("D6E2.ActionThread.RollArtifactInvalid");
        }
        return roll;
      }),
    ),
  );
}

function serializedRollValue(value: unknown): D6SerializedFoundryRollV1 {
  if (!value || typeof value !== "object") {
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  }
  const candidate = value as {
    evidence?: unknown;
    serialized?: unknown;
    version?: unknown;
  };
  if (
    candidate.version !== SERIALIZED_ROLL_VERSION ||
    typeof candidate.serialized !== "string" ||
    !candidate.evidence ||
    typeof candidate.evidence !== "object"
  ) {
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  }
  return value as D6SerializedFoundryRollV1;
}

/** Append only the newly-authorized roll slice to an existing initiating root.
 * Foundry's ChatMessage update hook—and therefore Dice So Nice—observes this
 * single atomic `rolls` addition. The presented-id flag suppresses reload,
 * reconnect, repair, and duplicate-socket replay. */
export async function appendD6InitiatingActionPresentation(input: {
  readonly artifacts: readonly FoundryRoll[];
  readonly entry: D6InitiatingActionResultV1;
  readonly ledger: D6InitiatingActionResultLedgerV1;
  readonly message: FoundryChatMessageDocument;
}): Promise<"appended" | "duplicate"> {
  const { artifacts, entry, ledger, message } = input;
  if (
    ledger.rootMessageId !== message.id ||
    ledger.entries.find(({ appendId }) => appendId === entry.appendId) !== entry
  ) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  const serialized = await serializeD6FoundryRolls(artifacts);
  if (
    JSON.stringify(serialized.map(({ evidence }) => evidence)) !==
    JSON.stringify(entry.rolls)
  ) {
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  }
  const presented = presentedIds(message);
  if (presented.includes(entry.appendId)) return "duplicate";
  const currentLedger = parseD6InitiatingActionResultLedger(
    message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
  );
  if (
    currentLedger &&
    (currentLedger.rootMessageId !== ledger.rootMessageId ||
      currentLedger.requestId !== ledger.requestId ||
      currentLedger.revision > ledger.revision)
  ) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  const visibility = visibilityIntersection(message, entry.rollMode);
  await message.update({
    ...visibility,
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(ledger),
    [`flags.${SYSTEM_ID}.${PRESENTED_RESULTS_FLAG}`]: [
      ...presented,
      entry.appendId,
    ],
    rolls: [...(message.rolls ?? []), ...artifacts],
  });
  return "appended";
}

export function initiatingActionLedgerFromMessage(
  message: FoundryChatMessageDocument,
): D6InitiatingActionResultLedgerV1 | null {
  return parseD6InitiatingActionResultLedger(
    message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
  );
}

function presentedIds(message: FoundryChatMessageDocument): readonly string[] {
  const value = message.getFlag(SYSTEM_ID, PRESENTED_RESULTS_FLAG);
  return Array.isArray(value) && value.every((id) => typeof id === "string")
    ? value
    : [];
}

function visibilityIntersection(
  message: FoundryChatMessageDocument,
  mode: D6RollMode,
): { readonly blind?: boolean; readonly whisper?: readonly string[] } {
  const gmIds =
    game.users?.contents.filter((user) => user.isGM).map((user) => user.id) ??
    [];
  const requested = chatVisibilityForMode(mode, gmIds, game.user?.id);
  const current = message.whisper ?? [];
  const requestedRecipients = requested.whisper ?? [];
  const whisper =
    current.length === 0
      ? requestedRecipients
      : requestedRecipients.length === 0
        ? current
        : current.filter((id) => requestedRecipients.includes(id));
  if (
    current.length > 0 &&
    requestedRecipients.length > 0 &&
    whisper.length === 0
  ) {
    throw new Error("D6E2.ActionThread.VisibilityMismatch");
  }
  return {
    ...(message.blind === true || requested.blind === true
      ? { blind: true }
      : {}),
    ...(whisper.length > 0 ? { whisper: [...new Set(whisper)] } : {}),
  };
}

function rollFaces(roll: FoundryRoll): number[] {
  return roll.dice.flatMap((term) =>
    term.results
      .filter(({ active }) => active !== false)
      .map(({ result }) => requiredTotal(result)),
  );
}

function requiredFormula(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 256
  )
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  return value;
}

function requiredTotal(value: unknown): number {
  if (!Number.isFinite(value))
    throw new Error("D6E2.ActionThread.RollArtifactInvalid");
  return Number(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
