// packages/echod6-companion-d6-system-2e/src/branding.ts
var BRAND_MARK_CLASS = "echo-brand-mark";
function brandingSurfaces(element) {
  if (element.classList.contains("od6s-item-v2")) {
    return Array.from(
      element.querySelectorAll(".od6item-section-heading")
    );
  }
  if (element.classList.contains("od6roll-dialog")) {
    const identity = element.querySelector(".od6roll-identity");
    return identity ? [identity] : [];
  }
  return [];
}
function removeEchoBranding(root = document) {
  for (const mark of Array.from(root.querySelectorAll(`.${BRAND_MARK_CLASS}`)))
    mark.remove();
}
function applyEchoBranding(application) {
  const element = application.element;
  if (!element) return false;
  const surfaces = brandingSurfaces(element);
  for (const surface of surfaces) {
    if (surface.querySelector(`.${BRAND_MARK_CLASS}`)) continue;
    const mark = document.createElement("span");
    mark.className = BRAND_MARK_CLASS;
    mark.dataset.companionBranding = "echo-d6";
    mark.setAttribute("aria-hidden", "true");
    const logo = document.createElement("span");
    logo.className = "echo-brand-logo";
    mark.append(logo);
    const trailingControls = surface.querySelector(
      ".od6v2-theme-control, .od6v2-toolbar-actions"
    );
    surface.insertBefore(mark, trailingControls);
  }
  return surfaces.length > 0;
}

// packages/echod6-companion-d6-system-2e/src/module.ts
var MODULE_ID = "echod6-companion-d6-system-2e";
var ECHO_SETTING_PROFILE_ID = "echo-d6";
function isEchoSettingSelected(api) {
  const selection = api.setting.selection();
  return selection.available && selection.activeProfileId === ECHO_SETTING_PROFILE_ID;
}

// packages/echod6-companion-d6-system-2e/src/d6-system-api.ts
var D6_SYSTEM_API_VERSION = 2;
function hasFunction(value, key) {
  return key in value && typeof value[key] === "function";
}
function isRegistry(value) {
  return typeof value === "object" && value !== null && hasFunction(value, "register") && hasFunction(value, "unregisterOwner");
}
function isD6SystemPublicApi(value) {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value;
  const rules = candidate.rules;
  return candidate.apiVersion === D6_SYSTEM_API_VERSION && candidate.systemId === "d6-system-2e" && isRegistry(candidate.terminology) && isRegistry(candidate.themes) && isRegistry(candidate.rulesProfileRegistry) && isRegistry(candidate.settingProfileRegistry) && typeof candidate.profilePreset === "object" && candidate.profilePreset !== null && hasFunction(candidate.profilePreset, "activate") && isRegistry(candidate.profilePresetRegistry) && typeof candidate.setting === "object" && candidate.setting !== null && hasFunction(candidate.setting, "activate") && hasFunction(candidate.setting, "selection") && typeof rules === "object" && rules !== null && hasFunction(rules, "activate");
}

// packages/echod6-companion-d6-system-2e/src/terminology.ts
function createEchoTerminology(localize) {
  return Object.freeze({
    attributes: Object.freeze({
      agility: "Agility",
      mysticism: localize("ECHOD6.EchoResonance")
    }),
    characterSheetLabel: localize("ECHOD6.CharacterSheet"),
    details: Object.freeze({
      allegiance: localize("ECHOD6.Allegiance"),
      currency: localize("ECHOD6.Credits")
    }),
    machines: Object.freeze({
      interstellarDrive: localize("ECHOD6.SlipstreamDrive"),
      starshipToughness: localize("ECHOD6.StarshipToughness"),
      vehicleToughness: localize("ECHOD6.VehicleToughness")
    }),
    manifestations: Object.freeze({
      plural: localize("ECHOD6.EchoPowers"),
      singular: localize("ECHOD6.EchoPower")
    }),
    metaphysics: Object.freeze({
      attribute: localize("ECHOD6.EchoResonance"),
      extranormal: localize("ECHOD6.Resonance"),
      skills: Object.freeze({
        channel: localize("ECHOD6.Harmonize"),
        sense: localize("ECHOD6.Attune"),
        transform: localize("ECHOD6.Project")
      })
    }),
    resources: Object.freeze({
      fatePoints: localize("ECHOD6.EchoPoints")
    }),
    systemLabel: localize("ECHOD6.Title")
  });
}

