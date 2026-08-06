import { formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  aidEnvironmentRecovery,
  d6EnvironmentsEnabled,
  environmentSafeBreathRounds,
  exposeActorToEnvironment,
  readActorEnvironmentEffect,
  recoverEnvironmentAfterSafeDay,
} from "./environment-service";

const { ApplicationV2 } = foundry.applications.api;
const EnvironmentApplication =
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

function formValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
    ? control.value
    : "";
}

function personalActors(): readonly FoundryActorDocument[] {
  return Object.freeze(
    (game.actors?.contents ?? [])
      .filter((actor) => ["character", "creature", "npc"].includes(actor.type))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

function aidChoices(): readonly {
  readonly label: string;
  readonly value: string;
}[] {
  return Object.freeze(
    personalActors()
      .flatMap((actor) =>
        actor.items.contents
          .filter((item) => item.type === "skill")
          .map((item) => ({
            label: `${actor.name} — ${item.name}`,
            value: `${actor.id}:${item.id}`,
          })),
      )
      .sort((left, right) => left.label.localeCompare(right.label)),
  );
}

async function promptExposure(): Promise<void> {
  const actors = personalActors();
  if (actors.length === 0)
    throw new Error("D6E2.Environment.Error.ActorMissing");
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/apps/environment-exposure.hbs`,
    { actors },
  );
  const input = await foundry.applications.api.DialogV2.wait<{
    readonly actorId: string;
    readonly hazard: string;
    readonly severity: string;
  } | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "roll",
        callback: (_event, button) => {
          if (!button.form)
            throw new Error("D6E2.Environment.Error.FormUnavailable");
          return {
            actorId: formValue(button.form, "actorId"),
            hazard: formValue(button.form, "hazard"),
            severity: formValue(button.form, "severity"),
          };
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-dice-d6",
        label: game.i18n.localize("D6E2.Environment.RollExposure"),
      },
    ],
    classes: ["d6e2", "od6-environment-dialog"],
    content,
    modal: true,
    position: { width: 520 },
    window: {
      icon: "fa-solid fa-cloud-bolt",
      title: game.i18n.localize("D6E2.Environment.ExposureTitle"),
    },
  });
  if (!input) return;
  if (!(
    input.hazard === "cold" ||
    input.hazard === "drowning" ||
    input.hazard === "heat" ||
    input.hazard === "poisonous-air"
  )) {
    throw new Error("D6E2.Environment.Error.InvalidThreat");
  }
  if (!(
    input.severity === "moderate" ||
    input.severity === "severe" ||
    input.severity === "deadly"
  )) {
    throw new Error("D6E2.Environment.Error.InvalidThreat");
  }
  await exposeActorToEnvironment({
    actorId: input.actorId,
    hazard: input.hazard,
    severity: input.severity,
  });
}

async function promptAid(targetActorId: string): Promise<void> {
  const choices = aidChoices();
  if (choices.length === 0)
    throw new Error("D6E2.Environment.Error.AidSkillMissing");
  const target = game.actors?.get(targetActorId);
  if (!target) throw new Error("D6E2.Environment.Error.ActorMissing");
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/apps/environment-aid.hbs`,
    { choices, target },
  );
  const selected = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "roll",
        callback: (_event, button) => {
          if (!button.form)
            throw new Error("D6E2.Environment.Error.FormUnavailable");
          return formValue(button.form, "source");
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-kit-medical",
        label: game.i18n.localize("D6E2.Environment.RollAid"),
      },
    ],
    classes: ["d6e2", "od6-environment-dialog"],
    content,
    modal: true,
    position: { width: 480 },
    window: {
      icon: "fa-solid fa-kit-medical",
      title: game.i18n.localize("D6E2.Environment.AidTitle"),
    },
  });
  if (!selected) return;
  const separator = selected.indexOf(":");
  await aidEnvironmentRecovery(
    targetActorId,
    selected.slice(0, separator),
    selected.slice(separator + 1),
  );
}

class D6System2eEnvironmentManager extends EnvironmentApplication {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/environment-manager.hbs`,
    },
  };

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "od6-environment-manager"],
    id: "d6e2-environment-manager",
    position: { height: "auto", width: 560 },
    window: {
      icon: "fa-solid fa-cloud-bolt",
      resizable: true,
      title: "D6E2.Environment.Title",
    },
  };

  readonly #clickHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement) void this.#click(target);
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      actors: personalActors().map((actor) => {
        const effect = readActorEnvironmentEffect(actor);
        return {
          actor,
          breathRounds: environmentSafeBreathRounds(actor),
          className: effect ? "is-affected" : "",
          effect: effect
            ? {
                ...effect,
                hazardLabel: game.i18n.localize(
                  `D6E2.Environment.Hazard.${effect.hazard}`,
                ),
                penaltyLabel: formatPipScore(effect.penaltyScore),
                severityLabel: game.i18n.localize(
                  `D6E2.Environment.Severity.${effect.severity}`,
                ),
              }
            : null,
        };
      }),
      sourceReference: "D6 System: Second Edition, pp. 77–78",
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
    control.setAttribute("aria-busy", "true");
    try {
      const actorId = control.dataset.actorId ?? "";
      if (control.dataset.action === "expose") await promptExposure();
      else if (control.dataset.action === "aid") await promptAid(actorId);
      else if (control.dataset.action === "safe-day") {
        const confirmed = await foundry.applications.api.DialogV2.wait<boolean>(
          {
            buttons: [
              {
                action: "cancel",
                callback: () => false,
                label: game.i18n.localize("D6E2.Cancel"),
              },
              {
                action: "confirm",
                callback: () => true,
                default: true,
                label: game.i18n.localize("D6E2.Environment.SafeDay"),
              },
            ],
            classes: ["d6e2", "od6roll-dialog"],
            content: `<p>${game.i18n.localize("D6E2.Environment.SafeDayConfirm")}</p>`,
            modal: true,
            window: { title: game.i18n.localize("D6E2.Environment.SafeDay") },
          },
        );
        if (confirmed) await recoverEnvironmentAfterSafeDay(actorId);
      } else if (control.dataset.action === "open") {
        const actor = game.actors?.get(actorId);
        if (actor) actor.sheet.render(true);
      }
      this.render();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "D6E2.Environment.Error.Unknown";
      ui.notifications.warn(
        message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
      );
    } finally {
      control.removeAttribute("aria-busy");
    }
  }
}

let manager: D6System2eEnvironmentManager | undefined;

export function toggleD6EnvironmentManager(): void {
  if (manager?.rendered) void manager.close();
  else {
    manager ??= new D6System2eEnvironmentManager();
    manager.render({ force: true });
  }
}

function refresh(): void {
  if (!d6EnvironmentsEnabled() && manager?.rendered) void manager.close();
  else if (manager?.rendered) manager.render();
  ui.controls?.render({ reset: true });
}

export function registerD6EnvironmentManager(): void {
  Hooks.on("getSceneControlButtons", (value: unknown) => {
    if (!d6EnvironmentsEnabled() || game.user?.isGM !== true) return;
    const tools = (value as SceneControls).tokens?.tools;
    if (!tools) return;
    tools.d6System2eEnvironment = {
      active: manager?.rendered === true,
      button: true,
      icon: "fa-solid fa-cloud-bolt",
      name: "d6System2eEnvironment",
      onChange: toggleD6EnvironmentManager,
      order: Object.keys(tools).length,
      title: game.i18n.localize("D6E2.Environment.Title"),
    };
  });
  Hooks.on("d6e2EnvironmentChanged", refresh);
  Hooks.on("updateActor", refresh);
}
