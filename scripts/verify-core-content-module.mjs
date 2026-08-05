import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const system = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const moduleRoot = path.join(root, "packages/d6-system-2e-core-content");
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);

if (
  manifest.id !== "d6-system-2e-core-content" ||
  manifest.version !== system.version ||
  manifest.relationships?.systems?.[0]?.id !== system.id ||
  manifest.packs?.map(({ name }) => name).join(",") !==
    "second-edition-skills,second-edition-equipment,second-edition-core-templates"
) {
  throw new Error("Second Edition Core Content manifest is invalid.");
}
if (
  system.packs.some(({ name }) =>
    ["second-edition-skills", "second-edition-equipment"].includes(name),
  )
) {
  throw new Error(
    "Extracted Core Content packs remain in the base system manifest.",
  );
}
for (const pack of manifest.packs) {
  const directory = path.join(moduleRoot, pack.path);
  await access(directory);
  const db = new ClassicLevel(directory, {
    readOnly: true,
    valueEncoding: "json",
  });
  let count = 0;
  for await (const [key, value] of db.iterator()) {
    if (!key.startsWith("!items!")) continue;
    if (
      value._stats?.systemId !== system.id ||
      value._stats?.systemVersion !== system.version
    ) {
      throw new Error(`${pack.name} contains invalid system provenance.`);
    }
    count += 1;
  }
  await db.close();
  const expected =
    pack.name === "second-edition-skills"
      ? 49
      : pack.name === "second-edition-equipment"
        ? 84
        : 9;
  if (count !== expected) {
    throw new Error(
      `${pack.name} contains ${count} documents; expected ${expected}.`,
    );
  }
}

await access(path.join(moduleRoot, "d6-system-2e-core-content.mjs"));
console.info(
  "Second Edition Core Content module verified (49 Skills, 84 equipment Items, 9 Character Templates). ",
);
