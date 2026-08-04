// packages/d6-system-2e-superhero/src/main.ts
var MODULE_ID = "d6-system-2e-superhero";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 1 || !api.contentPackages) {
    ui.notifications.warn(
      "D6 System Second Edition Superhero requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "superhero",
    id: MODULE_ID,
    label: "D6 System Second Edition \u2014 Superhero",
    mechanicIds: ["superheroes"],
    recommendedPrimaryProfile: "second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-alpha.30"
  });
});
//# sourceMappingURL=d6-system-2e-superhero.mjs.map
