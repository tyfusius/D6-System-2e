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

function packFolderPath(manifest, rootName, childName) {
  const rootFolder = manifest.packFolders?.find(
    (folder) => folder.name === rootName,
  );
  return rootFolder?.folders?.find((folder) => folder.name === childName);
}

async function moduleManifest(id) {
  return JSON.parse(
    await readFile(path.join(root, "packages", id, "module.json"), "utf8"),
  );
}

invariant(manifest.id === "d6-system-2e", "Manifest system ID changed.");
invariant(
  manifest.title === "D6 System Second Edition",
  "Manifest title changed.",
);
invariant(
  manifest.socket === true,
  "The system socket channel must remain enabled for remote roll requests.",
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
    "character,creature,hideout,npc,starship,vehicle" &&
    Object.keys(manifest.documentTypes?.Item ?? {}).join(",") ===
      "action,advantage,armor,asset,character-template,cybernetic,disadvantage,flaw,gear,item-group,manifestation,perk,skill,specialability,specialization,species-template,starship-gear,starship-weapon,talent,trouble,vehicle,vehicle-gear,vehicle-weapon,weapon",
  "The manifest document types must exactly match the supported data models.",
);
const manualPack = manifest.packs?.find(({ name }) => name === "user-manual");
invariant(
  manualPack?.type === "JournalEntry" &&
    manualPack.path === "packs/user-manual",
  "The generated user manual must be declared as a JournalEntry pack.",
);
invariant(
  packFolderPath(
    manifest,
    "D6 System Second Edition",
    "Core System",
  )?.packs?.join(",") === "user-manual",
  "The base system manual must be grouped under D6 System Second Edition / Core System.",
);
invariant(
  !manifest.packs.some(({ name }) =>
    ["second-edition-skills", "second-edition-equipment"].includes(name),
  ),
  "Second Edition Core Content packs must not remain in the base system manifest.",
);
invariant(
  manifest.relationships?.recommends?.some(
    ({ id, type, manifest: manifestUrl }) =>
      id === "d6-system-2e-core-content" &&
      type === "module" &&
      typeof manifestUrl === "string",
  ),
  "The base system must recommend the separately installable Core Content module.",
);
invariant(
  !manifest.packs.some(({ name }) =>
    [
      "second-edition-fantasy-creatures",
      "second-edition-fantasy-templates",
    ].includes(name),
  ),
  "Second Edition Fantasy packs must not remain in the base system manifest.",
);
invariant(
  manifest.relationships?.recommends?.some(
    ({ id, type, manifest: manifestUrl }) =>
      id === "d6-system-2e-fantasy" &&
      type === "module" &&
      typeof manifestUrl === "string",
  ),
  "The base system must recommend the separately installable Second Edition Fantasy module.",
);
invariant(
  manifest.relationships?.recommends?.some(
    ({ id, type, manifest: manifestUrl }) =>
      id === "d6-system-2e-science-fiction" &&
      type === "module" &&
      typeof manifestUrl === "string",
  ),
  "The base system must recommend the separately installable Second Edition Science Fiction module.",
);
invariant(
  manifest.relationships?.recommends?.some(
    ({ id, type, manifest: manifestUrl }) =>
      id === "d6-system-2e-superhero" &&
      type === "module" &&
      typeof manifestUrl === "string",
  ),
  "The base system must recommend the separately installable Second Edition Superhero module.",
);
invariant(
  !manifest.packs.some(({ name }) => name === "open-d6-skills"),
  "First Edition Core Content packs must not remain in the base system manifest.",
);
for (const id of [
  "open-d6-core-content-d6-system-2e",
  "open-d6-adventure-d6-system-2e",
  "open-d6-fantasy-d6-system-2e",
  "open-d6-space-d6-system-2e",
]) {
  invariant(
    manifest.relationships?.recommends?.some(
      (relationship) =>
        relationship.id === id &&
        relationship.type === "module" &&
        typeof relationship.manifest === "string",
    ),
    `The base system must recommend ${id}.`,
  );
}

