import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = await json("system.json");
const rootPackage = await json("package.json");
const lock = await json("package-lock.json");
const corePackage = await json("packages/core/package.json");
const systemPackage = await json("packages/system/package.json");
const coreContentPackage = await json(
  "packages/d6-system-2e-core-content/package.json",
);
const coreContentManifest = await json(
  "packages/d6-system-2e-core-content/module.json",
);
const secondEditionFantasyPackage = await json(
  "packages/d6-system-2e-fantasy/package.json",
);
const secondEditionFantasyManifest = await json(
  "packages/d6-system-2e-fantasy/module.json",
);
const secondEditionScienceFictionPackage = await json(
  "packages/d6-system-2e-science-fiction/package.json",
);
const secondEditionScienceFictionManifest = await json(
  "packages/d6-system-2e-science-fiction/module.json",
);
const secondEditionSuperheroPackage = await json(
  "packages/d6-system-2e-superhero/package.json",
);
const secondEditionSuperheroManifest = await json(
  "packages/d6-system-2e-superhero/module.json",
);
const hudPackage = await json(
  "packages/token-action-hud-d6-system-2e/package.json",
);
const hudManifest = await json(
  "packages/token-action-hud-d6-system-2e/module.json",
);
const spacePackage = await json(
  "packages/open-d6-space-d6-system-2e/package.json",
);
const spaceManifest = await json(
  "packages/open-d6-space-d6-system-2e/module.json",
);
const fantasyPackage = await json(
  "packages/open-d6-fantasy-d6-system-2e/package.json",
);
const fantasyManifest = await json(
  "packages/open-d6-fantasy-d6-system-2e/module.json",
);
const echoPackage = await json(
  "packages/echod6-companion-d6-system-2e/package.json",
);
const echoManifest = await json(
  "packages/echod6-companion-d6-system-2e/module.json",
);
const schema = await json("schema-version.json");
const version = manifest.version;

for (const [label, actual] of [
  ["root package", rootPackage.version],
  ["package-lock root", lock.packages?.[""]?.version],
  ["core workspace", corePackage.version],
  ["system workspace", systemPackage.version],
  ["Second Edition Core Content workspace", coreContentPackage.version],
  ["Second Edition Core Content manifest", coreContentManifest.version],
  ["Second Edition Fantasy workspace", secondEditionFantasyPackage.version],
  ["Second Edition Fantasy manifest", secondEditionFantasyManifest.version],
  [
    "Second Edition Science Fiction workspace",
    secondEditionScienceFictionPackage.version,
  ],
  [
    "Second Edition Science Fiction manifest",
    secondEditionScienceFictionManifest.version,
  ],
  [
    "Second Edition Science Fiction lock workspace",
    lock.packages?.["packages/d6-system-2e-science-fiction"]?.version,
  ],
  ["Second Edition Superhero workspace", secondEditionSuperheroPackage.version],
  ["Second Edition Superhero manifest", secondEditionSuperheroManifest.version],
  [
    "Second Edition Superhero lock workspace",
    lock.packages?.["packages/d6-system-2e-superhero"]?.version,
  ],
  ["Token Action HUD workspace", hudPackage.version],
  ["Token Action HUD manifest", hudManifest.version],
  ["Open D6 Space workspace", spacePackage.version],
  ["Open D6 Space manifest", spaceManifest.version],
  ["Open D6 Fantasy workspace", fantasyPackage.version],
  ["Open D6 Fantasy manifest", fantasyManifest.version],
  ["Echo D6 Companion workspace", echoPackage.version],
  ["Echo D6 Companion manifest", echoManifest.version],
]) {
  verify(
    actual === version,
    `${label} version ${actual} does not match ${version}.`,
  );
}
verify(
  systemPackage.dependencies?.["@d6-system-2e/core"] === version,
  "The system workspace must depend on the matching core workspace version.",
);
verify(
  manifest.flags?.[manifest.id]?.schemaVersion === schema.latest,
  "The release manifest and schema marker disagree.",
);

