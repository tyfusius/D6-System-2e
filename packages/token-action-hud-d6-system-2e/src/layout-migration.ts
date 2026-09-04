import {
  LAYOUT_SCHEMA_SETTING,
  LAYOUT_SCHEMA_VERSION,
  MODULE_ID,
} from "./settings";

interface RuntimeHud {
  resetUserData(): Promise<void>;
}

interface RuntimeGame {
  readonly tokenActionHud?: RuntimeHud;
}

export function layoutMigrationRequired(value: unknown): boolean {
  return typeof value !== "number" || value < LAYOUT_SCHEMA_VERSION;
}

export async function migrateLegacyHudLayout(): Promise<void> {
  const storedVersion = game.settings.get(MODULE_ID, LAYOUT_SCHEMA_SETTING);
  if (!layoutMigrationRequired(storedVersion)) return;

  const hud = (game as unknown as RuntimeGame).tokenActionHud;
  if (!hud?.resetUserData) {
    console.warn(
      "Token Action HUD D6 System Second Edition | Layout migration deferred; HUD Core is not ready",
    );
    return;
  }

  await hud.resetUserData();
  await game.settings.set(
    MODULE_ID,
    LAYOUT_SCHEMA_SETTING,
    LAYOUT_SCHEMA_VERSION,
  );
  Hooks.callAll?.("forceUpdateTokenActionHud");
  console.info(
    "Token Action HUD D6 System Second Edition | Migrated legacy layout to the combat HUD",
  );
}
