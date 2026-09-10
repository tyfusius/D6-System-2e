import {
  movementTranslationAllowed,
  runningOutcome,
} from "../application/first-edition-segmented-running";
import type { D6RollMode } from "@d6-system-2e/core";
import {
  parseFirstEditionRelativeMovement,
  type FirstEditionRelativeMovement,
} from "../application/first-edition-relative-movement";
import { FirstEditionActionError } from "../application/first-edition-action-root";
import type { FirstEditionActionStorePorts } from "../application/first-edition-action-ports";
import { SYSTEM_ID } from "../constants";
import { foundryRandomId } from "./foundry-random-id";
import {
  activeGridCombat,
  requestPrivateMovementRoot,
} from "./combat-round-private";
import { readCombatantRound } from "./combat-service";
import {
  registerRelativeMovementAuthority,
  RELATIVE_MOVEMENT_ROOT_FLAG,
  relativeMovementContextAvailable,
  relativeMovementRollRuntime,
  setRelativeMovementRenderer,
} from "./first-edition-relative-movement-authority";
import { createFoundryFirstEditionRollPorts } from "./first-edition-action-roll-ports";
import {
  renderD6RollResult,
  rollFirstEditionMovementCheck,
  rollFirstEditionSegmentRunningCheck,
} from "./rolls/roll-service";
import { bindD6EmbeddedRollActions } from "./rolls/chat-card-actions";
import type {
  ActorTokenMovementPreview,
  ActorTokenMovementRequest,
  ActorTokenMovementResult,
} from "./token-movement-service";

const label = (key: string) =>
  game.i18n.localize(`D6E2.Combat.FirstEdition.MovementRoot.${key}`);
const running = new Set<string>();
const mountedCards = new Map<
  string,
  Set<{
    card: WeakRef<HTMLElement>;
    message: WeakRef<FoundryChatMessageDocument>;
  }>
>();
function projectControls(
  value: FirstEditionRelativeMovement,
  card: HTMLElement,
  actor: FoundryActorDocument,
): void {
  const owner = value.action.stages[0]?.spec.controllerUserId === game.user?.id;
  const authorized = Boolean(
    game.user?.isGM === true ||
    (owner && game.user && actor.testUserPermission(game.user, "OWNER")),
  );
  for (const button of Array.from(
    card.querySelectorAll<HTMLButtonElement>("[data-d6-movement-root-action]"),
  )) {
    const cancel = button.dataset.d6MovementRootAction === "cancel";
    button.hidden = !authorized;
    button.classList.toggle("od6-movement-root-visible", authorized);
    const repair = value.action.stages.some(
      (s) =>
        s.state === "recorded" ||
        (s.state === "claimed" && s.spec.kind === "effect"),
    );
    button.disabled =
      !authorized ||
      running.has(value.action.rootMessageId) ||
      (cancel
        ? !owner ||
          value.action.status !== "open" ||
          value.action.stages.some((s) => s.state !== "pending")
        : owner && value.action.status === "open"
          ? false
          : !repair);
    if (!cancel)
      button.textContent = label(
        !owner || value.action.status !== "open" ? "Repair" : "Continue",
      );
  }
}
async function refreshMountedControls(id: string): Promise<void> {
  const cards = mountedCards.get(id);
  if (!cards) return;
  for (const entry of cards) {
    const card = entry.card.deref(),
      message = entry.message.deref();
    if (!card || !message) {
      cards.delete(entry);
      continue;
    }
    try {
      const value = parsed(
        message.getFlag(SYSTEM_ID, RELATIVE_MOVEMENT_ROOT_FLAG),
      );
      projectControls(value, card, await boundActor(value));
    } catch {
      for (const button of Array.from(
        card.querySelectorAll<HTMLButtonElement>(
          "[data-d6-movement-root-action]",
        ),
      ))
        button.disabled = true;
    }
  }
  if (cards.size === 0) mountedCards.delete(id);
}
async function cancelRelativeMovement(
  value: FirstEditionRelativeMovement,
): Promise<void> {
  const id = value.action.rootMessageId;
  if (running.has(id)) throw new FirstEditionActionError("conflict");
  running.add(id);
  try {
    await route(value, "cancel");
  } finally {
    running.delete(id);
    await refreshMountedControls(id);
  }
}
const drivers = new Map<
  string,
  ReturnType<typeof createFoundryFirstEditionRollPorts>
