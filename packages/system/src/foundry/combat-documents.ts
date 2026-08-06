import {
  firstEditionInitiativeFormula,
  orderedInitiativeIds,
  type SecondEditionInitiativeStrategy,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { currentSecondEditionInitiativeStrategy } from "../settings/initiative";
import { firstEditionAttributeRole } from "../settings/first-edition-genre-profile";
import { rollAttribute } from "./rolls/roll-service";

export const MANUAL_INITIATIVE_ORDER_FLAG = "manualInitiativeOrder";
export const NARRATIVE_INITIATIVE_SEQUENCE_FLAG = "narrativeInitiativeSequence";
export const INITIATIVE_SOCKET_KIND = "alternate-initiative-total";
export const NARRATIVE_SUCCESSOR_SOCKET_KIND =
  "alternate-initiative-narrative-successor";

interface InitiativeActorLike {
  readonly id?: string;
  readonly isOwner?: boolean;
  testUserPermission?(user: object, level: string): boolean;
  readonly system?: {
    readonly attributes?: Readonly<
      Record<string, { readonly score?: unknown }>
    >;
  };
}

export interface InitiativeCombatantLike {
  readonly actor?: InitiativeActorLike | null;
  readonly id: string;
  readonly initiative?: number | null;
  update?(changes: { initiative: number | null }): Promise<unknown>;
}

interface BaseCombat {
  readonly id?: string;
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

export function secondEditionInitiativeMode(): SecondEditionInitiativeStrategy {
  return currentSecondEditionInitiativeStrategy();
}

export function usesRolledSecondEditionInitiative(): boolean {
  const strategy = secondEditionInitiativeMode();
  return (
    !usesFirstEditionInitiativeRolls() &&
    (strategy === "basic" || strategy === "narrative")
  );
}

export function initiativeFormulaForActor(
  actor: InitiativeActorLike | null | undefined,
): string {
  const attributes = actor?.system?.attributes;
  const initiativeId = firstEditionAttributeRole("initiative");
  return firstEditionInitiativeFormula({
    agilityScore: score(attributes?.agility?.score),
    perceptionScore: score(attributes?.[initiativeId]?.score),
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

export function narrativeInitiativeSequence(
  combat: Pick<BaseCombat, "combatants" | "getFlag">,
): readonly string[] {
  const available = new Set(combat.combatants.contents.map(({ id }) => id));
  const stored = combat.getFlag(SYSTEM_ID, NARRATIVE_INITIATIVE_SEQUENCE_FLAG);
  return Object.freeze(
    Array.isArray(stored)
      ? stored.filter(
          (id, index): id is string =>
            typeof id === "string" &&
            available.has(id) &&
            stored.indexOf(id) === index,
        )
      : [],
  );
}

export async function chooseNextNarrativeCombatant(
  combat: Pick<
    BaseCombat,
    "id" | "combatants" | "getFlag" | "setFlag" | "setupTurns"
  >,
  targetId: string,
): Promise<readonly string[]> {
  if (secondEditionInitiativeMode() !== "narrative") {
    throw new Error("D6E2.Combat.Error.NarrativeInitiativeInactive");
  }
  const sequence = narrativeInitiativeSequence(combat);
  const current = combat.combatants.contents.find(
    ({ id }) => id === sequence[sequence.length - 1],
  );
  if (game.user?.isGM !== true && current?.actor?.isOwner !== true) {
    throw new Error("D6E2.Combat.Error.NarrativeInitiativeOwnerRequired");
  }
  if (
    sequence.includes(targetId) ||
    !combat.combatants.contents.some(({ id }) => id === targetId)
  ) {
    return sequence;
  }
  const next = Object.freeze([...sequence, targetId]);
  if (game.user?.isGM !== true) {
    const activeGm = (
      game as typeof game & { users?: { activeGM?: object | null } }
    ).users?.activeGM;
    if (!activeGm) {
      throw new Error("D6E2.Combat.Error.NarrativeInitiativeRequiresGM");
    }
    game.socket?.emit(initiativeSocketChannel(), {
      combatId: combat.id,
      kind: NARRATIVE_SUCCESSOR_SOCKET_KIND,
      targetId,
      userId: game.user?.id,
    });
    return next;
  }
  await combat.setFlag(SYSTEM_ID, NARRATIVE_INITIATIVE_SEQUENCE_FLAG, next);
  await combat.setFlag(SYSTEM_ID, MANUAL_INITIATIVE_ORDER_FLAG, [
    ...next,
    ...manualInitiativeOrder(combat).filter((id) => !next.includes(id)),
  ]);
  combat.setupTurns?.();
  (
    ui as typeof ui & {
      combat?: { render(options?: { force?: boolean }): unknown };
    }
  ).combat?.render({ force: true });
  return next;
}

function initiativeSocketChannel(): string {
  return `system.${SYSTEM_ID}`;
}

async function commitSecondEditionInitiativeTotal(
  combat: BaseCombat,
  combatantId: string,
  total: number,
): Promise<void> {
  if (game.user?.isGM !== true || !Number.isFinite(total)) return;
  const combatant = combat.combatants.contents.find(
    ({ id }) => id === combatantId,
  );
  if (!combatant?.update) return;
  await combatant.update({ initiative: Math.trunc(total) });
  const strategy = secondEditionInitiativeMode();
  if (strategy === "narrative") {
    const results = Object.fromEntries(
      combat.combatants.contents.map((entry) => [entry.id, entry.initiative]),
    );
    const order = orderedInitiativeIds(results, manualInitiativeOrder(combat));
    await combat.setFlag(SYSTEM_ID, MANUAL_INITIATIVE_ORDER_FLAG, order);
    const sequence = narrativeInitiativeSequence(combat);
    if (sequence.length <= 1) {
      await combat.setFlag(
        SYSTEM_ID,
        NARRATIVE_INITIATIVE_SEQUENCE_FLAG,
        order.length > 0 ? [order[0]] : [],
      );
    }
  }
  combat.setupTurns?.();
  (
    ui as typeof ui & {
      combat?: { render(options?: { force?: boolean }): unknown };
    }
  ).combat?.render({ force: true });
}

async function rollSecondEditionInitiative(
  combat: BaseCombat,
  ids: string | readonly string[],
): Promise<void> {
  const requested: readonly string[] = typeof ids === "string" ? [ids] : ids;
  for (const id of requested) {
    const combatant = combat.combatants.contents.find(
      (entry) => entry.id === id,
    );
    const actor = combatant?.actor;
    if (!actor || (game.user?.isGM !== true && actor.isOwner !== true))
      continue;
    const result = await rollAttribute(
      actor,
      firstEditionAttributeRole("initiative"),
    );
    if (!result) continue;
    if (game.user?.isGM === true) {
      await commitSecondEditionInitiativeTotal(combat, id, result.total);
    } else {
      game.socket?.emit(initiativeSocketChannel(), {
        combatId: combat.id,
        combatantId: id,
        kind: INITIATIVE_SOCKET_KIND,
        total: result.total,
        userId: game.user?.id,
      });
    }
  }
}

export function registerAlternateInitiativeSocket(): void {
  game.socket?.on(initiativeSocketChannel(), (value: unknown) => {
    if (game.user?.isGM !== true || typeof value !== "object" || value === null)
      return;
    const request = value as Record<string, unknown>;
    if (
      request.kind !== INITIATIVE_SOCKET_KIND &&
      request.kind !== NARRATIVE_SUCCESSOR_SOCKET_KIND
    )
      return;
    const combatId =
      typeof request.combatId === "string" ? request.combatId : "";
    const userId = typeof request.userId === "string" ? request.userId : "";
    const combat = (
      game as typeof game & {
        combats?: { get(id: string): BaseCombat | undefined };
        users?: { get(id: string): object | undefined };
      }
    ).combats?.get(combatId);
    const user = (
      game as typeof game & { users?: { get(id: string): object | undefined } }
    ).users?.get(userId);
    if (!combat || !user) return;
    if (request.kind === NARRATIVE_SUCCESSOR_SOCKET_KIND) {
      const targetId =
        typeof request.targetId === "string" ? request.targetId : "";
      const sequence = narrativeInitiativeSequence(combat);
      const current = combat.combatants.contents.find(
        ({ id }) => id === sequence[sequence.length - 1],
      );
      if (
        !current?.actor ||
        current.actor.testUserPermission?.(user, "OWNER") !== true
      )
        return;
      void chooseNextNarrativeCombatant(combat, targetId).catch(
        (error: unknown) => {
          console.error(
            "D6 System Second Edition | Narrative initiative socket failed",
            error,
          );
        },
      );
      return;
    }
    const combatantId =
      typeof request.combatantId === "string" ? request.combatantId : "";
    const combatant = combat.combatants.contents.find(
      ({ id }) => id === combatantId,
    );
    if (
      !combatant?.actor ||
      combatant.actor.testUserPermission?.(user, "OWNER") !== true
    )
      return;
    void commitSecondEditionInitiativeTotal(
      combat,
      combatant.id,
      Number(request.total),
    ).catch((error: unknown) => {
      console.error(
        "D6 System Second Edition | Initiative socket failed",
        error,
      );
    });
  });
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
      if (secondEditionInitiativeMode() === "basic") {
        return super._sortCombatants(a, b);
      }
      const order = manualInitiativeOrder(this);
      return order.indexOf(a.id) - order.indexOf(b.id);
    };

    override async rollInitiative(
      ids: string | readonly string[],
      options: Record<string, unknown> = {},
    ): Promise<unknown> {
      if (usesRolledSecondEditionInitiative()) {
        await rollSecondEditionInitiative(this, ids);
        return this;
      }
      if (!usesFirstEditionInitiativeRolls()) {
        ui.notifications.info(
          game.i18n.localize(
            secondEditionInitiativeMode() === "simple"
              ? "D6E2.Combat.Initiative.SimpleNotice"
              : "D6E2.Combat.Initiative.StandardNotice",
          ),
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
