import content from "../content/catalog.mjs";

const MODULE_ID = "open-d6-adventure-d6-system-2e";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly bestiaryRegistry: {
    register(ownerId: string, catalog: unknown): void;
  };
  readonly campaignPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
  readonly contentPackages: {
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
      "Open D6 Adventure requires a compatible D6 System Second Edition release.",
    );
    return;
  }
  const systemApi = api as D6PublicApi;
  systemApi.campaignPackages.register(MODULE_ID, content.packageManifest);
  systemApi.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-adventure",
    id: MODULE_ID,
    label: "Open D6 Adventure",
    mechanicIds: ["adventure-magic", "adventure-psionics"],
    recommendedPrimaryProfile: "open-d6",
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.3",
  });
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, content.genreProfile);
  systemApi.equipment.register(MODULE_ID, content.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, content.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, content.bestiaryCatalog);
});
