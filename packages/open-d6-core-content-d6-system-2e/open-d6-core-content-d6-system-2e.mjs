// packages/open-d6-core-content-d6-system-2e/src/main.ts
var MODULE_ID = "open-d6-core-content-d6-system-2e";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 2 || !api.contentPackages) {
    ui.notifications.warn(
      "Open D6 First Edition Core Content requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-core",
    id: MODULE_ID,
    label: "Open D6 First Edition \u2014 Core Content",
    mechanicIds: [],
    recommendedPrimaryProfile: "open-d6",
    recommendedSettingProfile: "open-d6-first-edition",
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.10"
  });
});
//# sourceMappingURL=open-d6-core-content-d6-system-2e.mjs.map
