import type { D6ChaseParticipantV1, D6ChaseSide } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { foundryRandomId } from "./foundry-random-id";
import {
  d6ChasesEnabled,
  endD6Chase,
  readD6Chase,
  resolveD6Chase,
  rollD6ChaseSide,
  startD6Chase,
} from "./chase-service";

const { ApplicationV2 } = foundry.applications.api;
const ChaseApplication =
  foundry.applications.api.HandlebarsApplicationMixin.bind(
    foundry.applications.api,
  )(ApplicationV2);

interface SceneControlTool {
  readonly active?: boolean;
  readonly button?: boolean;
  readonly icon: string;
  readonly name: string;
  readonly onChange: () => void;
  readonly order?: number;
  readonly title: string;
}

interface SceneControls {
  readonly tokens?: { readonly tools: Record<string, SceneControlTool> };
}

interface ParticipantChoice {
  readonly actorId: string;
  readonly itemId: string;
  readonly label: string;
  readonly value: string;
}

function choices(): readonly ParticipantChoice[] {
  return Object.freeze(
    (game.actors?.contents ?? [])
      .flatMap((actor) =>
        actor.items.contents
          .filter((item) => ["skill", "specialization"].includes(item.type))
          .map((item) => ({
            actorId: actor.id,
            itemId: item.id,
            label: `${actor.name} — ${item.name}`,
            value: `${actor.id}:${item.id}`,
          })),
      )
      .sort((left, right) => left.label.localeCompare(right.label)),
  );
}

function participantFrom(value: string): D6ChaseParticipantV1 {
  const separator = value.indexOf(":");
  const actorId = separator < 0 ? "" : value.slice(0, separator);
  const itemId = separator < 0 ? "" : value.slice(separator + 1);
  const actor = game.actors?.get(actorId);
  const item = actor?.items.get(itemId);
  if (!actor || !item) throw new Error("D6E2.Chase.Error.SkillMissing");
  return {
    actorId,
    actorName: actor.name,
    itemId,
    kind:
      actor.type === "character"
        ? "player-character"
        : ["npc", "creature"].includes(actor.type)
          ? "non-player-character"
          : "unknown",
    skillName: item.name,
  };
}

function formValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
    ? control.value
    : "";
}

async function promptStart(): Promise<void> {
  const options = choices();
  if (options.length < 2) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Chase.Error.TwoParticipants"),
    );
    return;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/apps/chase-start-dialog.hbs`,
    { choices: options, defaultDistance: 4 },
  );
  const input = await foundry.applications.api.DialogV2.wait<{
    readonly distance: number;
    readonly fleeing: string;
    readonly label: string;
    readonly pursuer: string;
  } | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "start",
        callback: (_event, button) => {
          if (!button.form) throw new Error("D6E2.Chase.Error.FormUnavailable");
          return {
            distance: Number(formValue(button.form, "distance")),
            fleeing: formValue(button.form, "fleeing"),
            label: formValue(button.form, "label"),
            pursuer: formValue(button.form, "pursuer"),
          };
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-flag-checkered",
        label: game.i18n.localize("D6E2.Chase.Start"),
      },
    ],
    classes: ["d6e2", "od6-chase-dialog"],
    content,
    modal: true,
    position: { width: 520 },
    window: {
      icon: "fa-solid fa-route",
      title: game.i18n.localize("D6E2.Chase.StartTitle"),
    },
  });
  if (!input) return;
  await startD6Chase({
    distance: input.distance,
    fleeing: participantFrom(input.fleeing),
    id: foundryRandomId(),
    label: input.label,
    pursuer: participantFrom(input.pursuer),
  });
}

async function promptResolve(): Promise<void> {
  const state = readD6Chase();
  if (!state?.rolls.pursuer || !state.rolls.fleeing) return;
  const tied = state.rolls.pursuer.total === state.rolls.fleeing.total;
  const automaticWinner: D6ChaseSide =
    state.rolls.pursuer.total > state.rolls.fleeing.total
      ? "pursuer"
      : "fleeing";
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/apps/chase-resolve-dialog.hbs`,
    { automaticWinner, chase: state, tied },
  );
  const input = await foundry.applications.api.DialogV2.wait<{
    readonly exceptional: boolean;
    readonly winner?: D6ChaseSide;
  } | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "resolve",
        callback: (_event, button) => {
          if (!button.form) throw new Error("D6E2.Chase.Error.FormUnavailable");
          const winner = formValue(button.form, "winner");
          const exceptional = button.form.elements.namedItem("exceptional");
          return {
            exceptional:
              exceptional instanceof HTMLInputElement && exceptional.checked,
            ...(winner === "pursuer" || winner === "fleeing" ? { winner } : {}),
          };
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-gavel",
        label: game.i18n.localize("D6E2.Chase.Resolve"),
      },
    ],
    classes: ["d6e2", "od6-chase-dialog"],
    content,
    modal: true,
    position: { width: 480 },
    window: {
      icon: "fa-solid fa-gavel",
      title: game.i18n.localize("D6E2.Chase.ResolveTitle"),
    },
  });
  if (input)
    await resolveD6Chase({ ...input, expectedRevision: state.revision });
}

