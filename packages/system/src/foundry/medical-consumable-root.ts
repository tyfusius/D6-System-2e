import type { D6RollMode } from "@d6-system-2e/core";
import {
  medicalConsumableRootCanCancel,
  parseMedicalConsumableRoot,
  type MedicalConsumableRootV1,
} from "../application/medical-consumable-root";
import { FirstEditionActionError } from "../application/first-edition-action-root";
import type { FirstEditionActionStorePorts } from "../application/first-edition-action-ports";
import { SYSTEM_ID } from "../constants";
import { currentDefaultRollMode } from "../settings/setting-values";
import { createFoundryFirstEditionRollPorts } from "./first-edition-action-roll-ports";
import { foundryRandomId } from "./foundry-random-id";
import { readActorHealth } from "./health-runtime";
import { hydrateD6FoundryRolls } from "./initiating-action-message";
import {
  MEDICAL_ROOT_FLAG,
  registerMedicalConsumableAuthority,
  requestMedicalRoot,
  setMedicalRootRenderer,
  type MedicalEffectStatus,
} from "./medical-consumable-authority";

const running = new Set<string>();
const drivers = new Map<
  string,
  ReturnType<typeof createFoundryFirstEditionRollPorts>
>();
const busyControls = new Map<string, Map<HTMLButtonElement, () => void>>();
const buttonActions = new WeakMap<HTMLButtonElement, () => void>();
const label = (key: string) => game.i18n.localize(`D6E2.Medical.Root.${key}`);
function parsed(value: unknown): MedicalConsumableRootV1 {
  const root = parseMedicalConsumableRoot(value);
  if (!root) throw new FirstEditionActionError("invalid");
  return root;
}
const route = (
  value: MedicalConsumableRootV1,
  method: string,
  data: Record<string, unknown> = {},
) =>
  requestMedicalRoot({
    ...data,
    method,
    rootMessageId: value.action.rootMessageId,
  });

async function driver(value: MedicalConsumableRootV1) {
  const stage = value.action.stages[0];
  if (!stage) throw new FirstEditionActionError("invalid");
  const cached = drivers.get(stage.id);
  if (cached) return cached;
  const administrator = (await fromUuid(stage.spec.subject.actorUuid)) as
    (FoundryActorDocument & { readonly uuid: string }) | null;
  if (!administrator?.uuid) throw new FirstEditionActionError("deleted");
  const store: FirstEditionActionStorePorts = {
    load: async () => parsed(await route(value, "load")).action,
    compareAndSwap: (_id, revision, next, scope) =>
      route(value, "cas", { revision, next, scope }).then(
        (result) => result === true,
      ),
    authorize: (_binding, _root, candidate, phase) => {
      if (
        !game.user?.active ||
        (!game.user.isGM &&
          !administrator.testUserPermission(game.user, "OWNER")) ||
        (phase === "claim" && candidate.spec.controllerUserId !== game.user.id)
      )
        return Promise.reject(new FirstEditionActionError("authority"));
      return Promise.resolve();
    },
  };
  const result = createFoundryFirstEditionRollPorts(
    {
      rootMessageId: value.action.rootMessageId,
      operationId: value.action.operationId,
      stageId: stage.id,
      authenticatedSenderId: game.user?.id ?? "",
    },
    administrator,
    {
      ...store,
      runtime: () => ({
        profileId: value.action.runtime.profileId,
        successEvaluator: "first-edition-meets",
        wildPolicy: "first-edition",
      }),
      present: async () => {
        await route(value, "present");
      },
    },
  );
  drivers.set(stage.id, result);
  return result;
}

