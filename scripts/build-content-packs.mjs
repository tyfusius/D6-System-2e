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
const manifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const profiles = [
  ["second-edition", "second-edition-skills"],
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

for (const [profile, directoryName] of profiles) {
  const directory = path.join(root, "packs", directoryName);
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
  const directory = path.join(root, "packs", directoryName);
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