// packages/echod6-companion-d6-system-2e/src/rules-profile.ts
var ECHO_RULES_PROFILE_ID = "echo-d6";
function createEchoRulesProfile(localize) {
  return Object.freeze({
    constraints: Object.freeze([]),
    description: localize("ECHOD6.Settings.PresetHint"),
    id: ECHO_RULES_PROFILE_ID,
    label: "Echo D6",
    source: Object.freeze({ kind: "module", ownerId: MODULE_ID }),
    strategies: Object.freeze({
      actionEconomy: "d6e2.action-economy.segmented",
      activeDefenses: "d6e2.defenses.static",
      advancement: "d6e2.advancement.configured",
      attributes: "d6e2.attributes.campaign-profile",
      health: "d6e2.health.condition-track",
      initiative: "d6e2.initiative.contextual",
      movement: "d6e2.movement.segmented",
      metaCurrency: "d6e2.meta-currency.hero-points",
      pips: "d6e2.pips.configured",
      retries: "d6e2.retries.doubling-down",
      successEvaluator: "d6e2.success.strictly-greater",
      wildDie: "d6e2.wild-die.advantage-complication"
    }),
    terminology: createEchoTerminology(localize),
    version: 1
  });
}

// packages/echod6-companion-d6-system-2e/src/preset.ts
function createEchoProfilePreset(localize) {
  return Object.freeze({
    description: localize("ECHOD6.Settings.PresetHint"),
    id: "echo-d6-recommended",
    label: localize("ECHOD6.Settings.PresetName"),
    selection: Object.freeze({
      rulesProfileId: ECHO_RULES_PROFILE_ID,
      settingProfileId: "echo-d6",
      version: 1
    }),
    version: 1
  });
}
function applyEchoPreset(api) {
  return api.profilePreset.activate(
    createEchoProfilePreset((key) => game.i18n.localize(key)).selection
  );
}

