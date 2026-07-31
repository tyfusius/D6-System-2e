import path from "node:path";
import { pathToFileURL } from "node:url";

/* eslint-disable @typescript-eslint/no-extraneous-class -- Foundry constructor stubs. */
const callbacks = new Map();
const sheetRegistrations = [];
const settingMenus = new Map();
const settingRegistrations = new Map();
const settingValues = new Map();

class StubField {
  constructor(options = {}) {
    this.options = options;
  }
}

class StubTypeDataModel {}
class StubActorSheet {}
class StubItemSheet {}
class StubActor {}
class StubItem {}

globalThis.Hooks = {
  on(hook, callback) {
    const registered = callbacks.get(hook) ?? [];
    registered.push(callback);
    callbacks.set(hook, registered);
    return registered.length;
  },
  once(hook, callback) {
    const registered = callbacks.get(hook) ?? [];
    registered.push(callback);
    callbacks.set(hook, registered);
    return registered.length;
  },
};
globalThis.Actor = StubActor;
globalThis.Item = StubItem;
globalThis.CONFIG = {
  Actor: { dataModels: {} },
  Item: { dataModels: {} },
};
globalThis.foundry = {
  abstract: {
    TypeDataModel: StubTypeDataModel,
  },
  applications: {
    api: {
      ApplicationV2: class {
        close() {
          return Promise.resolve();
        }
      },
      HandlebarsApplicationMixin: (base) => base,
    },
    apps: {
      DocumentSheetConfig: {
        registerSheet: (...args) => sheetRegistrations.push(args),
      },
    },
    sheets: {
      ActorSheetV2: StubActorSheet,
      ItemSheetV2: StubItemSheet,
    },
  },
  data: {
    fields: {
      ArrayField: StubField,
      BooleanField: StubField,
      HTMLField: StubField,
      NumberField: StubField,
      SchemaField: StubField,
      StringField: StubField,
    },
  },
};
globalThis.game = {
  i18n: { localize: (key) => key },
  settings: {
    get(namespace, key) {
      const fullKey = `${namespace}.${key}`;
      return (
        settingValues.get(fullKey) ?? settingRegistrations.get(fullKey)?.default
      );
    },
    register(namespace, key, configuration) {
      settingRegistrations.set(`${namespace}.${key}`, configuration);
    },
    registerMenu(namespace, key, configuration) {
      settingMenus.set(`${namespace}.${key}`, configuration);
    },
    async set(namespace, key, value) {
      const fullKey = `${namespace}.${key}`;
      settingValues.set(fullKey, value);
      settingRegistrations.get(fullKey)?.onChange?.(value);
      return value;
    },
  },
  system: { version: "0.1.0-alpha.9" },
  version: "14.365",
};

const bundle = path.resolve("dist/d6-system-2e.mjs");
await import(pathToFileURL(bundle).href);

for (const hook of ["init", "ready"]) {
  const registered = callbacks.get(hook);
  if (!registered?.length) {
    throw new Error(`Generated bundle did not register the ${hook} lifecycle.`);
  }
  for (const callback of registered) await callback();
}

