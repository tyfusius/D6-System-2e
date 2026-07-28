import type {
  D6RequestedRollContextV1,
  D6RequestedRollVisibility,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

export type RequestedRollSubject =
  | { readonly attributeId: string; readonly kind: "attribute" }
  | { readonly itemId: string; readonly kind: "skill" };

export interface ActiveRollRequest {
  readonly actorId: string;
  readonly actorImg: string;
  readonly actorName: string;
  readonly controllerName: string;
  readonly controllerUserId: string;
  readonly createdAt: number;
  readonly id: string;
  readonly label: string;
  readonly subject: RequestedRollSubject;
}

const ROLL_REQUEST_VERSION = 1 as const;
const ROLL_REQUEST_LIFETIME_MS = 5 * 60_000;

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
      readonly type: "complete";
    };

const tasks = new Map<string, ActiveRollRequest>();
const listeners = new Set<() => void>();
const pendingIncomingRequestIds = new Set<string>();

function notify(): void {
  for (const listener of listeners) listener();
}

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
  const message = value as RollRequestSocketMessage;
  if (
    message.type === "complete" &&
    message.requesterUserId === game.user?.id
  ) {
    tasks.delete(message.id);
    notify();
    return;
  }
  if (message.type !== "request" || message.targetUserId !== game.user?.id) {
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
  if (!actor?.isOwner || game.user.isGM) return;
  pendingIncomingRequestIds.add(message.id);
  try {
    await executeSubject(actor, message.subject, {
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
  } finally {
    pendingIncomingRequestIds.delete(message.id);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      id: message.id,
      requesterUserId: message.requesterUserId,
      type: "complete",
    } satisfies RollRequestSocketMessage);
  }
}

export function registerRollRequestSocket(): void {
  game.socket?.on(`system.${SYSTEM_ID}`, (value: unknown) => {
    void receiveSocket(value);
  });
}

export function activeRollRequests(): readonly ActiveRollRequest[] {
  return Object.freeze(
    [...tasks.values()].sort((left, right) => left.createdAt - right.createdAt),
  );
}

export function subscribeActiveRollRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
              const recipientUserId = formValue(form, "recipientUserId");
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
  return result ?? null;
}

export async function requestActorRoll(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
  label: string,
): Promise<void> {
  if (!game.user?.isGM) return;
  const controllers = activeNonGmOwners(actor);
  if (controllers.length === 0) {
    ui.notifications.warn(game.i18n.localize("D6E2.Quickbar.NoOnlineOwner"));
    return;
  }
  const configuration = await promptRequestedRollConfiguration(
    actor,
    controllers,
    label,
  );
  if (!configuration) return;
  const controller = controllers.find(
    (candidate) => candidate.id === configuration.recipientUserId,
  );
  if (!controller) return;
  const id = globalThis.crypto.randomUUID();
  const createdAt = Date.now();
  tasks.set(
    id,
    Object.freeze({
      actorId: actor.id,
      actorImg: actor.img,
      actorName: actor.name,
      controllerName: controller.name ?? controller.id,
      controllerUserId: controller.id,
      createdAt: Date.now(),
      id,
      label,
      subject,
    }),
  );
  notify();
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    actorId: actor.id,
    createdAt,
    expiresAt: createdAt + ROLL_REQUEST_LIFETIME_MS,
    id,
    requesterName: game.user.name ?? game.user.id,
    requesterUserId: game.user.id,
    subject,
    targetUserId: controller.id,
    type: "request",
    version: ROLL_REQUEST_VERSION,
    visibility: configuration.visibility,
  } satisfies RollRequestSocketMessage);
}

export async function takeOverRollRequest(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || !game.user?.isGM) return;
  const actor = actorById(task.actorId);
  if (actor) await executeSubject(actor, task.subject);
  tasks.delete(id);
  notify();
}

export function cancelRollRequest(id: string): void {
  if (!game.user?.isGM || !tasks.delete(id)) return;
  notify();
}
