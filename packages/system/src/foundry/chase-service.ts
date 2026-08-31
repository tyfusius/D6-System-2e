import {
  D6_CHASE_CONTRACT_VERSION,
  createD6Chase,
  resolveD6ChaseExchange,
  submitD6ChaseRoll,
  type D6ChaseResolveV1,
  type D6ChaseSide,
  type D6ChaseStartV1,
  type D6ChaseStateV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentOptionalCapabilityRuntime } from "../settings/optional-capabilities";
import { foundryRandomId } from "./foundry-random-id";
import { rollSkill } from "./rolls/roll-service";

const CHASE_FLAG = "chase";
const SOCKET_TIMEOUT_MS = 8_000;
type ChaseSocketMessage =
  | {
      readonly actorId: string;
      readonly chaseId: string;
      readonly expectedRevision: number;
      readonly itemId: string;
      readonly requestId: string;
      readonly requesterUserId: string;
      readonly side: D6ChaseSide;
      readonly total: number;
      readonly wildDieFace?: number;
      readonly wildOutcome?: string;
      readonly type: "chase-roll";
    }
  | {
      readonly error?: string;
      readonly requestId: string;
      readonly requesterUserId: string;
      readonly state?: D6ChaseStateV1;
      readonly type: "chase-response";
    };

const pending = new Map<
  string,
  {
    readonly reject: (error: Error) => void;
    readonly resolve: (state: D6ChaseStateV1) => void;
  }
>();

function scene(): FoundrySceneDocument {
  if (!canvas.scene) throw new Error("D6E2.Chase.Error.SceneRequired");
  return canvas.scene;
}

function isChaseState(value: unknown): value is D6ChaseStateV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "contractVersion" in value &&
    value.contractVersion === D6_CHASE_CONTRACT_VERSION &&
    "id" in value &&
    typeof value.id === "string" &&
    "revision" in value &&
    Number.isSafeInteger(value.revision) &&
    "distance" in value &&
    Number.isSafeInteger(value.distance)
  );
}

export function readD6Chase(): D6ChaseStateV1 | null {
  if (typeof canvas === "undefined") return null;
  const value = canvas.scene?.getFlag(SYSTEM_ID, CHASE_FLAG);
  return isChaseState(value) ? value : null;
}

function requireGm(): void {
  if (game.user?.isGM !== true) throw new Error("D6E2.Chase.Error.GmOnly");
}

export function d6ChasesEnabled(): boolean {
  return currentOptionalCapabilityRuntime().chases.state === "active";
}

async function write(state: D6ChaseStateV1): Promise<D6ChaseStateV1> {
  requireGm();
  const rolls: Record<string, unknown> = { ...state.rolls };
  if (!state.rolls.pursuer)
    rolls.pursuer = new foundry.data.operators.ForcedDeletion();
  if (!state.rolls.fleeing)
    rolls.fleeing = new foundry.data.operators.ForcedDeletion();
  await scene().setFlag(SYSTEM_ID, CHASE_FLAG, { ...state, rolls });
  Hooks.callAll?.("d6e2ChaseChanged", state);
  return state;
}

function actorForSide(state: D6ChaseStateV1, side: D6ChaseSide) {
  const participant = state[side];
  const actor = game.actors?.get(participant.actorId);
  if (!actor) throw new Error("D6E2.Chase.Error.ActorMissing");
  const item = actor.items.get(participant.itemId);
  if (!item || !["skill", "specialization"].includes(item.type)) {
    throw new Error("D6E2.Chase.Error.SkillMissing");
  }
  return { actor, item, participant };
}

export async function startD6Chase(
  input: D6ChaseStartV1,
): Promise<D6ChaseStateV1> {
  requireGm();
  if (!d6ChasesEnabled()) throw new Error("D6E2.Chase.Error.ModuleInactive");
  if (readD6Chase()) throw new Error("D6E2.Chase.Error.AlreadyActive");
  for (const side of ["pursuer", "fleeing"] as const) {
    const participant = input[side];
    const actor = game.actors?.get(participant.actorId);
    const item = actor?.items.get(participant.itemId);
    if (!actor || !item || !["skill", "specialization"].includes(item.type)) {
      throw new Error("D6E2.Chase.Error.SkillMissing");
    }
  }
  return write(createD6Chase(input));
}

