import type { D6RollMode } from "@d6-system-2e/core";
import {
  parseD6InitiatingActionResultLedger,
  reconcileD6InitiatingActionResultLedgers,
  type D6InitiatingActionResultLedgerV1,
  type D6InitiatingActionResultV1,
  type D6InitiatingActionRollEvidenceV1,
} from "../application/initiating-action-results";
import { SYSTEM_ID } from "../constants";
import {
  parseCombinedActionRoot,
  type CombinedActionRoot,
} from "../application/combined-action-root";
import { composeCombinedCombatResults } from "../application/combined-combat-results";
import {
  parseD6OrdinaryAttackThread,
  type D6OrdinaryAttackThreadV1,
} from "../application/ordinary-attack-thread";
import { chatVisibilityForMode } from "./rolls/chat-visibility";

export const D6_INITIATING_ACTION_RESULTS_FLAG = "initiatingActionResults";
const PRESENTED_RESULTS_FLAG = "initiatingActionPresentedResults";
const SERIALIZED_ROLL_VERSION = 1 as const;
const presentationMutations = new Map<string, Promise<unknown>>();

function serializeMessageMutation<T>(
  id: string,
  action: () => Promise<T>,
): Promise<T> {
  const task = (presentationMutations.get(id) ?? Promise.resolve())
    .catch(() => undefined)
    .then(action);
  presentationMutations.set(id, task);
  void task
    .finally(() => {
      if (presentationMutations.get(id) === task)
        presentationMutations.delete(id);
    })
    .catch(() => undefined);
  return task;
}

/** Save the continuation state and physical history together. Dice append uses
 * the same queue, so neither update can replace another continuation's save. */
export function persistD6OrdinaryInitiatingActionThread(
  message: FoundryChatMessageDocument,
  thread: D6OrdinaryAttackThreadV1,
): Promise<void> {
  return serializeMessageMutation(message.id, async () => {
    if (thread.attackMessageId !== message.id)
      throw new Error("D6E2.ActionThread.AuthorityMismatch");
    const ledger = messageLedger(message, thread.results, thread);
    await message.update({
      [`flags.${SYSTEM_ID}.ordinaryAttackThread`]: structuredClone(thread),
      [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
        structuredClone(ledger),
    });
  });
}

export function composedD6OrdinaryInitiatingActionThread(
  message: FoundryChatMessageDocument,
  thread: D6OrdinaryAttackThreadV1,
): D6OrdinaryAttackThreadV1 | undefined {
  const root = parseCombinedActionRoot(
    message.getFlag(SYSTEM_ID, "combinedActionRoot"),
  );
  if (root?.version !== 2) return undefined;
  assertCombinedAttackMessage(message, root);
  const raw = message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG);
  const current = parseD6InitiatingActionResultLedger(raw);
  if (raw !== undefined && !current)
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  composeCombinedCombatResults(root, thread, current ?? undefined);
  return thread;
}

function messageLedger(
  message: FoundryChatMessageDocument,
  incoming: D6InitiatingActionResultLedgerV1,
  ordinaryOverride?: D6OrdinaryAttackThreadV1,
): D6InitiatingActionResultLedgerV1 {
  const raw = message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG);
  const current = parseD6InitiatingActionResultLedger(raw);
  if (raw !== undefined && !current)
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  const root = parseCombinedActionRoot(
    message.getFlag(SYSTEM_ID, "combinedActionRoot"),
  );
  if (root?.version === 2) {
    const rawThread =
      ordinaryOverride ?? message.getFlag(SYSTEM_ID, "ordinaryAttackThread");
    const thread = parseD6OrdinaryAttackThread(rawThread);
    if (rawThread !== undefined && !thread)
      throw new Error("D6E2.ActionThread.AuthorityMismatch");
    if (thread) {
      assertCombinedAttackMessage(message, root);
      const source =
        incoming.requestId === root.groupId ? root.results : thread.results;
      if (JSON.stringify(incoming) !== JSON.stringify(source))
        throw new Error("D6E2.ActionThread.AuthorityMismatch");
      return composeCombinedCombatResults(root, thread, current ?? undefined);
    }
  }
  return current
    ? reconcileD6InitiatingActionResultLedgers(current, incoming)
    : incoming;
}

function assertCombinedAttackMessage(
  message: FoundryChatMessageDocument,
  root: CombinedActionRoot,
): void {
  const result = root.steps.find(
    (step) => step.id === root.combatDamage?.attackStepId,
  )?.result;
  const canonical = (value: unknown) =>
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
          )
        : item,
    );
  if (
    !result ||
    canonical(message.getFlag(SYSTEM_ID, "roll")) !== canonical(result)
  )
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
}

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
export function appendD6InitiatingActionPresentation(input: {
  readonly artifacts: readonly FoundryRoll[];
  readonly entry: D6InitiatingActionResultV1;
  readonly ledger: D6InitiatingActionResultLedgerV1;
  readonly message: FoundryChatMessageDocument;
  readonly rollUserId?: string;
}): Promise<"appended" | "duplicate"> {
  // Independent continuations can finish together. Serialize the read/modify/
  // update on the authoritative client, including Foundry's asynchronous save.
  return serializeMessageMutation(input.message.id, () =>
    appendPresentation(input),
  );
}

async function appendPresentation(input: {
  readonly artifacts: readonly FoundryRoll[];
  readonly entry: D6InitiatingActionResultV1;
  readonly ledger: D6InitiatingActionResultLedgerV1;
  readonly message: FoundryChatMessageDocument;
  readonly rollUserId?: string;
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
  const canonical = messageLedger(message, ledger);
  const presented = presentedIds(message);
  if (presented.includes(entry.appendId)) return "duplicate";
  const visibility = initiatingActionVisibilityIntersection(
    message,
    entry.rollMode,
    input.rollUserId,
  );
  await message.update({
    ...visibility,
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(canonical),
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

export function hasUnpresentedInitiatingActionResults(
  message: FoundryChatMessageDocument,
  ledger: D6InitiatingActionResultLedgerV1,
): boolean {
  const presented = presentedIds(message);
  return ledger.entries.some((entry) => !presented.includes(entry.appendId));
}

export function initiatingActionVisibilityIntersection(
  message: FoundryChatMessageDocument,
  mode: D6RollMode,
  rollUserId = game.user?.id,
): { readonly blind?: boolean; readonly whisper?: readonly string[] } {
  const gmIds =
    game.users?.contents.filter((user) => user.isGM).map((user) => user.id) ??
    [];
  const requested = chatVisibilityForMode(mode, gmIds, rollUserId);
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
