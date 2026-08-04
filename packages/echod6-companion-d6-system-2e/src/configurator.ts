import { MODULE_ID } from "./campaign";
import type { D6SystemPublicApi } from "./d6-system-api";
import { isD6SystemPublicApi } from "./d6-system-api";
import { applyEchoPreset } from "./preset";

const ApplicationV2 = foundry.applications.api.ApplicationV2;

class EchoPresetMenu extends ApplicationV2 {
  override render(): this {
    void openPresetConfirmation();
    return this;
  }
}

async function openPresetConfirmation(): Promise<void> {
  const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "apply",
        callback: () => true,
        class: "bright",
        default: true,
        icon: "fa-solid fa-check",
        label: game.i18n.localize("ECHOD6.Settings.PresetLabel"),
      },
      {
        action: "cancel",
        callback: () => false,
        label: "Cancel",
      },
    ],
    classes: ["d6e2", "echod6-preset-dialog"],
    content: `<p>${game.i18n.localize("ECHOD6.Settings.PresetHint")}</p>`,
    modal: true,
    window: {
      icon: "fa-solid fa-sliders",
      title: game.i18n.localize("ECHOD6.Settings.PresetName"),
    },
  });
  if (!confirmed) return;

  const api: unknown = game.system.api;
  if (!isD6SystemPublicApi(api)) {
    ui.notifications.warn(game.i18n.localize("ECHOD6.Warnings.Api"));
    return;
  }
  await applyAndReport(api);
}

async function applyAndReport(api: D6SystemPublicApi): Promise<void> {
  const result = await applyEchoPreset(api);
  if (result.failed.length > 0) {
    ui.notifications.warn(
      game.i18n.format("ECHOD6.Settings.PresetFailed", {
        failed: result.failed.length,
      }),
    );
    return;
  }
  ui.notifications.info(
    game.i18n.format("ECHOD6.Settings.PresetApplied", {
      applied: result.applied.length,
      unchanged: result.unchanged.length,
    }),
  );
}

export function registerEchoConfigurator(): void {
  game.settings.registerMenu(MODULE_ID, "echoPreset", {
    hint: "ECHOD6.Settings.PresetHint",
    icon: "fa-solid fa-sliders",
    label: "ECHOD6.Settings.PresetLabel",
    name: "ECHOD6.Settings.PresetName",
    restricted: true,
    type: EchoPresetMenu,
  });
}
