import type { CoreHudGroup } from "./hud-core-port";

export const SECTION_IDS = Object.freeze({
  abilities: "abilities",
  round: "round",
  weapons: "weapons",
});

function group(id: string, name: string, nestId: string): CoreHudGroup {
  return { id, name, nestId, type: "system" };
}

export function defaultHudLayout(): {
  readonly groups: readonly CoreHudGroup[];
  readonly layout: readonly CoreHudGroup[];
} {
  const names = {
    abilities: game.i18n.localize("D6E2_TAH.CombatAbilities"),
    round: game.i18n.localize("D6E2_TAH.Combat"),
    weapons: game.i18n.localize("D6E2_TAH.Weapons"),
  };
  const ids = [SECTION_IDS.round, SECTION_IDS.weapons, SECTION_IDS.abilities];
  return Object.freeze({
    groups: Object.freeze(ids.map((id) => group(id, names[id], id))),
    layout: Object.freeze(
      ids.map((id) => ({
        groups: Object.freeze([group(id, names[id], `${id}_${id}`)]),
        id,
        name: names[id],
        nestId: id,
      })),
    ),
  });
}