function ownsParticipant(): boolean {
  const state = readD6Chase();
  if (!state) return false;
  return ([state.pursuer, state.fleeing] as const).some(
    ({ actorId }) => game.actors?.get(actorId)?.isOwner === true,
  );
}

class D6System2eChaseTracker extends ChaseApplication {
  readonly #clickHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement) void this.#click(target);
  };

  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/chase-tracker.hbs`,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const chase = readD6Chase();
    const side = (value: D6ChaseSide) => {
      if (!chase) return null;
      const participant = chase[value];
      const actor = game.actors?.get(participant.actorId);
      return {
        ...participant,
        canRoll:
          chase.status === "active" &&
          !chase.rolls[value] &&
          (game.user?.isGM === true || actor?.isOwner === true),
        roll: chase.rolls[value],
        side: value,
      };
    };
    return Promise.resolve({
      canResolve:
        game.user?.isGM === true &&
        Boolean(chase?.rolls.pursuer && chase.rolls.fleeing),
      chase,
      distanceSteps: Array.from({ length: 9 }, (_, distance) => ({
        active: chase?.distance === distance,
        distance,
      })),
      fleeing: side("fleeing"),
      isGm: game.user?.isGM === true,
      pursuer: side("pursuer"),
      sourceReference: "D6 System: Second Edition, pp. 73–74",
    });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("click", this.#clickHandler);
    this.element.addEventListener("click", this.#clickHandler);
  }

  async #click(target: HTMLElement): Promise<void> {
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control) return;
    if (control.dataset.enabled === "false") return;
    control.setAttribute("aria-busy", "true");
    try {
      const action = control.dataset.action;
      if (action === "start") await promptStart();
      else if (action === "roll") {
        const side = control.dataset.side;
        if (side === "pursuer" || side === "fleeing")
          await rollD6ChaseSide(side);
      } else if (action === "resolve") await promptResolve();
      else if (action === "end") {
        const state = readD6Chase();
        if (state) {
          const confirmed =
            await foundry.applications.api.DialogV2.wait<boolean>({
              buttons: [
                {
                  action: "cancel",
                  callback: () => false,
                  label: game.i18n.localize("D6E2.Cancel"),
                },
                {
                  action: "end",
                  callback: () => true,
                  class: "is-danger",
                  default: true,
                  icon: "fa-solid fa-flag",
                  label: game.i18n.localize("D6E2.Chase.End"),
                },
              ],
              classes: ["d6e2", "od6roll-dialog"],
              content: `<p>${game.i18n.format("D6E2.Chase.EndConfirm", { name: state.label })}</p>`,
              modal: true,
              window: {
                icon: "fa-solid fa-flag",
                title: game.i18n.localize("D6E2.Chase.End"),
              },
            });
          if (confirmed) await endD6Chase(state.revision);
        }
      }
      this.render();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "D6E2.Chase.Error.Unknown";
      ui.notifications.warn(
        message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
      );
    } finally {
      control.removeAttribute("aria-busy");
    }
  }

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "od6-chase-tracker"],
    id: "d6e2-chase-tracker",
    position: { height: "auto", width: 500 },
    window: {
      icon: "fa-solid fa-route",
      resizable: true,
      title: "D6E2.Chase.Title",
    },
  };
}

let tracker: D6System2eChaseTracker | undefined;

export function toggleD6ChaseTracker(): void {
  if (tracker?.rendered) void tracker.close();
  else {
    tracker ??= new D6System2eChaseTracker();
    tracker.render({ force: true });
  }
}

function refresh(): void {
  if (tracker?.rendered) tracker.render();
  ui.controls?.render({ reset: true });
}

export function registerD6ChaseTracker(): void {
  Hooks.on("getSceneControlButtons", (value: unknown) => {
    if (!d6ChasesEnabled()) return;
    const state = readD6Chase();
    if (game.user?.isGM !== true && (!state || !ownsParticipant())) return;
    const tools = (value as SceneControls).tokens?.tools;
    if (!tools) return;
    tools.d6System2eChase = {
      active: tracker?.rendered === true,
      button: true,
      icon: "fa-solid fa-route",
      name: "d6System2eChase",
      onChange: toggleD6ChaseTracker,
      order: Object.keys(tools).length,
      title: game.i18n.localize("D6E2.Chase.Title"),
    };
  });
  Hooks.on("d6e2ChaseChanged", refresh);
  Hooks.on("updateScene", refresh);
  Hooks.on("canvasReady", refresh);
}