export async function continueMedicalConsumableRoot(
  initial: MedicalConsumableRootV1,
  intent: "continue" | "check" = "continue",
): Promise<MedicalConsumableRootV1> {
  const id = initial.action.rootMessageId;
  if (running.has(id)) throw new FirstEditionActionError("conflict");
  running.add(id);
  try {
    let value = parsed(await route(initial, "load"));
    for (let count = 0; count < 8; count++) {
      if (value.action.status !== "open") return value;
      const stage = value.action.stages.find(
        ({ state }) => state !== "recorded",
      );
      if (intent === "check" && stage?.state !== "claimed") return value;
      if (!stage) value = parsed(await route(value, "advance"));
      else if (stage.spec.kind === "effect")
        value = parsed(await route(value, "effect"));
      else if (stage.spec.kind === "plain-d6") {
        if (stage.spec.controllerUserId !== game.user?.id) return value;
        const capture = await driver(value);
        if (stage.state === "claimed") await capture.resume();
        else
          await capture.runPlain(value.rollMode, async (dice) => {
            const roll = await new Roll(`${dice}d6`).evaluate();
            return {
              total: roll.total,
              faces: roll.dice.flatMap((die) =>
                die.results
                  .filter((result) => result.active !== false)
                  .map((result) => result.result),
              ),
              artifacts: [roll],
            };
          });
        value = parsed(await route(value, "load"));
        if (intent === "check") return value;
      } else throw new FirstEditionActionError("invalid");
    }
    throw new FirstEditionActionError("uncertain");
  } finally {
    running.delete(id);
    const controls = busyControls.get(id);
    busyControls.delete(id);
    for (const refresh of controls?.values() ?? []) refresh();
  }
}

export async function startMedicalConsumableRoot(input: {
  readonly administrator: FoundryActorDocument & { readonly uuid?: string };
  readonly patient: FoundryActorDocument & { readonly uuid?: string };
  readonly item: FoundryItemDocument & { readonly uuid?: string };
  readonly rollMode?: D6RollMode;
  readonly rootMessageId?: string;
  readonly useId?: string;
}): Promise<MedicalConsumableRootV1> {
  if (!input.administrator.uuid || !input.patient.uuid || !input.item.uuid)
    throw new FirstEditionActionError("invalid");
  const root = parsed(
    await requestMedicalRoot({
      method: "create",
      rootMessageId: input.rootMessageId ?? foundryRandomId(16).slice(0, 16),
      useId: input.useId ?? foundryRandomId(16).slice(0, 16),
      administratorUuid: input.administrator.uuid,
      patientUuid: input.patient.uuid,
      itemUuid: input.item.uuid,
      rollMode: input.rollMode ?? currentDefaultRollMode(),
    }),
  );
  return continueMedicalConsumableRoot(root);
}

export async function medicalRootViewModel(
  value: MedicalConsumableRootV1,
  effectStatus?: MedicalEffectStatus,
) {
  const administratorBinding = value.action.subjects.find(
    ({ role }) => role === "administrator",
  )?.actor;
  const patientBinding = value.action.subjects.find(
    ({ role }) => role === "patient",
  )?.actor;
  if (!administratorBinding || !patientBinding)
    throw new FirstEditionActionError("invalid");
  const administrator = (await fromUuid(
    administratorBinding.actorUuid,
  )) as FoundryActorDocument | null;
  const patient = (await fromUuid(
    patientBinding.actorUuid,
  )) as FoundryActorDocument | null;
  const item = (await fromUuid(
    value.item.itemUuid,
  )) as FoundryItemDocument | null;
  if (!administrator || !patient || !item)
    throw new FirstEditionActionError("deleted");
  const health = readActorHealth(patient);
  const injuryState = health.track?.states.find(
    ({ id }) => id === value.injury,
  );
  const injuryLabel = injuryState
    ? game.i18n.localize(injuryState.label)
    : value.injury;
  const duration = value.action.stages[0];
  const effect = value.action.stages[1];
  const rolls =
    duration?.receipt?.kind === "plain-d6"
      ? await hydrateD6FoundryRolls(duration.receipt.artifacts)
      : [];
  const durationRollHtml = rolls[0]
    ? await (rolls[0] as FoundryRoll & { render(): Promise<string> }).render()
    : "";
  const claimed = value.action.stages.find(({ state }) => state === "claimed");
  const cancellable = medicalConsumableRootCanCancel(value);
  return {
    title: label("Title"),
    statusLabel:
      effectStatus === "expired"
        ? label("Expired")
        : effectStatus === "ended"
          ? label("Ended")
          : effectStatus === "needs-attention"
            ? label("NeedsAttention")
            : effectStatus === "active"
              ? label("Active")
              : value.action.status === "cancelled"
                ? label("Cancelled")
                : value.action.status === "complete"
                  ? label("Complete")
                  : claimed
                    ? label("NeedsAttention")
                    : effect
                      ? label("AwaitingEffect")
                      : duration?.state === "recorded"
                        ? label("DurationRecorded")
                        : label("Pending"),
    administratorLabel: administrator.name,
    patientLabel: patient.name,
    itemLabel: item.name,
    durationRollHtml,
    contextRows: [
      { label: label("Injury"), value: injuryLabel },
      { label: label("Action"), value: label("OneAction") },
      { label: label("Dose"), value: label("OneDose") },
    ],
    resultRows:
      duration?.receipt?.kind === "plain-d6"
        ? [
            {
              label: game.i18n.localize("D6E2.Medical.DurationRoll"),
              value: `${duration.receipt.total} rounds`,
            },
          ]
        : [],
    nextStepLabel:
      value.action.status === "open"
        ? claimed
          ? label("CheckHelp")
          : effect
            ? label("ApplyHelp")
            : label("RollHelp")
        : "",
    terminal: value.action.status !== "open",
    controls:
      value.action.status === "open"
        ? [
            {
              action: "continue",
              label: claimed ? label("CheckSavedProgress") : label("Continue"),
            },
            ...(cancellable
              ? [{ action: "cancel", label: label("Cancel") }]
              : [
                  {
                    action: "end-operation",
                    label: label("EndOperation"),
                  },
                ]),
          ]
        : [],
  };
}

