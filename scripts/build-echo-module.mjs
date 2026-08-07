import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/echod6-companion-d6-system-2e");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const echoSceneSource = JSON.parse(
  await readFile(
    path.join(moduleRoot, "content/scenes/echo-main.json"),
    "utf8",
  ),
);

async function writeRecords(name, records) {
  const directory = path.join(moduleRoot, "packs", name);
  if (records.length === 0) {
    try {
      await access(path.join(directory, "CURRENT"));
      const existing = new ClassicLevel(directory, {
        readOnly: true,
        valueEncoding: "json",
      });
      const existingRecords = (await existing.iterator().all()).length;
      await existing.close();
      if (existingRecords > 0) {
        throw new Error(
          `Refusing to replace ${manifest.id}.${name}: it contains ${existingRecords} unsourced record(s). Copy them to a world compendium or add them to source-backed content first.`,
        );
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await rm(directory, { force: true, recursive: true });
  const database = new ClassicLevel(directory, { valueEncoding: "json" });
  await database.batch(
    records.map(({ key, value }) => ({
      type: "put",
      key,
      value: value._stats
        ? {
            ...value,
            _stats: {
              ...value._stats,
              systemId: "d6-system-2e",
              systemVersion: manifest.version,
            },
          }
        : value,
    })),
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
  writeRecords("scenes", echoSceneSource.records),
]);
