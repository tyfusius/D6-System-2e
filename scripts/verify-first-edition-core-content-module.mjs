import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const system = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const moduleRoot = path.join(
  root,
  "packages/open-d6-core-content-d6-system-2e",
);
const manifest = JSON.parse(
  await readFile(path.join(moduleRoot, "module.json"), "utf8"),
);

if (
  manifest.id !== "open-d6-core-content-d6-system-2e" ||
  manifest.version !== system.version ||
  manifest.relationships?.systems?.[0]?.id !== system.id ||
  manifest.packs?.map(({ name }) => name).join(",") !== "open-d6-skills"
) {
  throw new Error("First Edition Core Content manifest is invalid.");
}
if (system.packs.some(({ name }) => name === "open-d6-skills")) {
  throw new Error(
    "First Edition Core Skills remain in the base system manifest.",
  );
}
const db = new ClassicLevel(path.join(moduleRoot, "packs/open-d6-skills"), {
  readOnly: true,
  valueEncoding: "json",
});
let count = 0;
for await (const [key, value] of db.iterator()) {
  if (!key.startsWith("!items!")) continue;
  if (
    value.type !== "skill" ||
    value._stats?.systemId !== system.id ||
    value._stats?.systemVersion !== system.version
  ) {
    throw new Error("Open D6 Core Content contains invalid provenance.");
  }
  count += 1;
}
await db.close();
if (count !== 60) {
  throw new Error(`open-d6-skills contains ${count} documents; expected 60.`);
}
await access(path.join(moduleRoot, "open-d6-core-content-d6-system-2e.mjs"));
console.info("First Edition Core Content module verified (60 Skills). ");
