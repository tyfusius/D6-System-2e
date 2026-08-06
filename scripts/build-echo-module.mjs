import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/echod6-companion-d6-system-2e");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);

async function writeRecords(name, records) {
  const directory = path.join(moduleRoot, "packs", name);
  await rm(directory, { force: true, recursive: true });
  const database = new ClassicLevel(directory, { valueEncoding: "json" });
  await database.batch(
    records.map(({ key, value }) => ({ type: "put", key, value })),
  );
  await database.close();
  console.info(`Built ${manifest.id}.${name}: ${records.length} records`);
}

await Promise.all([
  writeRecords("characters", []),
  writeRecords("character-templates", []),
  writeRecords("equipment", []),
  writeRecords("powers", []),
  writeRecords("vehicles-starships", []),
]);
