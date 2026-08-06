import type { HudDefaults, HudGroup } from "./core-contract";

export const HUD_GROUP_IDS = Object.freeze({
  attributes: "attributes",
  combat: "combat",
  features: "features",
  skills: "skills",
  weapons: "weapons",
});

function label(key: string): string {
  return game.i18n.localize(key);
}

function systemGroup(id: string, name: string, nestId: string): HudGroup {
  return { id, name, nestId, type: "system" };
}

export function createD6System2eDefaults(): HudDefaults {
  const labels = {
    attributes: label("D6E2_TAH.Attributes"),
    combat: label("D6E2_TAH.Combat"),
    features: label("D6E2_TAH.Features"),
    skills: label("D6E2_TAH.Skills"),
    weapons: label("D6E2_TAH.Weapons"),
  };
  const order = [
    HUD_GROUP_IDS.combat,
    HUD_GROUP_IDS.attributes,
    HUD_GROUP_IDS.skills,
    HUD_GROUP_IDS.weapons,
    HUD_GROUP_IDS.features,
  ] as const;

  return Object.freeze({
    groups: Object.freeze(order.map((id) => systemGroup(id, labels[id], id))),
    layout: Object.freeze(
      order.map((id) => ({
        groups: Object.freeze([systemGroup(id, labels[id], `${id}_${id}`)]),
        id,
        name: labels[id],
        nestId: id,
      })),
    ),
  });
}
