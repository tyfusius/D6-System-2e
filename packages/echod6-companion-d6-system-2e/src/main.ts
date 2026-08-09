import { applyEchoBranding, removeEchoBranding } from "./branding";
import { isEchoSettingSelected, MODULE_ID } from "./module";
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
  if (isEchoSettingSelected(systemApi)) {
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
  // Resolve the saved Setting Profile after all synchronous ready hooks have
  // registered their module-owned profiles.
  queueMicrotask(syncSelectedContribution);
  console.info("The Echo D6 Companion | D6 System public API v2 verified");
});

Hooks.on("updateSetting", () => {
  syncSelectedContribution();
});

Hooks.on("renderApplicationV2", (application) => {
  if (systemApi && isEchoSettingSelected(systemApi)) {
    applyEchoBranding(application as { readonly element?: HTMLElement | null });
  }
});
