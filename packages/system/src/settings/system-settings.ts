import type { D6SettingProfileV3 } from "@d6-system-2e/core";
import { SYSTEM_ID, SYSTEM_NAME } from "../constants";
import {
  observeThemeRegistry,
  themeRegistry,
  themeWildDieChatProperties,
} from "../registries/themes";
import { applyRulesProfilePresentation } from "./rules-profile-presentation";
import {
  FIRST_EDITION_OPTION_KEYS,
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_SETTINGS,
  SHARED_SETTING_KEYS,
  SHARED_SETTINGS,
  TYFUSIUS_HOMEBREW_SETTING_KEYS,
  TYFUSIUS_HOMEBREW_SETTINGS,
  type SystemSettingDefinition,
} from "./settings-catalog";
import { stringSetting } from "./setting-values";
import { registerGameSettingsRootEnhancement } from "./game-settings-root";
import { resolvePauseIcon, resolveSelectedTheme } from "./presentation-theme";
import {
  D6System2eFirstEditionSettings,
  D6System2eSecondEditionSettings,
} from "./settings-application";
import { synchronizeQuickbarAvailability } from "../foundry/quickbars";
import { observeCampaignPackageRegistry } from "../registries/campaign-packages";
import { observeContentPackageRegistry } from "../registries/content-packages";
import { registerCampaignPackageSettings } from "./campaign-packages";
import { WORLD_TERMINOLOGY_SETTING } from "./terminology-overrides";
import { refreshRenderedDocumentSheets } from "./rendered-document-sheets";
import {
  currentSettingProfile,
  ensureWorldSettingProfilesStored,
  migrateLegacyWorldTerminologyOverrides,
  WORLD_SETTING_PROFILES_SETTING,
} from "./setting-profile";
import {
  setRulesProfileTerminology,
  setSettingProfileTerminology,
  setWorldTerminologyOverrides,
} from "../registries/terminology";
import {
  currentConfiguredRulesProfile,
  currentRulesProfileTerminology,
  ensureWorldRulesProfilesStored,
  WORLD_RULES_PROFILES_SETTING,
} from "./rules-profile-library";

const userThemeChoices: Record<string, string> = {
  inherit: "D6E2.Settings.Theme.Inherit",
};

function refreshThemeChoices(): void {
  for (const key of Object.keys(userThemeChoices)) {
    if (key !== "inherit") Reflect.deleteProperty(userThemeChoices, key);
  }
  for (const theme of themeRegistry.current()) {
    userThemeChoices[theme.id] = theme.label;
  }
}

function typeConstructor(type: SystemSettingDefinition["type"]): unknown {
  if (type === "boolean") return Boolean;
  if (type === "number") return Number;
  return String;
}

function refreshCombatTracker(): void {
  (
    ui as typeof ui & {
      combat?: { render(options?: { force?: boolean }): unknown };
    }
  ).combat?.render({ force: true });
}

function refreshHealthPresentation(): void {
  refreshCombatTracker();
  for (const actor of game.actors?.contents ?? []) {
    actor.sheet.render(true);
  }
}

export function currentSelectedTheme():
  ReturnType<typeof themeRegistry.current>[number] | undefined {
  return resolveSelectedTheme(
    themeRegistry.current(),
    currentSettingProfile(),
    stringSetting(SHARED_SETTING_KEYS.userTheme, "inherit"),
  );
}

export function applySelectedTheme(): void {
  if (typeof document === "undefined") return;
  const profile = currentSettingProfile();
  const themes = themeRegistry.current();
  const selected = currentSelectedTheme();
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
  const pauseIcon = resolvePauseIcon(profile, selected);
  root.style.setProperty(
    "--d6e2-pause-icon",
    `url("${foundry.utils.getRoute(pauseIcon)}")`,
  );
  applyThemeWildDieMarkPresentation(root, selected);
  applySettingProfilePresentation();
  Hooks.callAll?.("d6e2ThemeChanged", selected.id);
  applyRulesProfilePresentation(currentConfiguredRulesProfile().id);
}

