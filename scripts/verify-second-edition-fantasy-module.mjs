import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const system = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const moduleRoot = path.join(root, "packages/d6-system-2e-fantasy");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);
const moduleSource = await readFile(
  path.join(moduleRoot, "src/main.ts"),
  "utf8",
);

if (
  manifest.id !== "d6-system-2e-fantasy" ||
  manifest.version !== system.version ||
  manifest.relationships?.systems?.[0]?.id !== system.id ||
  manifest.packs?.map(({ name }) => name).join(",") !==
    "second-edition-fantasy-creatures,second-edition-fantasy-templates"
) {
  throw new Error("Second Edition Fantasy manifest is invalid.");
}
if (
  !moduleSource.includes('family: "fantasy"') ||
  !moduleSource.includes('mechanicIds: ["fantasy-skills-magic"]') ||
  moduleSource.includes("game.settings.set") ||
  moduleSource.includes("applyPreset")
) {
  throw new Error(
    "Second Edition Fantasy must advertise recommended mechanics without activating rules.",
  );
}
const extractedPacks = manifest.packs.map(({ name }) => name);
if (system.packs.some(({ name }) => extractedPacks.includes(name))) {
  throw new Error(
    "Extracted Fantasy packs remain in the base system manifest.",
  );
}
const expectedCounts = new Map([
  ["second-edition-fantasy-creatures", 4],
  ["second-edition-fantasy-templates", 4],
]);
for (const pack of manifest.packs) {
  const directory = path.join(moduleRoot, pack.path);
  await access(directory);
  const db = new ClassicLevel(directory, {
    readOnly: true,
    valueEncoding: "json",
  });
  let count = 0;
  for await (const [key, value] of db.iterator()) {
    const documentPrefix = pack.type === "Actor" ? "!actors!" : "!items!";
    if (!key.startsWith(documentPrefix)) continue;
    if (
      value._stats?.systemId !== system.id ||
      value._stats?.systemVersion !== system.version
    ) {
      throw new Error(`${pack.name} contains invalid system provenance.`);
    }
    count += 1;
  }
  await db.close();
  const expected = expectedCounts.get(pack.name);
  if (count !== expected) {
    throw new Error(
      `${pack.name} contains ${count} documents; expected ${expected}.`,
    );
  }
}

await access(path.join(moduleRoot, "d6-system-2e-fantasy.mjs"));
console.info(
  "Second Edition Fantasy module verified (4 creatures, 4 templates).",
);
