import path from "node:path";
import { pathToFileURL } from "node:url";

/* eslint-disable @typescript-eslint/no-extraneous-class -- Foundry constructor stubs. */
const callbacks = new Map();
const sheetRegistrations = [];
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
    callbacks.set(hook, callback);
    return callbacks.size;
  },
  once(hook, callback) {
    callbacks.set(hook, callback);
    return callbacks.size;
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
    async set(namespace, key, value) {
      const fullKey = `${namespace}.${key}`;
      settingValues.set(fullKey, value);
      settingRegistrations.get(fullKey)?.onChange?.(value);
      return value;
    },
  },
  system: { version: "0.1.0-alpha.0" },
  version: "14.365",
};

const bundle = path.resolve("dist/d6-system-2e.mjs");
await import(pathToFileURL(bundle).href);

for (const hook of ["init", "ready"]) {
  const callback = callbacks.get(hook);
  if (typeof callback !== "function") {
    throw new Error(`Generated bundle did not register the ${hook} lifecycle.`);
  }
  await callback();
}

const api = globalThis.game.system.api;
if (
  api?.apiVersion !== 1 ||
  api.systemId !== "d6-system-2e" ||
  !api.capabilities.has("foundation.identity")
) {
  throw new Error("Generated bundle did not install the foundation API.");
}
if (
  !settingRegistrations.has("d6-system-2e.useOpenD6Rules") ||
  settingRegistrations.size !== 8
) {
  throw new Error("Rules compatibility settings were not registered.");
}
if (
  globalThis.CONFIG.Actor.dataModels.character?.name !== "CharacterDataModel" ||
  globalThis.CONFIG.Item.dataModels.skill?.name !== "SkillDataModel" ||
  sheetRegistrations.length !== 2
) {
  throw new Error(
    "Generated bundle did not register the initial data models and sheets.",
  );
}
const characterSchema =
  globalThis.CONFIG.Actor.dataModels.character.defineSchema();
const skillSchema = globalThis.CONFIG.Item.dataModels.skill.defineSchema();
if (
  !characterSchema.attributes ||
  !characterSchema.resources ||
  !skillSchema.attributeId ||
  !skillSchema.score
) {
  throw new Error("Initial data model schemas are incomplete.");
}
const metadataWrites = [];
callbacks.get("preCreateActor")?.(
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
if (
  metadataWrites[0]?.["system._migration"]?.foundry !== "14.365" ||
  metadataWrites[0]?.["system._migration"]?.schema !== 1 ||
  metadataWrites[0]?.["system._migration"]?.system !== "0.1.0-alpha.0"
) {
  throw new Error("New-document migration metadata was not initialized.");
}
callbacks.get("preCreateActor")?.(
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
if (metadataWrites.length !== 1) {
  throw new Error("Existing import migration metadata was overwritten.");
}

console.info("Generated bundle lifecycle smoke test passed.");
