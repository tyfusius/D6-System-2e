import { firstEditionNaturalHealingRule } from "@d6-system-2e/core";
import {
  parseFirstEditionWoundRoot,
  woundRootOutcome,
  type FirstEditionWoundRoot,
  type WoundOperation,
} from "../application/first-edition-wound-root";
import { FirstEditionActionError } from "../application/first-edition-action-root";
import type { FirstEditionActionStorePorts } from "../application/first-edition-action-ports";
import { SYSTEM_ID } from "../constants";
import { currentDefaultRollMode } from "../settings/setting-values";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  currentTerminology,
  terminologyHealthStateLabel,
} from "../registries/terminology";
import { createFoundryFirstEditionRollPorts } from "./first-edition-action-roll-ports";
import { foundryRandomId } from "./foundry-random-id";
import {
  renderD6RollResult,
  rollFirstEditionAutomatedMortalityCheck,
  rollFirstEditionHealingCheck,
} from "./rolls/roll-service";
import { bindD6EmbeddedRollActions } from "./rolls/chat-card-actions";
import {
  registerWoundRootAuthority,
  requestWoundRoot,
  setWoundRootRenderer,
  WOUND_ROOT_FLAG,
  woundBoundActor,
  woundRootRollRuntime,
} from "./first-edition-wound-authority";

const label = (key: string) =>
  game.i18n.localize(`D6E2.Combat.FirstEdition.WoundRoot.${key}`);
const drivers = new Map<
  string,
  ReturnType<typeof createFoundryFirstEditionRollPorts>
>();
const running = new Set<string>();
const buttonActions = new WeakMap<HTMLButtonElement, () => void>();
function parsed(raw: unknown): FirstEditionWoundRoot {
  const value = parseFirstEditionWoundRoot(raw);
  if (!value) throw new FirstEditionActionError("invalid");
  return value;
}
const route = (
  value: FirstEditionWoundRoot,
  method: string,
  data: Record<string, unknown> = {},
) =>
  requestWoundRoot({
    ...data,
    method,
    rootMessageId: value.action.rootMessageId,
  });
