import { readFile } from "node:fs/promises";
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
const verify = (value, message) => {
  if (!value) throw new Error(message);
};
verify(
  catalog.genreProfile.skills.length === 54,
  "Fantasy must register all 54 genre Skills.",
);
verify(
  catalog.characterTemplateCatalog.templates.length === 10,
  "Fantasy must ship ten templates.",
);
verify(
  catalog.characterTemplateCatalog.templates.every(({ id }) =>
    id.startsWith("open-d6-fantasy-"),
  ),
  "Fantasy template IDs must remain namespaced away from system templates.",
);
verify(
  catalog.bestiaryCatalog.entries.length === 14,
  "Fantasy must ship all audited pp. 125–126 generic profiles.",
);
verify(
  catalog.equipmentCatalog.entries.length === 141,
  "Fantasy must ship all audited personal equipment records.",
);
verify(
  catalog.packs.manifestations.length === 38,
  "Fantasy must ship 38 spells and miracles.",
);
verify(
  catalog.packs.ancestries.length === 4,
  "Fantasy must ship four ancestry packages.",
);
verify(
  catalog.packs.ancestryFeatures.length === 20,
  "Fantasy ancestry mechanics changed unexpectedly.",
);
verify(
  catalog.packs.vehicles.length === 12,
  "Fantasy must ship twelve vehicle actors.",
);
verify(
  catalog.packs.shipWeapons.length === 4,
  "Fantasy must ship four ship weapons.",
);
verify(
  catalog.packageManifest.sources[0].pages === "9–43, 83–119, 125–126, 128–137",
  "Fantasy source boundary changed.",
);
for (const declared of manifest.packs) {
  const db = new ClassicLevel(path.join(moduleRoot, declared.path), {
    valueEncoding: "json",
    readOnly: true,
  });
  let count = 0;
  for await (const [key] of db.iterator())
    if (key.startsWith(declared.type === "Actor" ? "!actors!" : "!items!"))
      count += 1;
  await db.close();
  verify(count > 0, `${declared.label} is empty.`);
}
console.info(
  "Verified Open D6 Fantasy module: 54 Skills, 141 equipment records, 38 manifestations, four ancestries, 12 vehicles, four ship weapons, 14 generic profiles, and 10 templates.",
);
