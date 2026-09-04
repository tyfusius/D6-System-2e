export const MODULE_ID = "token-action-hud-d6-system-2e";
export const ACTION_SCOPE_SETTING = "actionScope";
export const TOKEN_ANCHOR_SETTING = "anchorToToken";
export const LAYOUT_SCHEMA_SETTING = "layoutSchemaVersion";
export const LAYOUT_SCHEMA_VERSION = 1;

export function actionScope(): "all-rollable" | "combat" {
  return game.settings.get(MODULE_ID, ACTION_SCOPE_SETTING) === "all-rollable"
    ? "all-rollable"
    : "combat";
}

export function tokenAnchorEnabled(): boolean {
  return game.settings.get(MODULE_ID, TOKEN_ANCHOR_SETTING) !== false;
}

export function registerHudSettings(): void {
  game.settings.register(MODULE_ID, LAYOUT_SCHEMA_SETTING, {
    config: false,
    default: 0,
    hint: "",
    name: "D6 combat HUD layout schema",
    scope: "client",
    type: Number,
  });
  game.settings.register(MODULE_ID, ACTION_SCOPE_SETTING, {
    choices: {
      combat: game.i18n.localize("D6E2_TAH.Settings.ActionScope.Combat"),
      "all-rollable": game.i18n.localize(
        "D6E2_TAH.Settings.ActionScope.AllRollable",
      ),
    },
    config: true,
    default: "combat",
    hint: game.i18n.localize("D6E2_TAH.Settings.ActionScope.Hint"),
    name: game.i18n.localize("D6E2_TAH.Settings.ActionScope.Name"),
    onChange: () => Hooks.callAll?.("forceUpdateTokenActionHud"),
    scope: "client",
    type: String,
  });
  game.settings.register(MODULE_ID, TOKEN_ANCHOR_SETTING, {
    config: true,
    default: true,
    hint: game.i18n.localize("D6E2_TAH.Settings.AnchorToToken.Hint"),
    name: game.i18n.localize("D6E2_TAH.Settings.AnchorToToken.Name"),
    onChange: () => Hooks.callAll?.("d6e2RefreshTokenActionHudAnchor"),
    scope: "client",
    type: Boolean,
  });
}
