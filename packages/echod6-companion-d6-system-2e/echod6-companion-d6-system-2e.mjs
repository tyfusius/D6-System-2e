// packages/echod6-companion-d6-system-2e/src/branding.ts
var BRAND_MARK_CLASS = "echo-brand-mark";
function brandingSurfaces(element) {
  if (element.classList.contains("od6s-character-v2")) {
    return Array.from(
      element.querySelectorAll(".od6v2-sheet-utilities")
    );
  }
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

// packages/echod6-companion-d6-system-2e/src/campaign.ts
var MODULE_ID = "echod6-companion-d6-system-2e";
var ECHO_CAMPAIGN_PACKAGE = Object.freeze({
  apiCompatibility: Object.freeze({ maximum: 1, minimum: 1 }),
  compatibleGenreIds: Object.freeze(["space"]),
  contractVersion: 1,
  id: MODULE_ID,
  kind: "companion",
  label: "Echo D6",
  rulesFamily: "open-d6-first-edition",
  version: "1.0.0"
});
function isEchoSelected(api) {
  const selection = api.campaignPackages.selection?.();
  return selection?.valid === true && selection.companion?.id === MODULE_ID;
}

// packages/echod6-companion-d6-system-2e/src/d6-system-api.ts
var D6_SYSTEM_API_VERSION = 1;
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
  return candidate.apiVersion === D6_SYSTEM_API_VERSION && candidate.systemId === "d6-system-2e" && isRegistry(candidate.campaignPackages) && hasFunction(candidate.campaignPackages, "selection") && isRegistry(candidate.terminology) && isRegistry(candidate.themes) && typeof rules === "object" && rules !== null && hasFunction(rules, "applyPreset");
}

// packages/echod6-companion-d6-system-2e/src/preset.ts
function applyEchoPreset(api) {
  return api.rules.applyPreset("open-d6");
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
  await applyAndReport(api);
}
async function applyAndReport(api) {
  const result = await applyEchoPreset(api);
  if (result.failed.length > 0) {
    ui.notifications.warn(
      game.i18n.format("ECHOD6.Settings.PresetFailed", {
        failed: result.failed.length
      })
    );
    return;
  }
  ui.notifications.info(
    game.i18n.format("ECHOD6.Settings.PresetApplied", {
      applied: result.applied.length,
      unchanged: result.unchanged.length
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

// packages/echod6-companion-d6-system-2e/src/theme.ts
var ECHO_THEME = Object.freeze({
  cssClass: "d6e2-theme-echo",
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

// packages/echod6-companion-d6-system-2e/src/main.ts
var systemApi = null;
function syncSelectedContribution() {
  if (!systemApi) return;
  if (isEchoSelected(systemApi)) {
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
  api.campaignPackages.register(MODULE_ID, ECHO_CAMPAIGN_PACKAGE);
  api.themes.register(MODULE_ID, ECHO_THEME);
  queueMicrotask(syncSelectedContribution);
  console.info("The Echo D6 Companion | D6 System public API v1 verified");
});
Hooks.on("updateSetting", () => {
  syncSelectedContribution();
});
Hooks.on("renderApplicationV2", (application) => {
  if (systemApi && isEchoSelected(systemApi)) {
    applyEchoBranding(application);
  }
});
//# sourceMappingURL=echod6-companion-d6-system-2e.mjs.map
