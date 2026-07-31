import {
  D6_COMBAT_CONTRACT_VERSION,
  type D6CombatantRoundStateV1,
  type D6DeclaredCombatActionV1,
  type D6FirstEditionActionCommitmentV1,
} from "../contracts/combat";
import { formatPipScore } from "./die-code";
import {
  multipleActionPenaltyScore,
  secondEditionMovementPlan,
  type SecondEditionMovementMode,
} from "./combat";
import {
  firstEditionActionCommitment,
  spendFirstEditionCommittedAction,
  type FirstEditionActionCommitment,
  type FirstEditionDefenseCommitment,
} from "./action-economy";

const MOVEMENT_MODES: readonly SecondEditionMovementMode[] = Object.freeze([
  "hold",
  "walk",
  "run",
  "crawl",
  "stand",
]);

export function createCombatantRoundState(
  round: number,
): D6CombatantRoundStateV1 {
  if (!Number.isInteger(round) || round < 0) {
    throw new RangeError("Combat round must be a non-negative integer.");
  }
  return Object.freeze({
    actions: Object.freeze([]),
    completedActionIds: Object.freeze([]),
    contractVersion: D6_COMBAT_CONTRACT_VERSION,
    revision: 0,
    round,
  });
}

export function declareCombatActions(
  state: D6CombatantRoundStateV1,
  actions: readonly D6DeclaredCombatActionV1[],
): D6CombatantRoundStateV1 {
  if (state.completedActionIds.length > 0) {
    throw new Error("D6E2.Combat.Error.DeclarationLocked");
  }
  if (actions.length < 1) {
    throw new Error("D6E2.Combat.Error.ActionRequired");
  }
  const ids = new Set<string>();
  let movementActions = 0;
  for (const action of actions) {
    if (action.kind === "move") movementActions += 1;
    if (
      !action.id ||
      !action.label.trim() ||
      ids.has(action.id) ||
      !["attribute", "attack", "move", "other", "skill"].includes(
        action.kind,
      ) ||
      (action.movementMode !== undefined &&
        (action.kind !== "move" ||
          !MOVEMENT_MODES.includes(action.movementMode))) ||
      (action.endProne !== undefined &&
        (action.kind !== "move" ||
          typeof action.endProne !== "boolean" ||
          (action.endProne &&
            action.movementMode !== "walk" &&
            action.movementMode !== "run")))
    ) {
      throw new Error("D6E2.Combat.Error.InvalidDeclaration");
    }
    ids.add(action.id);
  }
  if (movementActions > 1) {
    throw new Error("D6E2.Combat.Error.InvalidDeclaration");
  }
  return Object.freeze({
    actions: Object.freeze(
      actions.map((action) => Object.freeze({ ...action })),
    ),
    completedActionIds: Object.freeze([]),
    contractVersion: state.contractVersion,
    revision: state.revision + 1,
    round: state.round,
  });
}

export function commitFirstEditionActions(
  state: D6CombatantRoundStateV1,
  plannedActionCount: number,
  actionAllotment: number,
  defense: FirstEditionDefenseCommitment,
  spentActionCount: number,
): D6CombatantRoundStateV1 {
  const commitment = firstEditionActionCommitment(
    plannedActionCount,
    actionAllotment,
    defense,
    spentActionCount,
  );
  return Object.freeze({
    ...state,
    actions: Object.freeze([]),
    completedActionIds: Object.freeze([]),
    firstEditionCommitment: Object.freeze({
      actionAllotment: commitment.actionAllotment,
      defense: commitment.defense,
      plannedActionCount: commitment.plannedActionCount,
      spentActionCount: commitment.spentActionCount,
    }),
    revision: state.revision + 1,
  });
}

export function spendFirstEditionAction(
  state: D6CombatantRoundStateV1,
): D6CombatantRoundStateV1 {
  if (!state.firstEditionCommitment) {
    throw new Error("D6E2.Combat.Error.FirstEditionCommitmentRequired");
  }
  const current = firstEditionCommitmentFromState(state.firstEditionCommitment);
  const next = spendFirstEditionCommittedAction(current);
  return Object.freeze({
    ...state,
    firstEditionCommitment: Object.freeze({
      actionAllotment: next.actionAllotment,
      defense: next.defense,
      plannedActionCount: next.plannedActionCount,
      spentActionCount: next.spentActionCount,
    }),
    revision: state.revision + 1,
  });
}

export function firstEditionCommitmentFromState(
  commitment: D6FirstEditionActionCommitmentV1,
): FirstEditionActionCommitment {
  return firstEditionActionCommitment(
    commitment.plannedActionCount,
    commitment.actionAllotment,
    commitment.defense,
    commitment.spentActionCount,
  );
}

export function completeNextCombatAction(
  state: D6CombatantRoundStateV1,
): D6CombatantRoundStateV1 {
  const completed = new Set(state.completedActionIds);
  const next = state.actions.find((action) => !completed.has(action.id));
  if (!next) return state;
  return Object.freeze({
    ...state,
    completedActionIds: Object.freeze([...state.completedActionIds, next.id]),
    revision: state.revision + 1,
  });
}

export function currentCombatAction(
  state: D6CombatantRoundStateV1,
): D6DeclaredCombatActionV1 | undefined {
  const completed = new Set(state.completedActionIds);
  return state.actions.find((action) => !completed.has(action.id));
}

export function combatRoundPenaltyScore(
  state: D6CombatantRoundStateV1,
): number {
  return (
    combatRoundActionPenaltyScore(state) +
    combatRoundMovementSkillPenaltyScore(state)
  );
}

export function combatRoundActionPenaltyScore(
  state: D6CombatantRoundStateV1,
): number {
  return state.actions.length > 0
    ? multipleActionPenaltyScore(state.actions.length)
    : 0;
}

export function combatRoundMovementSkillPenaltyScore(
  state: D6CombatantRoundStateV1,
): number {
  return state.actions.reduce(
    (highest, action) =>
      action.movementMode === undefined
        ? highest
        : Math.max(
            highest,
            secondEditionMovementPlan(
              action.movementMode,
              action.movementMode === "crawl" || action.movementMode === "stand"
                ? "prone"
                : "standing",
            ).skillPenaltyScore,
          ),
    0,
  );
}

export function combatRoundPenaltyLabel(
  state: D6CombatantRoundStateV1,
): string {
  const penalty = combatRoundPenaltyScore(state);
  return penalty === 0 ? "0D" : `−${formatPipScore(penalty)}`;
}
