import {
  chooseNextNarrativeCombatant,
  manualInitiativeOrder,
  moveCombatantInManualInitiative,
  narrativeInitiativeSequence,
  NARRATIVE_INITIATIVE_SEQUENCE_FLAG,
  MANUAL_INITIATIVE_ORDER_FLAG,
  type InitiativeCombatantLike,
} from "./combat-documents";
import {
  basicInitiativeDeclarationOrder,
  nextNarrativeInitiativeOrder,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolveFirstEditionEndOfRoundMortality } from "./first-edition-healing-service";
import { recoverActorFirstEditionAccumulatingStunsAtRoundStart } from "./first-edition-accumulating-stun-service";
import { booleanSetting } from "../settings/setting-values";
import { FIRST_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import {
  currentHealthResolutionStrategy,
  recoverActorRoundStartHealth,
} from "./health-runtime";
import { currentInitiativeRuntimeStrategy } from "../settings/initiative";
import { clearExpiredOpenD6FatePointEffects } from "./open-d6-roll-resource-service";

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
  readonly id?: string;
  readonly round?: number;
  readonly combatants?: {
    readonly contents?: readonly {
      readonly actor?: FoundryActorDocument | null;
    }[];
  };
  getFlag?(namespace: string, key: string): unknown;
  resetAll?(): Promise<unknown>;
  setFlag?(namespace: string, key: string, value: unknown): Promise<unknown>;
  setupTurns?(): unknown;
}

export async function advanceAlternateInitiativeRound(
  combat: RoundCombatLike,
): Promise<void> {
  const strategy = currentInitiativeRuntimeStrategy();
  if (
    game.user?.isGM !== true ||
    !Number.isSafeInteger(combat.round) ||
    (combat.round ?? 0) <= 1
  )
    return;
  if (strategy.roundTransition === "clear-rolled-totals") {
    await combat.resetAll?.();
    combat.setupTurns?.();
    return;
  }
  if (
    strategy.roundTransition !== "rotate-narrative-order" ||
    !combat.getFlag ||
    !combat.setFlag
  )
    return;
  const current = manualInitiativeOrder(
    combat as Parameters<typeof manualInitiativeOrder>[0],
  );
  const next = nextNarrativeInitiativeOrder(current);
  await combat.setFlag(SYSTEM_ID, MANUAL_INITIATIVE_ORDER_FLAG, next);
  await combat.setFlag(
    SYSTEM_ID,
    NARRATIVE_INITIATIVE_SEQUENCE_FLAG,
    next.length > 0 ? [next[0]] : [],
  );
  combat.setupTurns?.();
}

function isPrimaryActiveGamemaster(): boolean {
  const primary = (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) =>
      (left.name ?? left.id).localeCompare(right.name ?? right.id, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    )[0];
  return primary !== undefined && primary.id === game.user?.id;
}

export async function runFirstEditionEndOfRoundMortality(
  combat: RoundCombatLike,
): Promise<number> {
  if (
    currentHealthResolutionStrategy().lifecycle.mortality !==
      "open-d6.elapsed-rounds" ||
    !isPrimaryActiveGamemaster() ||
    !combat.id ||
    !Number.isSafeInteger(combat.round) ||
    (combat.round ?? 0) <= 1
  ) {
    return 0;
  }
  const completedRound = (combat.round ?? 1) - 1;
  const checkId = `${combat.id}:round:${String(completedRound)}`;
  const actors = new Map<string, FoundryActorDocument>();
  for (const combatant of combat.combatants?.contents ?? []) {
    const actor = combatant.actor;
    if (actor && ["character", "creature", "npc"].includes(actor.type)) {
      actors.set(actor.uuid ?? actor.id, actor);
    }
  }
  let resolved = 0;
  for (const actor of actors.values()) {
    try {
      if (await resolveFirstEditionEndOfRoundMortality(actor, checkId)) {
        resolved += 1;
      }
    } catch (error) {
      console.error(
        "D6 System Second Edition | End-of-round mortality check failed",
        error,
      );
    }
  }
  return resolved;
}

