import { formatDieCode } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import { booleanSetting } from "../settings/setting-values";
import {
  activeNonGmOwners,
  activeRollRequests,
  cancelRollRequest,
  executeHighlightedRollRequest,
  registerRollRequestSocket,
  requestActorRoll,
  subscribeActiveRollRequests,
  subscribeHighlightedRollRequests,
  takeOverRollRequest,
} from "./roll-requests";
import {
  parseQuickbarState,
  pinQuickbarActor,
  removeQuickbarActor,
  reorderQuickbarActor,
  resolveQuickbarSections,
  toggleQuickbarSection,
} from "./quickbar-state";
import type { QuickbarSection, QuickbarState } from "./quickbar-state";

const { ApplicationV2 } = foundry.applications.api;
const HandlebarsApplicationMixin =
  foundry.applications.api.HandlebarsApplicationMixin.bind(
    foundry.applications.api,
  );

const QUICKBAR_FLAG = "pcQuickbar";

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
  readonly tokens?: {
    readonly tools: Record<string, SceneControlTool>;
  };
}

function quickbarState(): QuickbarState {
  return parseQuickbarState(game.user?.getFlag(SYSTEM_ID, QUICKBAR_FLAG));
}

async function writeQuickbarState(state: QuickbarState): Promise<void> {
  await game.user?.setFlag(SYSTEM_ID, QUICKBAR_FLAG, state);
}

function actorFrom(target: HTMLElement): FoundryActorDocument | undefined {
  const id = target.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId;
  return id ? game.actors?.get(id) : undefined;
}

function accessibleActors(): readonly FoundryActorDocument[] {
  return Object.freeze(
    (game.actors?.contents ?? [])
      .filter(
        (actor) =>
          ["character", "npc", "creature"].includes(actor.type) &&
          (game.user?.isGM === true || actor.isOwner === true),
      )
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
  );
}

