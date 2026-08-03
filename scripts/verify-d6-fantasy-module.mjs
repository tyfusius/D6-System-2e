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
  catalog.bestiaryCatalog.entries.length === 14,
  "Fantasy must ship all audited pp. 125–126 generic profiles.",
);
verify(
  catalog.equipmentCatalog.entries.length === 26,
  "Fantasy equipment count changed unexpectedly.",
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
  "Verified Open D6 Fantasy module: 54 Skills, 26 equipment records, 14 generic profiles, and 10 templates.",
);
