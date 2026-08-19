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
import { SYSTEM_ID } from "../constants";
import { foundryRandomId } from "./foundry-random-id";
import {
  cancelRequestedRollDialog,
  rollResistanceAgainst,
} from "./rolls/roll-service";

export type RequestedRollSubject =
  | { readonly attributeId: string; readonly kind: "attribute" }
  | { readonly itemId: string; readonly kind: "skill" }
  | { readonly itemId: string; readonly kind: "weaponAttack" }
  | { readonly itemId: string; readonly kind: "weaponDamage" };
type SocketRollSubject =
  | RequestedRollSubject
  | {
      readonly damageTotal: number;
      readonly kind: "resistance";
      readonly preferredSource: D6ScaleRollContext;
    };
export type RequestedRollDelivery =
  "highlight-on-character-sheet" | "open-roll-window";

const ROLL_REQUEST_VERSION = 2 as const;
const ROLL_REQUEST_LIFETIME_MS = 5 * 60_000;
const ROLL_REQUEST_ACK_TIMEOUT_MS = 5_000;
type RequestedRollStatus = "cancelled" | "rejected" | "rolled";

export interface RequestedRollOutcome {
  readonly status: RequestedRollStatus;
  readonly total?: number;
  readonly wildOutcome?: D6WildDieOutcome;
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
      readonly wildOutcome?: D6WildDieOutcome;
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "cancel";
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
): Promise<boolean> {
  const match = [...highlightedRollRequests.values()].find(
    ({ request }) =>
      request.actorId === actor.id && subjectMatches(request.subject, subject),
  );
  if (!match) return false;
  removeHighlightedRollRequest(match.request.id);
  let outcome: RequestedRollOutcome = { status: "cancelled" };
  try {
    const result = await executeSubject(
      actor,
      subject,
      requestedRollContext(match.request),
    );
    outcome = result
      ? { status: "rolled", total: result.total }
      : { status: "cancelled" };
  } catch (error) {
    console.error("D6 System 2e highlighted requested roll failed", error);
    outcome = { status: "rejected" };
  }
  match.resolve(outcome);
  return true;
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
    );
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

async function receiveSocket(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const currentUser = game.user;
  if (!currentUser) return;
  const message = value as RollRequestSocketMessage;
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
    cancelRequestedRollDialog(message.id);
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
    (message.subject.kind === "resistance" &&
      message.delivery !== "open-roll-window") ||
    pendingIncomingRequestIds.has(message.id)
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
  if (
    message.delivery === "highlight-on-character-sheet" &&
    message.subject.kind !== "resistance" &&
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
  let outcome: RequestedRollOutcome = { status: "cancelled" };
  try {
    if (message.delivery === "highlight-on-character-sheet") {
      outcome = await enqueueHighlightedRollRequest(actor, message);
    } else {
      const result = await executeSubject(
        actor,
        message.subject,
        requestedRollContext(message),
        message.combinedAction,
      );
      outcome = result
        ? {
            status: "rolled",
            total: result.total,
            wildOutcome: result.wildOutcome,
          }
        : { status: "cancelled" };
    }
  } catch (error) {
    console.error("D6 System 2e requested roll failed", error);
    outcome = { status: "rejected" };
  } finally {
    pendingIncomingRequestIds.delete(message.id);
    emitRollResponse(message, outcome);
  }
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

function isSubject(value: unknown): value is SocketRollSubject {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const subject = value as {
    attributeId?: unknown;
    damageTotal?: unknown;
    itemId?: unknown;
    kind?: unknown;
    preferredSource?: unknown;
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
  const id = foundryRandomId();
  const createdAt = Date.now();
  const expiresAt = createdAt + ROLL_REQUEST_LIFETIME_MS;
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
        cancelRequestedRollDialog(id);
        return Promise.resolve();
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
      game.socket?.emit(`system.${SYSTEM_ID}`, request);
    });
  const executeLocal = async (): Promise<RequestedRollOutcome> => {
    if (configuration.delivery === "highlight-on-character-sheet") {
      return enqueueHighlightedRollRequest(actor, request);
    }
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
    );
    return result
      ? {
          status: "rolled",
          total: result.total,
          wildOutcome: result.wildOutcome,
        }
      : { status: "cancelled" };
  };
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
    }).finally(() => pendingSubjectKeys.delete(subjectKey));
  } catch (error) {
    pendingSubjectKeys.delete(subjectKey);
    throw error;
  }
}

export function requestActorResistanceRoll(
  actor: FoundryActorDocument,
  preferredSource: D6ScaleRollContext,
  damageTotal: number,
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
        visibility: "public",
      },
      "requestedRoll",
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
}