export function applySettingProfilePresentation(): void {
  const profile = currentSettingProfile();
  setRulesProfileTerminology(currentRulesProfileTerminology());
  setSettingProfileTerminology({
    ...profile.terminology,
    attributes: {
      ...Object.fromEntries(
        profile.attributes.map(({ id, label }) => [id, label]),
      ),
      ...profile.terminology.attributes,
    },
    characterSheetLabel: profile.label,
  });
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const markProperties = (
    face: D6SettingProfileV3["wildDie"]["one"],
    prefix: string,
  ): void => {
    root.style.setProperty(
      `${prefix}-image`,
      face.kind === "image"
        ? `url("${foundry.utils.getRoute(face.value)}")`
        : "none",
    );
    root.style.setProperty(
      `${prefix}-text`,
      face.kind === "text" ? JSON.stringify(face.value) : '""',
    );
  };
  root.style.setProperty(
    "--d6e2-setting-logo-image",
    `url("${foundry.utils.getRoute(profile.logo)}")`,
  );
  markProperties(profile.wildDie.one, "--od6-chat-wild-one-mark");
  markProperties(profile.wildDie.six, "--od6-chat-wild-six-mark");
  markProperties(profile.wildDie.six, "--od6-chat-wild-mark");
}

interface ThemePresentationRoot {
  readonly style: Pick<CSSStyleDeclaration, "setProperty">;
}

function applyThemeWildDieMarkPresentation(
  root: ThemePresentationRoot,
  theme: ReturnType<typeof themeRegistry.current>[number],
): void {
  const properties = themeWildDieChatProperties(theme, (path) =>
    foundry.utils.getRoute(path),
  );
  root.style.setProperty("--od6-chat-wild-mark-image", properties.image);
  root.style.setProperty("--od6-chat-wild-mark-text", properties.text);
}