async function driver(value: FirstEditionWoundRoot) {
  const id = value.action.rootMessageId;
  const cached = drivers.get(id);
  if (cached) return cached;
  const stage = value.action.stages[0];
  if (!stage) throw new FirstEditionActionError("invalid");
  const actor = await woundBoundActor(stage.spec.subject.actorUuid);
  const store: FirstEditionActionStorePorts = {
    load: async () => parsed(await route(value, "load")).action,
    compareAndSwap: (_id, revision, next, scope) =>
      route(value, "cas", { revision, next, scope }).then((v) => v === true),
    authorize: (_binding, _root, s, phase) => {
      if (
        !game.user?.active ||
        (!game.user.isGM && !actor.testUserPermission(game.user, "OWNER")) ||
        (phase === "claim" && s.spec.controllerUserId !== game.user.id)
      )
        throw new FirstEditionActionError("authority");
      return Promise.resolve();
    },
  };
  const result = createFoundryFirstEditionRollPorts(
    {
      rootMessageId: id,
      operationId: value.action.operationId,
      stageId: stage.id,
      authenticatedSenderId: game.user?.id ?? "",
    },
    actor,
    {
      ...store,
      runtime: woundRootRollRuntime,
      present: async () => {
        await route(value, "present");
      },
    },
  );
  drivers.set(id, result);
  return result;
}
/** Opening/rendering chat does not enter this function. Each entry is an explicit continuation. */
export async function continueWoundRoot(
  initial: FirstEditionWoundRoot,
): Promise<FirstEditionWoundRoot> {
  const id = initial.action.rootMessageId;
  if (running.has(id)) throw new FirstEditionActionError("conflict");
  running.add(id);
  try {
    let value = parsed(await route(initial, "load"));
    for (let count = 0; count < 8; count++) {
      if (value.action.status !== "open") {
        drivers.delete(id);
        return value;
      }
      const stage = value.action.stages.find((s) => s.state !== "recorded");
      if (!stage) value = parsed(await route(value, "advance"));
      else if (stage.spec.kind === "effect")
        value = parsed(await route(value, "effect"));
      else if (stage.spec.kind === "d6-roll") {
        if (
          stage.state === "pending" &&
          stage.spec.controllerUserId !== game.user?.id &&
          value.operation === "round-mortality" &&
          game.user?.isGM
        ) {
          value = parsed(await route(value, "adopt-roll"));
          continue;
        }
        const actor = await woundBoundActor(stage.spec.subject.actorUuid);
        const capture = await driver(value);
        const receipt = await capture.runD6((hooks) => {
          if (value.operation === "round-mortality") {
            const clock = value.action.clock;
            if (!clock) throw new FirstEditionActionError("invalid");
            return rollFirstEditionAutomatedMortalityCheck(
              actor,
              label("ScheduledCheck"),
              clock.elapsedMinutes.value,
              {
                checkId: clock.checkId,
                completedRounds: clock.completedRounds.value,
                elapsedMinutes: clock.elapsedMinutes.value,
                sourcePage: 76,
              },
              hooks,
            );
          }
          return rollFirstEditionHealingCheck(
            actor,
            label(
              value.operation === "assisted"
                ? "MedicineCheck"
                : value.operation === "natural"
                  ? "NaturalCheck"
                  : "MortalityCheck",
            ),
            stage.spec.kind === "d6-roll"
              ? stage.spec.fixedDifficulty
              : undefined,
            stage.spec.kind === "d6-roll"
              ? stage.spec.source.itemId
              : undefined,
            hooks,
          );
        });
        if (!receipt) return parsed(await route(value, "load"));
        value = parsed(await route(value, "load"));
      } else throw new FirstEditionActionError("invalid");
    }
    throw new FirstEditionActionError("uncertain");
  } finally {
    running.delete(id);
  }
}
async function createAndRunWoundRoot(
  patient: FoundryActorDocument,
  operation: WoundOperation,
  extra: {
    healer?: FoundryActorDocument;
    medicineItemId?: string;
    minutes?: number;
    checkId?: string;
    combatUuid?: string;
  } = {},
): Promise<FirstEditionWoundRoot | null> {
  if (!patient.uuid) throw new FirstEditionActionError("invalid");
  const raw = await requestWoundRoot({
    method: "create",
    rootMessageId: foundryRandomId(16).slice(0, 16),
    patientUuid: patient.uuid,
    operation,
    rollMode: currentDefaultRollMode(),
    ...(extra.healer ? { healerUuid: extra.healer.uuid } : {}),
    ...(extra.medicineItemId ? { medicineItemId: extra.medicineItemId } : {}),
    ...(extra.minutes === undefined ? {} : { minutes: extra.minutes }),
    ...(extra.checkId ? { checkId: extra.checkId } : {}),
    ...(extra.combatUuid ? { combatUuid: extra.combatUuid } : {}),
  });
  return raw === null ? null : continueWoundRoot(parsed(raw));
}
const starts = new Map<string, Promise<FirstEditionWoundRoot | null>>();
/** Coalesce repeated activation while the same initiating interaction is open. */
export function startWoundRoot(
  patient: FoundryActorDocument,
  operation: WoundOperation,
  extra: Parameters<typeof createAndRunWoundRoot>[2] = {},
): Promise<FirstEditionWoundRoot | null> {
  const key = `${patient.uuid}:${operation}`;
  const pending = starts.get(key);
  if (pending) return pending;
  const result = createAndRunWoundRoot(patient, operation, extra).finally(
    () => {
      starts.delete(key);
    },
  );
  starts.set(key, result);
  return result;
}
/** Reviewable view model. The dedicated Design lane owns the template/styles. */
export async function woundRootViewModel(value: FirstEditionWoundRoot) {
  const patientBinding = value.action.subjects.find(
    (s) => s.role === "patient",
  )?.actor;
  if (!patientBinding) throw new FirstEditionActionError("invalid");
  const patient = await woundBoundActor(patientBinding.actorUuid);
  const healerBinding = value.action.subjects.find(
    (s) => s.role === "healer",
  )?.actor;
  const healer = healerBinding
    ? await woundBoundActor(healerBinding.actorUuid)
    : undefined;
  const check = value.action.stages.find((s) => s.receipt?.kind === "d6-roll"),
    effect = value.action.stages.find((s) => s.spec.kind === "effect");
  const receipt =
    check?.receipt?.kind === "d6-roll" ? check.receipt : undefined;
  const outcome = effect?.state === "recorded" ? woundRootOutcome(value) : null;
  const rest =
    value.operation === "natural"
      ? firstEditionNaturalHealingRule(value.wound)
      : null;
  const claimedCheck = value.action.stages.find(
    (s) => s.spec.kind === "d6-roll" && s.state === "claimed",
  );
  const terminology = currentTerminology();
  const profile = currentConfiguredRulesProfile();
  const status =
    value.action.status === "cancelled"
      ? "Cancelled"
      : value.action.status === "complete"
        ? "Complete"
        : claimedCheck
          ? "AwaitingRoll"
          : value.action.stages.some((s) => s.state === "claimed")
            ? "NeedsAttention"
            : effect
              ? "AwaitingEffect"
              : "Pending";
  return {
    title: label(value.operation),
    treatmentAudit: value.treatmentAudit
      ? {
          familyLabel: game.i18n.localize("D6E2.Medical.OpenD6SpaceMedicine"),
          baseCategoryLabel:
            profile.difficultyLadder.find(
              ({ id }) => id === value.treatmentAudit?.baseCategory,
            )?.label ?? value.treatmentAudit.baseCategory,
          baseValue: value.treatmentAudit.baseValue,
          finalCategoryLabel:
            profile.difficultyLadder.find(
              ({ id }) => id === value.treatmentAudit?.finalCategory,
            )?.label ?? value.treatmentAudit.finalCategory,
          finalValue: value.treatmentAudit.finalValue,
          selfTreatment: value.treatmentAudit.selfTreatment,
        }
      : undefined,
    patientName: patient.name,
    healerName: healer?.name ?? "",
    statusLabel: label(status),
    restLabel: rest
      ? game.i18n.format(
          `D6E2.Combat.FirstEdition.Healing.Rest.${rest.restUnit}`,
          { amount: rest.restAmount },
        )
      : "",
    timingLabel: value.action.clock
      ? game.i18n.format("D6E2.Combat.FirstEdition.WoundRoot.Clock", {
          rounds: value.action.clock.completedRounds.value,
          minutes: value.action.clock.elapsedMinutes.value,
        })
      : value.minutes === undefined
        ? ""
        : game.i18n.format("D6E2.Combat.FirstEdition.WoundRoot.Minutes", {
            minutes: value.minutes,
          }),
    outcomeLabel: outcome ? label(outcome.outcome) : label("NotConfirmed"),
    beforeLabel: terminologyHealthStateLabel(
      terminology,
      "open-d6.damage.wounds",
      value.wound,
    ),
    afterLabel: outcome
      ? terminologyHealthStateLabel(
          terminology,
          "open-d6.damage.wounds",
          outcome.nextWound,
        )
      : "",
    nextStepLabel:
      outcome?.nextWound === "incapacitated" &&
      outcome.previousWound !== outcome.nextWound
        ? label("IncapacitatedNext")
        : value.action.status === "open"
          ? label(claimedCheck ? "AwaitingRollHelp" : "ContinueHelp")
          : "",
    rollDetails:
      receipt && check
        ? [
            {
              id: check.id,
              label: receipt.result.request.label,
              content: await renderD6RollResult(
                healer ?? patient,
                value.matchingResult ?? receipt.result,
              ),
            },
          ]
        : [],
    terminal: value.action.status !== "open",
    controls:
      value.action.status === "open"
        ? [
            {
              action: "continue",
              label: label(
                claimedCheck
                  ? "CheckSavedProgress"
                  : status === "NeedsAttention"
                    ? "Retry"
                    : "Continue",
              ),
            },
            {
              action: "cancel",
              label: label(
                value.operation === "round-mortality"
                  ? "CancelStale"
                  : "Cancel",
              ),
            },
          ]
        : [],
  };
}
export async function woundRootContent(
  value: FirstEditionWoundRoot,
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/first-edition-wound-root.hbs`,
    await woundRootViewModel(value),
  );
}
export async function bindWoundRoot(
  message: FoundryChatMessageDocument,
  html: HTMLElement,
): Promise<void> {
  const value = parseFirstEditionWoundRoot(
    message.getFlag(SYSTEM_ID, WOUND_ROOT_FLAG),
  );
  if (value?.action.rootMessageId !== message.id) return;
  const patient = value.action.subjects.find(
    (s) => s.role === "patient",
  )?.actor;
  if (!patient) return;
  const actor = await woundBoundActor(patient.actorUuid);
  const authorized =
    !!game.user &&
    (game.user.isGM ||
      (value.initiatorUserId === game.user.id &&
        actor.testUserPermission(game.user, "OWNER")));
  for (const detail of Array.from(
    html.querySelectorAll<HTMLElement>("[data-d6-wound-result-id]"),
  )) {
    const stage = value.action.stages.find(
      (s) => s.id === detail.dataset.d6WoundResultId,
    );
    if (stage?.receipt?.kind === "d6-roll")
      bindD6EmbeddedRollActions(
        message,
        detail,
        value.matchingResult ?? stage.receipt.result,
        stage.spec.controllerUserId !== game.user?.id ||
          Boolean(value.followUps?.[stage.id]),
        {
          claim: async () => (await route(value, "follow-up-claim")) === true,
          release: async () => {
            await route(value, "follow-up-release");
          },
          retryReward: async () => {
            await route(value, "matching-reward");
          },
        },
        await woundBoundActor(stage.spec.subject.actorUuid),
      );
  }
  for (const button of Array.from(
    html.querySelectorAll<HTMLButtonElement>("[data-d6-wound-root-action]"),
  )) {
    const cancel = button.dataset.d6WoundRootAction === "cancel";
    const claimedCheck = value.action.stages.find(
      (s) => s.spec.kind === "d6-roll" && s.state === "claimed",
    );
    button.hidden = !authorized;
    const unavailable = () =>
      !authorized ||
      value.action.status !== "open" ||
      running.has(message.id) ||
      (!cancel &&
        !!claimedCheck &&
        claimedCheck.spec.controllerUserId !== game.user.id) ||
      (cancel &&
        (value.operation === "round-mortality"
          ? !game.user.isGM
          : value.initiatorUserId !== game.user.id ||
            value.action.stages.some((s) => s.state !== "pending")));
    button.disabled = unavailable();
    // HTML clones retain data attributes, but not native event listeners.
    // Track each actual node and refresh the action captured by its one listener.
    const alreadyBound = buttonActions.has(button);
    delete button.dataset.woundBound;
    buttonActions.set(button, () => {
      if (button.disabled) return;
      button.disabled = true;
      void (cancel ? route(value, "cancel") : continueWoundRoot(value))
        .catch((error: unknown) =>
          ui.notifications.warn(
            label(
              claimedCheck &&
                error instanceof FirstEditionActionError &&
                error.code === "uncertain"
                ? "ProgressUnconfirmed"
                : "NeedsAttention",
            ),
          ),
        )
        .finally(() => {
          button.disabled = unavailable();
        });
    });
    if (!alreadyBound)
      button.addEventListener("click", () => buttonActions.get(button)?.());
  }
}
let registered = false;
export function registerWoundRootLifecycle(): void {
  if (registered) return;
  registered = true;
  registerWoundRootAuthority();
  setWoundRootRenderer(woundRootContent);
  Hooks.on("renderChatMessageHTML", (message: unknown, html: unknown) => {
    if (html instanceof HTMLElement)
      void bindWoundRoot(message as FoundryChatMessageDocument, html).catch(
        () => undefined,
      );
  });
  Hooks.on("deleteChatMessage", (message: unknown) => {
    drivers.delete((message as FoundryChatMessageDocument).id);
  });
}
