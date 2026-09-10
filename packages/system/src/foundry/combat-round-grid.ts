import {
  bindInitiativeTooltips,
  initiativePresentation,
} from "./initiative-presentation";
import { MODERN_INITIATIVE_ID } from "../settings/initiative-tie-editor";
import {
  initiativeAttributeBindingsForActor,
  initiativeBaseBindingsForActor,
} from "./combat-documents";
import { SYSTEM_ID } from "../constants";
import { currentActionEconomyRuntimeStrategy } from "../settings/action-economy";
import { currentInitiativeRuntimeStrategy } from "../settings/initiative";
import { combatRoundGridView } from "../application/combat-round-grid";
import {
  annotateCombatantNextAction,
  readCombatantRound,
  spendFirstEditionCombatantAction,
} from "./combat-service";
import {
  activeGridCombat,
  combatHasPrivateQueues,
  onCombatGridChange,
  refreshCombatGridProjection,
} from "./combat-round-private";
import {
  projectCurrentCombatGrid,
  registerCombatRoundGridService,
} from "./combat-round-grid-service";
import type { D6CombatGridProjectionV1 } from "@d6-system-2e/core";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);
let application: D6CombatRoundGridApplication | undefined;
export class D6CombatRoundGridApplication extends Base {
  readonly #preserveNativeTab = (event: KeyboardEvent): void => {
    if (
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    )
      event.stopPropagation();
  };
  #grid: D6CombatGridProjectionV1 | undefined;
  #error = "";
  #busy = false;
  #viewport: { left: number; top: number } | undefined;
  #revealNext = false;
  #focus: { action: string; id: string } | "viewport" | undefined;
  // Foundry has no element before first render or after close; its local ambient
  // declaration currently describes only the rendered state.
  #renderedElement(): HTMLElement | undefined {
    return this.element;
  }
  override async _prepareContext() {
    const element = this.#renderedElement();
    const viewport = element?.querySelector<HTMLElement>(
      ".d6e2-round-grid-scroll",
    );
    if (viewport)
      this.#viewport = { left: viewport.scrollLeft, top: viewport.scrollTop };
    const focused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    this.#focus = focused && focused === viewport ? "viewport" : undefined;
    if (focused && element?.contains(focused) && focused.dataset.action)
      this.#focus = {
        action: focused.dataset.action,
        id: focused.dataset.combatantId ?? "",
      };
    const available =
      currentActionEconomyRuntimeStrategy().turnScheduling ===
      "round-robin-segments";
    const combat = activeGridCombat();
    let grid: D6CombatGridProjectionV1 | undefined;
    let loadError = "";
    try {
      grid =
        available && combat && game.user
          ? combatHasPrivateQueues()
            ? await refreshCombatGridProjection()
            : projectCurrentCombatGrid(game.user)
          : undefined;
    } catch (error) {
      loadError = game.i18n.localize(
        error instanceof Error
          ? error.message
          : "D6E2.Combat.RoundGrid.authorityUnavailable",
      );
    }
    this.#grid = grid;
    const view = grid
      ? combatRoundGridView(
          grid,
          (k) => game.i18n.localize(k),
          (k, d) => game.i18n.format(k, d),
        )
      : { rows: [], columns: [] };
    if (grid)
      for (const row of view.rows) {
        const projected = grid.rows.find((r) => r.id === row.id);
        Object.assign(
          row,
          initiativePresentation(
            projected?.initiative,
            combat?.combatants.contents.find((c) => c.id === row.id),
          ),
        );
      }
    const modernMissing =
      currentInitiativeRuntimeStrategy().id === MODERN_INITIATIVE_ID &&
      (combat?.combatants.contents ?? []).some((c) => {
        if (!c.actor?.isOwner && !game.user?.isGM) return false;
        const bindings = initiativeAttributeBindingsForActor(c.actor);
        return (
          !bindings.configured ||
          bindings.primary === undefined ||
          bindings.secondary === undefined
        );
      });
    const missing =
      currentInitiativeRuntimeStrategy().id ===
        "open-d6.initiative.perception-reflexes" &&
      (combat?.combatants.contents ?? []).some((c) => {
        if (!c.actor?.isOwner) return false;
        const bindings = initiativeBaseBindingsForActor(c.actor);
        return (
          bindings.perception === undefined || bindings.reflexes === undefined
        );
      });
    if (this.#busy && "rows" in view)
      for (const row of view.rows) {
        row.canManage = false;
        for (const cell of row.cells) {
          cell.canComplete = false;
          cell.canAnnotateHold = false;
          cell.canClearHold = false;
          cell.canCancel = false;
        }
      }
    return {
      ...view,
      available: available && Boolean(combat) && Boolean(grid),
      unavailableReason:
        loadError ||
        this.#error ||
        game.i18n.localize(
          `D6E2.Combat.RoundGrid.${!combat ? "noCombat" : "unavailable"}`,
        ),
      combatLabel: combat?.name ?? "",
      error:
        loadError ||
        this.#error ||
        (modernMissing
          ? game.i18n.localize("D6E2.Combat.Initiative.MissingBaseAttributes")
          : missing
            ? game.i18n.localize("D6E2.Combat.RoundGrid.missingBaseAttributes")
            : ""),
    };
  }
  async #act(
    target: HTMLElement,
    kind: "spend" | "hold" | "clear-hold" | "cancel" | "declare",
  ) {
    const element = this.#renderedElement();
    if (this.#busy || !element) return;
    const id = target.dataset.combatantId;
    const row = this.#grid?.rows.find((r) => r.id === id);
    const combatant = activeGridCombat()?.combatants.contents.find(
      (c) => c.id === id,
    );
    if (!row?.canManage || !combatant?.actor || row.revision === undefined)
      return;
    this.#busy = true;
    this.#error = "";
    for (const button of Array.from(
      element.querySelectorAll<HTMLButtonElement>("button"),
    ))
      button.disabled = true;
    try {
      if (kind === "declare") {
        if (!readCombatantRound(combatant.actor))
          throw new Error("D6E2.Combat.RoundGrid.ambiguousActor");
        const sheet = combatant.actor.sheet as unknown as {
          render(options: unknown): Promise<unknown>;
          openFirstEditionActionDeclaration?(): Promise<void>;
        };
        if (!sheet.openFirstEditionActionDeclaration)
          throw new Error("D6E2.Combat.RoundGrid.unavailable");
        await sheet.render({ force: true });
        await sheet.openFirstEditionActionDeclaration();
      } else {
        const cell = row.cells.find((c) => c.active);
        if (!cell?.id || !cell.canComplete)
          throw new Error("D6E2.Combat.RoundGrid.staleState");
        if (kind === "spend")
          await spendFirstEditionCombatantAction(
            combatant.actor,
            row.revision,
            undefined,
            combatant.id,
          );
        else
          await annotateCombatantNextAction(
            combatant.actor,
            row.revision,
            cell.id,
            kind,
            undefined,
            combatant.id,
          );
        this.#revealNext = kind === "spend" || kind === "cancel";
      }
    } catch (error) {
      this.#error = game.i18n.localize(
        error instanceof Error
          ? error.message
          : "D6E2.Combat.RoundGrid.invalidState",
      );
    } finally {
      this.#busy = false;
      await this.render();
    }
  }
  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    const element = this.#renderedElement();
    const viewport = element?.querySelector<HTMLElement>(
      ".d6e2-round-grid-scroll",
    );
    if (!element || !viewport) return;
    bindInitiativeTooltips(element);
    // Foundry also intercepts Tab from buttons. Keep browser traversal throughout
    // this application, including Shift-Tab back into the table and out of controls.
    element.removeEventListener("keydown", this.#preserveNativeTab);
    element.addEventListener("keydown", this.#preserveNativeTab);
    viewport.addEventListener("keydown", (event) => {
      if (
        event.target !== viewport ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
          "Tab",
        ].includes(event.key)
      ) {
        // Foundry's canvas handler prevents these keys globally. Keep the browser's
        // native scrolling and focus-navigation defaults, but only while the table region itself owns focus.
        event.stopPropagation();
      }
    });
    if (this.#viewport && !this.#revealNext) {
      viewport.scrollLeft = this.#viewport.left;
      viewport.scrollTop = this.#viewport.top;
    }
    if (!this.#viewport || this.#revealNext)
      viewport
        .querySelector<HTMLElement>('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (this.#revealNext)
      viewport
        .querySelector<HTMLButtonElement>(
          '[data-active="true"] [data-action="completeNext"]',
        )
        ?.focus({ preventScroll: true });
    else if (this.#focus === "viewport")
      viewport.focus({ preventScroll: true });
    else if (this.#focus) {
      const remembered = this.#focus;
      Array.from(
        element.querySelectorAll<HTMLButtonElement>("button[data-action]"),
      )
        .find(
          (button) =>
            button.dataset.action === remembered.action &&
            (button.dataset.combatantId ?? "") === remembered.id,
        )
        ?.focus({ preventScroll: true });
    }
    this.#revealNext = false;
  }
  static override DEFAULT_OPTIONS = {
    id: "d6-round-grid",
    classes: ["d6e2", "d6e2-round-grid"],
    position: { width: 1000, height: 640 },
    window: {
      title: "D6E2.Combat.RoundGrid.title",
      icon: "fa-solid fa-table-cells",
      resizable: true,
    },
    actions: {
      refresh: function (this: D6CombatRoundGridApplication) {
        this.#error = "";
        void this.render();
      },
      completeNext: function (
        this: D6CombatRoundGridApplication,
        _e: Event,
        t: HTMLElement,
      ) {
        return this.#act(t, "spend");
      },
      annotateHold: function (
        this: D6CombatRoundGridApplication,
        _e: Event,
        t: HTMLElement,
      ) {
        return this.#act(t, "hold");
      },
      clearHold: function (
        this: D6CombatRoundGridApplication,
        _e: Event,
        t: HTMLElement,
      ) {
        return this.#act(t, "clear-hold");
      },
      cancelNext: function (
        this: D6CombatRoundGridApplication,
        _e: Event,
        t: HTMLElement,
      ) {
        return this.#act(t, "cancel");
      },
      openDeclaration: function (
        this: D6CombatRoundGridApplication,
        _e: Event,
        t: HTMLElement,
      ) {
        return this.#act(t, "declare");
      },
    },
  };
  static override PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/combat/round-grid.hbs` },
  };
}
export function openCombatRoundGrid(): void {
  application ??= new D6CombatRoundGridApplication();
  void application.render({ force: true });
}
export function registerCombatRoundGrid(): void {
  registerCombatRoundGridService();
  onCombatGridChange(() => {
    if (application?.rendered) void application.render();
  });
  Hooks.on("renderCombatTracker", (_app: unknown, html: unknown) => {
    const root =
      html instanceof HTMLElement
        ? html
        : (html as { 0?: HTMLElement } | null)?.[0];
    if (!root) return;
    root.querySelector("[data-d6-round-grid-open]")?.remove();
    if (
      currentActionEconomyRuntimeStrategy().turnScheduling !==
      "round-robin-segments"
    )
      return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.d6RoundGridOpen = "";
    button.textContent = game.i18n.localize("D6E2.Combat.RoundGrid.open");
    button.addEventListener("click", openCombatRoundGrid);
    root.prepend(button);
  });
}