function registerDefinition(
  definition: SystemSettingDefinition,
  config: boolean,
): void {
  const choices =
    definition.key === SHARED_SETTING_KEYS.userTheme
      ? userThemeChoices
      : definition.choices;
  game.settings.register(SYSTEM_ID, definition.key, {
    ...(choices ? { choices } : {}),
    config,
    default: definition.default,
    hint: definition.hint,
    name: definition.name,
    ...(definition.key === SHARED_SETTING_KEYS.userTheme && {
      onChange: applySelectedTheme,
    }),
    ...((definition.key === SHARED_SETTING_KEYS.showPcQuickbar ||
      definition.key === SHARED_SETTING_KEYS.showActiveTasksQuickbar ||
      definition.key ===
        TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions) && {
      onChange: synchronizeQuickbarAvailability,
    }),
    ...([
      "secondEditionChasesModule",
      "secondEditionEnvironmentsModule",
    ].includes(definition.key) && {
      onChange: () => ui.controls?.render({ reset: true }),
    }),
    ...(definition.key === "secondEditionInitiativeStrategy" && {
      onChange: refreshCombatTracker,
    }),
    ...((definition.key === FIRST_EDITION_OPTION_KEYS.bodyPoints ||
      definition.key === FIRST_EDITION_OPTION_KEYS.trackStuns) && {
      onChange: refreshHealthPresentation,
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
  game.settings.register(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
    config: false,
    default: { version: 1 },
    hint: "D6E2.Settings.RulesProfile.Hint",
    name: "D6E2.Settings.RulesProfile.Title",
    onChange: () => {
      Hooks.callAll?.("d6e2RulesProfileChanged");
      applySelectedTheme();
      refreshCombatTracker();
    },
    requiresReload: false,
    scope: "world",
    type: Object,
  });
  Hooks.on("d6e2RulesProfilesChanged", () => {
    applySelectedTheme();
    refreshCombatTracker();
  });
  registerGameSettingsRootEnhancement();
  const refreshCampaignPackages = (): void => {
    Hooks.callAll?.("d6e2CampaignPackagesChanged");
    const windows = (
      ui as typeof ui & { readonly windows?: Readonly<Record<number, unknown>> }
    ).windows;
    const application = Object.values(windows ?? {}).find(
      (window): window is D6System2eFirstEditionSettings =>
        window instanceof D6System2eFirstEditionSettings,
    );
    application?.render({ force: true });
  };
  registerCampaignPackageSettings(refreshCampaignPackages);
  game.settings.register(SYSTEM_ID, WORLD_TERMINOLOGY_SETTING, {
    config: false,
    default: {},
    hint: "D6E2.Settings.Terminology.Hint",
    name: "D6E2.Settings.Terminology.Title",
    onChange: () => {
      if (game.user?.isGM === true)
        void migrateLegacyWorldTerminologyOverrides();
    },
    scope: "world",
    type: Object,
  });
  game.settings.register(SYSTEM_ID, WORLD_SETTING_PROFILES_SETTING, {
    config: false,
    default: { version: 3 },
    hint: "D6E2.Settings.SettingProfile.Hint",
    name: "D6E2.Settings.SettingProfile.Title",
    onChange: () => {
      Hooks.callAll?.("d6e2SettingProfileChanged");
      applySelectedTheme();
      refreshRenderedDocumentSheets(
        (
          ui as typeof ui & {
            readonly windows?: Readonly<Record<number, unknown>>;
          }
        ).windows,
        (application) =>
          application instanceof foundry.applications.sheets.ActorSheetV2 ||
          application instanceof foundry.applications.sheets.ItemSheetV2,
      );
    },
    requiresReload: true,
    scope: "world",
    type: Object,
  });
  Hooks.once("ready", () => {
    if (game.user?.isGM !== true) return;
    void ensureWorldRulesProfilesStored()
      .then(() => ensureWorldSettingProfilesStored())
      .then(() => migrateLegacyWorldTerminologyOverrides())
      .then(() => applySelectedTheme());
  });
  setWorldTerminologyOverrides({});
  observeCampaignPackageRegistry(refreshCampaignPackages);
  observeContentPackageRegistry(() => {
    Hooks.callAll?.("d6e2ContentPackagesChanged");
    const windows = (
      ui as typeof ui & { readonly windows?: Readonly<Record<number, unknown>> }
    ).windows;
    const application = Object.values(windows ?? {}).find(
      (window): window is D6System2eSecondEditionSettings =>
        window instanceof D6System2eSecondEditionSettings,
    );
    application?.render({ force: true });
  });
  for (const definition of SHARED_SETTINGS) {
    registerDefinition(definition, true);
  }
  for (const definition of FIRST_EDITION_SETTINGS) {
    registerDefinition(definition, false);
  }
  for (const definition of SECOND_EDITION_SETTINGS) {
    registerDefinition(definition, false);
  }
  for (const definition of TYFUSIUS_HOMEBREW_SETTINGS) {
    registerDefinition(definition, false);
  }

  game.settings.registerMenu(SYSTEM_ID, "d6SystemSecondEdition", {
    hint: "D6E2.Settings.SecondEdition.Menu.Hint",
    icon: "fa-solid fa-dice",
    label: "D6E2.Settings.Configure",
    name: "D6E2.Settings.SecondEdition.Menu.Name",
    restricted: true,
    type: D6System2eSecondEditionSettings,
  });
  game.settings.registerMenu(SYSTEM_ID, "openD6FirstEdition", {
    hint: "D6E2.Settings.FirstEdition.Menu.Hint",
    icon: "fa-solid fa-dice-d6",
    label: "D6E2.Settings.Configure",
    name: "D6E2.Settings.FirstEdition.Menu.Name",
    restricted: true,
    type: D6System2eFirstEditionSettings,
  });
}

export function logSettingsProfile(): void {
  console.info(`${SYSTEM_NAME} | Settings profile ready`);
}
