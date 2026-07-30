import {
  manualInitiativeOrder,
  moveCombatantInManualInitiative,
  usesFirstEditionInitiativeRolls,
  type InitiativeCombatantLike,
} from "./combat-documents";
import { recoverActorRoundStartCondition } from "./condition-service";
import { currentRulesProfile } from "../settings/rules-compatibility";

interface CombatTrackerLike {
  readonly viewed?: {
    readonly combatants: {
      readonly contents: readonly InitiativeCombatantLike[];
    };
    getFlag(namespace: string, key: string): unknown;
    setFlag(namespace: string, key: string, value: unknown): Promise<unknown>;
  } | null;
}

interface RoundCombatLike {
  readonly combatants?: {
    readonly contents?: readonly {
      readonly actor?: FoundryActorDocument | null;
    }[];
  };
}

export async function recoverCombatRoundStart(
  combat: RoundCombatLike,
): Promise<number> {
  if (
    game.user?.isGM !== true ||
    currentRulesProfile().compatibility.firstEditionDamage
  ) {
    return 0;
  }
  const actors = new Map<string, FoundryActorDocument>();
  for (const combatant of combat.combatants?.contents ?? []) {
    const actor = combatant.actor;
    if (actor && ["character", "creature", "npc"].includes(actor.type)) {
      actors.set(actor.id, actor);
    }
  }
  const results = await Promise.allSettled(
    [...actors.values()].map((actor) => recoverActorRoundStartCondition(actor)),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "D6 System Second Edition | Round-start recovery failed",
        result.reason,
      );
    }
  }
  return results.filter(
    (result) => result.status === "fulfilled" && result.value,
  ).length;
}

export function handleCombatUpdate(combat: unknown, changes: unknown): void {
  if (
    typeof changes !== "object" ||
    changes === null ||
    !Object.hasOwn(changes, "round")
  ) {
    return;
  }
  if (typeof combat === "object" && combat !== null) {
    void recoverCombatRoundStart(combat);
  }
  for (const actor of game.actors?.contents ?? []) {
    actor.sheet.render(false);
  }
}

export function handleCombatTrackerRender(
  application: unknown,
  element: unknown,
): void {
  if (usesFirstEditionInitiativeRolls() || !(element instanceof HTMLElement)) {
    return;
  }
  const rollButtons: HTMLElement[] = Array.from(
    element.querySelectorAll<HTMLElement>('[data-action="rollInitiative"]'),
  );
  for (const button of rollButtons) {
    button.remove();
  }
  if (game.user?.isGM !== true) return;
  const combat = (application as CombatTrackerLike).viewed;
  if (!combat) return;
  const rows: HTMLElement[] = Array.from(
    element.querySelectorAll<HTMLElement>(".combatant[data-combatant-id]"),
  );
  const order = manualInitiativeOrder(combat);
  for (const row of rows) {
    const combatantId = row.dataset.combatantId;
    if (!combatantId) continue;
    row.draggable = true;
    row.classList.add("d6e2-manual-initiative");
    row.title = game.i18n.localize("D6E2.Combat.Initiative.DragHelp");
    const name = row.querySelector<HTMLElement>(".token-name");
    if (name && !name.querySelector(".d6e2-initiative-handle")) {
      const handle = document.createElement("i");
      handle.className = "d6e2-initiative-handle fa-solid fa-grip-vertical";
      handle.setAttribute("aria-hidden", "true");
      name.prepend(handle);
    }
    if (!row.querySelector(".d6e2-initiative-controls")) {
      const controls = document.createElement("span");
      controls.className = "d6e2-initiative-controls";
      const index = order.indexOf(combatantId);
      for (const [offset, icon, localization] of [
        [-1, "fa-arrow-up", "D6E2.Combat.Initiative.MoveEarlier"],
        [1, "fa-arrow-down", "D6E2.Combat.Initiative.MoveLater"],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "d6e2-initiative-move";
        button.ariaLabel = game.i18n.localize(localization);
        button.disabled =
          index < 0 || index + offset < 0 || index + offset >= order.length;
        button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
        button.addEventListener("click", (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const current = manualInitiativeOrder(combat);
          const currentIndex = current.indexOf(combatantId);
          const targetId = current[currentIndex + offset];
          if (!targetId) return;
          void moveCombatantInManualInitiative(
            combat,
            combatantId,
            targetId,
            offset > 0,
          ).catch(reportManualInitiativeFailure);
        });
        controls.append(button);
      }
      row.append(controls);
    }
    row.addEventListener("dragstart", (event: DragEvent) => {
      event.dataTransfer?.setData("text/plain", combatantId);
      event.dataTransfer?.setData("application/d6e2-combatant", combatantId);
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      for (const candidate of rows) {
        candidate.classList.remove("is-drop-target");
      }
    });
    row.addEventListener("dragover", (event: DragEvent) => {
      event.preventDefault();
      row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("is-drop-target");
    });
    row.addEventListener("drop", (event: DragEvent) => {
      event.preventDefault();
      row.classList.remove("is-drop-target");
      const draggedId =
        event.dataTransfer?.getData("application/d6e2-combatant") ??
        event.dataTransfer?.getData("text/plain") ??
        "";
      if (!draggedId) return;
      const bounds = row.getBoundingClientRect();
      const afterTarget = event.clientY >= bounds.top + bounds.height / 2;
      void moveCombatantInManualInitiative(
        combat,
        draggedId,
        combatantId,
        afterTarget,
      ).catch(reportManualInitiativeFailure);
    });
  }
}

function reportManualInitiativeFailure(error: unknown): void {
  console.error("D6 System Second Edition | Manual initiative failed", error);
  ui.notifications.warn(
    game.i18n.localize("D6E2.Combat.Error.ManualInitiativeFailed"),
  );
}

export function registerCombatHooks(): void {
  Hooks.on("updateCombat", handleCombatUpdate);
  Hooks.on("renderCombatTracker", handleCombatTrackerRender);
}