export async function recoverCombatRoundStart(
  combat: RoundCombatLike,
): Promise<number> {
  if (
    game.user?.isGM !== true ||
    currentHealthResolutionStrategy().lifecycle.roundStartRecovery !==
      "d6e2.transient-conditions"
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
    [...actors.values()].map((actor) => recoverActorRoundStartHealth(actor)),
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

export async function recoverFirstEditionAccumulatingStuns(
  combat: RoundCombatLike,
): Promise<number> {
  if (
    currentHealthResolutionStrategy().lifecycle.accumulatingStuns !==
      "open-d6.optional-accumulating-stuns" ||
    !booleanSetting(FIRST_EDITION_OPTION_KEYS.trackStuns, false) ||
    !isPrimaryActiveGamemaster() ||
    !combat.id ||
    !Number.isSafeInteger(combat.round) ||
    (combat.round ?? 0) < 1
  ) {
    return 0;
  }
  const roundId = `${combat.id}:round:${String(combat.round)}`;
  const actors = new Map<string, FoundryActorDocument>();
  for (const combatant of combat.combatants?.contents ?? []) {
    const actor = combatant.actor;
    if (actor && ["character", "creature", "npc"].includes(actor.type)) {
      actors.set(actor.uuid ?? actor.id, actor);
    }
  }
  const results = await Promise.allSettled(
    [...actors.values()].map((actor) =>
      recoverActorFirstEditionAccumulatingStunsAtRoundStart(actor, roundId),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "D6 System Second Edition | Accumulating-stun recovery failed",
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
    void advanceAlternateInitiativeRound(combat);
    void recoverCombatRoundStart(combat);
    void recoverFirstEditionAccumulatingStuns(combat);
    void runFirstEditionEndOfRoundMortality(combat);
  }
  void clearExpiredOpenD6FatePointEffects(game.actors?.contents ?? []).catch(
    (error: unknown) =>
      console.error(
        "D6 System Second Edition | Fate Point round cleanup failed",
        error,
      ),
  );
  for (const actor of game.actors?.contents ?? []) {
    actor.sheet.render(false);
  }
}

export function handleCombatTrackerRender(
  application: unknown,
  element: unknown,
): void {
  const strategy = currentInitiativeRuntimeStrategy();
  if (strategy.tracker === "foundry" || !(element instanceof HTMLElement)) {
    return;
  }
  const combat = (application as CombatTrackerLike).viewed;
  if (!combat) return;
  const tracker =
    element.querySelector<HTMLElement>(".combat-tracker") ?? element;
  if (!tracker.querySelector(".d6e2-initiative-notice")) {
    const notice = document.createElement("p");
    notice.className = "d6e2-initiative-notice";
    const suffix =
      strategy.family === "simple"
        ? "Simple"
        : strategy.family === "basic"
          ? "Basic"
          : strategy.family === "narrative"
            ? "Narrative"
            : "Standard";
    notice.textContent = game.i18n.localize(
      `D6E2.Combat.Initiative.${suffix}Notice`,
    );
    tracker.prepend(notice);
  }
  const rollButtons: HTMLElement[] = Array.from(
    element.querySelectorAll<HTMLElement>('[data-action="rollInitiative"]'),
  );
  if (strategy.roll === "none") {
    for (const button of rollButtons) button.remove();
  }
  const rows: HTMLElement[] = Array.from(
    element.querySelectorAll<HTMLElement>(".combatant[data-combatant-id]"),
  );
  const order = manualInitiativeOrder(combat);
  if (strategy.tracker === "declaration") {
    const declarationOrder = basicInitiativeDeclarationOrder(
      rows.flatMap((row) =>
        row.dataset.combatantId ? [row.dataset.combatantId] : [],
      ),
    );
    for (const row of rows) {
      const id = row.dataset.combatantId;
      if (!id) continue;
      const position = declarationOrder.indexOf(id);
      if (position >= 0 && !row.querySelector(".d6e2-declaration-order")) {
        const label = document.createElement("small");
        label.className = "d6e2-declaration-order";
        label.textContent = game.i18n.format(
          "D6E2.Combat.Initiative.DeclarePosition",
          { position: position + 1 },
        );
        row.querySelector(".token-name")?.append(label);
      }
    }
    return;
  }
  if (strategy.tracker === "narrative") {
    const sequence = narrativeInitiativeSequence(combat);
    const currentId = sequence[sequence.length - 1];
    const current = combat.combatants.contents.find(
      ({ id }) => id === currentId,
    );
    const canChoose =
      game.user?.isGM === true || current?.actor?.isOwner === true;
    const activeGm = (
      game as typeof game & { users?: { activeGM?: object | null } }
    ).users?.activeGM;
    if (canChoose && sequence.length > 0 && sequence.length < order.length) {
      for (const row of rows) {
        const id = row.dataset.combatantId;
        if (!id || sequence.includes(id)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "d6e2-narrative-next";
        button.textContent = game.i18n.localize(
          "D6E2.Combat.Initiative.ChooseNext",
        );
        if (game.user?.isGM !== true && !activeGm) {
          button.disabled = true;
          button.title = game.i18n.localize(
            "D6E2.Combat.Initiative.ActiveGMRequired",
          );
        }
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void chooseNextNarrativeCombatant(combat, id).catch(
            reportManualInitiativeFailure,
          );
        });
        row.append(button);
      }
    }
    return;
  }
  if (game.user?.isGM !== true) return;
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
