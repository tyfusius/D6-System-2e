import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(path.join(root, "content/skills.json"), "utf8"),
);
const equipmentCatalog = JSON.parse(
  await readFile(path.join(root, "content/equipment-catalog.json"), "utf8"),
);
const fantasyBestiaryCatalog = JSON.parse(
  await readFile(
    path.join(root, "content/fantasy-bestiary-catalog.json"),
    "utf8",
  ),
);
const fantasyTemplateCatalog = JSON.parse(
  await readFile(
    path.join(root, "content/fantasy-character-template-catalog.json"),
    "utf8",
  ),
);
const manifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const profiles = [
  [
    "second-edition",
    "second-edition-skills",
    "packages/d6-system-2e-core-content/packs",
  ],
  ["open-d6", "open-d6-skills"],
];

function documentId(identity) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function source(entry, profile) {
  const _id = documentId(`${profile}:${entry.key}`);
  return {
    _id,
    name: entry.name,
    type: "skill",
    img: "icons/svg/dice-target.svg",
    system: {
      attributeId: entry.attributeId,
      description: "",
      key: entry.key,
      score: 0,
      source: {
        book:
          profile === "open-d6" ? "OpenD6 Space" : "D6 System: Second Edition",
        module: entry.module,
        page: entry.sourcePage,
      },
      training: "standard",
    },
    effects: [],
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: {
      compendiumSource: null,
      coreVersion: "14.365",
      createdTime: null,
      duplicateSource: null,
      lastModifiedBy: null,
      modifiedTime: null,
      systemId: "d6-system-2e",
      systemVersion: manifest.version,
    },
  };
}

function equipmentSource(entry) {
  const _id = documentId(`second-edition-equipment:${entry.id}`);
  const equipment = {
    context: "personal",
    equipped: false,
    equipmentProvenance: {
      catalogId: equipmentCatalog.id,
      catalogVersion: equipmentCatalog.version,
      entryId: entry.id,
      era: entry.era,
      ownerId: manifest.id,
      sourceBook: entry.source.book,
      sourcePage: entry.source.page,
    },
    mass: 0,
    quantity: 1,
    value: 0,
  };
  const typeDefaults =
    entry.kind === "armor"
      ? {
          context: "personal",
          coverage: "",
          energyResistance: 0,
          physicalResistance: 0,
          stackingTag: "body",
        }
      : entry.kind === "weapon"
        ? {
            ammunition: { current: 0, maximum: 0 },
            attackAttributeId: "agility",
            attackBonus: 0,
            attackSkillKey: "",
            autofireRating: 0,
            damage: 0,
            damageType: "",
            range: { long: 0, medium: 0, short: 0, shortMinimum: 0 },
            scale: 0,
            weaponKind: "standard",
          }
        : { availability: "", legality: "" };
  return {
    _id,
    name: entry.name,
    type: entry.kind,
    img:
      entry.kind === "armor"
        ? "icons/svg/shield.svg"
        : entry.kind === "weapon"
          ? "icons/svg/sword.svg"
          : "icons/svg/item-bag.svg",
    system: {
      description: "",
      key: entry.id,
      ...equipment,
      ...typeDefaults,
      ...entry.system,
    },
    effects: [],
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: {
      compendiumSource: null,
      coreVersion: "14.365",
      createdTime: null,
      duplicateSource: null,
      lastModifiedBy: null,
      modifiedTime: null,
      systemId: manifest.id,
      systemVersion: manifest.version,
    },
  };
}

