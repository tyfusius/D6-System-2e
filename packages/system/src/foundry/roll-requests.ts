import type {
  D6RollInvocationOptionsV1,
  D6RollResultV1,
  D6RequestedRollContextV1,
  D6RequestedRollVisibility,
  D6ScaleRollContext,
  D6WildDieOutcome,
} from "@d6-system-2e/core";
import {
  activeD6GmTasks,
  cancelD6ActiveGmTask,
  runD6ActiveGmTask,
  subscribeD6ActiveGmTasks,
  takeOverD6ActiveGmTask,
} from "../application/active-gm-tasks";
import { resolveD6PendingInteraction } from "../application/pending-interactions";
import { SYSTEM_ID } from "../constants";
import {
  currentTerminology,
  terminologyAttributeLabel,
} from "../registries/terminology";
import { foundryRandomId } from "./foundry-random-id";
import {
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
  type D6SerializedFoundryRollV1,
} from "./initiating-action-message";
import { registerFoundryPendingInteraction } from "./pending-interactions";
import {
  cancelRequestedRollDialog,
  rollResistanceAgainst,
  rollSecondEditionRiposteAttack,
} from "./rolls/roll-service";
import {
  actorHeroPointBalance,
  transactActorHeroPoints,
} from "./hero-point-service";

export type RequestedRollSubject =
  | { readonly attributeId: string; readonly kind: "attribute" }
  | { readonly itemId: string; readonly kind: "skill" }
  | { readonly itemId: string; readonly kind: "weaponAttack" }
  | { readonly itemId: string; readonly kind: "weaponDamage" };
type SocketRollSubject =
  | RequestedRollSubject
  | {
      readonly itemId: string;
      readonly kind: "riposte";
      readonly rootMessageId: string;
      readonly targetActorId: string;
      readonly targetTokenId?: string;
    }
  | {
      readonly damageTotal: number;
      readonly kind: "resistance";
      readonly preferredSource: D6ScaleRollContext;
    };
export type RequestedRollDelivery =
  "highlight-on-character-sheet" | "open-roll-window";

const ROLL_REQUEST_VERSION = 3 as const;
const ROLL_REQUEST_LIFETIME_MS = 5 * 60_000;
const ROLL_REQUEST_ACK_TIMEOUT_MS = 5_000;
type RequestedRollStatus = "cancelled" | "rejected" | "rolled";

export interface RequestedRollOutcome {
  readonly resistanceRoll?: RequestedResistanceRollPresentation;
  readonly weaponAttackRoll?: RequestedWeaponAttackRollPresentation;
  readonly status: RequestedRollStatus;
  readonly total?: number;
  readonly wildOutcome?: D6WildDieOutcome;
}

export interface RequestedWeaponAttackRollPresentation {
  readonly actorId: string;
  readonly itemId: string;
  readonly requestId: string;
  readonly result: D6RollResultV1;
  readonly rollArtifacts: readonly D6SerializedFoundryRollV1[];
  readonly rootMessageId: string;
}

export interface RequestedResistanceRollPresentation {
  readonly actorId: string;
  readonly baseFaces: readonly number[];
  readonly characterPointFaces: readonly number[];
  readonly difficulty: number;
  readonly pool: {
    readonly dice: number;
    readonly pips: number;
  };
  readonly resultModifier: number;
  readonly requestId: string;
  readonly rollArtifacts: readonly D6SerializedFoundryRollV1[];
  readonly rollMode: Exclude<D6RollResultV1["request"]["rollMode"], "selfroll">;
  readonly total: number;
  readonly wildFaces: readonly number[];
  readonly wildOutcome: D6WildDieOutcome;
  readonly wildPolicy: D6RollResultV1["wildPolicy"];
}

type RollRequestSocketMessage =
  | {
      readonly actorId: string;
      readonly combinedAction?: NonNullable<
        D6RollInvocationOptionsV1["combinedAction"]
      >;
      readonly createdAt: number;
      readonly delivery: RequestedRollDelivery;
      readonly expiresAt: number;
      readonly id: string;
      readonly requesterUserId: string;
      readonly requesterName: string;
      readonly subject: SocketRollSubject;
      readonly targetUserId: string;
      readonly type: "request";
      readonly version: number;
      readonly visibility: D6RequestedRollVisibility;
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "acknowledged";
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly status: RequestedRollStatus;
      readonly targetUserId: string;
      readonly total?: number;
      readonly type: "response";
      readonly resistanceRoll?: RequestedResistanceRollPresentation;
      readonly weaponAttackRoll?: RequestedWeaponAttackRollPresentation;
      readonly wildOutcome?: D6WildDieOutcome;
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "cancel";
    }
  | {
      readonly targetUserId: string;
      readonly type: "recover-pending-requests";
      readonly version: number;
    };

type RollRequestMessage = Extract<
  RollRequestSocketMessage,
  { readonly type: "request" }
>;

export interface HighlightedRollRequestView {
  readonly actorId: string;
  readonly expiresAt: number;
  readonly id: string;
  readonly requesterName: string;
  readonly subject: RequestedRollSubject;
}

export type HighlightedRollExecutionDisposition =
  "dismissed" | "missing" | "resolved";

interface HighlightedRollRequestEntry {
  readonly actor: FoundryActorDocument;
  readonly request: RollRequestMessage;
  readonly resolve: (outcome: RequestedRollOutcome) => void;
  readonly timer: ReturnType<typeof globalThis.setTimeout>;
}

const pendingIncomingRequestIds = new Set<string>();
const pendingSubjectKeys = new Set<string>();
const highlightedRollRequests = new Map<string, HighlightedRollRequestEntry>();
const highlightedRollRequestListeners = new Set<(actorId: string) => void>();
const outgoingResponseResolvers = new Map<
  string,
  {
    readonly acknowledge: () => void;
    readonly reject: (error: Error) => void;
    readonly resolve: (outcome: RequestedRollOutcome) => void;
  }
>();
const outgoingRequests = new Map<string, RollRequestMessage>();

function actorById(id: string): FoundryActorDocument | undefined {
  return game.actors?.get(id);
}

function subjectMatches(
  left: SocketRollSubject,
  right: SocketRollSubject,
): boolean {
  if (left.kind === "resistance" || right.kind === "resistance") {
    return left.kind === "resistance" && right.kind === "resistance";
  }
  return left.kind === "attribute" && right.kind === "attribute"
    ? left.attributeId === right.attributeId
    : left.kind === right.kind && "itemId" in left && "itemId" in right
      ? left.itemId === right.itemId
      : false;
}

