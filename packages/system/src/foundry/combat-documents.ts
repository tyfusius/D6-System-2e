import { firstEditionInitiativeFormula } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentRulesProfile } from "../settings/rules-compatibility";

export const MANUAL_INITIATIVE_ORDER_FLAG = "manualInitiativeOrder";

interface InitiativeActorLike {
  readonly system?: {
    readonly attributes?: {
      readonly agility?: { readonly score?: unknown };
      readonly perception?: { readonly score?: unknown };
    };
  };
}

export interface InitiativeCombatantLike {
  readonly id: string;
  readonly initiative?: number | null;
}

interface BaseCombat {
  readonly combatants: {
    readonly contents: readonly InitiativeCombatantLike[];
  };
  getFlag(namespace: string, key: string): unknown;
  rollInitiative(
    ids: string | readonly string[],
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  setFlag(namespace: string, key: string, value: unknown): Promise<unknown>;
  setupTurns?(): readonly InitiativeCombatantLike[];
  _sortCombatants(
    a: InitiativeCombatantLike,
    b: InitiativeCombatantLike,
  ): number;
}

interface BaseCombatant {
  readonly actor?: InitiativeActorLike | null;
  _getInitiativeFormula(): string;
}

type BaseCombatConstructor = new (...args: never[]) => BaseCombat;
type BaseCombatantConstructor = new (...args: never[]) => BaseCombatant;

function score(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function usesFirstEditionInitiativeRolls(): boolean {
  return currentRulesProfile().compatibility.firstEditionInitiative;
}

export function initiativeFormulaForActor(
  actor: InitiativeActorLike | null | undefined,
): string {
  const attributes = actor?.system?.attributes;
  return firstEditionInitiativeFormula({
    agilityScore: score(attributes?.agility?.score),
    perceptionScore: score(attributes?.perception?.score),
  }).formula;
}

export function manualInitiativeOrder(
  combat: Pick<BaseCombat, "combatants" | "getFlag">,
): readonly string[] {
  const combatantIds = combat.combatants.contents.map(({ id }) => id);
  const available = new Set(combatantIds);
  const stored = combat.getFlag(SYSTEM_ID, MANUAL_INITIATIVE_ORDER_FLAG);
  const retained = Array.isArray(stored)
    ? stored.filter(
        (id, index): id is string =>
          typeof id === "string" &&
          available.has(id) &&
          stored.indexOf(id) === index,
      )
    : [];
  const retainedSet = new Set(retained);
  return Object.freeze([
    ...retained,
    ...combatantIds.filter((id) => !retainedSet.has(id)),
  ]);
}

export function reorderedInitiativeIds(
  current: readonly string[],
  draggedId: string,
  targetId: string,
  afterTarget: boolean,
): readonly string[] {
  if (draggedId === targetId || !current.includes(draggedId)) return current;
  const withoutDragged = current.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);
  if (targetIndex < 0) return current;
  const insertionIndex = targetIndex + (afterTarget ? 1 : 0);
  return Object.freeze([
    ...withoutDragged.slice(0, insertionIndex),
    draggedId,
    ...withoutDragged.slice(insertionIndex),
  ]);
}

export async function moveCombatantInManualInitiative(
  combat: Pick<BaseCombat, "combatants" | "getFlag" | "setFlag" | "setupTurns">,
  draggedId: string,
  targetId: string,
  afterTarget: boolean,
): Promise<readonly string[]> {
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.Combat.Error.ManualInitiativeRequiresGM");
  }
  const current = manualInitiativeOrder(combat);
  const next = reorderedInitiativeIds(
    current,
    draggedId,
    targetId,
    afterTarget,
  );
  if (next === current) return current;
  await combat.setFlag(SYSTEM_ID, MANUAL_INITIATIVE_ORDER_FLAG, next);
  combat.setupTurns?.();
  (
    ui as typeof ui & {
      combat?: { render(options?: { force?: boolean }): unknown };
    }
  ).combat?.render({ force: true });
  return next;
}

export function registerD6CombatDocuments(): void {
  const globals = globalThis as typeof globalThis & {
    readonly Combat?: BaseCombatConstructor;
    readonly Combatant?: BaseCombatantConstructor;
  };
  const BaseCombat = globals.Combat;
  const BaseCombatant = globals.Combatant;
  if (!BaseCombat || !BaseCombatant) {
    return;
  }

  class D6System2eCombat extends BaseCombat {
    override _sortCombatants = (
      a: InitiativeCombatantLike,
      b: InitiativeCombatantLike,
    ): number => {
      if (usesFirstEditionInitiativeRolls()) {
        return super._sortCombatants(a, b);
      }
      const order = manualInitiativeOrder(this);
      return order.indexOf(a.id) - order.indexOf(b.id);
    };

    override async rollInitiative(
      ids: string | readonly string[],
      options: Record<string, unknown> = {},
    ): Promise<unknown> {
      if (!usesFirstEditionInitiativeRolls()) {
        ui.notifications.info(
          game.i18n.localize("D6E2.Combat.Initiative.ContextualNotice"),
        );
        return this;
      }
      return super.rollInitiative(ids, options);
    }
  }

  class D6System2eCombatant extends BaseCombatant {
    override _getInitiativeFormula(): string {
      return initiativeFormulaForActor(this.actor);
    }
  }

  const config = CONFIG as typeof CONFIG & {
    readonly Combat: {
      documentClass: FoundryConstructor<object>;
      initiative: { decimals: number; formula: string };
    };
    readonly Combatant: {
      documentClass: FoundryConstructor<object>;
    };
  };
  config.Combat.documentClass =
    D6System2eCombat as unknown as FoundryConstructor<object>;
  config.Combatant.documentClass =
    D6System2eCombatant as unknown as FoundryConstructor<object>;
  config.Combat.initiative = {
    decimals: 2,
    formula: "0",
  };
}
