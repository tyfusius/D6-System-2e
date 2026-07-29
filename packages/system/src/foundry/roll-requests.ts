import type {
  D6RequestedRollContextV1,
  D6RequestedRollVisibility,
} from "@d6-system-2e/core";
import {
  activeD6GmTasks,
  cancelD6ActiveGmTask,
  runD6ActiveGmTask,
  subscribeD6ActiveGmTasks,
  takeOverD6ActiveGmTask,
} from "../application/active-gm-tasks";
import { SYSTEM_ID } from "../constants";
import { cancelRequestedRollDialog } from "./rolls/roll-service";

export type RequestedRollSubject =
  | { readonly attributeId: string; readonly kind: "attribute" }
  | { readonly itemId: string; readonly kind: "skill" };

const ROLL_REQUEST_VERSION = 1 as const;
const ROLL_REQUEST_LIFETIME_MS = 5 * 60_000;
const ROLL_REQUEST_ACK_TIMEOUT_MS = 5_000;
type RequestedRollStatus = "cancelled" | "rejected" | "rolled";

type RollRequestSocketMessage =
  | {
      readonly actorId: string;
      readonly createdAt: number;
      readonly expiresAt: number;
      readonly id: string;
      readonly requesterUserId: string;
      readonly requesterName: string;
      readonly subject: RequestedRollSubject;
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
      readonly type: "response";
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
      readonly type: "cancel";
    };

const pendingIncomingRequestIds = new Set<string>();
const pendingSubjectKeys = new Set<string>();
const outgoingResponseResolvers = new Map<
  string,
  {
    readonly acknowledge: () => void;
    readonly reject: (error: Error) => void;
    readonly resolve: (status: RequestedRollStatus) => void;
  }
>();

function actorById(id: string): FoundryActorDocument | undefined {
  return game.actors?.get(id);
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
  subject: RequestedRollSubject,
  requestedRoll?: D6RequestedRollContextV1,
): Promise<unknown> {
  const api = game.system.api;
  if (!api) return null;
  const options = requestedRoll ? { requestedRoll } : undefined;
  return subject.kind === "attribute"
    ? api.roll.attribute(actor, subject.attributeId, options)
    : api.roll.skill(actor, subject.itemId, options);
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
    pending?.resolve(message.status);
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
    !isVisibility(message.visibility) ||
    pendingIncomingRequestIds.has(message.id)
  ) {
    return;
  }
  const actor = actorById(message.actorId);
  if (!actor?.isOwner || currentUser.isGM) {
    emitRollResponse(message, "rejected");
    return;
  }
  pendingIncomingRequestIds.add(message.id);
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: message.targetUserId,
    type: "acknowledged",
  } satisfies RollRequestSocketMessage);
  let status: RequestedRollStatus = "cancelled";
  try {
    const result = await executeSubject(actor, message.subject, {
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
    });
    status = result ? "rolled" : "cancelled";
  } catch (error) {
    console.error("D6 System 2e requested roll failed", error);
    status = "rejected";
  } finally {
    pendingIncomingRequestIds.delete(message.id);
    emitRollResponse(message, status);
  }
}

function emitRollResponse(
  request: Extract<RollRequestSocketMessage, { readonly type: "request" }>,
  status: RequestedRollStatus,
): void {
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    id: request.id,
    requesterUserId: request.requesterUserId,
    status,
    targetUserId: request.targetUserId,
    type: "response",
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

interface RequestedRollConfiguration {
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

function isRequestedRollStatus(value: unknown): value is RequestedRollStatus {
  return value === "cancelled" || value === "rejected" || value === "rolled";
}

function isSubject(value: unknown): value is RequestedRollSubject {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const subject = value as Partial<RequestedRollSubject>;
  return subject.kind === "attribute"
    ? typeof subject.attributeId === "string" &&
        subject.attributeId.trim().length > 0
    : subject.kind === "skill" &&
        typeof subject.itemId === "string" &&
        subject.itemId.trim().length > 0;
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
              if (!recipientUserId || !isVisibility(visibility)) {
                throw new Error("The requested-roll configuration is invalid.");
              }
              return { recipientUserId, visibility };
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
      : `${actor.id}:skill:${subject.itemId}`;
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
  const remoteController = controllers.find(
    (candidate) => candidate.id === configuration.recipientUserId,
  );
  const gmFallback =
    controllers.length === 0 &&
    configuration.recipientUserId === currentUser.id;
  if (!remoteController && !gmFallback) {
    pendingSubjectKeys.delete(subjectKey);
    return;
  }
  const controller = remoteController ?? currentUser;
  const id = globalThis.crypto.randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + ROLL_REQUEST_LIFETIME_MS;
  const requesterName = currentUser.name ?? currentUser.id;
  const request = {
    actorId: actor.id,
    createdAt,
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
        pending?.resolve("cancelled");
        outgoingResponseResolvers.delete(id);
        return Promise.resolve();
      }
    : (): Promise<void> => {
        cancelRequestedRollDialog(id);
        return Promise.resolve();
      };
  const executeRemote = (): Promise<RequestedRollStatus> =>
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
  const executeLocal = async (): Promise<RequestedRollStatus> => {
    const result = await executeSubject(actor, subject, {
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
    });
    return result ? "rolled" : "cancelled";
  };
  try {
    void runD6ActiveGmTask({
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      cancelRemote,
      cancelValue: "cancelled" as const,
      controllerName: controller.name ?? controller.id,
      controllerUserId: controller.id,
      createdAt,
      execute: remoteController ? executeRemote : executeLocal,
      expiresAt,
      id,
      kind: "requestedRoll",
      label,
      ...(remoteController ? { takeOver: executeLocal } : {}),
    }).finally(() => pendingSubjectKeys.delete(subjectKey));
  } catch (error) {
    pendingSubjectKeys.delete(subjectKey);
    throw error;
  }
}

export async function takeOverRollRequest(id: string): Promise<void> {
  if (!game.user?.isGM) return;
  await takeOverD6ActiveGmTask(id);
}

export async function cancelRollRequest(id: string): Promise<void> {
  if (!game.user?.isGM) return;
  await cancelD6ActiveGmTask(id);
}
