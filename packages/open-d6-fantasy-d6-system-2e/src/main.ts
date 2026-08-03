import content from "../content/catalog.mjs";

const MODULE_ID = "open-d6-fantasy-d6-system-2e";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly bestiaryRegistry: {
    register(ownerId: string, catalog: unknown): void;
  };
  readonly campaignPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
  readonly equipment: { register(ownerId: string, catalog: unknown): void };
  readonly firstEditionGenreProfiles: {
    register(ownerId: string, profile: unknown): void;
  };
  readonly templates: { register(ownerId: string, catalog: unknown): void };
}

Hooks.once("ready", () => {
  const api = game.system.api as Partial<D6PublicApi> | undefined;
  if (api?.apiVersion !== 1 || !api.firstEditionGenreProfiles) {
    ui.notifications.warn(
      "Open D6 Fantasy requires a compatible D6 System Second Edition release.",
    );
    return;
  }
  const systemApi = api as D6PublicApi;
  systemApi.campaignPackages.register(MODULE_ID, content.packageManifest);
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, content.genreProfile);
  systemApi.equipment.register(MODULE_ID, content.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, content.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, content.bestiaryCatalog);
});
