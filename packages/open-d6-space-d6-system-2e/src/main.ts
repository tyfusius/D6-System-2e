import content from "../content/catalog.json" with { type: "json" };

const MODULE_ID = "open-d6-space-d6-system-2e";

interface D6PublicApi {
  readonly apiVersion: number;
  readonly bestiaryRegistry: {
    register(ownerId: string, catalog: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly campaignPackages: {
    register(ownerId: string, manifest: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly templates: {
    register(ownerId: string, catalog: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
  readonly equipment: {
    register(ownerId: string, catalog: unknown): void;
    unregisterOwner(ownerId: string): void;
  };
}

function api(): D6PublicApi | null {
  const value = game.system.api as Partial<D6PublicApi> | undefined;
  return value?.apiVersion === 1 ? (value as D6PublicApi) : null;
}

Hooks.once("ready", () => {
  const systemApi = api();
  if (!systemApi) {
    ui.notifications.warn(
      "Open D6 Space requires a compatible D6 System Second Edition release.",
    );
    return;
  }
  systemApi.campaignPackages.register(MODULE_ID, content.packageManifest);
  systemApi.equipment.register(MODULE_ID, content.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, content.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, content.bestiaryCatalog);
});
