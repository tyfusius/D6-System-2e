import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/open-d6-adventure-d6-system-2e");
const catalog = (
  await import(pathToFileURL(path.join(moduleRoot, "content/catalog.mjs")))
).default;
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const source = await readFile(path.join(moduleRoot, "src/main.ts"), "utf8");

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

const expected = {
  advantages: 24,
  disadvantages: 44,
  equipment: 150,
  genericCharacters: 18,
  manifestations: 37,
  skills: 61,
  specialAbilities: 54,
  templates: 10,
  vehicles: 24,
};
verify(catalog.packageManifest.id === manifest.id, "Package IDs must match.");
verify(
  catalog.packageManifest.sources[0].pages === "9–42, 83–120, 126–137",
  "Adventure source boundary changed.",
);
verify(
  manifest.relationships?.recommends?.some(
    ({ id, manifest: manifestUrl }) =>
      id === "open-d6-core-content-d6-system-2e" &&
      typeof manifestUrl === "string",
  ),
  "Adventure must recommend First Edition Core Content.",
);
verify(
  source.includes('family: "first-edition-adventure"') &&
    source.includes('recommendedPrimaryProfile: "open-d6"') &&
    source.includes('"adventure-magic", "adventure-psionics"'),
  "Adventure must register its profile and optional mechanics identity.",
);
verify(
  catalog.genreProfile.skills.length === expected.skills,
  "Adventure must register all 61 Skills.",
);
verify(
  catalog.characterTemplateCatalog.templates.length === expected.templates,
  "Adventure must ship ten original/generic occupation templates.",
);
verify(
  catalog.bestiaryCatalog.entries.length === expected.genericCharacters,
  "Adventure must ship 18 generic people, animals, and monsters.",
);
verify(
  catalog.equipmentCatalog.entries.length === expected.equipment,
  "Adventure must ship all 150 audited equipment records.",
);
for (const entry of catalog.equipmentCatalog.entries) {
  verify(
    /^[a-z][a-z0-9.-]*$/u.test(entry.id),
    `${entry.name} must have a registry-safe equipment ID.`,
  );
  verify(
    entry.system.equipmentProvenance.entryId === entry.id,
    `${entry.name} equipment provenance must use its catalog ID.`,
  );
}
verify(
  catalog.packs.manifestations.filter(
    ({ system }) => system.firstEdition.tradition === "magic",
  ).length === 27,
  "Adventure must ship 27 generic spell examples.",
);
verify(
  catalog.packs.manifestations.filter(
    ({ system }) => system.firstEdition.tradition === "psionics",
  ).length === 10,
  "Adventure must ship ten generic Psionics manifestations.",
);
const serialized = JSON.stringify(catalog);
for (const forbidden of [
  "Permission is hereby granted",
  "Copyright 2004 Purgatory",
  "D6 Adventure Locations",
  "D6 Adventure Creatures",
  "D6 Adventure Magic",
]) {
  verify(
    !serialized.includes(forbidden),
    `Adventure catalog contains protected or license prose: ${forbidden}`,
  );
}
for (const manifestation of catalog.packs.manifestations) {
  verify(
    /^Adventure (Spell Example|Psionic Exercise) \d{2}$/u.test(
      manifestation.name,
    ),
    `${manifestation.name} must use an original/generic label.`,
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
          : pack.name;
  verify(
    documents === expected[catalogKey],
    `${pack.name} contains ${documents} documents; expected ${expected[catalogKey]}.`,
  );
}

console.info(
  "Open D6 Adventure verified: 61 Skills, 150 equipment records, 37 manifestations, 24 vehicles, 18 generic profiles, and 10 templates.",
);
