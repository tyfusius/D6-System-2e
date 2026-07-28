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

type RollRequestSocketMessage =
  | {
      readonly actorId: string;
      readonly id: string;
      readonly requesterUserId: string;
      readonly subject: RequestedRollSubject;
      readonly targetUserId: string;
      readonly type: "request";
    }
  | {
      readonly id: string;
      readonly requesterUserId: string;
      readonly type: "complete";
    };

const tasks = new Map<string, ActiveRollRequest>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function actorById(id: string): FoundryActorDocument | undefined {
  return game.actors?.get(id);
}

async function executeSubject(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
): Promise<unknown> {
  const api = game.system.api;
  if (!api) return null;
  return subject.kind === "attribute"
    ? api.roll.attribute(actor, subject.attributeId)
    : api.roll.skill(actor, subject.itemId);
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
  const actor = actorById(message.actorId);
  if (!actor?.isOwner) return;
  try {
    await executeSubject(actor, message.subject);
  } finally {
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

export function requestActorRoll(
  actor: FoundryActorDocument,
  subject: RequestedRollSubject,
  label: string,
): void {
  if (!game.user?.isGM) return;
  const controller = game.users?.contents.find(
    (user) =>
      user.active && !user.isGM && actor.testUserPermission(user, "OWNER"),
  );
  if (!controller) {
    ui.notifications.warn(game.i18n.localize("D6E2.Quickbar.NoOnlineOwner"));
    return;
  }
  const id = globalThis.crypto.randomUUID();
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
    id,
    requesterUserId: game.user.id,
    subject,
    targetUserId: controller.id,
    type: "request",
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
