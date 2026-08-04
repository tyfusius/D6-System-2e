import { readFile } from "node:fs/promises";
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
const license = await readFile(
  path.join(moduleRoot, "OPEN-GAME-LICENSE.txt"),
  "utf8",
);

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

const expected = {
  advantages: 24,
  cybernetics: 3,
  disadvantages: 44,
  equipment: 104,
  genericCharacters: 10,
  metaphysics: 3,
  shipDesign: 17,
  specialAbilities: 54,
  templates: 10,
  vehicles: 8,
};
for (const [key, count] of Object.entries(expected)) {
  verify(
    catalog.packs[key]?.length === count,
    `${key} must contain ${count} records.`,
  );
}
verify(
  catalog.packageManifest.id === manifest.id,
  "Package manifest ID must match the Foundry module ID.",
);
verify(
  catalog.packageManifest.rulesFamily === "open-d6-first-edition",
  "The Space package must remain First Edition scoped.",
);
verify(
  manifest.relationships?.recommends?.some(
    ({ id, manifest: manifestUrl }) =>
      id === "open-d6-core-content-d6-system-2e" &&
      typeof manifestUrl === "string",
  ),
  "The Space package must recommend First Edition Core Content.",
);
const source = await readFile(path.join(moduleRoot, "src/main.ts"), "utf8");
verify(
  source.includes('family: "first-edition-space"') &&
    source.includes('recommendedPrimaryProfile: "open-d6"'),
  "The Space package must register its aligned content identity.",
);
verify(
  catalog.equipmentCatalog.entries.length === expected.equipment,
  "Equipment registry and compendium must share all records.",
);
verify(
  catalog.characterTemplateCatalog.templates.length === expected.templates,
  "All ten printed templates must be registered.",
);
verify(
  catalog.bestiaryCatalog.entries.length === expected.genericCharacters,
  "All generic people and animals must be registered.",
);
verify(
  license.includes(
    "D6 Space (WEG 51012), Copyright 2004, Purgatory Publishing Inc.",
  ),
  "The exact source copyright notice is required.",
);

const serialized = JSON.stringify(catalog);
for (const forbidden of [
  "<p>",
  "Permission is hereby granted",
  "Description: Life is",
  "Copyright 2004 Purgatory",
]) {
  verify(
    !serialized.includes(forbidden),
    `Public catalog contains forbidden source prose: ${forbidden}`,
  );
}
for (const entry of [
  ...catalog.packs.advantages,
  ...catalog.packs.disadvantages,
  ...catalog.packs.specialAbilities,
  ...catalog.packs.cybernetics,
  ...catalog.packs.equipment,
  ...catalog.packs.metaphysics,
  ...catalog.packs.shipDesign,
]) {
  verify(
    Number.isSafeInteger(entry.sourcePage ?? entry.source?.page),
    `${entry.name} requires printed-page provenance.`,
  );
  verify(
    JSON.stringify(entry.system ?? {}).length < 1_800,
    `${entry.name} exceeds the bounded mechanical record size.`,
  );
}

for (const pack of manifest.packs) {
  const db = new ClassicLevel(path.join(moduleRoot, pack.path), {
    readOnly: true,
    valueEncoding: "json",
  });
  let documents = 0;
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith("!items!") || key.startsWith("!actors!")) {
      verify(
        value._stats?.systemId === "d6-system-2e",
        `${pack.name} contains a document for another system.`,
      );
      documents += 1;
    }
  }
  await db.close();
  const catalogKey =
    pack.name === "special-abilities"
      ? "specialAbilities"
      : pack.name === "generic-characters"
        ? "genericCharacters"
        : pack.name === "character-templates"
          ? "templates"
          : pack.name === "ship-design"
            ? "shipDesign"
            : pack.name;
  verify(
    documents === expected[catalogKey],
    `${pack.name} contains ${documents} top-level documents; expected ${expected[catalogKey]}.`,
  );
}

console.info(
  "Open D6 Space module catalogs, license boundary, and Foundry packs verified (277 records). ",
);