export async function medicalRootContent(
  value: MedicalConsumableRootV1,
  effectStatus?: MedicalEffectStatus,
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/medical-consumable-root.hbs`,
    await medicalRootViewModel(value, effectStatus),
  );
}

export async function bindMedicalRoot(
  message: FoundryChatMessageDocument,
  html: HTMLElement,
): Promise<void> {
  const value = parseMedicalConsumableRoot(
    message.getFlag(SYSTEM_ID, MEDICAL_ROOT_FLAG),
  );
  if (value?.action.rootMessageId !== message.id) return;
  const administratorBinding = value.action.subjects.find(
    ({ role }) => role === "administrator",
  )?.actor;
  const actor = administratorBinding
    ? ((await fromUuid(
        administratorBinding.actorUuid,
      )) as FoundryActorDocument | null)
    : null;
  const authorized =
    !!game.user &&
    !!actor &&
    (game.user.isGM ||
      (value.initiatorUserId === game.user.id &&
        actor.testUserPermission(game.user, "OWNER")));
  for (const button of Array.from(
    html.querySelectorAll<HTMLButtonElement>("[data-d6-medical-root-action]"),
  )) {
    const action = button.dataset.d6MedicalRootAction;
    const actionAuthorized =
      authorized && (action !== "end-operation" || game.user.isGM);
    button.hidden = !actionAuthorized;
    const unavailable = () =>
      !actionAuthorized ||
      value.action.status !== "open" ||
      running.has(message.id);
    button.disabled = unavailable();
    if (running.has(message.id)) {
      let controls = busyControls.get(message.id);
      if (!controls) {
        controls = new Map<HTMLButtonElement, () => void>();
        busyControls.set(message.id, controls);
      }
      controls.set(button, () => {
        button.disabled = unavailable();
      });
    }
    const bound = buttonActions.has(button);
    buttonActions.set(button, () => {
      if (button.disabled) return;
      button.disabled = true;
      const check = value.action.stages.some(
        ({ state }) => state === "claimed",
      );
      void (
        action === "cancel" || action === "end-operation"
          ? route(value, action)
          : continueMedicalConsumableRoot(value, check ? "check" : "continue")
      )
        .catch(() => ui.notifications.warn(label("NeedsAttention")))
        .finally(() => {
          button.disabled = unavailable();
        });
    });
    if (!bound)
      button.addEventListener("click", () => buttonActions.get(button)?.());
  }
}

let registered = false;
export function registerMedicalConsumableLifecycle(): void {
  if (registered) return;
  registered = true;
  registerMedicalConsumableAuthority();
  setMedicalRootRenderer(medicalRootContent);
  Hooks.on("renderChatMessageHTML", (message: unknown, html: unknown) => {
    if (html instanceof HTMLElement)
      void bindMedicalRoot(message as FoundryChatMessageDocument, html).catch(
        () => undefined,
      );
  });
}
