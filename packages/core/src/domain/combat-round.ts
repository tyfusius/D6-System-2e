import {
  D6_COMBAT_CONTRACT_VERSION,
  type D6CombatantRoundStateV1,
  type D6DeclaredCombatActionV1,
  type D6FirstEditionActiveDefenseV1,
  type D6FirstEditionActionCommitmentV1,
  type D6SecondEditionFeintV1,
  type D6SecondEditionFullDefenseV1,
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

export function recordFirstEditionActiveDefense(
  state: D6CombatantRoundStateV1,
  defense: D6FirstEditionActiveDefenseV1,
  consumeAction: boolean,
): D6CombatantRoundStateV1 {
  const commitment = state.firstEditionCommitment
    ? firstEditionCommitmentFromState(state.firstEditionCommitment)
    : undefined;
  if (!commitment || commitment.defense === "none") {
    throw new RangeError("A First Edition defense commitment is required.");
  }
  const expectedMode =
    commitment.defense === "full-defense" ? "full" : "partial";
  if (defense.mode !== expectedMode) {
    throw new RangeError(
      "The active-defense mode does not match its commitment.",
    );
  }
  if (!Number.isSafeInteger(defense.total) || defense.total < 0) {
    throw new RangeError("An active-defense total must be non-negative.");
  }
  const nextCommitment = consumeAction
    ? spendFirstEditionCommittedAction(commitment)
    : commitment;
  const nextAction = consumeAction
    ? state.actions[nextCommitment.spentActionCount - 1]
    : undefined;
  return Object.freeze({
    ...state,
    completedActionIds:
      nextAction === undefined
        ? state.completedActionIds
        : Object.freeze([...state.completedActionIds, nextAction.id]),
    firstEditionActiveDefense: Object.freeze({ ...defense }),
    firstEditionCommitment: Object.freeze({
      actionAllotment: nextCommitment.actionAllotment,
      defense: nextCommitment.defense,
      plannedActionCount: nextCommitment.plannedActionCount,
      spentActionCount: nextCommitment.spentActionCount,
    }),
    revision: state.revision + 1,
  });
}

export function declareCombatActions(
  state: D6CombatantRoundStateV1,
  actions: readonly D6DeclaredCombatActionV1[],
): D6CombatantRoundStateV1 {
  if (state.completedActionIds.length > 0 || state.actionForfeiture) {
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

export function forfeitRemainingCombatActions(
  state: D6CombatantRoundStateV1,
): D6CombatantRoundStateV1 {
  if (state.actionForfeiture) return state;
  return Object.freeze({
    ...state,
    actionForfeiture: Object.freeze({
      reason: "wounded" as const,
      sourcePage: 33 as const,
    }),
    revision: state.revision + 1,
  });
}

export function enterSecondEditionFullDefense(
  state: D6CombatantRoundStateV1,
  defense: D6SecondEditionFullDefenseV1,
): D6CombatantRoundStateV1 {
  if (state.completedActionIds.length > 0 || state.actions.length > 0) {
    throw new Error("D6E2.Combat.ActiveResponsive.FullDefenseFirst");
  }
  const action = Object.freeze({
    id: `${state.round}-${state.revision + 1}-full-defense`,
    kind: "other" as const,
    label: "Full Defense",
  });
  return Object.freeze({
    ...state,
    actions: Object.freeze([action]),
    completedActionIds: Object.freeze([action.id]),
    secondEditionFullDefense: Object.freeze({ ...defense }),
    revision: state.revision + 1,
  });
}

export function recordSecondEditionFeint(
  state: D6CombatantRoundStateV1,
  feint: D6SecondEditionFeintV1,
  consumeAction = true,
): D6CombatantRoundStateV1 {
  if (state.actionForfeiture) {
    throw new Error("D6E2.Combat.Error.ActionsForfeitedByWound");
  }
  const action =
    consumeAction && state.actions.length === 0
      ? Object.freeze({
          id: `${state.round}-${state.revision + 1}-feint`,
          kind: "skill" as const,
          label: "Feint",
        })
      : undefined;
  return Object.freeze({
    ...state,
    ...(action === undefined
      ? {}
      : {
          actions: Object.freeze([action]),
          completedActionIds: Object.freeze([action.id]),
        }),
    secondEditionFeint: Object.freeze({ ...feint }),
    revision: state.revision + 1,
  });
}

export function clearSecondEditionFeint(
  state: D6CombatantRoundStateV1,
): D6CombatantRoundStateV1 {
  if (!state.secondEditionFeint) return state;
  const next = { ...state };
  delete next.secondEditionFeint;
  return Object.freeze({ ...next, revision: state.revision + 1 });
}

export function commitFirstEditionActions(
  state: D6CombatantRoundStateV1,
  plannedActionCount: number,
  actionAllotment: number,
  defense: FirstEditionDefenseCommitment,
  spentActionCount: number,
  queuedActions?: readonly D6DeclaredCombatActionV1[],
): D6CombatantRoundStateV1 {
  const commitment = firstEditionActionCommitment(
    plannedActionCount,
    actionAllotment,
    defense,
    spentActionCount,
  );
  const actions = Object.freeze(
    (
      queuedActions ??
      Array.from({ length: plannedActionCount }, (_, index) => ({
        id: `${state.round}-${state.revision + 1}-first-edition-${index + 1}`,
        kind: "other" as const,
        label: `Action ${index + 1}`,
      }))
    ).map((action) => Object.freeze({ ...action })),
  );
  if (
    actions.length !== plannedActionCount ||
    actions.some(
      (action) =>
        !action.id ||
        !action.label.trim() ||
        !["attribute", "attack", "move", "other", "skill"].includes(
          action.kind,
        ),
    )
  ) {
    throw new Error("D6E2.Combat.Error.InvalidDeclaration");
  }
  return Object.freeze({
    actions,
    completedActionIds: Object.freeze(
      actions.slice(0, spentActionCount).map((action) => action.id),
    ),
    contractVersion: state.contractVersion,
    firstEditionCommitment: Object.freeze({
      actionAllotment: commitment.actionAllotment,
      defense: commitment.defense,
      plannedActionCount: commitment.plannedActionCount,
      spentActionCount: commitment.spentActionCount,
    }),
    revision: state.revision + 1,
    round: state.round,
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
  const completedAction = state.actions[next.spentActionCount - 1];
  return Object.freeze({
    ...state,
    completedActionIds:
      completedAction === undefined ||
      state.completedActionIds.includes(completedAction.id)
        ? state.completedActionIds
        : Object.freeze([...state.completedActionIds, completedAction.id]),
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
  if (state.actionForfeiture) return state;
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
  if (state.actionForfeiture) return undefined;
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
