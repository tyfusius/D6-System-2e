import { SYSTEM_ID, SYSTEM_NAME } from "../constants";
import { observeThemeRegistry, themeRegistry } from "../registries/themes";
import {
  COMPATIBILITY_SETTING_KEYS,
  currentRulesProfile,
  OPEN_D6_MASTER_SETTING,
  registerRulesCompatibilitySettings,
} from "./rules-compatibility";
import { applyRulesProfilePresentation } from "./rules-profile-presentation";
import {
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_SETTINGS,
  SHARED_SETTING_KEYS,
  SHARED_SETTINGS,
  type SystemSettingDefinition,
} from "./settings-catalog";
import { stringSetting } from "./setting-values";
import {
  D6System2eFirstEditionSettings,
  D6System2eSecondEditionSettings,
} from "./settings-application";
import { synchronizeQuickbarVisibility } from "../foundry/quickbars";

const COMPATIBILITY_KEYS = new Set<string>([
  OPEN_D6_MASTER_SETTING,
  ...Object.values(COMPATIBILITY_SETTING_KEYS),
]);

const worldThemeChoices: Record<string, string> = {};
const userThemeChoices: Record<string, string> = {
  inherit: "D6E2.Settings.Theme.Inherit",
};

function refreshThemeChoices(): void {
  for (const key of Object.keys(worldThemeChoices)) {
    Reflect.deleteProperty(worldThemeChoices, key);
  }
  for (const key of Object.keys(userThemeChoices)) {
    if (key !== "inherit") Reflect.deleteProperty(userThemeChoices, key);
  }
  for (const theme of themeRegistry.current()) {
    worldThemeChoices[theme.id] = theme.label;
    userThemeChoices[theme.id] = theme.label;
  }
}

function typeConstructor(type: SystemSettingDefinition["type"]): unknown {
  if (type === "boolean") return Boolean;
  if (type === "number") return Number;
  return String;
}

export function applySelectedTheme(): void {
  if (typeof document === "undefined") return;
  const worldTheme = stringSetting(SHARED_SETTING_KEYS.worldTheme, "classic");
  const userTheme = stringSetting(SHARED_SETTING_KEYS.userTheme, "inherit");
  const requested = userTheme === "inherit" ? worldTheme : userTheme;
  const themes = themeRegistry.current();
  const selected =
    themes.find((theme) => theme.id === requested) ??
    themes.find((theme) => theme.id === "classic");
  if (!selected) return;
  const root = document.documentElement;
  for (const theme of themes) root.classList.remove(theme.cssClass);
  root.classList.add(selected.cssClass);
  root.dataset.d6System2eTheme = selected.id;
  root.style.setProperty("--od6-accent", selected.tokens.accent);
  root.style.setProperty("--od6-accent-bright", selected.tokens.accentBright);
  root.style.setProperty("--od6-bg", selected.tokens.background);
  root.style.setProperty("--od6-muted", selected.tokens.muted);
  root.style.setProperty("--od6-text", selected.tokens.text);
  applyRulesProfilePresentation(currentRulesProfile().id);
}

function registerDefinition(
  definition: SystemSettingDefinition,
  config: boolean,
): void {
  const choices =
    definition.key === SHARED_SETTING_KEYS.worldTheme
      ? worldThemeChoices
      : definition.key === SHARED_SETTING_KEYS.userTheme
        ? userThemeChoices
        : definition.choices;
  game.settings.register(SYSTEM_ID, definition.key, {
    ...(choices ? { choices } : {}),
    config,
    default: definition.default,
    hint: definition.hint,
    name: definition.name,
    ...((definition.key === SHARED_SETTING_KEYS.worldTheme ||
      definition.key === SHARED_SETTING_KEYS.userTheme) && {
      onChange: applySelectedTheme,
    }),
    ...((definition.key === SHARED_SETTING_KEYS.showPcQuickbar ||
      definition.key === SHARED_SETTING_KEYS.showActiveTasksQuickbar) && {
      onChange: synchronizeQuickbarVisibility,
    }),
    ...(definition.key === "secondEditionChasesModule" && {
      onChange: () => ui.controls?.render({ reset: true }),
    }),
    ...(definition.requiresReload === undefined
      ? {}
      : { requiresReload: definition.requiresReload }),
    scope: definition.scope,
    type: typeConstructor(definition.type),
  });
}

export function registerSystemSettings(): void {
  refreshThemeChoices();
  observeThemeRegistry(() => {
    refreshThemeChoices();
    applySelectedTheme();
  });
  registerRulesCompatibilitySettings(() => {
    applyRulesProfilePresentation(currentRulesProfile().id);
    (
      ui as typeof ui & {
        combat?: { render(options?: { force?: boolean }): unknown };
      }
    ).combat?.render({ force: true });
  });
  for (const definition of SHARED_SETTINGS) {
    registerDefinition(definition, true);
  }
  for (const definition of FIRST_EDITION_SETTINGS) {
    if (!COMPATIBILITY_KEYS.has(definition.key)) {
      registerDefinition(definition, true);
    }
  }
  for (const definition of SECOND_EDITION_SETTINGS) {
    registerDefinition(definition, true);
  }

  game.settings.registerMenu(SYSTEM_ID, "openD6FirstEdition", {
    hint: "D6E2.Settings.FirstEdition.Menu.Hint",
    icon: "fa-solid fa-dice-d6",
    label: "D6E2.Settings.Configure",
    name: "D6E2.Settings.FirstEdition.Menu.Name",
    restricted: true,
    type: D6System2eFirstEditionSettings,
  });
  game.settings.registerMenu(SYSTEM_ID, "d6SystemSecondEdition", {
    hint: "D6E2.Settings.SecondEdition.Menu.Hint",
    icon: "fa-solid fa-dice",
    label: "D6E2.Settings.Configure",
    name: "D6E2.Settings.SecondEdition.Menu.Name",
    restricted: true,
    type: D6System2eSecondEditionSettings,
  });
}

export function logSettingsProfile(): void {
  console.info(`${SYSTEM_NAME} | Settings profile ready`);
}
