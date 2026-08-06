import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/open-d6-space-d6-system-2e");
const catalog = JSON.parse(
  await readFile(path.join(moduleRoot, "content/catalog.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const systemManifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const skills = JSON.parse(
  await readFile(path.join(root, "content/skills.json"), "utf8"),
);

function id(identity) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function stats() {
  return {
    compendiumSource: null,
    coreVersion: "14.365",
    createdTime: null,
    duplicateSource: null,
    lastModifiedBy: null,
    modifiedTime: null,
    systemId: systemManifest.id,
    systemVersion: systemManifest.version,
  };
}

function itemSource(pack, entry) {
  return {
    _id: id(`${manifest.id}:${pack}:${entry.type}:${entry.name}`),
    effects: [],
    folder: null,
    flags: {},
    img:
      entry.type === "armor"
        ? "icons/svg/shield.svg"
        : entry.type === "weapon"
          ? "icons/svg/sword.svg"
          : entry.type === "skill"
            ? "icons/svg/dice-target.svg"
            : "icons/svg/item-bag.svg",
    name: entry.name,
    ownership: { default: 0 },
    sort: 0,
    system: entry.system,
    type: entry.type,
    _stats: stats(),
  };
}

function templateSource(template) {
  const attributes = Object.entries(template.attributeScores)
    .map(
      ([key, score]) =>
        `${key}: ${Math.floor(score / 3)}D${score % 3 ? `+${score % 3}` : ""}`,
    )
    .join(", ");
  const source = itemSource("character-templates", {
    name: template.label,
    system: {
      activation: "Apply from a Character's creation workspace",
      cost: 0,
      description: `Space creation template. Attributes: ${attributes}. Suggested Skills: ${template.suggestedSkillKeys.join(", ")}. Apply through Preview & Apply or drag this entry onto a Character sheet during creation. Source: Open D6 Space, printed p. ${template.source.page}.`,
      frequency: "always",
      key: template.id,
      rank: 1,
    },
    type: "character-template",
  });
  source.flags = {
    [systemManifest.id]: {
      characterTemplate: {
        catalogId: catalog.characterTemplateCatalog.id,
        rulesFamily: template.rulesFamily,
        templateId: template.id,
        version: template.version,
      },
    },
  };
  return source;
}

function skillSource(entry, actorEntry) {
  const combined = actorEntry.skillScores?.[entry.key];
  return {
    ...itemSource("generic-characters", {
      name: entry.name,
      system: {
        attributeId: entry.attributeId,
        description: "",
        key: entry.key,
        score:
          combined === undefined
            ? 0
            : Math.max(
                0,
                combined - (actorEntry.attributeScores[entry.attributeId] ?? 0),
              ),
        source: {
          book: "Open D6 Space",
          module: entry.module,
          page: entry.sourcePage,
        },
        training: entry.training ?? "standard",
      },
      type: "skill",
    }),
    _id: id(`${manifest.id}:generic:${actorEntry.id}:skill:${entry.key}`),
  };
}

function embeddedItemSource(entry, item, index) {
  return {
    ...itemSource("generic-characters", item),
    _id: id(`${manifest.id}:generic:${entry.id}:item:${index}:${item.name}`),
  };
}

function genericActorSource(entry) {
  const actorId = id(`${manifest.id}:generic:${entry.id}`);
  const embedded = [
    ...skills
      .filter((skill) => skill.profiles.includes("open-d6"))
      .map((skill) => skillSource(skill, entry)),
    ...(entry.items ?? []).map((item, index) =>
      embeddedItemSource(entry, item, index),
    ),
  ];
  return {
    _id: actorId,
    effects: [],
    folder: null,
    flags: {},
    img: "icons/svg/mystery-man.svg",
    items: embedded,
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
      biography: `Generic mechanical profile. See Open D6 Space, printed p. ${entry.source.page}.`,
      defenses: {
        dodgeOverride: entry.defenseOverrides.dodge,
        parryOverride: entry.defenseOverrides.parry,
      },
      resources: { magicPoints: { initialized: false, value: 0 } },
      scale: entry.scale ?? 0,
    },
    type: "creature",
    _stats: stats(),
  };
}

function vehicleActorSource(entry) {
  return {
    _id: id(`${manifest.id}:vehicles:${entry.name}`),
    effects: [],
    folder: null,
    flags: {},
    img: "icons/svg/wing.svg",
    items: [],
    name: entry.name,
    ownership: { default: 0 },
    sort: 0,
    system: entry.system,
    type: "vehicle",
    _stats: stats(),
  };
}

async function writePack(name, documentName, entries) {
  const directory = path.join(moduleRoot, "packs", name);
  await rm(directory, { force: true, recursive: true });
  const db = new ClassicLevel(directory, { valueEncoding: "json" });
  const documentKey = documentName === "Actor" ? "actors" : "items";
  const operations = entries.flatMap((entry) => {
    if (documentName !== "Actor")
      return [
        { type: "put", key: `!${documentKey}!${entry._id}`, value: entry },
      ];
    return [
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
    ];
  });
  await db.batch(operations);
  await db.close();
  console.info(
    `Built ${manifest.id}.${name}: ${entries.length} ${documentName} documents`,
  );
}

await Promise.all([
  writePack(
    "advantages",
    "Item",
    catalog.packs.advantages.map((entry) => itemSource("advantages", entry)),
  ),
  writePack(
    "disadvantages",
    "Item",
    catalog.packs.disadvantages.map((entry) =>
      itemSource("disadvantages", entry),
    ),
  ),
  writePack(
    "special-abilities",
    "Item",
    catalog.packs.specialAbilities.map((entry) =>
      itemSource("special-abilities", entry),
    ),
  ),
  writePack(
    "cybernetics",
    "Item",
    catalog.packs.cybernetics.map((entry) => itemSource("cybernetics", entry)),
  ),
  writePack(
    "equipment",
    "Item",
    catalog.packs.equipment.map((entry) =>
      itemSource("equipment", {
        name: entry.name,
        system: entry.system,
        type: entry.kind,
      }),
    ),
  ),
  writePack(
    "vehicles",
    "Actor",
    catalog.packs.vehicles.map(vehicleActorSource),
  ),
  writePack(
    "metaphysics",
    "Item",
    catalog.packs.metaphysics.map((entry) => itemSource("metaphysics", entry)),
  ),
  writePack(
    "ship-design",
    "Item",
    catalog.packs.shipDesign.map((entry) => itemSource("ship-design", entry)),
  ),
  writePack(
    "generic-characters",
    "Actor",
    catalog.packs.genericCharacters.map(genericActorSource),
  ),
  writePack(
    "character-templates",
    "Item",
    catalog.packs.templates.map(templateSource),
  ),
]);
