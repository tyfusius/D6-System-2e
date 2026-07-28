import { SYSTEM_ID } from "../constants";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { booleanSetting } from "../settings/setting-values";
import {
  activeRollRequests,
  cancelRollRequest,
  registerRollRequestSocket,
  requestActorRoll,
  subscribeActiveRollRequests,
  takeOverRollRequest,
} from "./roll-requests";

const { ApplicationV2 } = foundry.applications.api;
const HandlebarsApplicationMixin =
  foundry.applications.api.HandlebarsApplicationMixin.bind(
    foundry.applications.api,
  );

function actorFrom(target: HTMLElement): FoundryActorDocument | undefined {
  const id = target.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId;
  return id ? game.actors?.get(id) : undefined;
}

function visibleActors(): readonly FoundryActorDocument[] {
  return Object.freeze(
    (game.actors?.contents ?? [])
      .filter(
        (actor) =>
          actor.type === "character" &&
          (game.user?.isGM === true || actor.isOwner === true),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

class D6System2ePcQuickbar extends HandlebarsApplicationMixin(ApplicationV2) {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/pc-quickbar.hbs`,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const api = game.system.api;
    const actors = api
      ? visibleActors().map((actor) => {
          const model = api.read.actor(actor);
          return {
            ...model,
            attributes: model.attributes.map((attribute) => ({
              ...attribute,
              skills: model.skills.filter(
                (skill) => skill.attributeId === attribute.id,
              ),
            })),
            canRequest: game.user?.isGM === true,
          };
        })
      : [];
    return Promise.resolve({ actors, count: actors.length });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.addEventListener("click", (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const control = event.target.closest<HTMLElement>("[data-action]");
      if (!control) return;
      const actor = actorFrom(control);
      if (!actor) return;
      const action = control.dataset.action;
      const attributeId = control.closest<HTMLElement>("[data-attribute-id]")
        ?.dataset.attributeId;
      const itemId =
        control.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
      if (action === "openActor") actor.sheet.render(true);
      else if (action === "rollAttribute" && attributeId) {
        void game.system.api?.roll.attribute(actor, attributeId);
      } else if (action === "rollSkill" && itemId) {
        void game.system.api?.roll.skill(actor, itemId);
      } else if (action === "requestAttribute" && attributeId) {
        const label = control.dataset.label ?? attributeId;
        requestActorRoll(actor, { attributeId, kind: "attribute" }, label);
      } else if (action === "requestSkill" && itemId) {
        const label = control.dataset.label ?? itemId;
        requestActorRoll(actor, { itemId, kind: "skill" }, label);
      }
    });
  }

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "d6e2-pc-quickbar"],
    id: "d6e2-pc-quickbar",
    position: { height: "auto", width: 390 },
    window: {
      icon: "fa-solid fa-people-group",
      resizable: true,
      title: "D6E2.Quickbar.Title",
    },
  };
}

class D6System2eActiveTasksQuickbar extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/active-tasks-quickbar.hbs`,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const tasks = activeRollRequests().map((task) => ({
      ...task,
      controllerOnline: game.users?.get(task.controllerUserId)?.active === true,
    }));
    return Promise.resolve({ count: tasks.length, tasks });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.addEventListener("click", (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const control = event.target.closest<HTMLElement>("[data-action]");
      const taskId =
        control?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId;
      if (!control || !taskId) return;
      if (control.dataset.action === "takeOverTask") {
        void takeOverRollRequest(taskId);
      } else if (control.dataset.action === "cancelTask") {
        cancelRollRequest(taskId);
      }
    });
  }

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "d6e2-active-tasks-quickbar"],
    id: "d6e2-active-tasks-quickbar",
    position: { height: "auto", left: 12, top: 120, width: 330 },
    window: {
      icon: "fa-solid fa-list-check",
      resizable: true,
      title: "D6E2.Tasks.Title",
    },
  };
}

let pcQuickbar: D6System2ePcQuickbar | undefined;
let tasksQuickbar: D6System2eActiveTasksQuickbar | undefined;

function close(
  application: { close(): Promise<void>; rendered?: boolean } | undefined,
) {
  if (application?.rendered) void application.close();
}

export function synchronizeQuickbarVisibility(): void {
  if (typeof document === "undefined") return;
  const showPc = booleanSetting(SHARED_SETTING_KEYS.showPcQuickbar, true);
  if (showPc) {
    pcQuickbar ??= new D6System2ePcQuickbar();
    pcQuickbar.render({ force: true });
  } else close(pcQuickbar);

  const showTasks =
    game.user?.isGM === true &&
    booleanSetting(SHARED_SETTING_KEYS.showActiveTasksQuickbar, true);
  if (showTasks) {
    tasksQuickbar ??= new D6System2eActiveTasksQuickbar();
    tasksQuickbar.render({ force: true });
  } else close(tasksQuickbar);
}

function refreshQuickbars(): void {
  if (pcQuickbar?.rendered) pcQuickbar.render();
  if (tasksQuickbar?.rendered) tasksQuickbar.render();
}

export function registerD6System2eQuickbars(): void {
  registerRollRequestSocket();
  subscribeActiveRollRequests(refreshQuickbars);
  for (const hook of [
    "createActor",
    "updateActor",
    "deleteActor",
    "createItem",
    "updateItem",
    "deleteItem",
    "updateUser",
    "userConnected",
  ]) {
    Hooks.on(hook, refreshQuickbars);
  }
  Hooks.once("ready", synchronizeQuickbarVisibility);
}