function notifyHighlightedRollRequests(actorId: string): void {
  for (const listener of highlightedRollRequestListeners) listener(actorId);
}

function removeHighlightedRollRequest(
  id: string,
): HighlightedRollRequestEntry | undefined {
  const entry = highlightedRollRequests.get(id);
  if (!entry) return undefined;
  globalThis.clearTimeout(entry.timer);
  highlightedRollRequests.delete(id);
  notifyHighlightedRollRequests(entry.request.actorId);
  return entry;
}

function cancelHighlightedRollRequest(id: string): boolean {
  const entry = removeHighlightedRollRequest(id);
  if (!entry) return false;
  resolveD6PendingInteraction(id);
  entry.resolve({ status: "cancelled" });
  return true;
}

function enqueueHighlightedRollRequest(
  actor: FoundryActorDocument,
  request: RollRequestMessage,
): Promise<RequestedRollOutcome> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(
      () => cancelHighlightedRollRequest(request.id),
      Math.max(0, request.expiresAt - Date.now()),
    );
    highlightedRollRequests.set(request.id, {
      actor,
      request,
      resolve,
      timer,
    });
    notifyHighlightedRollRequests(request.actorId);
  });
}

export function activeHighlightedRollRequests(
  actorId?: string,
): readonly HighlightedRollRequestView[] {
  return Object.freeze(
    [...highlightedRollRequests.values()]
      .filter(({ request }) => !actorId || request.actorId === actorId)
      .map(({ request }) =>
        Object.freeze({
          actorId: request.actorId,
          expiresAt: request.expiresAt,
          id: request.id,
          requesterName: request.requesterName,
          subject: request.subject as RequestedRollSubject,
        }),
      ),
  );
}

export function highlightedRollRequestForSubject(
  actorId: string,
  subject: RequestedRollSubject,
): HighlightedRollRequestView | undefined {
  return activeHighlightedRollRequests(actorId).find((request) =>
    subjectMatches(request.subject, subject),
  );
}

export async function executeHighlightedRollRequest(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
): Promise<HighlightedRollExecutionDisposition> {
  const match = [...highlightedRollRequests.values()].find(
    ({ request }) =>
      request.actorId === actor.id && subjectMatches(request.subject, subject),
  );
  if (!match) return "missing";
  try {
    const result = await executeSubject(
      actor,
      subject,
      requestedRollContext(match.request),
    );
    if (!result) return "dismissed";
    if (!removeHighlightedRollRequest(match.request.id)) return "dismissed";
    match.resolve({ status: "rolled", total: result.total });
    return "resolved";
  } catch (error) {
    console.error("D6 System 2e highlighted requested roll failed", error);
    throw error;
  }
}

export function subscribeHighlightedRollRequests(
  listener: (actorId: string) => void,
): () => void {
  highlightedRollRequestListeners.add(listener);
  return () => highlightedRollRequestListeners.delete(listener);
}

