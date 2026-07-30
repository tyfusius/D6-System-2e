import {
  D6_COMBAT_CONTRACT_VERSION,
  combatRoundPenaltyLabel,
  combatRoundPenaltyScore,
  completeNextCombatAction,
  createCombatantRoundState,
  currentCombatAction,
  declareCombatActions,
  secondEditionMovementPlan,
  type D6CombatActionKind,
  type D6CombatCommandResultV1,
  type D6CombatantRoundReadModelV1,
  type D6CombatantRoundStateV1,
  type D6CombatDeclarationV1,
  type SecondEditionMovementMode,
  type SecondEditionPosture,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";

const ROUND_ACTION_FLAG = "roundAction";

interface CombatantLike {
  readonly actor?: object | null;
  readonly actorId?: string;
  readonly id: string;
  getFlag(namespace: string, key: string): unknown;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

interface CombatLike {
  readonly combatants: {
    readonly contents: readonly CombatantLike[];
  };
  readonly round?: number;
}

function activeCombat(): CombatLike | undefined {
  return (game as FoundryGame & { readonly combat?: CombatLike }).combat;
}

function actorId(actor: object): string {
  const id = (actor as { readonly id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

function actorUuid(actor: object): string {
  const uuid = (actor as { readonly uuid?: unknown }).uuid;
  return typeof uuid === "string" ? uuid : "";
}

function actorIsOwner(actor: object): boolean {
  return (
    game.user?.isGM === true ||
    (actor as { readonly isOwner?: unknown }).isOwner === true
  );
}

function actorPosture(actor: object): SecondEditionPosture {
  const posture = (
    actor as { readonly system?: { readonly movement?: { posture?: unknown } } }
  ).system?.movement?.posture;
  return posture === "prone" ? "prone" : "standing";
}

async function updateActorPosture(
  actor: object,
  posture: SecondEditionPosture,
): Promise<void> {
  if (actorPosture(actor) === posture) return;
  const update = (
    actor as {
      readonly update?: (changes: Record<string, unknown>) => Promise<unknown>;
    }
  ).update;
  if (typeof update !== "function") return;
  await update.call(actor, { "system.movement.posture": posture });
}

function activeCombatant(actor: object): CombatantLike | undefined {
  const id = actorId(actor);
  const uuid = actorUuid(actor);
  return activeCombat()?.combatants.contents.find(
    (combatant) =>
      combatant.actor === actor ||
      (combatant.actor != null &&
        uuid.length > 0 &&
        actorUuid(combatant.actor) === uuid) ||
      (combatant.actor == null && combatant.actorId === id),
  );
}

function isActionKind(value: unknown): value is D6CombatActionKind {
  return ["attribute", "attack", "move", "other", "skill"].includes(
    String(value),
  );
}

function isMovementMode(value: unknown): value is SecondEditionMovementMode {
  return ["hold", "walk", "run", "crawl", "stand"].includes(String(value));
}

function roundNumber(): number {
  const value = activeCombat()?.round;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function storedState(combatant: CombatantLike): D6CombatantRoundStateV1 {
  const source = combatant.getFlag(SYSTEM_ID, ROUND_ACTION_FLAG);
  if (
    typeof source !== "object" ||
    source === null ||
    (source as { readonly contractVersion?: unknown }).contractVersion !==
      D6_COMBAT_CONTRACT_VERSION ||
    (source as { readonly round?: unknown }).round !== roundNumber()
  ) {
    return createCombatantRoundState(roundNumber());
  }
  const candidate = source as {
    readonly actions?: unknown;
    readonly completedActionIds?: unknown;
    readonly revision?: unknown;
    readonly round: number;
  };
  const actions = Array.isArray(candidate.actions)
    ? candidate.actions.flatMap((action) => {
        if (typeof action !== "object" || action === null) return [];
        const value = action as Record<string, unknown>;
        if (
          typeof value.id !== "string" ||
          typeof value.label !== "string" ||
          !isActionKind(value.kind)
        ) {
          return [];
        }
        return [
          {
            id: value.id,
            kind: value.kind,
            label: value.label,
            ...(value.endProne === true ? { endProne: true } : {}),
            ...(value.kind === "move" && isMovementMode(value.movementMode)
              ? { movementMode: value.movementMode }
              : {}),
          },
        ];
      })
    : [];
  const actionIds = new Set(actions.map((action) => action.id));
  const completedActionIds = Array.isArray(candidate.completedActionIds)
    ? candidate.completedActionIds.filter(
        (id): id is string => typeof id === "string" && actionIds.has(id),
      )
    : [];
  return Object.freeze({
    actions: Object.freeze(actions),
    completedActionIds: Object.freeze(completedActionIds),
    contractVersion: D6_COMBAT_CONTRACT_VERSION,
    revision:
      Number.isInteger(candidate.revision) && Number(candidate.revision) >= 0
        ? Number(candidate.revision)
        : 0,
    round: candidate.round,
  });
}

function readModel(
  actor: object,
  combatant: CombatantLike,
  state = storedState(combatant),
): D6CombatantRoundReadModelV1 {
  const currentAction = currentCombatAction(state);
  return Object.freeze({
    ...state,
    active: true,
    actorId: actorId(actor),
    combatantId: combatant.id,
    complete: state.actions.length > 0 && currentAction === undefined,
    ...(currentAction === undefined ? {} : { currentAction }),
    currentSegment: Math.min(
      state.completedActionIds.length + 1,
      Math.max(state.actions.length, 1),
    ),
    penaltyLabel: combatRoundPenaltyLabel(state),
    penaltyScore: combatRoundPenaltyScore(state),
  });
}

function assertAuthorized(actor: object): void {
  if (!actorIsOwner(actor)) throw new Error("D6E2.Combat.Error.NotAuthorized");
}

function assertRevision(
  state: D6CombatantRoundStateV1,
  expectedRevision: number,
): void {
  if (state.revision !== expectedRevision) {
    throw new Error("D6E2.Combat.Error.RevisionConflict");
  }
}

async function persist(
  actor: object,
  combatant: CombatantLike,
  state: D6CombatantRoundStateV1,
): Promise<D6CombatCommandResultV1> {
  await combatant.update({
    [`flags.${SYSTEM_ID}.${ROUND_ACTION_FLAG}`]: state,
  });
  return Object.freeze({
    changed: true,
    state: readModel(actor, combatant, state),
  });
}

export function readCombatantRound(
  actor: object,
): D6CombatantRoundReadModelV1 | null {
  const combatant = activeCombatant(actor);
  return combatant ? readModel(actor, combatant) : null;
}

export async function declareCombatantActions(
  actor: object,
  declaration: D6CombatDeclarationV1,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, declaration.expectedRevision);
  const movement = declaration.actions.find(
    (action) => action.kind === "move" && action.movementMode !== undefined,
  );
  if (movement?.movementMode !== undefined) {
    secondEditionMovementPlan(
      movement.movementMode,
      actorPosture(actor),
      movement.endProne === true,
    );
  }
  const actions = declaration.actions.map((action, index) => ({
    id: `${current.round}-${current.revision + 1}-${index + 1}`,
    kind: action.kind,
    label: action.label.trim(),
    ...(action.endProne === true ? { endProne: true } : {}),
    ...(action.kind === "move" && action.movementMode !== undefined
      ? { movementMode: action.movementMode }
      : {}),
  }));
  return persist(actor, combatant, declareCombatActions(current, actions));
}

export async function completeNextCombatantAction(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  const currentAction = currentCombatAction(current);
  const movementPlan =
    currentAction?.kind === "move" && currentAction.movementMode !== undefined
      ? secondEditionMovementPlan(
          currentAction.movementMode,
          actorPosture(actor),
          currentAction.endProne === true,
        )
      : undefined;
  const next = completeNextCombatAction(current);
  if (next === current) {
    return Object.freeze({
      changed: false,
      state: readModel(actor, combatant),
    });
  }
  const result = await persist(actor, combatant, next);
  if (movementPlan) {
    await updateActorPosture(actor, movementPlan.postureAfter);
  }
  return result;
}

export async function resetCombatantActions(
  actor: object,
  expectedRevision: number,
): Promise<D6CombatCommandResultV1> {
  assertAuthorized(actor);
  const combatant = activeCombatant(actor);
  if (!combatant) throw new Error("D6E2.Combat.Error.NotInCombat");
  const current = storedState(combatant);
  assertRevision(current, expectedRevision);
  if (current.completedActionIds.length > 0 && game.user?.isGM !== true) {
    throw new Error("D6E2.Combat.Error.ResetRequiresGM");
  }
  const reset = {
    ...createCombatantRoundState(current.round),
    revision: current.revision + 1,
  };
  return persist(actor, combatant, reset);
}
