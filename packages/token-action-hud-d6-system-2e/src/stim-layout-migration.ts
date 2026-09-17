import type { CoreGroupPort, CoreSavedGroup } from "./hud-core-port";
import { MODULE_ID, STIM_LAYOUT_SETTING } from "./settings";

/** Add to the saved user layout once without resetting custom or hidden groups. */
export async function migrateStimHudLayout(
  handler?: CoreGroupPort,
): Promise<void> {
  if (
    !handler ||
    game.settings.get(MODULE_ID, STIM_LAYOUT_SETTING) === true ||
    game.settings.get("token-action-hud-core", "enableCustomization") ===
      false ||
    !handler.dataHandler.canGetData ||
    !handler.dataHandler.canSaveData ||
    !game.user?.id
  )
    return;
  const saved = handler.userGroups;
  if (Object.values(saved).some((group) => group.id === "stims")) {
    await game.settings.set(MODULE_ID, STIM_LAYOUT_SETTING, true);
    return;
  }
  const top = Object.values(saved)
    .filter((group) => group.level === 1)
    .sort((a, b) => a.order - b.order);
  const weaponIndex = top.findIndex((group) => group.id === "weapons");
  const previous = weaponIndex >= 0 ? top[weaponIndex] : top.at(-1);
  const next = weaponIndex >= 0 ? top[weaponIndex + 1] : undefined;
  const order =
    next && previous
      ? (previous.order + next.order) / 2
      : (previous?.order ?? -1) + 1;
  const name = game.i18n.localize("D6E2_TAH.Stims");
  const group: CoreSavedGroup = {
    id: "stims",
    nestId: "stims",
    name,
    level: 1,
    order,
    selected: true,
    type: "system",
  };
  const child: CoreSavedGroup = {
    ...group,
    nestId: "stims_stims",
    level: 2,
    order: 0,
  };
  const updated = { ...saved, stims: group, stims_stims: child };
  // Save the full original user data, including descendants of hidden groups.
  await handler.dataHandler.saveDataAsGm("user", game.user.id, updated);
  handler.userGroups = updated;
  const runtimeGroup = handler.createGroup(group);
  handler.groups.stims = runtimeGroup;
  handler.addGroup(
    { id: "stims", name, type: "system", order: 0 },
    { nestId: "stims" },
  );
  const visible = handler.hudManager.hud.groups;
  const insertion = visible.findIndex((entry) => entry.order > order);
  visible.splice(insertion < 0 ? visible.length : insertion, 0, runtimeGroup);
  await game.settings.set(MODULE_ID, STIM_LAYOUT_SETTING, true);
}
