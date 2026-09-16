import { requireDestinyValue as required } from "@d6-system-2e/core";
import {
  firstEditionBodyPointWound,
  type D6RollMode,
} from "@d6-system-2e/core";
import {
  bodyPointAmount,
  bodyPointTreatmentOutcome,
  parseFirstEditionBodyPointRoot,
  type FirstEditionBodyPointRoot,
} from "../application/first-edition-body-point-root";
import { FirstEditionActionError } from "../application/first-edition-action-root";
import type { FirstEditionActionStage } from "../application/first-edition-action-contract";
import type { FirstEditionActionStorePorts } from "../application/first-edition-action-ports";
import { SYSTEM_ID } from "../constants";
import { currentDefaultRollMode } from "../settings/setting-values";
import {
  currentTerminology,
  terminologyHealthStateLabel,
} from "../registries/terminology";
import { createFoundryFirstEditionRollPorts } from "./first-edition-action-roll-ports";
import { foundryRandomId } from "./foundry-random-id";
import {
  renderD6RollResult,
  rollFirstEditionHealingCheck,
  rollFirstEditionRecoveryCheck,
} from "./rolls/roll-service";
import { bindD6EmbeddedRollActions } from "./rolls/chat-card-actions";
import { hydrateD6FoundryRolls } from "./initiating-action-message";
import {
  registerBodyPointRootAuthority,
  requestBodyPointRoot,
  setBodyPointRootRenderer,
  BODY_POINT_ROOT_FLAG,
  bodyPointBoundActor,
  bodyPointRootRollRuntime,
} from "./first-edition-body-point-authority";
const label = (key: string) =>
  game.i18n.localize(`D6E2.Combat.FirstEdition.BodyPointRoot.${key}`);
const drivers = new Map<
  string,
  ReturnType<typeof createFoundryFirstEditionRollPorts>
>();
const running = new Set<string>();
// Chat can replace or clone controls while a sheet-launched roll is pending.
// Retain their latest gates only for that run, then release every busy control.
const busyControls = new Map<string, Map<HTMLButtonElement, () => void>>();
const buttonActions = new WeakMap<HTMLButtonElement, () => void>();
function parsed(raw: unknown) {
  const value = parseFirstEditionBodyPointRoot(raw);
  if (!value) throw new FirstEditionActionError("invalid");
  return value;
}
const route = (
  value: FirstEditionBodyPointRoot,
  method: string,
  data: Record<string, unknown> = {},
) =>
  requestBodyPointRoot({
    ...data,
    method,
    rootMessageId: value.action.rootMessageId,
  });