>();
function parsed(raw: unknown): FirstEditionRelativeMovement {
  const value = parseFirstEditionRelativeMovement(raw);
  if (!value) throw new FirstEditionActionError("invalid");
  return value;
}
function route(
  value: FirstEditionRelativeMovement,
  method: string,
  data: Record<string, unknown> = {},
): Promise<unknown> {
  const combat = activeGridCombat(),
    c = combat?.combatants.contents.find(
      (c) =>
        value.combat.combatantUuid === `Combat.${combat.id}.Combatant.${c.id}`,
    );
  if (!c?.actor) throw new FirstEditionActionError("authority");
  return requestPrivateMovementRoot({
    kind: "relative-movement-root",
    actorId: c.actor.id,
    combatantId: c.id,
    revision: value.combat.revision,
    data: { ...data, method, rootMessageId: value.action.rootMessageId },
  });
}
async function boundActor(
  value: FirstEditionRelativeMovement,
): Promise<FoundryActorDocument & { readonly uuid: string }> {
  const subject = value.action.subjects[0]?.actor;
  const actor = (await fromUuid(
    subject?.actorUuid ?? "",
  )) as FoundryActorDocument | null;
  if (
    !subject ||
    actor?.uuid !== subject.actorUuid ||
    actor.id !== subject.actorId
  )
    throw new FirstEditionActionError("authority");
  return actor as FoundryActorDocument & { readonly uuid: string };
}
function rollDriver(
  value: FirstEditionRelativeMovement,
  actor: FoundryActorDocument & { readonly uuid: string },
) {
  const id = value.action.rootMessageId;
  let driver = drivers.get(id);
  if (driver) return driver;
  const stage = value.action.stages[0];
  if (!stage) throw new FirstEditionActionError("invalid");
  const binding = {
    rootMessageId: id,
    operationId: value.action.operationId,
    stageId: stage.id,
    authenticatedSenderId: game.user?.id ?? "",
  };
  const store: FirstEditionActionStorePorts = {
    load: async () => parsed(await route(value, "load")).action,
    compareAndSwap: (_id, revision, next, scope: D6RollMode | "preserve") =>
      route(value, "cas", { revision, next, scope }).then(
        (result) => result === true,
      ),
    authorize: (_binding, _root, current, phase) => {
      if (
        !game.user?.active ||
        !(game.user.isGM || actor.testUserPermission(game.user, "OWNER")) ||
        (phase === "claim" && current.spec.controllerUserId !== game.user.id)
      )
        throw new FirstEditionActionError("authority");
      return Promise.resolve();
    },
  };
  driver = createFoundryFirstEditionRollPorts(binding, actor, {
    ...store,
    runtime: relativeMovementRollRuntime,
    present: async () => {
      await route(value, "present");
    },
  });
  drivers.set(id, driver);
  return driver;
}
/** Explicit continuation only. Restoring chat never rolls dice or applies effects. */
export async function continueRelativeMovement(
  initial: FirstEditionRelativeMovement,
): Promise<FirstEditionRelativeMovement> {
  const id = initial.action.rootMessageId;
  if (running.has(id)) throw new FirstEditionActionError("conflict");
  running.add(id);
  try {
    let value = parsed(await route(initial, "load"));
    if (value.action.stages[0]?.spec.controllerUserId !== game.user?.id) {
      if (!game.user?.isGM) throw new FirstEditionActionError("authority");
      const stage = value.action.stages.find((s) => s.state !== "recorded");
      // A non-controller GM can reconcile existing evidence only. Never run a
      // builder, claim a pending effect, or advance into the owner's next stage.
      if (stage?.state === "claimed" && stage.spec.kind === "effect")
        value = parsed(await route(value, "effect"));
      await route(value, "present");
      return value;
    }
    for (let step = 0; step < 8; step++) {
      if (value.action.status !== "open") {
        await route(value, "present");
        drivers.delete(id);
        return value;
      }
      const stage = value.action.stages.find((s) => s.state !== "recorded");
      if (!stage) value = parsed(await route(value, "advance"));
      else if (stage.spec.kind === "d6-roll") {
        const actor = await boundActor(value);
        const result = await rollDriver(value, actor).runD6((hooks) =>
          value.segment
            ? rollFirstEditionSegmentRunningCheck(
                actor,
                value.plan.difficulty,
                value.plan.distance,
                hooks,
              )
            : rollFirstEditionMovementCheck(actor, value.plan, hooks),
        );
        if (!result) return parsed(await route(value, "load"));
        value = parsed(await route(value, "load"));
      } else if (stage.spec.kind === "effect")
        value = parsed(await route(value, "effect"));
      else throw new FirstEditionActionError("invalid");
    }
    throw new FirstEditionActionError("uncertain");
  } finally {
    running.delete(id);
    await refreshMountedControls(id);
  }
}
/** null is the explicit preflight result: run the complete existing flow. Any
 * error after creation stays with this root and must never fall back/replay. */
