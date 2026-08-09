import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);

async function findPackDirectories(directory) {
  const packDirectories = [];
  const entries = await readdir(directory, { withFileTypes: true });

  if (entries.some((entry) => entry.isFile() && entry.name === "CURRENT")) {
    return [directory];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    packDirectories.push(
      ...(await findPackDirectories(path.join(directory, entry.name))),
    );
  }

  return packDirectories;
}

const roots = [path.join(root, "packs"), path.join(root, "packages")];
const packDirectories = (
  await Promise.all(roots.map((directory) => findPackDirectories(directory)))
).flat();

let updatedDocuments = 0;
let updatedPacks = 0;

for (const directory of packDirectories) {
  const database = new ClassicLevel(directory, { valueEncoding: "json" });
  const updates = [];

  for await (const [key, value] of database.iterator()) {
    if (
      value?._stats?.systemId !== manifest.id ||
      value._stats.systemVersion === manifest.version
    ) {
      continue;
    }

    updates.push({
      type: "put",
      key,
      value: {
        ...value,
        _stats: {
          ...value._stats,
          systemVersion: manifest.version,
        },
      },
    });
  }

  if (updates.length > 0) {
    await database.batch(updates);
    updatedDocuments += updates.length;
    updatedPacks += 1;
  }

  await database.close();
}

console.log(
  `Stamped ${updatedDocuments} documents across ${updatedPacks} packs with ${manifest.version}.`,
);