export function activeNonGmOwners(
  actor: FoundryActorDocument,
): readonly FoundryUser[] {
  return Object.freeze(
    (game.users?.contents ?? [])
      .filter(
        (user) =>
          user.active &&
          !user.isGM &&
          (user.character?.id === actor.id ||
            actor.testUserPermission(user, "OWNER")),
      )
      .sort((left, right) =>
        (left.name ?? left.id).localeCompare(
          right.name ?? right.id,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      ),
  );
}

async function executeSubject(
  actor: FoundryActorDocument,
  subject: SocketRollSubject,
  requestedRoll?: D6RequestedRollContextV1,
  combinedAction?: D6RollInvocationOptionsV1["combinedAction"],
  captureExecution?: (
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ) => Promise<void> | void,
): Promise<D6RollResultV1 | null> {
  const api = game.system.api;
  if (!api) return null;
  const options =
    requestedRoll || combinedAction
      ? {
          ...(requestedRoll ? { requestedRoll } : {}),
          ...(combinedAction ? { combinedAction } : {}),
        }
      : undefined;
  if (subject.kind === "attribute") {
    return api.roll.attribute(actor, subject.attributeId, options);
  }
  if (subject.kind === "skill") {
    return api.roll.skill(actor, subject.itemId, options);
  }
  if (subject.kind === "resistance") {
    return rollResistanceAgainst(
      actor,
      subject.preferredSource,
      subject.damageTotal,
      options,
      true,
      captureExecution,
    );
  }
  if (subject.kind === "riposte") {
    if (actorHeroPointBalance(actor) < 1)
      throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
    await transactActorHeroPoints(actor, 1, 0);
    try {
      const result = await rollSecondEditionRiposteAttack(
        actor,
        subject.itemId,
        {
          targetActorId: subject.targetActorId,
          ...(subject.targetTokenId
            ? { targetTokenId: subject.targetTokenId }
            : {}),
        },
        options ?? {},
        captureExecution ?? (() => undefined),
      );
      if (!result) await transactActorHeroPoints(actor, 0, 1);
      return result;
    } catch (error) {
      await transactActorHeroPoints(actor, 0, 1);
      throw error;
    }
  }
  return api.roll.item(
    actor,
    subject.itemId,
    subject.kind === "weaponDamage" ? "damage" : "attack",
    options,
  );
}

function requestedRollContext(
  message: RollRequestMessage,
): D6RequestedRollContextV1 {
  return {
    recipientUserId: message.targetUserId,
    requestId: message.id,
    requesterName: message.requesterName,
    requesterUserId: message.requesterUserId,
    rollMode:
      message.visibility === "private"
        ? "gmroll"
        : message.visibility === "hidden"
          ? "blindroll"
          : "publicroll",
    visibility: message.visibility,
  };
}

function redeliverOutstandingRequests(targetUserId: string): void {
  const coordinator = game.user;
  if (!coordinator?.isGM) return;
  for (const request of outgoingRequests.values()) {
    if (
      request.requesterUserId === coordinator.id &&
      request.targetUserId === targetUserId &&
      request.expiresAt > Date.now()
    ) {
      game.socket?.emit(`system.${SYSTEM_ID}`, request);
    }
  }
}

async function receiveSocket(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const currentUser = game.user;
  if (!currentUser) return;
  const message = value as RollRequestSocketMessage;
  if (message.type === "recover-pending-requests") {
    if (
      message.version !== ROLL_REQUEST_VERSION ||
      !currentUser.isGM ||
      typeof message.targetUserId !== "string"
    ) {
      return;
    }
    const target = game.users?.get(message.targetUserId);
    if (!target?.active || target.isGM) return;
    redeliverOutstandingRequests(target.id);
    return;
  }
  if (
    message.type === "acknowledged" &&
    message.requesterUserId === currentUser.id
  ) {
    const task = activeD6GmTasks().find(({ id }) => id === message.id);
    if (task?.controllerUserId !== message.targetUserId) return;
    outgoingResponseResolvers.get(message.id)?.acknowledge();
    return;
  }
  if (
    message.type === "response" &&
    message.requesterUserId === currentUser.id &&
    isRequestedRollStatus(message.status)
  ) {
    const task = activeD6GmTasks().find(({ id }) => id === message.id);
    if (task?.controllerUserId !== message.targetUserId) return;
    const pending = outgoingResponseResolvers.get(message.id);
    outgoingResponseResolvers.delete(message.id);
    pending?.resolve({
      status: message.status,
      ...(message.status === "rolled" && Number.isFinite(message.total)
        ? { total: message.total }
        : {}),
      ...(message.status === "rolled" &&
      isRequestedResistanceRollPresentation(message.resistanceRoll) &&
      message.resistanceRoll.total === message.total &&
      message.resistanceRoll.wildOutcome === message.wildOutcome
        ? { resistanceRoll: message.resistanceRoll }
        : {}),
      ...(message.status === "rolled" &&
      isRequestedWeaponAttackRollPresentation(message.weaponAttackRoll) &&
      message.weaponAttackRoll.result.total === message.total
        ? { weaponAttackRoll: message.weaponAttackRoll }
        : {}),
      ...(isWildDieOutcome(message.wildOutcome)
        ? { wildOutcome: message.wildOutcome }
        : {}),
    });
    return;
  }
  if (
    message.type === "cancel" &&
    message.targetUserId === currentUser.id &&
    message.requesterUserId !== currentUser.id
  ) {
    const requester = game.users?.get(message.requesterUserId);
    if (
      !requester?.active ||
      !requester.isGM ||
      !pendingIncomingRequestIds.has(message.id)
    ) {
      return;
    }
    if (cancelHighlightedRollRequest(message.id)) return;
    void cancelRequestedRollDialog(message.id);
    pendingIncomingRequestIds.delete(message.id);
    resolveD6PendingInteraction(message.id);
    return;
  }
  if (message.type !== "request" || message.targetUserId !== currentUser.id) {
    return;
  }
  const now = Date.now();
  const requester = game.users?.get(message.requesterUserId);
  if (
    message.version !== ROLL_REQUEST_VERSION ||
    !Number.isFinite(message.createdAt) ||
    !Number.isFinite(message.expiresAt) ||
    message.expiresAt <= now ||
    message.createdAt > now + 30_000 ||
    message.expiresAt - message.createdAt > ROLL_REQUEST_LIFETIME_MS ||
    !requester?.active ||
    !requester.isGM ||
    !isSubject(message.subject) ||
    !isDelivery(message.delivery) ||
    !isVisibility(message.visibility) ||
    !isCombinedAction(message.combinedAction) ||
    ((message.subject.kind === "resistance" ||
      message.subject.kind === "riposte") &&
      message.delivery !== "open-roll-window")
  ) {
    return;
  }
  const actor = actorById(message.actorId);
  if (!actor?.isOwner || currentUser.isGM) {
    emitRollResponse(message, { status: "rejected" });
    return;
  }
  if (
    message.subject.kind === "resistance" &&
    message.subject.preferredSource.targetActorId !== actor.id
  ) {
    emitRollResponse(message, { status: "rejected" });
    return;
  }
  if (pendingIncomingRequestIds.has(message.id)) {
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      id: message.id,
      requesterUserId: message.requesterUserId,
      targetUserId: message.targetUserId,
      type: "acknowledged",
    } satisfies RollRequestSocketMessage);
    return;
  }
  if (
    message.delivery === "highlight-on-character-sheet" &&
    message.subject.kind !== "resistance" &&
    message.subject.kind !== "riposte" &&
    highlightedRollRequestForSubject(message.actorId, message.subject)
  ) {
    emitRollResponse(message, { status: "rejected" });
    return;
  }
  pendingIncomingRequestIds.add(message.id);
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: message.targetUserId,
    type: "acknowledged",
  } satisfies RollRequestSocketMessage);
  const finish = (outcome: RequestedRollOutcome): void => {
    pendingIncomingRequestIds.delete(message.id);
    resolveD6PendingInteraction(message.id);
    emitRollResponse(message, outcome);
  };
  if (message.delivery === "highlight-on-character-sheet") {
    const waiting = enqueueHighlightedRollRequest(actor, message);
    await registerFoundryPendingInteraction({
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      controllerName: currentUser.name ?? currentUser.id,
      controllerUserId: currentUser.id,
      createdAt: message.createdAt,
      expiresAt: message.expiresAt,
      id: message.id,
      kind: "requested-roll",
      label: requestedSubjectLabel(actor, message.subject),
      reopen: async () => {
        const disposition = await executeHighlightedRollRequest(
          actor,
          message.subject as RequestedRollSubject,
        );
        return disposition === "resolved" ? "resolved" : "dismissed";
      },
      subjectLabel: actor.name,
    });
    void waiting.then(finish);
    return;
  }
  await registerFoundryPendingInteraction(
    {
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      controllerName: currentUser.name ?? currentUser.id,
      controllerUserId: currentUser.id,
      createdAt: message.createdAt,
      expiresAt: message.expiresAt,
      id: message.id,
      kind:
        message.subject.kind === "resistance"
          ? "resistance-roll"
          : "requested-roll",
      label: requestedSubjectLabel(actor, message.subject),
      onExpire: () => finish({ status: "cancelled" }),
      reopen: async () => {
        try {
          let rollArtifacts: readonly D6SerializedFoundryRollV1[] | undefined;
          const result = await executeSubject(
            actor,
            message.subject,
            requestedRollContext(message),
            message.combinedAction,
            async (_rolled, artifacts) => {
              rollArtifacts = await serializeD6FoundryRolls(artifacts);
            },
          );
          if (!result) return "dismissed";
          const resistanceRoll =
            message.subject.kind === "resistance"
              ? requestedResistanceRollPresentation(result, rollArtifacts)
              : undefined;
          const weaponAttackRoll =
            message.subject.kind === "riposte"
              ? requestedWeaponAttackRollPresentation(
                  result,
                  message.subject,
                  rollArtifacts,
                )
              : undefined;
          finish({
            status: "rolled",
            total: result.total,
            ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
            ...(weaponAttackRoll === undefined ? {} : { weaponAttackRoll }),
            wildOutcome: result.wildOutcome,
          });
          return "resolved";
        } catch (error) {
          console.error("D6 System 2e requested roll failed", error);
          throw error;
        }
      },
      subjectLabel: actor.name,
    },
    {
      automaticEligible:
        message.subject.kind === "resistance" ||
        message.subject.kind === "riposte",
      forceOpen:
        message.subject.kind !== "resistance" &&
        message.subject.kind !== "riposte",
    },
  );
}