class D6System2eGmQuickbar extends HandlebarsApplicationMixin(ApplicationV2) {
  #compact = false;
  readonly #openActorIds = new Set<string>();
  readonly #openAttributeKeys = new Set<string>();
  #rollPending = false;
  readonly #rootClickHandler = (event: Event): void => {
    if (event instanceof MouseEvent) void this.#handleClick(event);
  };

  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/pc-quickbar.hbs`,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const api = game.system.api;
    const state = quickbarState();
    const hidden = new Set(state.hiddenActorIds);
    const pinned = new Set(state.pinnedActorIds);
    const actors = accessibleActors();
    const sections = resolveQuickbarSections(state, actors);
    const highlightedTaskKeys = new Set(
      activeRollRequests()
        .filter(({ delivery }) => delivery === "highlight-on-character-sheet")
        .map(
          ({ actorId, subject }) => `${actorId}:${subject.kind}:${subject.id}`,
        ),
    );

    const views = api
      ? [...sections.pcIds, ...sections.npcIds].flatMap((actorId) => {
          const actor = actors.find((candidate) => candidate.id === actorId);
          if (!actor || hidden.has(actor.id)) return [];
          const model = api.read.actor(actor);
          const onlineOwners = activeNonGmOwners(actor);
          return [
            {
              attributes: model.attributes.map((attribute) => ({
                ...attribute,
                expanded: this.#openAttributeKeys.has(
                  `${actor.id}:${attribute.id}`,
                ),
                hasSkills: model.skills.some(
                  (skill) => skill.attributeId === attribute.id,
                ),
                scoreLabel: formatDieCode(attribute.code),
                requestedRoll: highlightedTaskKeys.has(
                  `${actor.id}:attribute:${attribute.id}`,
                ),
                skills: model.skills
                  .filter((skill) => skill.attributeId === attribute.id)
                  .map((skill) => ({
                    ...skill,
                    name: skill.label,
                    requestedRoll: highlightedTaskKeys.has(
                      `${actor.id}:skill:${skill.id}`,
                    ),
                    scoreLabel: formatDieCode(skill.code),
                  })),
              })),
              automatic: !pinned.has(actor.id),
              canRequest: game.user?.isGM === true,
              expanded: this.#openActorIds.has(actor.id),
              id: actor.id,
              img: actor.img,
              name: actor.name,
              onlineOwnerNames: onlineOwners
                .map((user) => user.name ?? user.id)
                .join(", "),
              pinned: pinned.has(actor.id),
              showRequest: game.user?.isGM === true,
              type: actor.type,
            },
          ];
        })
      : [];
    const byId = new Map(views.map((actor) => [actor.id, actor]));
    const pcActors = sections.pcIds.flatMap((id) => {
      const actor = byId.get(id);
      return actor ? [actor] : [];
    });
    const npcActors = sections.npcIds.flatMap((id) => {
      const actor = byId.get(id);
      return actor ? [actor] : [];
    });
    const choices = actors
      .filter((actor) => hidden.has(actor.id))
      .map((actor) => ({ id: actor.id, name: actor.name }));

    return Promise.resolve({
      choices,
      compact: this.#compact,
      count: views.length,
      hasChoices: choices.length > 0,
      npcActors,
      npcCollapsed: state.npcCollapsed,
      npcCount: npcActors.length,
      pcActors,
      pcCollapsed: state.pcCollapsed,
      pcCount: pcActors.length,
    });
  }
  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.classList.toggle("is-compact", this.#compact);
    this.element
      .querySelectorAll<HTMLDetailsElement>("details[data-actor-id]")
      .forEach((details) => {
        details.addEventListener("toggle", () => {
          const id = details.dataset.actorId;
          if (!id) return;
          if (details.open) this.#openActorIds.add(id);
          else this.#openActorIds.delete(id);
        });
      });
    this.element
      .querySelectorAll<HTMLDetailsElement>("details[data-attribute-key]")
      .forEach((details) => {
        details.addEventListener("toggle", () => {
          const key = details.dataset.attributeKey;
          if (!key) return;
          if (details.open) this.#openAttributeKeys.add(key);
          else this.#openAttributeKeys.delete(key);
        });
      });
    this.#setupDragAndDrop();
    // ApplicationV2 retains its root element across part renders. Replace the
    // delegated listener so repeated Actor/Item refreshes cannot multiply a
    // single click into several simultaneous rolls.
    this.element.removeEventListener("click", this.#rootClickHandler);
    this.element.addEventListener("click", this.#rootClickHandler);
  }

  #setupDragAndDrop(): void {
    this.element
      .querySelectorAll<HTMLElement>(".od6pc-actor[draggable='true']")
      .forEach((card) => {
        card.addEventListener("dragstart", (event) => {
          const id = card.dataset.actorId;
          if (!id) return;
          event.dataTransfer?.setData(
            "text/plain",
            JSON.stringify({ id, type: "D6E2QuickbarActor" }),
          );
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          card.classList.add("is-dragging");
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("is-dragging");
          this.element
            .querySelectorAll(".is-drag-over")
            .forEach((element) => element.classList.remove("is-drag-over"));
        });
      });

    this.element
      .querySelectorAll<HTMLElement>(".od6pc-section-body")
      .forEach((body) => {
        body.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          body.classList.add("is-drag-over");
        });
        body.addEventListener("dragleave", (event) => {
          if (!body.contains(event.relatedTarget as Node | null)) {
            body.classList.remove("is-drag-over");
          }
        });
        body.addEventListener("drop", (event) => {
          void this.#handleDrop(event, body);
        });
      });
  }

  async #handleDrop(event: DragEvent, body: HTMLElement): Promise<void> {
    event.preventDefault();
    body.classList.remove("is-drag-over");
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { id?: string; type?: string };
      if (payload.type !== "D6E2QuickbarActor" || !payload.id) return;
      const section =
        (body.dataset.section as QuickbarSection | undefined) ?? "pc";
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        ".od6pc-actor",
      );
      const targetIndex = target?.dataset.index
        ? Number.parseInt(target.dataset.index, 10)
        : Number.MAX_SAFE_INTEGER;
      const state = quickbarState();
      const sections = resolveQuickbarSections(state, accessibleActors());
      await writeQuickbarState(
        reorderQuickbarActor(
          {
            ...state,
            npcOrder: sections.npcIds,
            pcOrder: sections.pcIds,
          },
          payload.id,
          section,
          targetIndex,
        ),
      );
      this.render();
    } catch {
      // Ignore unrelated Foundry drag payloads.
    }
  }

  async #handleClick(event: MouseEvent): Promise<void> {
    if (!(event.target instanceof HTMLElement)) return;
    const control = event.target.closest<HTMLElement>("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    if (action === "toggleCompact") {
      this.#compact = !this.#compact;
      this.render();
      return;
    }
    if (action === "togglePcSection" || action === "toggleNpcSection") {
      const state = quickbarState();
      await writeQuickbarState(
        toggleQuickbarSection(
          state,
          action === "togglePcSection" ? "pc" : "npc",
        ),
      );
      this.render();
      return;
    }
    if (action === "addActor") {
      const id = this.element.querySelector<HTMLSelectElement>(
        "select[name='actorId']",
      )?.value;
      if (!id) return;
      const state = quickbarState();
      const actor = game.actors?.get(id);
      if (!actor) return;
      await writeQuickbarState(
        pinQuickbarActor(state, id, actor.type === "character" ? "pc" : "npc"),
      );
      this.render();
      return;
    }

    const actor = actorFrom(control);
    if (!actor) return;
    if (action === "openActor") {
      actor.sheet.render(true);
      return;
    }
    if (action === "pinActor") {
      const state = quickbarState();
      await writeQuickbarState(
        pinQuickbarActor(
          state,
          actor.id,
          actor.type === "character" ? "pc" : "npc",
        ),
      );
      this.render();
      return;
    }
    if (action === "removeActor") {
      const state = quickbarState();
      await writeQuickbarState(removeQuickbarActor(state, actor.id));
      this.render();
      return;
    }

    const attributeId = control.closest<HTMLElement>("[data-attribute-id]")
      ?.dataset.attributeId;
    const itemId =
      control.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (
      (action === "rollAttribute" && attributeId) ||
      (action === "rollSkill" && itemId)
    ) {
      if (this.#rollPending) return;
      this.#rollPending = true;
      control.setAttribute("aria-busy", "true");
      if (control instanceof HTMLButtonElement) control.disabled = true;
      try {
        if (action === "rollAttribute" && attributeId) {
          const requested = await executeHighlightedRollRequest(actor, {
            attributeId,
            kind: "attribute",
          });
          if (!requested) {
            await game.system.api?.roll.attribute(actor, attributeId);
          }
        } else if (action === "rollSkill" && itemId) {
          const requested = await executeHighlightedRollRequest(actor, {
            itemId,
            kind: "skill",
          });
          if (!requested) await game.system.api?.roll.skill(actor, itemId);
        }
      } finally {
        this.#rollPending = false;
        control.removeAttribute("aria-busy");
        if (control instanceof HTMLButtonElement) control.disabled = false;
      }
    } else if (action === "requestAttribute" && attributeId) {
      await requestActorRoll(
        actor,
        { attributeId, kind: "attribute" },
        control.dataset.label ?? attributeId,
      );
    } else if (action === "requestSkill" && itemId) {
      await requestActorRoll(
        actor,
        { itemId, kind: "skill" },
        control.dataset.label ?? itemId,
      );
    }
  }

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "od6-pc-quickbar"],
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
  #compact = false;
  readonly #rootClickHandler = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    const control = event.target;
    if (!(control instanceof HTMLElement)) return;
    void this.#handleClick(control);
  };

  static override PARTS = {
    content: {
      template: `systems/${SYSTEM_ID}/templates/apps/active-tasks-quickbar.hbs`,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const now = Date.now();
    const tasks = activeRollRequests().map((task) => {
      const controllerOnline =
        game.users?.get(task.controllerUserId)?.active === true;
      return {
        ...task,
        canTakeOver:
          task.remoteFailed || (!controllerOnline && task.cancellable),
        controllerOnline,
        expiresIn: Math.max(0, Math.ceil((task.expiresAt - now) / 1000)),
        kindLabel: game.i18n.localize("D6E2.Tasks.RequestedRoll"),
      };
    });
    return Promise.resolve({
      compact: this.#compact,
      count: tasks.length,
      tasks,
    });
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.classList.toggle("is-compact", this.#compact);
    this.element.removeEventListener("click", this.#rootClickHandler);
    this.element.addEventListener("click", this.#rootClickHandler);
  }

  async #handleClick(target: HTMLElement): Promise<void> {
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control) return;
    if (control.dataset.action === "toggleCompact") {
      this.#compact = !this.#compact;
      this.render();
      return;
    }
    const taskId =
      control.closest<HTMLElement>("[data-task-id]")?.dataset.taskId;
    if (!taskId) return;
    if (control.dataset.action === "takeOverTask") {
      const task = activeRollRequests().find(({ id }) => id === taskId);
      const controllerOnline =
        task && game.users?.get(task.controllerUserId)?.active === true;
      if (
        !task ||
        (!task.remoteFailed && (controllerOnline || !task.cancellable))
      ) {
        ui.notifications.warn(game.i18n.localize("D6E2.Tasks.StillOnline"));
        return;
      }
      await takeOverRollRequest(taskId);
    } else if (control.dataset.action === "cancelTask") {
      await cancelRollRequest(taskId);
    }
  }

  static override DEFAULT_OPTIONS = {
    classes: ["d6-system-2e", "od6-active-tasks-quickbar"],
    id: "d6e2-active-tasks-quickbar",
    position: { height: "auto", left: 12, top: 120, width: 330 },
    window: {
      icon: "fa-solid fa-list-check",
      resizable: true,
      title: "D6E2.Tasks.Title",
    },
  };
}

let gmQuickbar: D6System2eGmQuickbar | undefined;
let tasksQuickbar: D6System2eActiveTasksQuickbar | undefined;

function gmQuickbarEnabled(): boolean {
  // Keep the original setting key so existing per-user preferences survive
  // the product-name change from PC Quickbar to GM Quickbar.
  return (
    game.user?.isGM === true &&
    booleanSetting(SHARED_SETTING_KEYS.showPcQuickbar, true)
  );
}

function activeTasksQuickbarEnabled(): boolean {
  return (
    game.user?.isGM === true &&
    booleanSetting(SHARED_SETTING_KEYS.showActiveTasksQuickbar, true)
  );
}

function close(
  application: { close(): Promise<void>; rendered?: boolean } | undefined,
): void {
  if (application?.rendered) void application.close();
}

export function synchronizeQuickbarAvailability(): void {
  if (typeof document === "undefined") return;
  if (!gmQuickbarEnabled()) close(gmQuickbar);
  if (!activeTasksQuickbarEnabled()) close(tasksQuickbar);
  ui.controls?.render({ reset: true });
}

export function toggleGmQuickbar(): void {
  if (!gmQuickbarEnabled()) {
    close(gmQuickbar);
    return;
  }
  if (gmQuickbar?.rendered) void gmQuickbar.close();
  else {
    gmQuickbar ??= new D6System2eGmQuickbar();
    gmQuickbar.render({ force: true });
  }
}

export function toggleActiveTasksQuickbar(): void {
  if (!activeTasksQuickbarEnabled()) {
    close(tasksQuickbar);
    return;
  }
  if (tasksQuickbar?.rendered) void tasksQuickbar.close();
  else {
    tasksQuickbar ??= new D6System2eActiveTasksQuickbar();
    tasksQuickbar.render({ force: true });
  }
}

function refreshQuickbars(): void {
  if (gmQuickbar?.rendered) gmQuickbar.render();
  if (tasksQuickbar?.rendered) tasksQuickbar.render();
}

export function registerD6System2eQuickbars(): void {
  subscribeActiveRollRequests(refreshQuickbars);
  subscribeHighlightedRollRequests((actorId) => {
    const actor = game.actors?.get(actorId);
    const sheet = actor?.sheet as
      (FoundryDocumentSheet & { readonly rendered?: boolean }) | undefined;
    if (sheet?.rendered) sheet.render();
    refreshQuickbars();
  });
  Hooks.on("getSceneControlButtons", (value: unknown) => {
    const tools = (value as SceneControls).tokens?.tools;
    if (!tools) return;
    if (gmQuickbarEnabled()) {
      tools.d6System2eGmQuickbar = {
        active: gmQuickbar?.rendered === true,
        button: true,
        icon: "fa-solid fa-people-group",
        name: "d6System2eGmQuickbar",
        onChange: toggleGmQuickbar,
        order: Object.keys(tools).length,
        title: game.i18n.localize("D6E2.Quickbar.Title"),
      };
    }
    if (activeTasksQuickbarEnabled()) {
      tools.d6System2eActiveTasks = {
        active: tasksQuickbar?.rendered === true,
        button: true,
        icon: "fa-solid fa-list-check",
        name: "d6System2eActiveTasks",
        onChange: toggleActiveTasksQuickbar,
        order: Object.keys(tools).length,
        title: game.i18n.localize("D6E2.Tasks.Title"),
      };
    }
  });
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
  Hooks.once("ready", () => {
    registerRollRequestSocket();
    synchronizeQuickbarAvailability();
  });
}
