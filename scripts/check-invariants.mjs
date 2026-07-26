import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "system.json"), "utf8"),
);
const schema = JSON.parse(
  await readFile(path.join(root, "schema-version.json"), "utf8"),
);
const english = JSON.parse(
  await readFile(path.join(root, "lang/en.json"), "utf8"),
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(manifest.id === "d6-system-2e", "Manifest system ID changed.");
invariant(
  manifest.title === "D6 System Second Edition",
  "Manifest title changed.",
);

const localizationKeys = Object.keys(english);
for (const key of localizationKeys) {
  invariant(
    !localizationKeys.some((candidate) => candidate.startsWith(`${key}.`)),
    `Localization key ${key} cannot also be a namespace in Foundry v14.`,
  );
}
invariant(
  manifest.flags?.["d6-system-2e"]?.schemaVersion === schema.latest,
  "Manifest schemaVersion flag must match schema-version.json.",
);
invariant(
  manifest.compatibility?.minimum === "14.365" &&
    manifest.compatibility?.verified === "14.365",
  "Foundry compatibility must target v14 Build 365.",
);
invariant(
  Array.isArray(manifest.esmodules) &&
    manifest.esmodules.length === 1 &&
    manifest.esmodules[0] === "dist/d6-system-2e.mjs",
  "Exactly one generated ESM entrypoint is allowed.",
);
invariant(
  Object.keys(manifest.documentTypes?.Actor ?? {}).join(",") ===
    "character,creature,npc" &&
    Object.keys(manifest.documentTypes?.Item ?? {}).join(",") ===
      "action,advantage,armor,character-template,cybernetic,disadvantage,gear,item-group,manifestation,skill,specialability,specialization,species-template,starship-gear,starship-weapon,vehicle,vehicle-gear,vehicle-weapon,weapon",
  "The manifest document types must exactly match the supported data models.",
);

await access(path.join(root, manifest.esmodules[0]));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "coverage", "dist", "node_modules"].includes(entry.name))
      continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

const files = await walk(root);
invariant(
  files.every((file) => path.extname(file) !== ".html"),
  "AppV1 .html templates are not allowed.",
);

const coreFiles = files.filter(
  (file) =>
    file.startsWith(path.join(root, "packages/core/")) &&
    path.extname(file) === ".ts",
);
for (const file of coreFiles) {
  const source = await readFile(file, "utf8");
  invariant(
    !/\b(?:foundry|Hooks|CONFIG|game)\s*\./.test(source),
    `Core source must not reference Foundry globals: ${path.relative(root, file)}`,
  );
}

console.info("Package invariants passed.");
