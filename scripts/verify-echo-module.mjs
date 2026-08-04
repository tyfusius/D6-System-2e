import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/echod6-companion-d6-system-2e");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

const declaredPacks = new Map(manifest.packs.map((pack) => [pack.name, pack]));
verify(
  JSON.stringify(manifest.packFolders?.[0]?.folders?.[0]?.packs) ===
    JSON.stringify([
      "characters",
      "character-templates",
      "equipment",
      "powers",
      "vehicles-starships",
    ]),
  "Echo packs must remain grouped under Setting Companions / Echo D6.",
);

for (const [packName, expectedRecords] of [
  ["characters", 0],
  ["character-templates", 0],
  ["equipment", 0],
  ["powers", 0],
  ["vehicles-starships", 0],
]) {
  const pack = declaredPacks.get(packName);
  const database = new ClassicLevel(path.join(moduleRoot, pack.path), {
    readOnly: true,
    valueEncoding: "json",
  });
  const records = [];
  for await (const [, value] of database.iterator()) records.push(value);
  await database.close();
  verify(
    records.length === expectedRecords,
    `${packName} contains ${records.length} records; expected ${expectedRecords}.`,
  );
  verify(
    records.every(
      (record) =>
        record._stats?.systemId === "d6-system-2e" &&
        record._stats?.systemVersion === manifest.version,
    ),
    `${packName} contains stale or foreign records.`,
  );
}

console.info("Echo D6 companion packs verified: 5 empty content shells.");