function bestiaryItemSource(entry, item, index) {
  const _id = documentId(
    `second-edition-fantasy-creatures:${entry.id}:${item.name}:${index}`,
  );
  const common = {
    description: "",
    key: `${entry.id}-${index + 1}`,
  };
  const typeDefaults =
    item.type === "armor"
      ? {
          context: "personal",
          coverage: "",
          energyResistance: 0,
          equipmentProvenance: {
            catalogId: fantasyBestiaryCatalog.id,
            catalogVersion: fantasyBestiaryCatalog.version,
            entryId: entry.id,
            era: "medieval",
            ownerId: manifest.id,
            sourceBook: entry.source.book,
            sourcePage: entry.source.page,
          },
          equipped: true,
          mass: 0,
          physicalResistance: 0,
          quantity: 1,
          stackingTag: "body",
          value: 0,
        }
      : item.type === "weapon"
        ? {
            ammunition: { current: 0, maximum: 0 },
            attackAttributeId: "agility",
            attackBonus: 0,
            attackSkillKey: "",
            autofireRating: 0,
            context: "personal",
            damage: 0,
            damageType: "",
            equipmentProvenance: {
              catalogId: fantasyBestiaryCatalog.id,
              catalogVersion: fantasyBestiaryCatalog.version,
              entryId: entry.id,
              era: "medieval",
              ownerId: manifest.id,
              sourceBook: entry.source.book,
              sourcePage: entry.source.page,
            },
            equipped: true,
            mass: 0,
            quantity: 1,
            range: { long: 0, medium: 0, short: 0, shortMinimum: 0 },
            scale: 0,
            value: 0,
            weaponKind: "standard",
          }
        : {
            activation: "",
            cost: 0,
            frequency: "always",
            rank: 1,
          };
  return {
    _id,
    name: item.name,
    type: item.type,
    img:
      item.type === "armor"
        ? "icons/svg/shield.svg"
        : item.type === "weapon"
          ? "icons/svg/sword.svg"
          : "icons/svg/aura.svg",
    system: { ...common, ...typeDefaults, ...item.system },
    effects: [],
    flags: {
      [manifest.id]: {
        bestiary: {
          catalogId: fantasyBestiaryCatalog.id,
          entryId: entry.id,
          version: fantasyBestiaryCatalog.version,
        },
      },
    },
    sort: 0,
  };
}

function embeddedCoreSkillSource(entry, skill) {
  return {
    _id: documentId(
      `second-edition-fantasy-creatures:${entry.id}:skill:${skill.key}`,
    ),
    name: skill.name,
    type: "skill",
    img: "icons/svg/dice-target.svg",
    system: {
      attributeId: skill.attributeId,
      description: "",
      key: skill.key,
      score: 0,
      source: {
        book: "D6 System: Second Edition",
        module: skill.module,
        page: skill.sourcePage,
      },
      training: "standard",
    },
    effects: [],
    flags: {},
    sort: 0,
  };
}

function bestiaryActorSource(entry) {
  const _id = documentId(`second-edition-fantasy-creatures:${entry.id}`);
  const coreSkills = catalog.filter(
    (skill) =>
      skill.profiles.includes("second-edition") && skill.module === "core",
  );
  return {
    _id,
    name: entry.label,
    type: "creature",
    img: "icons/svg/mystery-man.svg",
    system: {
      attributes: Object.fromEntries(
        Object.entries(entry.attributeScores).map(([id, score]) => [
          id,
          { score },
        ]),
      ),
      bestiary: {
        applied: true,
        catalogId: fantasyBestiaryCatalog.id,
        entryId: entry.id,
        label: entry.label,
        ownerId: manifest.id,
        sourceBook: entry.source.book,
        sourcePage: entry.source.page,
        version: fantasyBestiaryCatalog.version,
      },
      biography: entry.biography ?? "",
      defenses: {
        dodgeOverride: entry.defenseOverrides.dodge,
        parryOverride: entry.defenseOverrides.parry,
      },
      resources: {
        magicPoints: {
          initialized: (entry.magicPoints ?? 0) > 0,
          value: entry.magicPoints ?? 0,
        },
      },
      scale: entry.scale ?? 0,
    },
    items: [
      ...coreSkills.map((skill) => embeddedCoreSkillSource(entry, skill)),
      ...(entry.items ?? []).map((item, index) =>
        bestiaryItemSource(entry, item, index),
      ),
    ],
    effects: [],
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: {
      compendiumSource: null,
      coreVersion: "14.365",
      createdTime: null,
      duplicateSource: null,
      lastModifiedBy: null,
      modifiedTime: null,
      systemId: manifest.id,
      systemVersion: manifest.version,
    },
  };
}