function requestedSubjectLabel(
  actor: FoundryActorDocument,
  subject: SocketRollSubject,
): string {
  if (subject.kind === "resistance") {
    return game.i18n.localize("D6E2.Combat.Resistance");
  }
  if (subject.kind === "riposte") {
    return game.i18n.localize("D6E2.Combat.ActiveResponsive.Riposte");
  }
  if (subject.kind === "attribute") {
    return (
      terminologyAttributeLabel(currentTerminology(), subject.attributeId) ??
      subject.attributeId
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
  }
  return actor.items.get(subject.itemId)?.name ?? subject.itemId;
}

function emitRollResponse(
  request: Extract<RollRequestSocketMessage, { readonly type: "request" }>,
  outcome: RequestedRollOutcome,
): void {
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    id: request.id,
    requesterUserId: request.requesterUserId,
    status: outcome.status,
    targetUserId: request.targetUserId,
    ...(outcome.total === undefined ? {} : { total: outcome.total }),
    ...(outcome.resistanceRoll === undefined
      ? {}
      : { resistanceRoll: outcome.resistanceRoll }),
    ...(outcome.weaponAttackRoll === undefined
      ? {}
      : { weaponAttackRoll: outcome.weaponAttackRoll }),
    type: "response",
    ...(outcome.wildOutcome === undefined
      ? {}
      : { wildOutcome: outcome.wildOutcome }),
  } satisfies RollRequestSocketMessage);
}

export function registerRollRequestSocket(): void {
  game.socket?.on(`system.${SYSTEM_ID}`, (value: unknown) => {
    void receiveSocket(value);
  });
  Hooks.on("userConnected", (user: unknown, connected: unknown) => {
    if (
      connected !== true ||
      !user ||
      typeof user !== "object" ||
      !("id" in user)
    ) {
      return;
    }
    redeliverOutstandingRequests(String(user.id));
  });
  const currentUser = game.user;
  if (currentUser && !currentUser.isGM) {
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      targetUserId: currentUser.id,
      type: "recover-pending-requests",
      version: ROLL_REQUEST_VERSION,
    } satisfies RollRequestSocketMessage);
  }
}

export function activeRollRequests() {
  return activeD6GmTasks();
}

export function subscribeActiveRollRequests(listener: () => void): () => void {
  return subscribeD6ActiveGmTasks(listener);
}

export interface RequestedRollConfiguration {
  readonly delivery: RequestedRollDelivery;
  readonly recipientUserId: string;
  readonly visibility: D6RequestedRollVisibility;
}

function formValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  if (control instanceof RadioNodeList) return control.value;
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
  ) {
    return control.value;
  }
  return "";
}

function isVisibility(value: string): value is D6RequestedRollVisibility {
  return value === "public" || value === "private" || value === "hidden";
}

function isDelivery(value: unknown): value is RequestedRollDelivery {
  return (
    value === "highlight-on-character-sheet" || value === "open-roll-window"
  );
}

function isRequestedRollStatus(value: unknown): value is RequestedRollStatus {
  return value === "cancelled" || value === "rejected" || value === "rolled";
}

function isWildDieOutcome(value: unknown): value is D6WildDieOutcome {
  return [
    "normal",
    "exploded",
    "complication",
    "exceptional-success",
    "ordinary-success",
    "penalty",
    "partial-success",
    "failure",
    "unresolved-advantage",
    "unresolved-complication",
  ].includes(String(value));
}

function isWildDiePolicy(
  value: unknown,
): value is D6RollResultV1["wildPolicy"] {
  return [
    "second-edition",
    "second-edition-basic",
    "second-edition-classic",
    "second-edition-simple",
    "first-edition",
  ].includes(String(value));
}

function isDieFaces(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (face) =>
        Number.isInteger(face) && Number(face) >= 1 && Number(face) <= 6,
    )
  );
}

export function requestedResistanceRollPresentation(
  result: D6RollResultV1,
  rollArtifacts?: readonly D6SerializedFoundryRollV1[],
): RequestedResistanceRollPresentation | undefined {
  const difficulty = result.difficulty?.difficulty;
  const requested = result.request.context?.requestedRoll;
  if (
    result.request.kind !== "resistance" ||
    typeof difficulty !== "number" ||
    !Number.isInteger(difficulty) ||
    result.request.context?.resistance === undefined ||
    requested === undefined ||
    rollArtifacts === undefined ||
    rollArtifacts.length === 0
  ) {
    return undefined;
  }
  return Object.freeze({
    actorId: result.request.source.actorId,
    baseFaces: Object.freeze([...result.baseFaces]),
    characterPointFaces: Object.freeze([...(result.characterPointFaces ?? [])]),
    difficulty: Math.trunc(difficulty),
    pool: Object.freeze({
      dice: result.pool.code.dice,
      pips: result.pool.code.pips,
    }),
    resultModifier: result.request.resultModifier,
    requestId: requested.requestId,
    rollArtifacts: Object.freeze([...rollArtifacts]),
    rollMode: requested.rollMode,
    total: result.total,
    wildFaces: Object.freeze([...result.wildFaces]),
    wildOutcome: result.wildOutcome,
    wildPolicy: result.wildPolicy,
  });
}

