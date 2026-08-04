import { readFile } from "node:fs/promises";
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
  [
    "open-d6",
    "open-d6-skills",
    "packages/open-d6-core-content-d6-system-2e/packs",
  ],
];

for (const [profile, directoryName, parent = "packs"] of profiles) {
  const expected = catalog.filter((entry) =>
    entry.profiles.includes(profile),
  ).length;
  const db = new ClassicLevel(path.join(root, parent, directoryName), {
    readOnly: true,
    valueEncoding: "json",
  });
  let actual = 0;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    if (
      value.type !== "skill" ||
      value.system?.description !== "" ||
      typeof value.system?.source?.book !== "string" ||
      value._stats?.systemId !== manifest.id ||
      value._stats?.systemVersion !== manifest.version
    ) {
      throw new Error(`Invalid catalog document ${key} in ${directoryName}.`);
    }
    actual += 1;
  }
  await db.close();
  if (actual !== expected) {
    throw new Error(
      `${directoryName} contains ${actual} skills; expected ${expected}.`,
    );
  }
}

{
  const directoryName = "second-edition-equipment";
  const expectedById = new Map(
    equipmentCatalog.entries.map((entry) => [entry.id, entry]),
  );
  const db = new ClassicLevel(
    path.join(root, "packages/d6-system-2e-core-content/packs", directoryName),
    {
      readOnly: true,
      valueEncoding: "json",
    },
  );
  let actual = 0;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    const provenance = value.system?.equipmentProvenance;
    const expected = expectedById.get(provenance?.entryId);
    if (
      !expected ||
      value.type !== expected.kind ||
      value.name !== expected.name ||
      provenance.catalogId !== equipmentCatalog.id ||
      provenance.catalogVersion !== equipmentCatalog.version ||
      provenance.era !== expected.era ||
      provenance.sourceBook !== expected.source.book ||
      provenance.sourcePage !== expected.source.page ||
      value._stats?.systemId !== manifest.id ||
      value._stats?.systemVersion !== manifest.version
    ) {
      throw new Error(`Invalid catalog document ${key} in ${directoryName}.`);
    }
    actual += 1;
  }
  await db.close();
  if (actual !== expectedById.size) {
    throw new Error(
      `${directoryName} contains ${actual} items; expected ${expectedById.size}.`,
    );
  }
}

{
  const directoryName = "second-edition-fantasy-creatures";
  const expectedById = new Map(
    fantasyBestiaryCatalog.entries.map((entry) => [entry.id, entry]),
  );
  const db = new ClassicLevel(
    path.join(root, "packages/d6-system-2e-fantasy/packs", directoryName),
    { readOnly: true, valueEncoding: "json" },
  );
  let actual = 0;
  let embeddedActual = 0;
  let embeddedExpected = 0;
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith("!actors.items!")) {
      embeddedActual += 1;
      continue;
    }
    if (!key.startsWith("!actors!")) continue;
    const provenance = value.system?.bestiary;
    const expected = expectedById.get(provenance?.entryId);
    const itemIds = Array.isArray(value.items) ? value.items : [];
    if (
      !expected ||
      value.type !== "creature" ||
      value.name !== expected.label ||
      provenance.catalogId !== fantasyBestiaryCatalog.id ||
      provenance.sourceBook !== expected.source.book ||
      provenance.sourcePage !== expected.source.page ||
      value.system?.defenses?.dodgeOverride !==
        expected.defenseOverrides.dodge ||
      value.system?.defenses?.parryOverride !==
        expected.defenseOverrides.parry ||
      value._stats?.systemId !== manifest.id ||
      value._stats?.systemVersion !== manifest.version ||
      itemIds.some((itemId) => typeof itemId !== "string")
    ) {
      throw new Error(`Invalid catalog document ${key} in ${directoryName}.`);
    }
    for (const itemId of itemIds) {
      await db.get(`!actors.items!${value._id}.${itemId}`);
    }
    embeddedExpected += itemIds.length;
    actual += 1;
  }
  await db.close();
  if (actual !== expectedById.size) {
    throw new Error(
      `${directoryName} contains ${actual} creatures; expected ${expectedById.size}.`,
    );
  }
  if (embeddedActual !== embeddedExpected) {
    throw new Error(
      `${directoryName} contains ${embeddedActual} embedded items; expected ${embeddedExpected}.`,
    );
  }
}

{
  const directoryName = "second-edition-fantasy-templates";
  const expectedById = new Map(
    fantasyTemplateCatalog.templates.map((entry) => [entry.id, entry]),
  );
  const db = new ClassicLevel(
    path.join(root, "packages/d6-system-2e-fantasy/packs", directoryName),
    { readOnly: true, valueEncoding: "json" },
  );
  let actual = 0;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    const provenance = value.flags?.[manifest.id]?.characterTemplate;
    const expected = expectedById.get(provenance?.templateId);
    if (
      !expected ||
      value.type !== "character-template" ||
      value.name !== expected.label ||
      provenance.catalogId !== fantasyTemplateCatalog.id ||
      provenance.rulesFamily !== expected.rulesFamily ||
      provenance.version !== expected.version ||
      value.system?.key !== expected.id ||
      !value.system?.description?.includes("drag this entry") ||
      !value.system?.description?.includes(`p. ${expected.source.page}`) ||
      value._stats?.systemId !== manifest.id ||
      value._stats?.systemVersion !== manifest.version
    ) {
      throw new Error(`Invalid catalog document ${key} in ${directoryName}.`);
    }
    actual += 1;
  }
  await db.close();
  if (actual !== expectedById.size) {
    throw new Error(
      `${directoryName} contains ${actual} templates; expected ${expectedById.size}.`,
    );
  }
}

console.info("Content packs match their structured catalog.");
