import {
  formatPipScore,
  type D6CombatGridProjectionV1,
} from "@d6-system-2e/core";

/** Presentation is an allowlist over the already authorized projection. */
export function combatRoundGridView(
  grid: D6CombatGridProjectionV1,
  localize: (key: string) => string,
  format: (key: string, data: Record<string, string | number>) => string,
) {
  const text = (key: string) => localize(`D6E2.Combat.RoundGrid.${key}`);
  const icons: Readonly<Record<string, string>> = {
    attack: "fa-solid fa-bullseye",
    attribute: "fa-solid fa-user",
    skill: "fa-solid fa-dice",
    move: "fa-solid fa-person-walking",
    other: "fa-solid fa-circle",
  };
  return {
    round: grid.round,
    currentSegment: grid.currentSegment,
    complete: grid.complete,
    waiting: grid.waiting,
    columns: grid.columns.map((segment) => ({
      segment,
      label: format("D6E2.Combat.RoundGrid.segment", { segment }),
      current: segment === grid.currentSegment,
    })),
    rows: grid.rows.map((row) => ({
      id: row.id,
      label: row.label,
      img: row.img,
      initiativeLabel:
        row.initiative === undefined
          ? undefined
          : row.initiative === null
            ? "—"
            : String(row.initiative),
      actionCountLabel:
        row.actionCount === undefined
          ? undefined
          : format("D6E2.Combat.RoundGrid.actions", { count: row.actionCount }),
      mapLabel:
        row.penaltyScore === undefined
          ? undefined
          : row.penaltyScore
            ? `−${formatPipScore(row.penaltyScore)}`
            : "0D",
      declared: row.declared,
      canManage: row.canManage,
      cells: row.cells.map((cell) => ({
        segment: cell.segment,
        label:
          cell.label ??
          text(cell.status === "redacted" ? "hiddenDeclaration" : "noAction"),
        status: cell.status,
        statusLabel: text(cell.status),
        iconClass: cell.kind
          ? (icons[cell.kind] ?? icons.other)
          : "fa-solid fa-minus",
        active: cell.active,
        empty: cell.status === "empty",
        redacted: cell.status === "redacted",
        heldAnnotation: cell.status === "held",
        earlyReaction: cell.earlyReaction,
        reactionLabel: cell.earlyReaction ? text("earlyReaction") : undefined,
        canComplete: cell.canComplete,
        canAnnotateHold: cell.canAnnotateHold,
        canClearHold: cell.canClearHold,
        canCancel: cell.canCancel,
      })),
    })),
  };
}