export function requestedWeaponAttackRollPresentation(
  result: D6RollResultV1,
  subject: Extract<SocketRollSubject, { readonly kind: "riposte" }>,
  rollArtifacts?: readonly D6SerializedFoundryRollV1[],
): RequestedWeaponAttackRollPresentation | undefined {
  const requested = result.request.context?.requestedRoll;
  const attack = result.request.context?.weaponAttack;
  if (
    result.request.kind !== "weapon-attack" ||
    result.request.source.actorId.trim().length === 0 ||
    result.request.source.itemId !== subject.itemId ||
    attack?.weaponId !== subject.itemId ||
    attack.targetActorId !== subject.targetActorId ||
    attack.targetTokenId !== subject.targetTokenId ||
    requested?.requestId === undefined ||
    rollArtifacts === undefined ||
    rollArtifacts.length === 0
  )
    return undefined;
  return Object.freeze({
    actorId: result.request.source.actorId,
    itemId: subject.itemId,
    requestId: requested.requestId,
    result: structuredClone(result),
    rollArtifacts: Object.freeze([...rollArtifacts]),
    rootMessageId: subject.rootMessageId,
  });
}

export async function validateRequestedWeaponAttackRollArtifacts(
  roll: RequestedWeaponAttackRollPresentation,
  expected: {
    readonly actorId: string;
    readonly itemId: string;
    readonly requestId: string;
    readonly rootMessageId: string;
    readonly targetActorId: string;
    readonly targetTokenId?: string;
  },
): Promise<readonly FoundryRoll[]> {
  const attack = roll.result.request.context?.weaponAttack;
  const requested = roll.result.request.context?.requestedRoll;
  if (
    roll.actorId !== expected.actorId ||
    roll.itemId !== expected.itemId ||
    roll.requestId !== expected.requestId ||
    roll.rootMessageId !== expected.rootMessageId ||
    roll.result.request.kind !== "weapon-attack" ||
    roll.result.request.source.actorId !== expected.actorId ||
    roll.result.request.source.itemId !== expected.itemId ||
    attack?.weaponId !== expected.itemId ||
    attack.targetActorId !== expected.targetActorId ||
    attack.targetTokenId !== expected.targetTokenId ||
    requested?.requestId !== expected.requestId ||
    JSON.stringify(
      roll.rollArtifacts.flatMap(({ evidence }) => evidence.faces),
    ) !==
      JSON.stringify([
        ...roll.result.baseFaces,
        ...(roll.result.characterPointFaces ?? []),
        ...roll.result.wildFaces,
      ])
  )
    throw new Error("D6E2.ActionThread.ReactionEvidenceMissing");
  return hydrateD6FoundryRolls(roll.rollArtifacts);
}

export async function validateRequestedResistanceRollArtifacts(
  roll: RequestedResistanceRollPresentation,
  expected: {
    readonly actorId: string;
    readonly difficulty: number;
    readonly requestId: string;
  },
): Promise<readonly FoundryRoll[]> {
  if (
    roll.actorId !== expected.actorId ||
    roll.requestId !== expected.requestId ||
    roll.difficulty !== expected.difficulty ||
    JSON.stringify(
      roll.rollArtifacts.flatMap(({ evidence }) => evidence.faces),
    ) !==
      JSON.stringify([
        ...roll.baseFaces,
        ...roll.characterPointFaces,
        ...roll.wildFaces,
      ])
  ) {
    throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
  }
  return hydrateD6FoundryRolls(roll.rollArtifacts);
}

function isRequestedResistanceRollPresentation(
  value: unknown,
): value is RequestedResistanceRollPresentation {
  if (!value || typeof value !== "object") return false;
  const roll = value as Partial<RequestedResistanceRollPresentation>;
  const pool = roll.pool as
    { readonly dice?: unknown; readonly pips?: unknown } | undefined;
  return (
    isDieFaces(roll.baseFaces) &&
    isDieFaces(roll.characterPointFaces) &&
    isDieFaces(roll.wildFaces) &&
    Number.isInteger(roll.difficulty) &&
    Number(roll.difficulty) >= 0 &&
    Number.isInteger(pool?.dice) &&
    Number(pool?.dice) >= 0 &&
    Number.isInteger(pool?.pips) &&
    Number(pool?.pips) >= 0 &&
    Number(pool?.pips) <= 2 &&
    Number.isInteger(roll.resultModifier) &&
    typeof roll.actorId === "string" &&
    roll.actorId.trim().length > 0 &&
    typeof roll.requestId === "string" &&
    roll.requestId.trim().length > 0 &&
    ["blindroll", "gmroll", "publicroll"].includes(String(roll.rollMode)) &&
    Array.isArray(roll.rollArtifacts) &&
    roll.rollArtifacts.length > 0 &&
    roll.rollArtifacts.length <= 10 &&
    roll.rollArtifacts.every(isSerializedRollArtifact) &&
    Number.isInteger(roll.total) &&
    isWildDieOutcome(roll.wildOutcome) &&
    isWildDiePolicy(roll.wildPolicy)
  );
}

function isRequestedWeaponAttackRollPresentation(
  value: unknown,
): value is RequestedWeaponAttackRollPresentation {
  if (!value || typeof value !== "object") return false;
  const roll = value as Partial<RequestedWeaponAttackRollPresentation>;
  const result = roll.result as Partial<D6RollResultV1> | undefined;
  return (
    typeof roll.actorId === "string" &&
    roll.actorId.trim().length > 0 &&
    typeof roll.itemId === "string" &&
    roll.itemId.trim().length > 0 &&
    typeof roll.requestId === "string" &&
    roll.requestId.trim().length > 0 &&
    typeof roll.rootMessageId === "string" &&
    roll.rootMessageId.trim().length > 0 &&
    result?.request?.kind === "weapon-attack" &&
    result.request.source.actorId === roll.actorId &&
    result.request.source.itemId === roll.itemId &&
    Number.isFinite(result.total) &&
    Array.isArray(roll.rollArtifacts) &&
    roll.rollArtifacts.length > 0 &&
    roll.rollArtifacts.length <= 10 &&
    roll.rollArtifacts.every(isSerializedRollArtifact)
  );
}

function isSerializedRollArtifact(value: unknown): boolean {
  const artifact = value as Partial<D6SerializedFoundryRollV1> | undefined;
  const evidence = artifact?.evidence;
  return (
    artifact?.version === 1 &&
    typeof artifact.serialized === "string" &&
    artifact.serialized.length > 0 &&
    artifact.serialized.length <= 100_000 &&
    evidence?.formula !== undefined &&
    typeof evidence.formula === "string" &&
    evidence.formula.length > 0 &&
    evidence.formula.length <= 256 &&
    Number.isFinite(evidence.total) &&
    isDieFaces(evidence.faces) &&
    evidence.faces.reduce((sum, face) => sum + face, 0) === evidence.total &&
    typeof evidence.fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(evidence.fingerprint)
  );
}

