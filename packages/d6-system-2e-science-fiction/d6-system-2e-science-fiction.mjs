// packages/d6-system-2e-science-fiction/src/main.ts
var MODULE_ID = "d6-system-2e-science-fiction";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 2 || !api.contentPackages) {
    ui.notifications.warn(
      "D6 System Second Edition Science Fiction requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "science-fiction",
    id: MODULE_ID,
    label: "D6 System Second Edition \u2014 Science Fiction",
    mechanicIds: ["science-fiction-skills"],
    recommendedPrimaryProfile: "second-edition",
    recommendedSettingProfile: "d6-system-second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-beta.9"
  });
});
//# sourceMappingURL=d6-system-2e-science-fiction.mjs.map
