import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "packages/echod6-companion-d6-system-2e");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const systemManifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

verify(
  !manifest.relationships?.requires?.length,
  "Echo must not require an Open D6 content module.",
);
verify(
  !systemManifest.relationships?.recommends?.some(
    ({ id }) => id === manifest.id,
  ),
  "The private Echo module must not be advertised as stock system content.",
);

const declaredPacks = new Map(manifest.packs.map((pack) => [pack.name, pack]));
verify(
  JSON.stringify(manifest.packFolders?.[0]?.folders?.[0]?.packs) ===
    JSON.stringify([
      "characters",
      "character-templates",
      "equipment",
      "powers",
      "vehicles-starships",
      "scenes",
    ]),
  "Echo packs must remain grouped under Setting Companions / Echo D6.",
);

for (const [packName, expectedRecords] of [
  ["characters", 0],
  ["character-templates", 0],
  ["equipment", 0],
  ["powers", 0],
  ["vehicles-starships", 0],
  ["scenes", 2],
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
  const topLevelRecords = records.filter((record) => record._stats);
  verify(
    topLevelRecords.every(
      (record) =>
        record._stats.systemId === "d6-system-2e" &&
        record._stats.systemVersion === manifest.version,
    ),
    `${packName} contains stale or foreign top-level records.`,
  );

  if (packName === "scenes") {
    const scene = records.find((record) => record.name === "Echo Main");
    const level = records.find((record) => record.name === "Level");
    verify(scene?._id === "XhAq7yg6z6XIfjZm", "Echo Main ID changed.");
    verify(
      scene?.active === false,
      "Bundled Echo Main must not activate on import.",
    );
    verify(
      scene?.tokens?.length === 0,
      "Bundled Echo Main must not retain test-world tokens.",
    );
    verify(
      level?.background?.src ===
        "systems/d6-system-2e/packages/echod6-companion-d6-system-2e/art/scenes/echo-start-scene.png",
      "Echo Main background must use the bundled portable asset.",
    );
  }
}

console.info(
  "Echo D6 companion packs verified: 5 empty content shells and 1 portable Scene.",
);