function isSubject(value: unknown): value is SocketRollSubject {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const subject = value as {
    attributeId?: unknown;
    damageTotal?: unknown;
    itemId?: unknown;
    kind?: unknown;
    preferredSource?: unknown;
    rootMessageId?: unknown;
    targetActorId?: unknown;
    targetTokenId?: unknown;
  };
  if (subject.kind === "attribute") {
    return (
      typeof subject.attributeId === "string" &&
      subject.attributeId.trim().length > 0
    );
  }
  if (subject.kind === "resistance") {
    return (
      typeof subject.damageTotal === "number" &&
      Number.isFinite(subject.damageTotal) &&
      subject.damageTotal >= 0 &&
      isScaleRollContext(subject.preferredSource)
    );
  }
  if (subject.kind === "riposte") {
    return (
      typeof subject.itemId === "string" &&
      subject.itemId.trim().length > 0 &&
      typeof subject.rootMessageId === "string" &&
      subject.rootMessageId.trim().length > 0 &&
      typeof subject.targetActorId === "string" &&
      subject.targetActorId.trim().length > 0 &&
      (subject.targetTokenId === undefined ||
        (typeof subject.targetTokenId === "string" &&
          subject.targetTokenId.trim().length > 0))
    );
  }
  return (
    (subject.kind === "skill" ||
      subject.kind === "weaponAttack" ||
      subject.kind === "weaponDamage") &&
    typeof subject.itemId === "string" &&
    subject.itemId.trim().length > 0
  );
}

function isScaleRollContext(value: unknown): value is D6ScaleRollContext {
  if (!value || typeof value !== "object") return false;
  const scale = value as Partial<D6ScaleRollContext>;
  return (
    scale.application === "damage" &&
    typeof scale.sourceActorId === "string" &&
    typeof scale.sourceName === "string" &&
    Number.isFinite(scale.sourceRank) &&
    typeof scale.targetActorId === "string" &&
    typeof scale.targetName === "string" &&
    Number.isFinite(scale.targetRank) &&
    Number.isFinite(scale.modifierScore) &&
    Number.isFinite(scale.sourcePage)
  );
}

function isCombinedAction(
  value: unknown,
): value is D6RollInvocationOptionsV1["combinedAction"] {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    readonly bonusScore?: unknown;
    readonly context?: {
      readonly groupId?: unknown;
      readonly leaderActorId?: unknown;
      readonly primaryActorId?: unknown;
      readonly stage?: unknown;
    };
    readonly penaltyScore?: unknown;
  };
  const context = candidate.context;
  return (
    typeof candidate.bonusScore === "number" &&
    Number.isFinite(candidate.bonusScore) &&
    candidate.bonusScore >= 0 &&
    typeof candidate.penaltyScore === "number" &&
    Number.isFinite(candidate.penaltyScore) &&
    candidate.penaltyScore >= 0 &&
    context !== undefined &&
    typeof context.groupId === "string" &&
    typeof context.leaderActorId === "string" &&
    typeof context.primaryActorId === "string" &&
    (context.stage === "command" || context.stage === "task")
  );
}