async function driver(
  value: FirstEditionBodyPointRoot,
  stage: FirstEditionActionStage,
) {
  const cached = drivers.get(stage.id);
  if (cached) return cached;
  const actor = await bodyPointBoundActor(stage.spec.subject.actorUuid);
  const store: FirstEditionActionStorePorts = {
    load: async () => parsed(await route(value, "load")).action,
    compareAndSwap: (_id, revision, next, scope) =>
      route(value, "cas", { revision, next, scope }).then((v) => v === true),
    authorize: (_b, _r, s, phase) => {
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
      rootMessageId: value.action.rootMessageId,
      operationId: value.action.operationId,
      stageId: stage.id,
      authenticatedSenderId: game.user?.id ?? "",
    },
    actor,
    {
      ...store,
      runtime: bodyPointRootRollRuntime,
      present: async () => {
        await route(value, "present");
      },
    },
  );
  drivers.set(stage.id, result);
  return result;
}
/** Repair is a separate intent: recover the current receipt and stop before any next stage. */
export async function continueBodyPointRoot(
  initial: FirstEditionBodyPointRoot,
  intent: "continue" | "check" = "continue",
): Promise<FirstEditionBodyPointRoot> {
  const id = initial.action.rootMessageId;
  if (running.has(id)) throw new FirstEditionActionError("conflict");
  running.add(id);
  try {
    let value = parsed(await route(initial, "load"));
    for (let count = 0; count < 12; count++) {
      if (value.action.status !== "open") return value;
      const stage = value.action.stages.find((s) => s.state !== "recorded");
      if (intent === "check" && stage?.state !== "claimed") return value;
      if (!stage) {
        value = parsed(await route(value, "advance"));
        continue;
      }
      const repairing = stage.state === "claimed";
      if (stage.spec.kind === "effect")
        value = parsed(await route(value, "effect"));
      else {
        if (stage.spec.controllerUserId !== game.user?.id) return value;
        const capture = await driver(value, stage);
        if (repairing) await capture.resume();
        else if (stage.spec.kind === "plain-d6") {
          const first = value.action.stages[0]?.receipt;
          const mode: D6RollMode =
            first?.kind === "d6-roll"
              ? first.result.request.rollMode
              : "selfroll";
          await capture.runPlain(mode, async (dice) => {
            const roll = await new Roll(`${dice}d6`).evaluate();
            const faces = roll.dice.flatMap((d) =>
              d.results.filter((r) => r.active !== false).map((r) => r.result),
            );
            return { total: roll.total, faces, artifacts: [roll] };
          });
        } else {
          const spec = stage.spec,
            actor = await bodyPointBoundActor(spec.subject.actorUuid);
          const receipt = await capture.runD6((hooks) =>
            spec.purpose === "medicine"
              ? rollFirstEditionHealingCheck(
                  actor,
                  label("MedicineCheck"),
                  undefined,
                  spec.source.itemId,
                  hooks,
                )
              : rollFirstEditionRecoveryCheck(
                  actor,
                  label(
                    spec.purpose === "survival"
                      ? "SurvivalCheck"
                      : "NaturalCheck",
                  ),
                  spec.source.attributeId,
                  spec.fixedDifficulty,
                  spec.source.itemId,
                  spec.fixedScore,
                  spec.purpose === "survival",
                  undefined,
                  hooks,
                ),
          );
          if (!receipt) return parsed(await route(value, "load"));
        }
        value = parsed(await route(value, "load"));
      }
      if (intent === "check" || repairing) return value;
    }
    throw new FirstEditionActionError("uncertain");
  } finally {
    running.delete(id);
    const controls = busyControls.get(id);
    busyControls.delete(id);
    for (const refresh of controls?.values() ?? []) refresh();
  }
}
const starts = new Map<string, Promise<FirstEditionBodyPointRoot | null>>();
export function startBodyPointRoot(
  patient: FoundryActorDocument,
  operation: "natural" | "assisted",
  extra: {
    healer?: FoundryActorDocument;
    medicineItemId?: string;
    restModifierScore?: -3 | 0 | 3;
  } = {},
): Promise<FirstEditionBodyPointRoot | null> {
  const key = `${patient.uuid}:${operation}`,
    pending = starts.get(key);
  if (pending) return pending;
  const promise = requestBodyPointRoot({
    method: "create",
    rootMessageId: foundryRandomId(16).slice(0, 16),
    patientUuid: patient.uuid,
    operation,
    rollMode: currentDefaultRollMode(),
    ...(extra.healer ? { healerUuid: extra.healer.uuid } : {}),
    ...(extra.medicineItemId ? { medicineItemId: extra.medicineItemId } : {}),
    restModifierScore: extra.restModifierScore ?? 0,
  })
    .then((raw) => (raw === null ? null : continueBodyPointRoot(parsed(raw))))
    .finally(() => starts.delete(key));
  starts.set(key, promise);
  return promise;
}
export async function bodyPointRootViewModel(value: FirstEditionBodyPointRoot) {
  const p = value.action.subjects.find((s) => s.role === "patient")?.actor;
  if (!p) throw new FirstEditionActionError("invalid");
  const patient = await bodyPointBoundActor(p.actorUuid),
    h = value.action.subjects.find((s) => s.role === "healer")?.actor,
    healer = h ? await bodyPointBoundActor(h.actorUuid) : undefined;
  const pending = value.action.stages.find((s) => s.state !== "recorded"),
    claimed = pending?.state === "claimed";
  const poolSaved = value.action.stages.some(
      (s) => s.id.endsWith(":pool") && s.state === "recorded",
    ),
    skills = value.action.stages.find((s) => s.id.endsWith(":skills"));
  const outcome = bodyPointTreatmentOutcome(value),
    amount = bodyPointAmount(value);
  const status =
    value.action.status === "complete"
      ? "Complete"
      : value.action.status === "cancelled"
        ? "Cancelled"
        : claimed
          ? pending.spec.kind === "effect"
            ? "NeedsAttention"
            : "AwaitingRoll"
          : pending?.spec.kind === "d6-roll" &&
              pending.spec.purpose === "survival"
            ? "AwaitingSurvival"
            : poolSaved && skills?.state !== "recorded"
              ? "AwaitingSkills"
              : "Pending";
  const restLabel =
    value.operation === "natural"
      ? label(
          value.restModifierScore < 0
            ? "StrenuousRest"
            : value.restModifierScore > 0
              ? "FullRest"
              : "LightRest",
        )
      : "";
  const timingLabel =
    value.operation === "assisted" &&
    firstEditionBodyPointWound(value.before.current, value.before.maximum) ===
      "mortally-wounded"
      ? game.i18n.format("D6E2.Combat.FirstEdition.BodyPointRoot.Minutes", {
          minutes: value.minutes,
        })
      : "";
  const contextRows = [
    ...(healer ? [{ label: label("Healer"), value: healer.name }] : []),
    ...(restLabel ? [{ label: label("Rest"), value: restLabel }] : []),
    ...(timingLabel ? [{ label: label("Time"), value: timingLabel }] : []),
  ];
  const term = currentTerminology(),
    injury = (state: Parameters<typeof terminologyHealthStateLabel>[2]) =>
      terminologyHealthStateLabel(term, "open-d6.damage.wounds", state);
  const resultRows = [
    {
      label: label("PoolBefore"),
      value: `${value.before.current} / ${value.before.maximum}`,
    },
    {
      label: label("InjuryBefore"),
      value: injury(
        firstEditionBodyPointWound(value.before.current, value.before.maximum),
      ),
    },
    ...(amount === null
      ? []
      : [
          {
            label: label(value.fixedAmount ? "FixedAmount" : "RolledAmount"),
            value: String(amount),
          },
        ]),
    ...(poolSaved && outcome
      ? [
          { label: label("ActualGain"), value: String(outcome.gain) },
          {
            label: label("PoolAfter"),
            value: `${outcome.current} / ${outcome.maximum}`,
          },
          { label: label("InjuryAfter"), value: injury(outcome.wound) },
        ]
      : []),
  ];
  const skillLossRows =
    outcome && outcome.skillLossDice > 0
      ? [
          {
            label: label("RequiredSkillLoss"),
            value: `${outcome.skillLossDice}D`,
          },
          {
            label: label("SkillLossStatus"),
            value: label(
              skills?.state === "recorded" ? "Recorded" : "Unresolved",
            ),
          },
        ]
      : [];
  const rollDetails = [];
  for (const s of value.action.stages) {
    const r = s.receipt;
    if (!r || r.kind === "effect") continue;
    if (r.kind === "d6-roll")
      rollDetails.push({
        id: s.id,
        label: label(
          s.spec.kind === "d6-roll" && s.spec.purpose === "survival"
            ? "SurvivalCheck"
            : value.operation === "assisted"
              ? "MedicineCheck"
              : "NaturalCheck",
        ),
        content: await renderD6RollResult(
          await bodyPointBoundActor(s.spec.subject.actorUuid),
          value.matchingResults?.[s.id] ?? r.result,
        ),
      });
    else {
      const artifacts = await hydrateD6FoundryRolls(r.artifacts);
      rollDetails.push({
        id: s.id,
        label: label("AmountRoll"),
        content: (
          await Promise.all(
            artifacts.map((r) =>
              (r as FoundryRoll & { render(): Promise<string> }).render(),
            ),
          )
        ).join(""),
      });
    }
  }
  return {
    title: label(value.operation),
    patientName: patient.name,
    healerName: healer?.name ?? "",
    statusLabel: label(status),
    restLabel,
    timingLabel,
    outcomeLabel:
      poolSaved && outcome ? label(outcome.rescue) : label("Unresolved"),
    nextStepLabel:
      value.action.status === "open"
        ? label(
            pending?.spec.kind === "effect"
              ? "EffectHelp"
              : claimed
                ? "AwaitingRollHelp"
                : "ContinueHelp",
          )
        : "",
    contextRows,
    resultRows,
    skillLossRows,
    rollDetails,
    terminal: value.action.status !== "open",
    controls:
      value.action.status === "open"
        ? [
            {
              action: "continue",
              label: label(
                claimed && pending.spec.kind !== "effect"
                  ? "CheckSavedProgress"
                  : "Continue",
              ),
            },
            ...(value.action.stages.every((s) => s.state === "pending")
              ? [{ action: "cancel", label: label("Cancel") }]
              : []),
          ]
        : [],
  };
}
export async function bodyPointRootContent(value: FirstEditionBodyPointRoot) {
  return foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/first-edition-body-point-root.hbs`,
    await bodyPointRootViewModel(value),
  );
}
export async function bindBodyPointRoot(
  message: FoundryChatMessageDocument,
  html: HTMLElement,
) {
  const value = parseFirstEditionBodyPointRoot(
    message.getFlag(SYSTEM_ID, BODY_POINT_ROOT_FLAG),
  );
  if (value?.action.rootMessageId !== message.id) return;
  const subjects = await Promise.all(
    value.action.subjects.map((s) => bodyPointBoundActor(s.actor.actorUuid)),
  );
  const authorized =
    !!game.user?.active &&
    (game.user.isGM ||
      (value.initiatorUserId === game.user.id &&
        subjects.every((a) =>
          a.testUserPermission(required(game.user), "OWNER"),
        )));
  for (const detail of Array.from(
    html.querySelectorAll<HTMLElement>("[data-d6-body-point-result-id]"),
  )) {
    const s = value.action.stages.find(
      (s) => s.id === detail.dataset.d6BodyPointResultId,
    );
    if (s?.receipt?.kind === "d6-roll")
      bindD6EmbeddedRollActions(
        message,
        detail,
        value.matchingResults?.[s.id] ?? s.receipt.result,
        s.spec.controllerUserId !== game.user?.id ||
          Boolean(value.followUps?.[s.id]),
        {
          claim: async () =>
            (await route(value, "follow-up-claim", { stageId: s.id })) === true,
          release: async () => {
            await route(value, "follow-up-release", { stageId: s.id });
          },
          retryReward: async () => {
            await route(value, "matching-reward", { stageId: s.id });
          },
        },
        await bodyPointBoundActor(s.spec.subject.actorUuid),
      );
  }
  for (const button of Array.from(
    html.querySelectorAll<HTMLButtonElement>(
      "[data-d6-body-point-root-action]",
    ),
  )) {
    const action = button.dataset.d6BodyPointRootAction,
      cancel = action === "cancel",
      stage = value.action.stages.find((s) => s.state !== "recorded");
    const unavailable = () =>
      !authorized ||
      value.action.status !== "open" ||
      running.has(message.id) ||
      !["continue", "cancel"].includes(action ?? "") ||
      (cancel &&
        (value.initiatorUserId !== game.user.id ||
          value.action.stages.some((s) => s.state !== "pending"))) ||
      (!cancel &&
        !!stage &&
        stage.spec.kind !== "effect" &&
        stage.spec.controllerUserId !== game.user.id);
    button.hidden = !authorized;
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
      if (unavailable()) return;
      button.disabled = true;
      void (
        cancel
          ? route(value, "cancel")
          : continueBodyPointRoot(
              value,
              stage?.state === "claimed" && stage.spec.kind !== "effect"
                ? "check"
                : "continue",
            )
      )
        .catch(() => ui.notifications.warn(label("ProgressUnconfirmed")))
        .finally(() => {
          button.disabled = unavailable();
        });
    });
    if (!bound)
      button.addEventListener("click", () => buttonActions.get(button)?.());
  }
}
let registered = false;
export function registerBodyPointRootLifecycle() {
  if (registered) return;
  registered = true;
  registerBodyPointRootAuthority();
  setBodyPointRootRenderer(bodyPointRootContent);
  Hooks.on("renderChatMessageHTML", (message: unknown, html: unknown) => {
    if (html instanceof HTMLElement)
      void bindBodyPointRoot(message as FoundryChatMessageDocument, html).catch(
        () => undefined,
      );
  });
  Hooks.on("deleteChatMessage", (message: unknown) => {
    const id = (message as FoundryChatMessageDocument).id;
    for (const key of drivers.keys())
      if (key.startsWith(`${id}:`)) drivers.delete(key);
  });
}