for (const [id, rootName, childName, expectedPacks] of [
  [
    "d6-system-2e-core-content",
    "D6 System Second Edition",
    "Core Content",
    "second-edition-skills,second-edition-equipment,second-edition-core-templates",
  ],
  [
    "d6-system-2e-fantasy",
    "D6 System Second Edition",
    "Fantasy",
    "second-edition-fantasy-creatures,second-edition-fantasy-templates",
  ],
  [
    "open-d6-core-content-d6-system-2e",
    "Open D6 First Edition",
    "Core Content",
    "open-d6-skills",
  ],
  [
    "open-d6-adventure-d6-system-2e",
    "Open D6 First Edition",
    "Adventure",
    "skills,advantages,disadvantages,special-abilities,equipment,vehicles,manifestations,generic-characters,character-templates",
  ],
  [
    "open-d6-fantasy-d6-system-2e",
    "Open D6 First Edition",
    "Fantasy",
    "skills,equipment,generic-characters,character-templates,manifestations,ancestries,vehicles,ship-weapons",
  ],
  [
    "open-d6-space-d6-system-2e",
    "Open D6 First Edition",
    "Space",
    "advantages,disadvantages,special-abilities,cybernetics,equipment,vehicles,metaphysics,ship-design,generic-characters,character-templates",
  ],
]) {
  const contentManifest = await moduleManifest(id);
  invariant(
    packFolderPath(contentManifest, rootName, childName)?.packs?.join(",") ===
      expectedPacks,
    `${id} must group every declared pack under ${rootName} / ${childName}.`,
  );
}

await access(path.join(root, manifest.esmodules[0]));
await access(path.join(root, "docs/USER-MANUAL.md"));
await access(path.join(root, "docs/UI-PARITY.md"));
await access(path.join(root, "packs/user-manual"));

const stylesheet = await readFile(
  path.join(root, "styles/d6-system-2e.css"),
  "utf8",
);
const pcQuickbarTemplate = await readFile(
  path.join(root, "templates/apps/pc-quickbar.hbs"),
  "utf8",
);
const activeTasksTemplate = await readFile(
  path.join(root, "templates/apps/active-tasks-quickbar.hbs"),
  "utf8",
);
const quickbarSource = await readFile(
  path.join(root, "packages/system/src/foundry/quickbars.ts"),
  "utf8",
);
const machineSheetSource = await readFile(
  path.join(root, "packages/system/src/foundry/sheets/machine-sheet.ts"),
  "utf8",
);

for (const contract of [
  [pcQuickbarTemplate, "od6pc-shell", "GM Quickbar template"],
  [activeTasksTemplate, "od6tasks-shell", "Active Tasks template"],
  [stylesheet, ".application.od6-pc-quickbar", "GM Quickbar stylesheet"],
  [
    stylesheet,
    ".application.od6-active-tasks-quickbar",
    "Active Tasks stylesheet",
  ],
  [quickbarSource, '"od6-pc-quickbar"', "GM Quickbar ApplicationV2"],
  [quickbarSource, '"od6-active-tasks-quickbar"', "Active Tasks ApplicationV2"],
  [
    quickbarSource,
    'Hooks.on("getSceneControlButtons"',
    "Quickbar Token Controls integration",
  ],
  [quickbarSource, "gmQuickbarEnabled()", "GM Quickbar setting gate"],
  [quickbarSource, "activeTasksQuickbarEnabled()", "Active Tasks setting gate"],
  [
    machineSheetSource,
    "secondEditionStaticDefense(hullScore)",
    "Second Edition machine Defense derivation",
  ],
  [
    machineSheetSource,
    "currentCombinedPipScore(hullScore, protectionScore)",
    "Second Edition machine resistance derivation",
  ],
]) {
  invariant(
    contract[0].includes(contract[1]),
    `${contract[2]} must retain the canonical OpenD6 Next class contract.`,
  );
}
invariant(
  !/d6e2-(?:quickbar|task-list|tasks-shell)/.test(
    `${pcQuickbarTemplate}\n${activeTasksTemplate}\n${stylesheet}`,
  ),
  "Parallel d6e2 quickbar styling is forbidden; use the canonical OpenD6 Next components.",
);
for (const font of [
  '"Avenir Next", "Segoe UI Variable", "Segoe UI", sans-serif',
  '"Avenir Next Condensed", "Arial Narrow", "Segoe UI", sans-serif',
]) {
  invariant(
    stylesheet.includes(font),
    `Canonical OpenD6 Next typography is missing: ${font}`,
  );
}

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