function fantasyTemplateSource(template) {
  const _id = documentId(`second-edition-fantasy-templates:${template.id}`);
  const attributes = Object.entries(template.attributeScores)
    .map(([id, score]) => `${id}: ${Math.floor(score / 3)}D`)
    .join(", ");
  return {
    _id,
    name: template.label,
    type: "character-template",
    img: "icons/svg/book.svg",
    system: {
      activation: "Apply from a Character's creation workspace",
      cost: 0,
      description: `Fantasy creation template. Attributes: ${attributes}. Suggested Skills: ${template.suggestedSkillKeys.join(", ")}. During character creation, apply through Preview & Apply or drag this entry onto the Character sheet. Source: ${template.source.book}, p. ${template.source.page}.`,
      frequency: "always",
      key: template.id,
      rank: 1,
    },
    effects: [],
    folder: null,
    flags: {
      [manifest.id]: {
        characterTemplate: {
          catalogId: fantasyTemplateCatalog.id,
          rulesFamily: template.rulesFamily,
          templateId: template.id,
          version: template.version,
        },
      },
    },
    ownership: { default: 0 },
    sort: 0,
    _stats: {
      compendiumSource: null,
      coreVersion: "14.365",
      createdTime: null,
      duplicateSource: null,
      lastModifiedBy: null,
      modifiedTime: null,
      systemId: manifest.id,
      systemVersion: manifest.version,
    },
  };
}

for (const [profile, directoryName, parent = "packs"] of profiles) {
  const directory = path.join(root, parent, directoryName);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const entries = catalog
    .filter((entry) => entry.profiles.includes(profile))
    .map((entry) => source(entry, profile));
  await db.batch(
    entries.map((entry) => ({
      type: "put",
      key: `!items!${entry._id}`,
      value: entry,
    })),
  );
  await db.close();
  console.info(`Built ${directoryName}: ${entries.length} skills`);
}

{
  const directoryName = "second-edition-equipment";
  const directory = path.join(
    root,
    "packages/d6-system-2e-core-content/packs",
    directoryName,
  );
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const entries = equipmentCatalog.entries.map(equipmentSource);
  await db.batch(
    entries.map((entry) => ({
      type: "put",
      key: `!items!${entry._id}`,
      value: entry,
    })),
  );
  await db.close();
  console.info(`Built ${directoryName}: ${entries.length} items`);
}

{
  const directoryName = "second-edition-fantasy-creatures";
  const directory = path.join(root, "packs", directoryName);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const entries = fantasyBestiaryCatalog.entries.map(bestiaryActorSource);
  await db.batch(
    entries.flatMap((entry) => [
      {
        type: "put",
        key: `!actors!${entry._id}`,
        value: { ...entry, items: entry.items.map((item) => item._id) },
      },
      ...entry.items.map((item) => ({
        type: "put",
        key: `!actors.items!${entry._id}.${item._id}`,
        value: item,
      })),
    ]),
  );
  await db.close();
  console.info(`Built ${directoryName}: ${entries.length} creatures`);
}

{
  const directoryName = "second-edition-fantasy-templates";
  const directory = path.join(root, "packs", directoryName);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const entries = fantasyTemplateCatalog.templates.map(fantasyTemplateSource);
  await db.batch(
    entries.map((entry) => ({
      type: "put",
      key: `!items!${entry._id}`,
      value: entry,
    })),
  );
  await db.close();
  console.info(`Built ${directoryName}: ${entries.length} templates`);
}
