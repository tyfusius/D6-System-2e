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
  readonly contentPackages: {
    register(ownerId: string, manifest: unknown): void;
  };
  readonly firstEditionGenreProfiles: {
    register(ownerId: string, profile: unknown): void;
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
  return value?.apiVersion === 2 ? (value as D6PublicApi) : null;
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
  systemApi.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-space",
    id: MODULE_ID,
    label: "Open D6 Space",
    mechanicIds: [],
    recommendedPrimaryProfile: "open-d6",
    recommendedSettingProfile: MODULE_ID,
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.7",
  });
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, {
    attributeBudgetScore: 54,
    attributes: [
      { id: "agility", label: "D6E2.Attribute.Agility" },
      { id: "brawn", label: "D6E2.Attribute.Brawn" },
      { id: "mechanical", label: "D6E2.Attribute.Mechanical" },
      { id: "knowledge", label: "D6E2.Attribute.Knowledge" },
      { id: "perception", label: "D6E2.Attribute.Perception" },
      { id: "technical", label: "D6E2.Attribute.Technical" },
    ],
    genreId: MODULE_ID,
    id: MODULE_ID,
    label: "Open D6 Space",
    roles: {
      initiative: "perception",
      knowledge: "knowledge",
      strength: "brawn",
    },
    skillBudgetScore: 21,
    skills: [],
    version: 1,
  });
  systemApi.equipment.register(MODULE_ID, content.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, content.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, content.bestiaryCatalog);
});
