import { applyEchoBranding, removeEchoBranding } from "./branding";
import { ECHO_CAMPAIGN_PACKAGE, isEchoSelected, MODULE_ID } from "./campaign";
import { registerEchoConfigurator } from "./configurator";
import type { D6SystemPublicApi } from "./d6-system-api";
import { isD6SystemPublicApi } from "./d6-system-api";
import { createEchoTerminology } from "./terminology";
import { ECHO_THEME } from "./theme";
import { createEchoRulesProfile } from "./rules-profile";
import { createEchoSettingProfile } from "./setting-profile";
import { createEchoProfilePreset } from "./preset";

let systemApi: D6SystemPublicApi | null = null;

function syncSelectedContribution(): void {
  if (!systemApi) return;
  if (isEchoSelected(systemApi)) {
    systemApi.terminology.register(
      MODULE_ID,
      createEchoTerminology((key) => game.i18n.localize(key)),
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
  const api: unknown = game.system.api;
  if (!isD6SystemPublicApi(api)) {
    ui.notifications.warn(game.i18n.localize("ECHOD6.Warnings.Api"));
    return;
  }

  systemApi = api;
  api.campaignPackages.register(MODULE_ID, ECHO_CAMPAIGN_PACKAGE);
  api.rulesProfileRegistry.register(
    MODULE_ID,
    createEchoRulesProfile((key) => game.i18n.localize(key)),
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    createEchoSettingProfile((key) => game.i18n.localize(key)),
  );
  api.profilePresetRegistry.register(
    MODULE_ID,
    createEchoProfilePreset((key) => game.i18n.localize(key)),
  );
  api.themes.register(MODULE_ID, ECHO_THEME);
  // Other campaign packages register from their own ready hooks. Resolve the
  // saved genre/companion pair after that synchronous hook wave completes so
  // startup does not briefly treat a valid companion as incompatible.
  queueMicrotask(syncSelectedContribution);
  console.info("The Echo D6 Companion | D6 System public API v2 verified");
});

Hooks.on("updateSetting", () => {
  syncSelectedContribution();
});

Hooks.on("renderApplicationV2", (application) => {
  if (systemApi && isEchoSelected(systemApi)) {
    applyEchoBranding(application as { readonly element?: HTMLElement | null });
  }
});
