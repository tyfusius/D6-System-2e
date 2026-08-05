const MODULE_ID = "open-d6-core-content-d6-system-2e";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly contentPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
}

Hooks.once("ready", () => {
  const api = game.system.api as Partial<D6PublicApi> | undefined;
  if (api?.apiVersion !== 1 || !api.contentPackages) {
    ui.notifications.warn(
      "Open D6 First Edition Core Content requires a compatible system release.",
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-core",
    id: MODULE_ID,
    label: "Open D6 First Edition — Core Content",
    mechanicIds: [],
    recommendedPrimaryProfile: "open-d6",
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.1",
  });
});
