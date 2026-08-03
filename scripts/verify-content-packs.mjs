import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(path.join(root, "content/skills.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const profiles = [
  ["second-edition", "second-edition-skills"],
  ["open-d6", "open-d6-skills"],
];

for (const [profile, directoryName] of profiles) {
  const expected = catalog.filter((entry) =>
    entry.profiles.includes(profile),
  ).length;
  const db = new ClassicLevel(path.join(root, "packs", directoryName), {
    readOnly: true,
    valueEncoding: "json",
  });
  let actual = 0;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    if (
      value.type !== "skill" ||
      value.system?.description !== "" ||
      typeof value.system?.source?.book !== "string" ||
      value._stats?.systemId !== manifest.id ||
      value._stats?.systemVersion !== manifest.version
    ) {
      throw new Error(`Invalid catalog document ${key} in ${directoryName}.`);
    }
    actual += 1;
  }
  await db.close();
  if (actual !== expected) {
    throw new Error(
      `${directoryName} contains ${actual} skills; expected ${expected}.`,
    );
  }
}

console.info("Content packs match their structured catalog.");