const migrationDirectory = path.join(root, "packages/system/src/migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d{3}-.+\.ts$/u.test(name) && !name.endsWith(".test.ts"))
  .sort();
const migrationVersions = migrationFiles.map((name) =>
  Number(name.slice(0, 3)),
);
const expectedVersions = Array.from(
  { length: schema.latest },
  (_, index) => index + 1,
);
verify(
  JSON.stringify(migrationVersions) === JSON.stringify(expectedVersions),
  `Migration files must be contiguous from 001 through ${String(schema.latest).padStart(3, "0")}.`,
);
const migrationIndex = await readFile(
  path.join(migrationDirectory, "index.ts"),
  "utf8",
);
for (const file of migrationFiles) {
  verify(
    migrationIndex.includes(`from "./${file.slice(0, -3)}"`),
    `Migration ${file} is not imported by the migration index.`,
  );
}

verify(
  manifest.packs.every(
    ({ path: packPath }) =>
      typeof packPath === "string" &&
      packPath.startsWith("packs/") &&
      !packPath.includes("private"),
  ),
  "The public system manifest may contain only public pack paths.",
);
const equipment = await json("content/equipment-catalog.json");
const fantasyBestiary = await json("content/fantasy-bestiary-catalog.json");
const fantasyTemplates = await json(
  "content/fantasy-character-template-catalog.json",
);
const skills = await json("content/skills.json");
verify(
  equipment.entries.length === 84,
  "The public equipment catalog must contain all 84 verified pp. 79-85 entries.",
);
verify(
  equipment.entries.every(
    (entry) =>
      ["armor", "gear", "weapon"].includes(entry.kind) &&
      equipment.eras.includes(entry.era) &&
      entry.source?.book === "D6 System: Second Edition" &&
      Number.isSafeInteger(entry.source?.page) &&
      entry.source.page >= 79 &&
      entry.source.page <= 85 &&
      typeof entry.system === "object" &&
      JSON.stringify(entry.system).length <= 700,
  ),
  "Public equipment entries must remain concise mechanical records with printed-page provenance.",
);
verify(
  skills.every((entry) => !("description" in entry)),
  "The public Skill catalog must not contain book descriptions.",
);
verify(
  fantasyBestiary.entries.length === 4 &&
    fantasyBestiary.entries.every(
      (entry) =>
        entry.source?.book === "D6 System: Second Edition" &&
        Number.isSafeInteger(entry.source?.page) &&
        entry.source.page >= 165 &&
        entry.source.page <= 167 &&
        Object.keys(entry.attributeScores ?? {}).length === 4 &&
        JSON.stringify(entry.biography ?? "").length <= 500 &&
        (entry.items ?? []).every(
          (item) =>
            [
              "armor",
              "gear",
              "manifestation",
              "specialability",
              "weapon",
            ].includes(item.type) && JSON.stringify(item.system).length <= 700,
        ),
    ),
  "The public Fantasy Bestiary must contain four concise mechanical pp. 165-167 records.",
);
verify(
  fantasyTemplates.templates.length === 4 &&
    fantasyTemplates.templates.every(
      (template) =>
        template.source?.book === "D6 System: Second Edition" &&
        Number.isSafeInteger(template.source?.page) &&
        template.source.page >= 168 &&
        template.source.page <= 171 &&
        Object.keys(template.attributeScores ?? {}).length === 7 &&
        Object.values(template.attributeScores ?? {}).reduce(
          (total, score) => total + score,
          0,
        ) +
          (template.unassignedAttributeScore ?? 0) ===
          63 &&
        Array.isArray(template.suggestedSkillKeys),
    ),
  "The public Fantasy Templates catalog must contain four exact 21D pp. 168-171 scaffolds.",
);
for (const [relativePath, emptyRegistration] of [
  ["packages/system/src/registries/feature-catalogs.ts", "definitions: []"],
  ["packages/system/src/registries/hideout-features.ts", "entries: []"],
  ["packages/system/src/registries/psionics.ts", "powers: []"],
]) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  verify(
    source.includes(emptyRegistration),
    `${relativePath} no longer exposes an empty public catalog boundary.`,
  );
}

const fixtureRoot = await mkdtemp(
  path.join(tmpdir(), "d6e2-private-boundary-"),
);
try {
  const eligibleSkill = skills.find((entry) =>
    entry.profiles.includes("second-edition"),
  );
  verify(
    eligibleSkill,
    "No Second Edition Skill exists for companion verification.",
  );
  const inputPath = path.join(fixtureRoot, "skill-descriptions.json");
  const outputPath = path.join(fixtureRoot, "module");
  const fixtureDescription = "Private companion verification fixture.";
  await writeFile(
    inputPath,
    `${JSON.stringify({ [eligibleSkill.key]: fixtureDescription })}\n`,
  );
  await execFileAsync(
    process.execPath,
    ["scripts/build-private-content-companion.mjs"],
    {
      cwd: root,
      env: {
        ...process.env,
        D6_PRIVATE_CONTENT_INPUT: inputPath,
        D6_PRIVATE_CONTENT_OUTPUT: outputPath,
      },
    },
  );
  const companionManifest = JSON.parse(
    await readFile(path.join(outputPath, "module.json"), "utf8"),
  );
  verify(
    companionManifest.version === version &&
      companionManifest.relationships?.systems?.[0]?.id === manifest.id,
    "The private companion manifest does not match the public system release.",
  );
  const db = new ClassicLevel(
    path.join(outputPath, "packs/second-edition-skills-private"),
    { readOnly: true, valueEncoding: "json" },
  );
  const documents = [];
  for await (const [, value] of db.iterator()) documents.push(value);
  await db.close();
  verify(
    documents.length === 1 &&
      documents[0]?.system?.description === fixtureDescription &&
      documents[0]?._stats?.systemVersion === version,
    "The synthetic private companion did not preserve its isolated content and release metadata.",
  );
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

console.info(
  `Release boundary verified at ${version}, schema ${schema.latest}, with ${migrationFiles.length} contiguous migrations.`,
);
