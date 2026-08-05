import coreCharacterTemplateCatalog from "../../../content/core-character-template-catalog.json" with { type: "json" };

const MODULE_ID = "d6-system-2e-core-content";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly contentPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
  readonly templates: {
    register(ownerId: string, catalog: unknown): void;
  };
}

Hooks.once("ready", () => {
  const api = game.system.api as Partial<D6PublicApi> | undefined;
  if (api?.apiVersion !== 1 || !api.contentPackages || !api.templates) {
    ui.notifications.warn(
      "D6 System Second Edition Core Content requires a compatible system release.",
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "core",
    id: MODULE_ID,
    label: "D6 System Second Edition — Core Content",
    mechanicIds: [],
    recommendedPrimaryProfile: "second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-alpha.32",
  });
  api.templates.register(MODULE_ID, coreCharacterTemplateCatalog);
});