async function promptRequestedRollConfiguration(
  actor: FoundryActorDocument,
  recipients: readonly FoundryUser[],
  label: string,
): Promise<RequestedRollConfiguration | null> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/roll/request-dialog.hbs`,
    {
      actor,
      label,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name ?? recipient.id,
      })),
      gmFallback: recipients.length === 0,
      deliveryOptions: [
        {
          description: game.i18n.localize("D6E2.RequestRoll.Delivery.OpenHelp"),
          icon: "fa-window-restore",
          label: game.i18n.localize("D6E2.RequestRoll.Delivery.Open"),
          selected: true,
          value: "open-roll-window",
        },
        {
          description: game.i18n.localize(
            "D6E2.RequestRoll.Delivery.HighlightHelp",
          ),
          icon: "fa-highlighter",
          label: game.i18n.localize("D6E2.RequestRoll.Delivery.Highlight"),
          selected: false,
          value: "highlight-on-character-sheet",
        },
      ],
      showRecipientChoice: recipients.length > 1,
      visibilityOptions: [
        {
          description: game.i18n.localize(
            "D6E2.RequestRoll.Visibility.PublicHelp",
          ),
          icon: "fa-earth-americas",
          label: game.i18n.localize("D6E2.RequestRoll.Visibility.Public"),
          selected: true,
          value: "public",
        },
        {
          description: game.i18n.localize(
            "D6E2.RequestRoll.Visibility.PrivateHelp",
          ),
          icon: "fa-user-shield",
          label: game.i18n.localize("D6E2.RequestRoll.Visibility.Private"),
          selected: false,
          value: "private",
        },
        {
          description: game.i18n.localize(
            "D6E2.RequestRoll.Visibility.HiddenHelp",
          ),
          icon: "fa-eye-slash",
          label: game.i18n.localize("D6E2.RequestRoll.Visibility.Hidden"),
          selected: false,
          value: "hidden",
        },
      ],
    },
  );
  const result =
    await foundry.applications.api.DialogV2.wait<RequestedRollConfiguration | null>(
      {
        buttons: [
          {
            action: "cancel",
            class: "od6roll-cancel",
            callback: () => null,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "request",
            callback: (_event, button) => {
              const form = button.form;
              if (!form) {
                throw new Error(
                  "The requested-roll configuration form is unavailable.",
                );
              }
              const selectedRecipient = formValue(form, "recipientUserId");
              const recipientUserId =
                selectedRecipient.length > 0
                  ? selectedRecipient
                  : (recipients[0]?.id ?? game.user?.id ?? "");
              const visibility = formValue(form, "visibility");
              const delivery = formValue(form, "delivery");
              if (
                !recipientUserId ||
                !isDelivery(delivery) ||
                !isVisibility(visibility)
              ) {
                throw new Error("The requested-roll configuration is invalid.");
              }
              return { delivery, recipientUserId, visibility };
            },
            class: "od6roll-submit",
            default: true,
            icon: "fa-solid fa-tower-broadcast",
            label: game.i18n.localize("D6E2.RequestRoll.Send"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "od6-request-roll-dialog"],
        content,
        modal: true,
        rejectClose: false,
        position: { width: 520 },
        window: {
          icon: "fa-solid fa-tower-broadcast",
          title: game.i18n.localize("D6E2.RequestRoll.Title"),
        },
      },
    );
  return result && typeof result === "object" ? result : null;
}

export async function requestActorRoll(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
  label: string,
): Promise<void> {
  const currentUser = game.user;
  if (!currentUser?.isGM) return;
  const subjectKey =
    subject.kind === "attribute"
      ? `${actor.id}:attribute:${subject.attributeId}`
      : `${actor.id}:${subject.kind}:${subject.itemId}`;
  if (pendingSubjectKeys.has(subjectKey)) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.RequestRoll.AlreadyPending"),
    );
    return;
  }
  pendingSubjectKeys.add(subjectKey);
  const controllers = activeNonGmOwners(actor);
  let configuration: RequestedRollConfiguration | null;
  try {
    configuration = await promptRequestedRollConfiguration(
      actor,
      controllers,
      label,
    );
  } catch (error) {
    pendingSubjectKeys.delete(subjectKey);
    throw error;
  }
  if (!configuration) {
    pendingSubjectKeys.delete(subjectKey);
    return;
  }
  pendingSubjectKeys.delete(subjectKey);
  void dispatchActorRoll(actor, subject, label, configuration, "requestedRoll");
}

function socketSubjectKey(actorId: string, subject: SocketRollSubject): string {
  return subject.kind === "attribute"
    ? `${actorId}:attribute:${subject.attributeId}`
    : subject.kind === "resistance"
      ? `${actorId}:resistance`
      : `${actorId}:${subject.kind}:${subject.itemId}`;
}

function dispatchActorRoll(
  actor: FoundryActorDocument,
  subject: SocketRollSubject,
  label: string,
  configuration: RequestedRollConfiguration,
  taskKind: "combinedAction" | "requestedRoll",
  combinedAction?: D6RollInvocationOptionsV1["combinedAction"],
  dispatchOptions: {
    readonly createdAt?: number;
    readonly deferLocal?: boolean;
    readonly expiresAt?: number;
    readonly id?: string;
  } = {},
): Promise<RequestedRollOutcome> | null {
  const currentUser = game.user;
  if (!currentUser?.isGM) return null;
  const subjectKey = socketSubjectKey(actor.id, subject);
  if (pendingSubjectKeys.has(subjectKey)) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.RequestRoll.AlreadyPending"),
    );
    return null;
  }
  pendingSubjectKeys.add(subjectKey);
  const controllers = activeNonGmOwners(actor);
  const remoteController = controllers.find(
    (candidate) => candidate.id === configuration.recipientUserId,
  );
  const gmFallback =
    controllers.length === 0 &&
    configuration.recipientUserId === currentUser.id;
  if (!remoteController && !gmFallback) {
    pendingSubjectKeys.delete(subjectKey);
    return null;
  }
  const controller = remoteController ?? currentUser;
  const id = dispatchOptions.id ?? foundryRandomId();
  const createdAt = dispatchOptions.createdAt ?? Date.now();
  const expiresAt =
    dispatchOptions.expiresAt ?? createdAt + ROLL_REQUEST_LIFETIME_MS;
  if (
    id.trim().length === 0 ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > ROLL_REQUEST_LIFETIME_MS
  ) {
    pendingSubjectKeys.delete(subjectKey);
    throw new Error("D6 System 2e requested-roll identity is invalid.");
  }
  const requesterName = currentUser.name ?? currentUser.id;
  const request = {
    actorId: actor.id,
    ...(combinedAction === undefined ? {} : { combinedAction }),
    createdAt,
    delivery: configuration.delivery,
    expiresAt,
    id,
    requesterName,
    requesterUserId: currentUser.id,
    subject,
    targetUserId: controller.id,
    type: "request",
    version: ROLL_REQUEST_VERSION,
    visibility: configuration.visibility,
  } satisfies RollRequestSocketMessage;
  const cancelRemote = remoteController
    ? (): Promise<void> => {
        const pending = outgoingResponseResolvers.get(id);
        game.socket?.emit(`system.${SYSTEM_ID}`, {
          id,
          requesterUserId: currentUser.id,
          targetUserId: remoteController.id,
          type: "cancel",
        } satisfies RollRequestSocketMessage);
        pending?.resolve({ status: "cancelled" });
        outgoingResponseResolvers.delete(id);
        return Promise.resolve();
      }
    : (): Promise<void> => {
        cancelHighlightedRollRequest(id);
        return cancelRequestedRollDialog(id);
      };
  const executeRemote = (): Promise<RequestedRollOutcome> =>
    new Promise((resolve, reject) => {
      let acknowledged = false;
      const timer = globalThis.setTimeout(() => {
        if (acknowledged) return;
        outgoingResponseResolvers.delete(id);
        reject(new Error("Requested-roll delivery was not acknowledged."));
      }, ROLL_REQUEST_ACK_TIMEOUT_MS);
      outgoingResponseResolvers.set(id, {
        acknowledge: () => {
          acknowledged = true;
          globalThis.clearTimeout(timer);
        },
        reject,
        resolve: (status) => {
          globalThis.clearTimeout(timer);
          resolve(status);
        },
      });
      outgoingRequests.set(id, request);
      game.socket?.emit(`system.${SYSTEM_ID}`, request);
    });
  const executeLocal = async (): Promise<RequestedRollOutcome> => {
    if (configuration.delivery === "highlight-on-character-sheet") {
      return enqueueHighlightedRollRequest(actor, request);
    }
    let rollArtifacts: readonly D6SerializedFoundryRollV1[] | undefined;
    const result = await executeSubject(
      actor,
      subject,
      {
        recipientUserId: currentUser.id,
        requestId: id,
        requesterName,
        requesterUserId: currentUser.id,
        rollMode:
          configuration.visibility === "private"
            ? "gmroll"
            : configuration.visibility === "hidden"
              ? "blindroll"
              : "publicroll",
        visibility: configuration.visibility,
      },
      combinedAction,
      async (_rolled, artifacts) => {
        rollArtifacts = await serializeD6FoundryRolls(artifacts);
      },
    );
    if (!result) return { status: "cancelled" };
    const resistanceRoll =
      subject.kind === "resistance"
        ? requestedResistanceRollPresentation(result, rollArtifacts)
        : undefined;
    const weaponAttackRoll =
      subject.kind === "riposte"
        ? requestedWeaponAttackRollPresentation(result, subject, rollArtifacts)
        : undefined;
    return {
      status: "rolled",
      total: result.total,
      ...(resistanceRoll === undefined ? {} : { resistanceRoll }),
      ...(weaponAttackRoll === undefined ? {} : { weaponAttackRoll }),
      wildOutcome: result.wildOutcome,
    };
  };
  if (!remoteController && dispatchOptions.deferLocal === true) {
    const deferred = new Promise<RequestedRollOutcome>((resolve, reject) => {
      const settle = (outcome: RequestedRollOutcome): void => resolve(outcome);
      void registerFoundryPendingInteraction(
        {
          actorId: actor.id,
          actorImg: actor.img,
          actorName: actor.name,
          controllerName: currentUser.name ?? currentUser.id,
          controllerUserId: currentUser.id,
          createdAt,
          expiresAt,
          id,
          kind:
            subject.kind === "resistance"
              ? "resistance-roll"
              : "requested-roll",
          label,
          onExpire: async () => {
            await cancelRequestedRollDialog(id);
            settle({ status: "cancelled" });
          },
          reopen: async () => {
            try {
              const outcome = await executeLocal();
              if (outcome.status === "cancelled") return "dismissed";
              settle(outcome);
              return "resolved";
            } catch (error) {
              throw error instanceof Error ? error : new Error(String(error));
            }
          },
          subjectLabel: actor.name,
        },
        {
          automaticEligible:
            subject.kind === "resistance" || subject.kind === "riposte",
        },
      ).catch(reject);
    });
    return deferred.finally(() => pendingSubjectKeys.delete(subjectKey));
  }
  try {
    return runD6ActiveGmTask({
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      cancelRemote,
      cancelValue: { status: "cancelled" as const },
      controllerName: controller.name ?? controller.id,
      controllerUserId: controller.id,
      createdAt,
      delivery: configuration.delivery,
      execute: remoteController ? executeRemote : executeLocal,
      expiresAt,
      id,
      kind: taskKind,
      label,
      subject:
        subject.kind === "attribute"
          ? { id: subject.attributeId, kind: "attribute" as const }
          : subject.kind === "resistance"
            ? { id: "resistance", kind: "attribute" as const }
            : { id: subject.itemId, kind: "skill" as const },
      ...(remoteController ? { takeOver: executeLocal } : {}),
    }).finally(() => {
      outgoingRequests.delete(id);
      pendingSubjectKeys.delete(subjectKey);
    });
  } catch (error) {
    pendingSubjectKeys.delete(subjectKey);
    throw error;
  }
}

export function requestActorResistanceRoll(
  actor: FoundryActorDocument,
  preferredSource: D6ScaleRollContext,
  damageTotal: number,
  options: {
    readonly createdAt?: number;
    readonly deferLocal?: boolean;
    readonly expiresAt?: number;
    readonly id?: string;
    readonly visibility?: D6RequestedRollVisibility;
  } = {},
): Promise<RequestedRollOutcome> {
  const currentUser = game.user;
  if (!currentUser?.isGM) {
    return Promise.resolve({ status: "rejected" });
  }
  const controller = activeNonGmOwners(actor)[0] ?? currentUser;
  return (
    dispatchActorRoll(
      actor,
      {
        damageTotal: Math.max(0, Math.trunc(damageTotal)),
        kind: "resistance",
        preferredSource,
      },
      game.i18n.localize("D6E2.Combat.Resistance"),
      {
        delivery: "open-roll-window",
        recipientUserId: controller.id,
        visibility: options.visibility ?? "public",
      },
      "requestedRoll",
      undefined,
      options,
    ) ?? Promise.resolve({ status: "rejected" })
  );
}

export function requestActorRiposteRoll(
  actor: FoundryActorDocument,
  input: {
    readonly createdAt: number;
    readonly id: string;
    readonly itemId: string;
    readonly rollMode: D6RollResultV1["request"]["rollMode"];
    readonly rootMessageId: string;
    readonly targetActorId: string;
    readonly targetTokenId?: string;
  },
): Promise<RequestedRollOutcome> {
  const currentUser = game.user;
  if (!currentUser?.isGM) return Promise.resolve({ status: "rejected" });
  const controller = activeNonGmOwners(actor)[0] ?? currentUser;
  const visibility: D6RequestedRollVisibility =
    input.rollMode === "blindroll"
      ? "hidden"
      : input.rollMode === "publicroll"
        ? "public"
        : "private";
  return (
    dispatchActorRoll(
      actor,
      {
        itemId: input.itemId,
        kind: "riposte",
        rootMessageId: input.rootMessageId,
        targetActorId: input.targetActorId,
        ...(input.targetTokenId ? { targetTokenId: input.targetTokenId } : {}),
      },
      game.i18n.localize("D6E2.Combat.ActiveResponsive.Riposte"),
      {
        delivery: "open-roll-window",
        recipientUserId: controller.id,
        visibility,
      },
      "requestedRoll",
      undefined,
      { createdAt: input.createdAt, deferLocal: true, id: input.id },
    ) ?? Promise.resolve({ status: "rejected" })
  );
}

export function requestCombinedActorRoll(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
  label: string,
  configuration: RequestedRollConfiguration,
  combinedAction: NonNullable<D6RollInvocationOptionsV1["combinedAction"]>,
): Promise<RequestedRollOutcome> {
  return (
    dispatchActorRoll(
      actor,
      subject,
      label,
      configuration,
      "combinedAction",
      combinedAction,
    ) ?? Promise.resolve({ status: "rejected" as const })
  );
}

export async function takeOverRollRequest(id: string): Promise<void> {
  if (!game.user?.isGM) return;
  await takeOverD6ActiveGmTask(id);
}

export async function cancelRollRequest(id: string): Promise<void> {
  if (!game.user?.isGM) return;
  await cancelD6ActiveGmTask(id);
}

export function resetRollRequestsForTests(): void {
  for (const entry of highlightedRollRequests.values()) {
    globalThis.clearTimeout(entry.timer);
  }
  highlightedRollRequests.clear();
  highlightedRollRequestListeners.clear();
  pendingIncomingRequestIds.clear();
  pendingSubjectKeys.clear();
  outgoingResponseResolvers.clear();
  outgoingRequests.clear();
}
