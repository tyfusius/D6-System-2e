import { describe, expect, it } from "vitest";
import { projectCombatRoundGrid } from "./combat-grid";
import {
  annotateFirstEditionNextAction,
  commitFirstEditionActions,
  createCombatantRoundState,
  normalizeCombatActionAnnotations,
  recordFirstEditionActiveDefense,
  recordFirstEditionSegmentMovement,
  spendFirstEditionAction,
} from "./combat-round";
import type { D6CombatGridParticipantV1 } from "../contracts/combat-grid";
const queue = (count: number) =>
  commitFirstEditionActions(
    createCombatantRoundState(1),
    count,
    1,
    "partial-defense",
    0,
    Array.from({ length: count }, (_, i) => ({
      id: `a${i}`,
      kind: "other",
      label: i === 0 ? "Move and shoot" : `Action ${i}`,
    })),
  );
const row = (id: string, count: number): D6CombatGridParticipantV1 => ({
  id,
  label: id,
  initiative: 12,
  visible: true,
  canRead: true,
  canManage: true,
  defeated: false,
  state: queue(count),
});
describe("segmented round grid and exact queued outcomes", () => {
  it("uses independent counts/MAP, a single combined cell, and no grants in shorter rows", () => {
    const grid = projectCombatRoundGrid(
      [row("long", 5), row("short", 2)],
      1,
      true,
    );
    expect(grid.columns).toEqual([1, 2, 3, 4, 5]);
    expect(grid.rows.map((r) => [r.actionCount, r.penaltyScore])).toEqual([
      [5, 12],
      [2, 3],
    ]);
    expect(grid.rows[0]?.cells[0]).toMatchObject({
      label: "Move and shoot",
      active: true,
    });
    expect(
      grid.rows[1]?.cells
        .slice(2)
        .every((c) => c.status === "empty" && !c.canComplete),
    ).toBe(true);
    expect(grid.declarationOrder).toEqual(["short", "long"]);
  });
  it("conceals row presence, labels, ids and queue dimensions in actual projections", () => {
    const secret = {
      ...row("SECRET_ACTOR", 30),
      visible: false,
      canRead: false,
    };
    const concealed = {
      ...row("visible-name", 25),
      canRead: false,
      canManage: false,
    };
    const a = projectCombatRoundGrid(
      [row("own", 2), secret, concealed],
      1,
      false,
    );
    const b = projectCombatRoundGrid(
      [
        row("own", 2),
        { ...secret, state: queue(3) },
        { ...concealed, state: queue(4) },
      ],
      1,
      false,
    );
    expect(a.columns).toEqual([1, 2]);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain("SECRET_ACTOR");
    expect(a.rows[1]).toEqual({
      id: "visible-name",
      label: "visible-name",
      canManage: false,
      cells: [1, 2].map((segment) => ({
        segment,
        status: "redacted",
        active: false,
        earlyReaction: false,
        canComplete: false,
        canAnnotateHold: false,
        canClearHold: false,
        canCancel: false,
      })),
    });
  });
  it("retains count/MAP when GM annotates or cancels exactly the next identity", () => {
    const original = queue(3);
    const held = annotateFirstEditionNextAction(original, "a0", true);
    expect(held.firstEditionCommitment).toEqual(
      original.firstEditionCommitment,
    );
    const canceled = spendFirstEditionAction(held, "gm-canceled");
    expect(canceled.firstEditionCommitment).toMatchObject({
      plannedActionCount: 3,
      spentActionCount: 1,
    });
    expect(canceled.actionAnnotations).toEqual({
      version: 1,
      outcomes: { a0: { status: "canceled", reason: "gm-canceled" } },
    });
    expect(() =>
      annotateFirstEditionNextAction(canceled, "a0", true),
    ).toThrow();
    const grid = projectCombatRoundGrid(
      [{ ...row("a", 3), state: canceled }],
      1,
      true,
    );
    expect(grid.rows[0]?.cells.map((c) => c.status)).toEqual([
      "canceled",
      "pending",
      "pending",
    ]);
    expect(grid.rows[0]?.penaltyScore).toBe(6);
  });
  it("shows early defense in the already-spent slot and running prevention separately", () => {
    const defense = recordFirstEditionActiveDefense(
      queue(3),
      {
        difficulty: 10,
        kind: "dodge",
        label: "Dodge",
        mode: "partial",
        sourceId: "dodge",
        total: 14,
      },
      true,
    );
    expect(
      projectCombatRoundGrid([{ ...row("a", 3), state: defense }], 1, true)
        .rows[0]?.cells[0],
    ).toMatchObject({ status: "completed", earlyReaction: true });
    const running = recordFirstEditionSegmentMovement(queue(3), {
      complication: true,
      distance: 0,
      normalDistance: 3,
    });
    expect(
      projectCombatRoundGrid(
        [{ ...row("a", 3), state: running }],
        1,
        true,
      ).rows[0]?.cells.map((c) => c.status),
    ).toEqual(["completed", "prevented", "prevented"]);
  });
  it("upgrades absent metadata idempotently, rejects unknown versions and clears round projections", () => {
    const upgraded = normalizeCombatActionAnnotations(undefined, ["a0"]);
    expect(normalizeCombatActionAnnotations(upgraded, ["a0"])).toEqual(
      upgraded,
    );
    expect(() =>
      normalizeCombatActionAnnotations({ version: 2, outcomes: {} }, ["a0"]),
    ).toThrow();
    expect(() =>
      normalizeCombatActionAnnotations(
        { version: 1, outcomes: { other: { status: "canceled" } } },
        ["a0"],
      ),
    ).toThrow();
    expect(projectCombatRoundGrid([row("a", 4)], 2, true)).toMatchObject({
      round: 2,
      columns: [],
      waiting: true,
    });
  });
});
