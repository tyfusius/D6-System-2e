import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/open-d6-fantasy-d6-system-2e");
const catalog = (
  await import(pathToFileURL(path.join(moduleRoot, "content/catalog.mjs")))
).default;
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const systemManifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const id = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
const stats = () => ({
  compendiumSource: null,
  coreVersion: "14.365",
  createdTime: null,
  duplicateSource: null,
  lastModifiedBy: null,
  modifiedTime: null,
  systemId: systemManifest.id,
  systemVersion: systemManifest.version,
});
const item = (pack, name, type, system) => ({
  _id: id(`${manifest.id}:${pack}:${type}:${name}`),
  effects: [],
  folder: null,
  flags: {},
  img:
    type === "armor"
      ? "icons/svg/shield.svg"
      : type === "weapon"
        ? "icons/svg/sword.svg"
        : type === "skill"
          ? "icons/svg/dice-target.svg"
          : "icons/svg/item-bag.svg",
  name,
  ownership: { default: 0 },
  sort: 0,
  system,
  type,
  _stats: stats(),
});
const skillItem = (entry, actorId = "") => ({
  ...item("skills", entry.name, "skill", {
    attributeId: entry.attributeId,
    description: "",
    key: entry.key,
    score: 0,
    source: {
      book: entry.source.book,
      module: manifest.id,
      page: entry.source.page,
    },
    training: "standard",
  }),
  ...(actorId
    ? { _id: id(`${manifest.id}:${actorId}:skill:${entry.key}`) }
    : {}),
});
const templateItem = (entry) => {
  const result = item(
    "character-templates",
    entry.label,
    "character-template",
    {
      activation: "Apply from a Character's creation workspace",
      cost: 0,
      description: `Fantasy creation template. Apply through Preview & Apply or drag this entry onto a Character sheet during creation. See D6 Fantasy, printed p. ${entry.source.page}.`,
      frequency: "always",
      key: entry.id,
      rank: 1,
    },
  );
  result.flags = {
    [systemManifest.id]: {
      characterTemplate: {
        catalogId: catalog.characterTemplateCatalog.id,
        rulesFamily: entry.rulesFamily,
        templateId: entry.id,
        version: entry.version,
      },
    },
  };
  return result;
};
const equipmentItem = (entry) =>
  item("equipment", entry.name, entry.kind, entry.system);
const actor = (entry) => ({
  _id: id(`${manifest.id}:generic:${entry.id}`),
  effects: [],
  folder: null,
  flags: {},
  img: "icons/svg/mystery-man.svg",
  items: catalog.packs.skills.map((skill) => {
    const source = skillItem(skill, entry.id);
    const combined = entry.skillScores?.[skill.key];
    if (combined !== undefined)
      source.system.score = Math.max(
        0,
        combined - (entry.attributeScores[skill.attributeId] ?? 0),
      );
    return source;
  }),
  name: entry.label,
  ownership: { default: 0 },
  sort: 0,
  system: {
    attributes: Object.fromEntries(
      Object.entries(entry.attributeScores).map(([key, score]) => [
        key,
        { score },
      ]),
    ),
    bestiary: {
      applied: true,
      catalogId: catalog.bestiaryCatalog.id,
      entryId: entry.id,
      label: entry.label,
      ownerId: manifest.id,
      sourceBook: entry.source.book,
      sourcePage: entry.source.page,
      version: entry.version,
    },
    biography: entry.biography,
    defenses: { dodgeOverride: 0, parryOverride: 0 },
    movement: { base: entry.move ?? 10, current: entry.move ?? 10 },
    resources: { magicPoints: { initialized: false, value: 0 } },
    scale: entry.scale ?? 0,
  },
  type: "creature",
  _stats: stats(),
});
async function pack(name, documentName, entries) {
  const directory = path.join(moduleRoot, "packs", name);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const operations = entries.flatMap((entry) =>
    documentName === "Item"
      ? [{ type: "put", key: `!items!${entry._id}`, value: entry }]
      : [
          {
            type: "put",
            key: `!actors!${entry._id}`,
            value: { ...entry, items: entry.items.map(({ _id }) => _id) },
          },
          ...entry.items.map((embedded) => ({
            type: "put",
            key: `!actors.items!${entry._id}.${embedded._id}`,
            value: embedded,
          })),
        ],
  );
  await db.batch(operations);
  await db.close();
  console.info(
    `Built ${manifest.id}.${name}: ${entries.length} ${documentName} documents`,
  );
}
await Promise.all([
  pack(
    "skills",
    "Item",
    catalog.packs.skills.map((entry) => skillItem(entry)),
  ),
  pack("equipment", "Item", catalog.packs.equipment.map(equipmentItem)),
  pack(
    "character-templates",
    "Item",
    catalog.packs.templates.map(templateItem),
  ),
  pack("generic-characters", "Actor", catalog.packs.bestiaryEntries.map(actor)),
]);
