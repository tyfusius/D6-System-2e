import {
  projectCombatRoundGrid,
  type D6CombatGridProjectionV1,
  type D6CombatantRoundReadModelV1,
  type D6FirstEditionActionDeclarationV1,
  type D6FirstEditionActiveDefenseResultV1,
} from "@d6-system-2e/core";
import {
  annotateCombatantNextAction,
  commitFirstEditionCombatantActions,
  readCombatantRound,
  recordFirstEditionCombatantDefense,
  recordFirstEditionCombatantSegmentMovement,
  resetCombatantActions,
  spendFirstEditionCombatantAction,
  storedState,
} from "./combat-service";
import {
  activeGridCombat,
  PRIVATE_COMBAT_AUTHORITY,
  registerPrivateCombat,
  type PrivateCombatCommand,
} from "./combat-round-private";

export function projectCurrentCombatGrid(
  user: FoundryUser,
): D6CombatGridProjectionV1 {
  const combat = activeGridCombat();
  const ordered = combat?.turns ?? combat?.combatants.contents ?? [];
  return projectCombatRoundGrid(
    ordered
      .filter((c) => c.actor)
      .map((c) => {
        const owner = Boolean(c.actor?.testUserPermission(user, "OWNER"));
        const visible = user.isGM || !c.hidden || owner;
        return {
          id: c.id,
          label: c.name ?? c.actor?.name ?? "",
          ...(c.img ? { img: c.img } : {}),
          initiative: c.initiative ?? null,
          visible,
          canRead: visible,
          canManage: user.isGM || owner,
          defeated: c.defeated === true,
          state: storedState(c),
        };
      }),
    combat?.round ?? 0,
    user.isGM,
  );
}
function ownedProjection(
  user: FoundryUser,
  grid: D6CombatGridProjectionV1,
): Readonly<Record<string, D6CombatantRoundReadModelV1>> {
  const result: Record<string, D6CombatantRoundReadModelV1> = {};
  const active = grid.rows.find((row) => row.cells.some((cell) => cell.active));
  for (const c of activeGridCombat()?.combatants.contents ?? []) {
    if (!c.actor || !(user.isGM || c.actor.testUserPermission(user, "OWNER")))
      continue;
    const state = readCombatantRound(c.actor, c.id);
    if (!state) continue;
    // Existing read model contains global queue labels. Replace that entire
    // projection with viewer-safe metadata before transport, never after DOM.
    const {
      firstEditionNextCombatantId: _next,
      firstEditionNextLabel: _label,
      firstEditionSegmentWaitingLabels: _waiting,
      ...own
    } = state;
    void _next;
    void _label;
    void _waiting;
    result[c.id] = {
      ...own,
      firstEditionCurrentSegment: grid.currentSegment,
      firstEditionSegmentComplete: grid.complete,
      firstEditionSegmentReady: Boolean(active),
      firstEditionSegmentWaitingLabels: [],
      ...(active
        ? {
            firstEditionNextCombatantId: active.id,
            firstEditionNextLabel: active.label,
          }
        : {}),
    };
  }
  return result;
}
export async function executePrivateCombatCommand(
  command: PrivateCombatCommand,
  user: FoundryUser,
) {
  const actor = activeGridCombat()?.combatants.contents.find(
    (c) => c.id === command.combatantId && c.actor?.id === command.actorId,
  )?.actor;
  if (!actor || !(user.isGM || actor.testUserPermission(user, "OWNER")))
    throw new Error("D6E2.Combat.RoundGrid.notAuthorized");
  const current = readCombatantRound(actor, command.combatantId);
  if (current?.revision !== command.revision)
    throw new Error("D6E2.Combat.RoundGrid.staleState");
  if (!user.isGM) {
    if (["hold", "clear-hold", "cancel"].includes(command.kind))
      throw new Error("D6E2.Combat.RoundGrid.notAuthorized");
    if (
      (command.kind === "declare" || command.kind === "reset") &&
      (current.firstEditionCommitment?.spentActionCount ?? 0) > 0
    )
      throw new Error("D6E2.Combat.Error.DeclarationLocked");
    if (command.kind === "defense" && current.firstEditionActiveDefense)
      throw new Error("D6E2.Combat.Error.FirstEditionDefenseLocked");
  }
  switch (command.kind) {
    case "declare":
      return commitFirstEditionCombatantActions(
        actor,
        {
          ...(command.data as D6FirstEditionActionDeclarationV1),
          expectedRevision: command.revision,
        },
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
    case "spend":
      return spendFirstEditionCombatantAction(
        actor,
        command.revision,
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
    case "defense":
      return recordFirstEditionCombatantDefense(
        actor,
        {
          ...(command.data as D6FirstEditionActiveDefenseResultV1),
          expectedRevision: command.revision,
        },
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
    case "movement":
      return recordFirstEditionCombatantSegmentMovement(
        actor,
        command.revision,
        command.data as Parameters<
          typeof recordFirstEditionCombatantSegmentMovement
        >[2],
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
    case "reset":
      return resetCombatantActions(
        actor,
        command.revision,
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
    default:
      return annotateCombatantNextAction(
        actor,
        command.revision,
        (command.data as { actionId: string }).actionId,
        command.kind,
        PRIVATE_COMBAT_AUTHORITY,
        command.combatantId,
      );
  }
}
export function registerCombatRoundGridService(): void {
  registerPrivateCombat(executePrivateCombatCommand, (user) => {
    const grid = projectCurrentCombatGrid(user);
    return { grid, owned: ownedProjection(user, grid) };
  });
}