async function submitAuthoritatively(
  state: D6ChaseStateV1,
  side: D6ChaseSide,
  total: number,
  wildDieFace?: number,
  wildOutcome?: string,
): Promise<D6ChaseStateV1> {
  const currentUser = game.user;
  if (!currentUser) throw new Error("D6E2.Chase.Error.UserRequired");
  const { actor, participant } = actorForSide(state, side);
  if (!currentUser.isGM && actor.isOwner !== true) {
    throw new Error("D6E2.Chase.Error.NotAuthorized");
  }
  const requestId = foundryRandomId();
  if (currentUser.isGM) {
    return write(
      submitD6ChaseRoll(
        readD6Chase() ?? state,
        {
          requestId,
          side,
          total,
          userId: currentUser.id,
          ...(wildDieFace === undefined ? {} : { wildDieFace }),
          ...(wildOutcome === undefined ? {} : { wildOutcome }),
        },
        state.revision,
      ),
    );
  }
  const activeGm = (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!activeGm) throw new Error("D6E2.Chase.Error.GmUnavailable");
  return new Promise((resolve, reject) => {
    pending.set(requestId, { reject, resolve });
    window.setTimeout(() => {
      if (!pending.delete(requestId)) return;
      reject(new Error("D6E2.Chase.Error.GmTimeout"));
    }, SOCKET_TIMEOUT_MS);
    game.socket?.emit(`system.${SYSTEM_ID}`, {
      actorId: participant.actorId,
      chaseId: state.id,
      expectedRevision: state.revision,
      itemId: participant.itemId,
      requestId,
      requesterUserId: currentUser.id,
      side,
      total,
      ...(wildDieFace === undefined ? {} : { wildDieFace }),
      ...(wildOutcome === undefined ? {} : { wildOutcome }),
      type: "chase-roll",
    } satisfies ChaseSocketMessage);
  });
}

export async function rollD6ChaseSide(
  side: D6ChaseSide,
): Promise<D6ChaseStateV1 | null> {
  const state = readD6Chase();
  if (state?.status !== "active") throw new Error("D6E2.Chase.Error.NotActive");
  if (state.rolls[side]) throw new Error("D6E2.Chase.Error.AlreadyRolled");
  const { actor, participant } = actorForSide(state, side);
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Chase.Error.NotAuthorized");
  }
  const result = await rollSkill(actor, participant.itemId, {
    forceTotalResolution: true,
  });
  if (!result) return null;
  if ("resolution" in result) {
    throw new Error("D6E2.Chase.Error.NumericResolutionRequired");
  }
  return submitAuthoritatively(
    state,
    side,
    result.total,
    result.wildFaces[0],
    result.wildOutcome,
  );
}

export async function resolveD6Chase(
  input: D6ChaseResolveV1,
): Promise<D6ChaseStateV1> {
  requireGm();
  const current = readD6Chase();
  if (!current) throw new Error("D6E2.Chase.Error.NotActive");
  const next = resolveD6ChaseExchange(current, input);
  await write(next);
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/chase-resolution.hbs`,
    { chase: next, result: next.history.at(-1) },
  );
  const actor = game.actors?.get(next.pursuer.actorId);
  await ChatMessage.create({
    content,
    ...(actor ? { speaker: ChatMessage.getSpeaker({ actor }) } : {}),
  });
  return next;
}

export async function endD6Chase(expectedRevision: number): Promise<void> {
  requireGm();
  const current = readD6Chase();
  if (!current) return;
  if (current.revision !== expectedRevision)
    throw new Error("D6E2.Chase.Error.RevisionConflict");
  await scene().unsetFlag(SYSTEM_ID, CHASE_FLAG);
  Hooks.callAll?.("d6e2ChaseChanged", null);
}

async function receive(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const message = value as ChaseSocketMessage;
  if (message.type === "chase-response") {
    if (message.requesterUserId !== game.user?.id) return;
    const resolver = pending.get(message.requestId);
    if (!resolver) return;
    pending.delete(message.requestId);
    if (message.error || !message.state)
      resolver.reject(
        new Error(message.error ?? "D6E2.Chase.Error.InvalidResponse"),
      );
    else resolver.resolve(message.state);
    return;
  }
  if (game.user?.isGM !== true) return;
  const activeGm = (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (activeGm?.id !== game.user.id) return;
  const requester = game.users?.get(message.requesterUserId);
  let next: D6ChaseStateV1 | undefined;
  let error: string | undefined;
  try {
    const current = readD6Chase();
    if (current?.id !== message.chaseId)
      throw new Error("D6E2.Chase.Error.NotActive");
    const participant = current[message.side];
    const actor = game.actors?.get(message.actorId);
    if (
      participant.actorId !== message.actorId ||
      participant.itemId !== message.itemId ||
      !requester?.active ||
      requester.isGM ||
      !actor?.testUserPermission(requester, "OWNER")
    )
      throw new Error("D6E2.Chase.Error.NotAuthorized");
    next = await write(
      submitD6ChaseRoll(
        current,
        {
          requestId: message.requestId,
          side: message.side,
          total: message.total,
          userId: message.requesterUserId,
          ...(message.wildDieFace === undefined
            ? {}
            : { wildDieFace: message.wildDieFace }),
          ...(message.wildOutcome === undefined
            ? {}
            : { wildOutcome: message.wildOutcome }),
        },
        message.expectedRevision,
      ),
    );
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "D6E2.Chase.Error.InvalidRequest";
  }
  game.socket?.emit(`system.${SYSTEM_ID}`, {
    ...(error ? { error } : {}),
    requestId: message.requestId,
    requesterUserId: message.requesterUserId,
    ...(next ? { state: next } : {}),
    type: "chase-response",
  } satisfies ChaseSocketMessage);
}

export function registerD6ChaseSocket(): void {
  game.socket?.on(
    `system.${SYSTEM_ID}`,
    (value: unknown) => void receive(value),
  );
}
