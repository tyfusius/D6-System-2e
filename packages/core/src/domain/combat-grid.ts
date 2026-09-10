import type {
  D6CombatGridParticipantV1,
  D6CombatGridProjectionV1,
  D6CombatGridCellV1,
} from "../contracts/combat-grid";
import { firstEditionSegmentPlan } from "./first-edition-action-segments";
import { firstEditionCommitmentFromState } from "./combat-round";

/** Input is already in the encounter's committed initiative order. Secret
 * queues influence authority, never the viewer's row shape or dimensions. */
export function projectCombatRoundGrid(
  participants: readonly D6CombatGridParticipantV1[],
  round: number,
  isGM: boolean,
): D6CombatGridProjectionV1 {
  const current = participants.map((p) => ({
    ...p,
    state:
      p.state.round === round
        ? p.state
        : {
            ...p.state,
            actions: [],
            completedActionIds: [],
            firstEditionCommitment: undefined,
            actionAnnotations: undefined,
          },
  }));
  const plan = firstEditionSegmentPlan(
    current
      .filter((p) => !p.defeated)
      .map((p) => ({
        combatantId: p.id,
        label: p.label,
        declared: Boolean(p.state.firstEditionCommitment),
        actionCount: p.state.firstEditionCommitment?.plannedActionCount ?? 0,
        spentActionCount: p.state.firstEditionCommitment?.spentActionCount ?? 0,
      })),
  );
  const visible = current.filter((p) => p.visible);
  const maximum = visible.reduce(
    (n, p) =>
      p.canRead
        ? Math.max(n, p.state.firstEditionCommitment?.plannedActionCount ?? 0)
        : n,
    0,
  );
  const columns = Array.from({ length: maximum }, (_, i) => i + 1);
  const rows = visible.map((p) => {
    const commitment = p.state.firstEditionCommitment;
    const canManage = p.canRead && p.canManage && !p.defeated;
    const cells = columns.map((segment): D6CombatGridCellV1 => {
      const neutral = {
        segment,
        active: false,
        earlyReaction: false,
        canComplete: false,
        canAnnotateHold: false,
        canClearHold: false,
        canCancel: false,
      };
      if (!p.canRead) return { ...neutral, status: "redacted" };
      const action = p.state.actions[segment - 1];
      if (!commitment || segment > commitment.plannedActionCount || !action)
        return { ...neutral, status: "empty" };
      const outcome = p.state.actionAnnotations?.outcomes[action.id];
      const spent = segment <= commitment.spentActionCount;
      const held =
        !spent && p.state.actionAnnotations?.heldActionId === action.id;
      const active =
        !p.defeated &&
        plan.ready &&
        plan.nextCombatantId === p.id &&
        plan.currentSegment === segment;
      return {
        ...neutral,
        id: action.id,
        label: action.label,
        kind: action.kind,
        status:
          outcome?.status ??
          (spent
            ? "completed"
            : p.defeated
              ? "prevented"
              : held
                ? "held"
                : "pending"),
        active,
        earlyReaction:
          outcome?.reason === "defense" ||
          outcome?.reason === "reactive-movement",
        canComplete: active && canManage,
        canAnnotateHold: active && canManage && isGM && !held,
        canClearHold: active && canManage && isGM && held,
        canCancel: active && canManage && isGM,
      };
    });
    return {
      id: p.id,
      label: p.label,
      canManage,
      cells,
      ...(p.canRead
        ? {
            img: p.img,
            initiative: p.initiative,
            declared: Boolean(commitment),
            actionCount: commitment?.plannedActionCount ?? 0,
            penaltyScore: commitment
              ? firstEditionCommitmentFromState(commitment).penaltyScore
              : 0,
            revision: p.state.revision,
          }
        : {}),
    };
  });
  const visibleActive = rows.some((row) =>
    row.cells.some((cell) => cell.active),
  );
  const visibleComplete = rows
    .filter((row) => row.declared !== undefined)
    .every(
      (row) =>
        row.declared &&
        row.cells.every((cell) =>
          ["completed", "canceled", "prevented", "empty"].includes(cell.status),
        ),
    );
  return Object.freeze({
    version: 1,
    round,
    columns,
    rows,
    currentSegment: visibleActive ? plan.currentSegment : 0,
    complete: isGM ? plan.complete : visibleComplete,
    waiting: !visibleActive && !(isGM ? plan.complete : visibleComplete),
    declarationOrder: [...rows].reverse().map((row) => row.id),
  });
}