export async function tryRelativeMovementRoot(
  actor: FoundryActorDocument,
  request: ActorTokenMovementRequest,
  preview: ActorTokenMovementPreview,
): Promise<ActorTokenMovementResult | null> {
  if (!relativeMovementContextAvailable(actor, preview.token.id)) return null;
  const c = activeGridCombat()?.combatants.contents.find(
    (c) =>
      c.actor?.uuid === actor.uuid &&
      (c as unknown as { tokenId: string }).tokenId === preview.token.id,
  );
  const round = readCombatantRound(actor, c?.id),
    tokenUuid = (preview.token.document as { readonly uuid?: string }).uuid;
  if (!round || !tokenUuid) throw new FirstEditionActionError("authority");
  const raw = await requestPrivateMovementRoot({
    kind: "relative-movement-root",
    actorId: actor.id,
    combatantId: round.combatantId,
    revision: request.expectedRevision ?? -1,
    data: {
      method: "create",
      // Native ChatMessage IDs are 16 characters; the shared helper defaults
      // to 24 and its isolated Web Crypto fallback returns 32.
      rootMessageId: foundryRandomId(16).slice(0, 16),
      tokenUuid,
      origin: { x: preview.token.document.x, y: preview.token.document.y },
      destination: request.destination,
      type: request.type,
      terrainModifier: request.terrainModifier ?? 0,
      ...(request.reactive === true ? { reactive: true } : {}),
    },
  });
  if (raw === null) return null;
  const value = await continueRelativeMovement(parsed(raw));
  return Object.freeze({
    ...preview,
    moved: value.action.stages.some(
      (s) =>
        s.receipt?.kind === "effect" &&
        s.receipt.plan.kind === "token-translation" &&
        s.receipt.outcome === "applied",
    ),
    movementSucceeded:
      value.action.status === "complete" && movementTranslationAllowed(value),
  });
}
export async function relativeMovementContent(
  value: FirstEditionRelativeMovement,
  actor: FoundryActorDocument,
): Promise<string> {
  const check = value.action.stages.find((s) => s.receipt?.kind === "d6-roll"),
    result =
      check?.receipt?.kind === "d6-roll"
        ? (value.matchingResult ?? check.receipt.result)
        : undefined,
    translation = value.action.stages.find(
      (s) =>
        s.spec.kind === "effect" && s.spec.plan.kind === "token-translation",
    ),
    spend = value.action.stages.find(
      (s) =>
        s.spec.kind === "effect" &&
        ["action-spend", "segment-movement"].includes(s.spec.plan.kind),
    ),
    uncertain = value.action.stages.some((s) => s.state === "claimed"),
    status =
      value.action.status === "cancelled"
        ? "Cancelled"
        : value.action.status === "complete"
          ? "Complete"
          : uncertain
            ? "NeedsAttention"
            : "Pending";
  const outcome = runningOutcome(value);
  const format = (key: string, data: Record<string, string | number>) =>
    game.i18n.format(`D6E2.Combat.FirstEdition.MovementRoot.${key}`, data);
  return foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/first-edition-movement-card.hbs`,
    {
      actor,
      plan: value.plan,
      root: true,
      statusLabel: label(status),
      ...(value.segment
        ? {
            movementAudit: {
              summary: format("RunningDistance", {
                distance: value.plan.distance,
                normal: value.segment.plan.normalDistance,
              }),
              detail: format("RunningDifficulty", {
                maximum: value.segment.plan.maximumDistance,
                difficulty: value.plan.difficulty,
              }),
            },
          }
        : {}),
      typeLabel: game.i18n.localize(
        value.segment
          ? "D6E2.Combat.FirstEdition.Running"
          : `D6E2.Combat.FirstEdition.Movement.${value.plan.type}`,
      ),
      actionLabel: game.i18n.localize(
        value.plan.actionRequired
          ? "D6E2.Combat.Movement.OneAction"
          : "D6E2.Combat.FirstEdition.FreeMovement",
      ),
      trackedAction:
        spend?.receipt?.kind === "effect" &&
        spend.receipt.outcome === "applied",
      movementOutcome: {
        ...(outcome && spend?.state === "recorded"
          ? {
              detail: format(
                outcome.complication
                  ? "RunningComplication"
                  : outcome.runningFailure
                    ? "RunningFailure"
                    : "RunningSuccess",
                { remaining: outcome.remainingDistance },
              ),
            }
          : {}),
        label: label(
          translation?.state === "recorded"
            ? "Moved"
            : value.action.status === "complete"
              ? value.segment
                ? "RunningNotMoved"
                : "CheckFailed"
              : "NotConfirmed",
        ),
      },
      actionOutcome: {
        ...(outcome &&
        spend?.state === "recorded" &&
        outcome.forfeitedActions > 0
          ? {
              detail: format("RunningForfeited", {
                count: outcome.forfeitedActions,
              }),
            }
          : {}),
        label: label(
          spend?.state === "recorded"
            ? "ActionSpent"
            : value.spend
              ? "NotConfirmed"
              : "NoActionSpent",
        ),
      },
      rollDetails:
        result && check
          ? [
              {
                id: check.id,
                label: label("Check"),
                total: result.total,
                content: await renderD6RollResult(actor, result),
              },
            ]
          : [],
      controls: [
        {
          action: "continue",
          label: label(value.action.status !== "open" ? "Repair" : "Continue"),
          disabled: false,
        },
        {
          action: "cancel",
          label: label("Cancel"),
          disabled:
            value.action.status !== "open" ||
            value.action.stages.some((s) => s.state !== "pending"),
        },
      ],
    },
  );
}
export async function bindRelativeMovementRoot(
  message: FoundryChatMessageDocument,
  html: HTMLElement,
): Promise<void> {
  const value = parseFirstEditionRelativeMovement(
    message.getFlag(SYSTEM_ID, RELATIVE_MOVEMENT_ROOT_FLAG),
  );
  if (!value) return;
  const card = html.matches(".od6-first-edition-movement-root")
    ? html
    : html.querySelector<HTMLElement>(".od6-first-edition-movement-root");
  if (!card || card.classList.contains("od6-movement-root-bound")) return;
  const actor = await boundActor(value),
    owner = value.action.stages[0]?.spec.controllerUserId === game.user?.id;
  if (card.classList.contains("od6-movement-root-bound")) return;
  for (const detail of Array.from(
    card.querySelectorAll<HTMLElement>("[data-d6-movement-result-id]"),
  )) {
    const stage = value.action.stages.find(
      (s) => s.id === detail.dataset.d6MovementResultId,
    );
    if (stage?.receipt?.kind !== "d6-roll") continue;
    bindD6EmbeddedRollActions(
      message,
      detail,
      value.matchingResult ?? stage.receipt.result,
      !owner || Boolean(value.followUps?.[stage.id]),
      {
        claim: async () =>
          (await route(value, "follow-up-claim", { stepId: stage.id })) ===
          true,
        release: async () => {
          await route(value, "follow-up-release", { stepId: stage.id });
        },
        retryReward: async () => {
          await route(value, "matching-reward");
        },
      },
      actor,
    );
  }
  for (const button of Array.from(
    card.querySelectorAll<HTMLButtonElement>("[data-d6-movement-root-action]"),
  )) {
    const cancel = button.dataset.d6MovementRootAction === "cancel";
    button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      void (
        cancel ? cancelRelativeMovement(value) : continueRelativeMovement(value)
      )
        .catch(() => {
          ui.notifications.warn(label("NeedsAttention"));
        })
        .finally(() => refreshMountedControls(message.id));
    });
  }
  const cards = mountedCards.get(message.id) ?? new Set();
  cards.add({ card: new WeakRef(card), message: new WeakRef(message) });
  mountedCards.set(message.id, cards);
  projectControls(value, card, actor);
  card.classList.add("od6-movement-root-bound");
}
let registered = false;
export function registerRelativeMovementLifecycle(): void {
  if (registered) return;
  registered = true;
  registerRelativeMovementAuthority();
  setRelativeMovementRenderer(relativeMovementContent);
  Hooks.on("deleteChatMessage", (message: unknown) => {
    const id = (message as FoundryChatMessageDocument).id;
    mountedCards.delete(id);
    drivers.delete(id);
  });
  Hooks.on("renderChatMessageHTML", (message: unknown, html: unknown) => {
    if (html instanceof HTMLElement)
      void bindRelativeMovementRoot(
        message as FoundryChatMessageDocument,
        html,
      ).catch(() => undefined);
  });
}