// packages/echod6-companion-d6-system-2e/src/configurator.ts
var ApplicationV2 = foundry.applications.api.ApplicationV2;
var EchoPresetMenu = class extends ApplicationV2 {
  render() {
    void openPresetConfirmation();
    return this;
  }
};
async function openPresetConfirmation() {
  const confirmed = await foundry.applications.api.DialogV2.wait({
    buttons: [
      {
        action: "apply",
        callback: () => true,
        class: "bright",
        default: true,
        icon: "fa-solid fa-check",
        label: game.i18n.localize("ECHOD6.Settings.PresetLabel")
      },
      {
        action: "cancel",
        callback: () => false,
        label: "Cancel"
      }
    ],
    classes: ["d6e2", "echod6-preset-dialog"],
    content: `<p>${game.i18n.localize("ECHOD6.Settings.PresetHint")}</p>`,
    modal: true,
    window: {
      icon: "fa-solid fa-sliders",
      title: game.i18n.localize("ECHOD6.Settings.PresetName")
    }
  });
  if (!confirmed) return;
  const api = game.system.api;
  if (!isD6SystemPublicApi(api)) {
    ui.notifications.warn(game.i18n.localize("ECHOD6.Warnings.Api"));
    return;
  }
  try {
    await applyAndReport(api);
  } catch (error) {
    ui.notifications.error(
      game.i18n.format("ECHOD6.Settings.PresetFailed", {
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}
async function applyAndReport(api) {
  const { preview } = await applyEchoPreset(api);
  ui.notifications.info(
    game.i18n.format("ECHOD6.Settings.PresetApplied", {
      applied: preview.changedCount,
      unchanged: preview.unchangedCount
    })
  );
}
function registerEchoConfigurator() {
  game.settings.registerMenu(MODULE_ID, "echoPreset", {
    hint: "ECHOD6.Settings.PresetHint",
    icon: "fa-solid fa-sliders",
    label: "ECHOD6.Settings.PresetLabel",
    name: "ECHOD6.Settings.PresetName",
    restricted: true,
    type: EchoPresetMenu
  });
}

// packages/echod6-companion-d6-system-2e/src/theme.ts
var ECHO_THEME = Object.freeze({
  cssClass: "d6e2-theme-echo",
  dice: Object.freeze({
    body: "#0b0908",
    colorsetId: "d6-system-2e-echo-standard",
    edge: "#a57443",
    face: "#d2ad72",
    name: "Echo D6 dice",
    systemId: "d6-system-2e-echo",
    wildDie: Object.freeze({
      body: "#8a6038",
      colorsetId: "d6-system-2e-echo-wild",
      edge: "#b78652",
      face: "#090807"
    }),
    wildDieLabels: Object.freeze([
      "1",
      "2",
      "3",
      "4",
      "5",
      "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png"
    ])
  }),
  id: "echo",
  label: "Echo D6",
  pauseIcon: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
  tokens: Object.freeze({
    accent: "#a57443",
    accentBright: "#d2ad72",
    background: "#0b0908",
    muted: "#968777",
    text: "#e7e2d8"
  })
});

// packages/echod6-companion-d6-system-2e/src/setting-profile.ts
var ATTRIBUTES = Object.freeze([
  ["agility", "Agility", true],
  ["brawn", "Brawn", true],
  ["knowledge", "Knowledge", true],
  ["perception", "Perception", true],
  ["charm", "Charm", false],
  ["magic", "Magic", false],
  ["mechanical", "Mechanical", true],
  ["mysticism", "Mysticism", false],
  ["technical", "Technical", true],
  ["acumen", "Acumen", false],
  ["charisma", "Charisma", false],
  ["coordination", "Coordination", false],
  ["extranormal", "Extranormal", false],
  ["intellect", "Intellect", false],
  ["physique", "Physique", false],
  ["presence", "Presence", false],
  ["reflexes", "Reflexes", false]
]);
function createEchoSettingProfile(localize) {
  return Object.freeze({
    attributes: Object.freeze(
      ATTRIBUTES.map(
        ([id, label, active]) => Object.freeze({ active, id, label })
      )
    ),
    description: "Echo D6 character vocabulary and presentation.",
    id: "echo-d6",
    label: "Echo D6",
    logo: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
    logoAsWatermark: true,
    originRulesFamily: "d6-system-second-edition",
    skills: Object.freeze([]),
    terminology: createEchoTerminology(localize),
    version: 2,
    wildDie: Object.freeze({
      one: Object.freeze({ kind: "text", value: "1" }),
      oneSound: "systems/d6-system-2e/assets/audio/wild-one.mp3",
      six: Object.freeze({
        kind: "image",
        value: "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png"
      }),
      sixSound: "systems/d6-system-2e/assets/audio/wild-six.mp3"
    })
  });
}

// packages/echod6-companion-d6-system-2e/src/main.ts
var systemApi = null;
function syncSelectedContribution() {
  if (!systemApi) return;
  if (isEchoSettingSelected(systemApi)) {
    systemApi.terminology.register(
      MODULE_ID,
      createEchoTerminology((key) => game.i18n.localize(key))
    );
    return;
  }
  systemApi.terminology.unregisterOwner(MODULE_ID);
  removeEchoBranding();
}
Hooks.once("init", () => {
  registerEchoConfigurator();
});
Hooks.once("ready", () => {
  const api = game.system.api;
  if (!isD6SystemPublicApi(api)) {
    ui.notifications.warn(game.i18n.localize("ECHOD6.Warnings.Api"));
    return;
  }
  systemApi = api;
  api.rulesProfileRegistry.register(
    MODULE_ID,
    createEchoRulesProfile((key) => game.i18n.localize(key))
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    createEchoSettingProfile((key) => game.i18n.localize(key))
  );
  api.profilePresetRegistry.register(
    MODULE_ID,
    createEchoProfilePreset((key) => game.i18n.localize(key))
  );
  api.themes.register(MODULE_ID, ECHO_THEME);
  queueMicrotask(syncSelectedContribution);
  console.info("The Echo D6 Companion | D6 System public API v2 verified");
});
Hooks.on("updateSetting", () => {
  syncSelectedContribution();
});
Hooks.on("renderApplicationV2", (application) => {
  if (systemApi && isEchoSettingSelected(systemApi)) {
    applyEchoBranding(application);
  }
});
//# sourceMappingURL=echod6-companion-d6-system-2e.mjs.map