const api = globalThis.game.system.api;
if (
  api?.apiVersion !== 1 ||
  api.systemId !== "d6-system-2e" ||
  !api.capabilities.has("foundation.identity") ||
  !api.capabilities.has("advancement.command") ||
  !api.capabilities.has("campaign.profile") ||
  !api.capabilities.has("health.condition") ||
  !api.capabilities.has("rules.capabilities") ||
  !api.capabilities.has("roll.double-down") ||
  !api.capabilities.has("roll.reroll") ||
  typeof api.advancement?.attribute !== "function" ||
  typeof api.advancement?.item !== "function" ||
  typeof api.health?.condition !== "function" ||
  api.rules?.capabilities()?.contractVersion !== 1 ||
  typeof api.roll?.reroll !== "function" ||
  typeof api.roll?.doubleDown !== "function" ||
  typeof api.features?.invoke !== "function" ||
  typeof api.features?.read !== "function" ||
  typeof api.features?.reset !== "function" ||
  api.campaign?.current()?.profileVersion !== 1
) {
  throw new Error("Generated bundle did not install the foundation API.");
}
if (
  !settingRegistrations.has("d6-system-2e.useOpenD6Rules") ||
  !settingRegistrations.has("d6-system-2e.worldTheme") ||
  !settingRegistrations.has("d6-system-2e.secondEditionOptionalCharm") ||
  !settingRegistrations.has(
    "d6-system-2e.firstEditionAllowSecondEditionAdvancedSkills",
  ) ||
  !settingRegistrations.has(
    "d6-system-2e.secondEditionSkillSpecializationModule",
  ) ||
  !settingRegistrations.has(
    "d6-system-2e.secondEditionOptionalSkillModuleCount",
  ) ||
  !settingRegistrations.has("d6-system-2e.useFirstEditionPips") ||
  !settingRegistrations.has("d6-system-2e.useFirstEditionInitiative") ||
  !settingRegistrations.has("d6-system-2e.useFirstEditionRetries") ||
  !settingRegistrations.has("d6-system-2e.secondEditionPipsModule") ||
  !settingRegistrations.has(
    "d6-system-2e.secondEditionPerksFlawsTalentsModule",
  ) ||
  !settingRegistrations.has("d6-system-2e.secondEditionTroublesAssetsModule") ||
  !settingRegistrations.has("d6-system-2e.secondEditionAdvancementStrategy") ||
  !settingRegistrations.has("d6-system-2e.secondEditionWildDieStrategy") ||
  !settingRegistrations.has("d6-system-2e.actionDeclarationAssistance") ||
  settingRegistrations.size !== 57 ||
  settingMenus.size !== 2
) {
  throw new Error("Grouped system settings were not registered.");
}
api.themes.register("smoke-companion", {
  cssClass: "d6e2-theme-smoke",
  id: "smoke",
  label: "Smoke Theme",
  tokens: {
    accent: "#123456",
    accentBright: "#abcdef",
    background: "#010203",
    muted: "#777777",
    text: "#fefefe",
  },
});
if (
  settingRegistrations.get("d6-system-2e.worldTheme")?.choices?.smoke !==
  "Smoke Theme"
) {
  throw new Error("Companion theme was not added to live setting choices.");
}
api.themes.unregisterOwner("smoke-companion");
if ("smoke" in settingRegistrations.get("d6-system-2e.worldTheme").choices) {
  throw new Error("Disabled companion theme remained selectable.");
}
if (
  globalThis.CONFIG.Actor.dataModels.character?.name !== "CharacterDataModel" ||
  globalThis.CONFIG.Item.dataModels.skill?.name !== "SkillDataModel" ||
  globalThis.CONFIG.Item.dataModels.weapon?.name !== "WeaponDataModel" ||
  globalThis.CONFIG.Item.dataModels.armor?.name !== "ArmorDataModel" ||
  globalThis.CONFIG.Item.dataModels.advantage?.name !== "AdvantageDataModel" ||
  globalThis.CONFIG.Item.dataModels.perk?.name !== "PerkDataModel" ||
  globalThis.CONFIG.Item.dataModels.flaw?.name !== "FlawDataModel" ||
  globalThis.CONFIG.Item.dataModels.talent?.name !== "TalentDataModel" ||
  globalThis.CONFIG.Item.dataModels.trouble?.name !== "TroubleDataModel" ||
  globalThis.CONFIG.Item.dataModels.asset?.name !== "AssetDataModel" ||
  globalThis.CONFIG.Actor.dataModels.vehicle?.name !== "VehicleDataModel" ||
  globalThis.CONFIG.Actor.dataModels.starship?.name !== "StarshipDataModel" ||
  sheetRegistrations.length !== 3
) {
  throw new Error(
    "Generated bundle did not register the supported data models and sheets.",
  );
}
const characterSchema =
  globalThis.CONFIG.Actor.dataModels.character.defineSchema();
const skillSchema = globalThis.CONFIG.Item.dataModels.skill.defineSchema();
const weaponSchema = globalThis.CONFIG.Item.dataModels.weapon.defineSchema();
const armorSchema = globalThis.CONFIG.Item.dataModels.armor.defineSchema();
const perkSchema = globalThis.CONFIG.Item.dataModels.perk.defineSchema();
const talentSchema = globalThis.CONFIG.Item.dataModels.talent.defineSchema();
const troubleSchema = globalThis.CONFIG.Item.dataModels.trouble.defineSchema();
const vehicleSchema = globalThis.CONFIG.Actor.dataModels.vehicle.defineSchema();
const starshipSchema =
  globalThis.CONFIG.Actor.dataModels.starship.defineSchema();
if (
  !characterSchema.attributes ||
  !characterSchema.resources ||
  !skillSchema.attributeId ||
  !skillSchema.prerequisiteSkillKeys ||
  !skillSchema.score ||
  !weaponSchema.damage ||
  !weaponSchema.range ||
  !armorSchema.physicalResistance ||
  !armorSchema.energyResistance ||
  !perkSchema.rank ||
  !perkSchema.focus ||
  !perkSchema.source ||
  !talentSchema.cost ||
  !talentSchema.repeatable ||
  !troubleSchema.trigger ||
  !troubleSchema.source ||
  !vehicleSchema.attributes ||
  !vehicleSchema.passengers ||
  !vehicleSchema.armor ||
  !starshipSchema.attributes ||
  !starshipSchema.crew ||
  !starshipSchema.shields
) {
  throw new Error("Supported data model schemas are incomplete.");
}
const metadataWrites = [];
for (const callback of callbacks.get("preCreateActor") ?? []) {
  callback(
    { updateSource: (changes) => metadataWrites.push(changes) },
    {
      system: {
        _migration: {
          foundry: "",
          schema: 1,
          system: "",
        },
      },
    },
  );
}
if (
  metadataWrites[0]?.["system._migration"]?.foundry !== "14.365" ||
  metadataWrites[0]?.["system._migration"]?.schema !== 1 ||
  metadataWrites[0]?.["system._migration"]?.system !== "0.1.0-alpha.9"
) {
  throw new Error("New-document migration metadata was not initialized.");
}
for (const callback of callbacks.get("preCreateActor") ?? []) {
  callback(
    { updateSource: (changes) => metadataWrites.push(changes) },
    {
      system: {
        _migration: {
          foundry: "14.364",
          schema: 0,
          system: "0.0.1",
        },
      },
    },
  );
}
if (metadataWrites.length !== 1) {
  throw new Error("Existing import migration metadata was overwritten.");
}

console.info("Generated bundle lifecycle smoke test passed.");
