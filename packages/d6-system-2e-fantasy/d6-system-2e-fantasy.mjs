// packages/d6-system-2e-fantasy/src/main.ts
var MODULE_ID = "d6-system-2e-fantasy";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 1 || !api.contentPackages) {
    ui.notifications.warn(
      "D6 System Second Edition Fantasy requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "fantasy",
    id: MODULE_ID,
    label: "D6 System Second Edition \u2014 Fantasy",
    mechanicIds: ["fantasy-skills-magic"],
    recommendedPrimaryProfile: "second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-alpha.27"
  });
});
//# sourceMappingURL=d6-system-2e-fantasy.mjs.map
