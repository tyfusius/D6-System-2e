const MODULE_ID = "d6-system-2e-science-fiction";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly contentPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
}

Hooks.once("ready", () => {
  const api = game.system.api as Partial<D6PublicApi> | undefined;
  if (api?.apiVersion !== 2 || !api.contentPackages) {
    ui.notifications.warn(
      "D6 System Second Edition Science Fiction requires a compatible system release.",
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "science-fiction",
    id: MODULE_ID,
    label: "D6 System Second Edition — Science Fiction",
    mechanicIds: ["science-fiction-skills"],
    recommendedPrimaryProfile: "second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-beta.6",
  });
});
