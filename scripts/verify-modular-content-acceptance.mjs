import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const officialModules = Object.freeze([
  "d6-system-2e-core-content",
  "d6-system-2e-fantasy",
  "d6-system-2e-science-fiction",
  "d6-system-2e-superhero",
  "open-d6-core-content-d6-system-2e",
  "open-d6-adventure-d6-system-2e",
  "open-d6-fantasy-d6-system-2e",
  "open-d6-space-d6-system-2e",
]);

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function referencedPaths(manifest) {
  return [
    ...(manifest.esmodules ?? []),
    ...(manifest.styles ?? []),
    ...(manifest.languages ?? []).map(({ path: languagePath }) => languagePath),
    ...(manifest.packs ?? []).map(({ path: packPath }) => packPath),
  ];
}

async function stagePackage(sourceRoot, destinationRoot, manifestName) {
  const manifest = await json(path.join(sourceRoot, manifestName));
  await mkdir(destinationRoot, { recursive: true });
  await cp(
    path.join(sourceRoot, manifestName),
    path.join(destinationRoot, manifestName),
  );
  for (const relativePath of referencedPaths(manifest)) {
    const destination = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(sourceRoot, relativePath), destination, {
      recursive: true,
    });
  }
  return manifest;
}

async function verifyStagedPackage(packageRoot, manifestName) {
  const manifest = await json(path.join(packageRoot, manifestName));
  for (const relativePath of referencedPaths(manifest)) {
    await readFile(
      path.join(
        packageRoot,
        relativePath,
        relativePath.startsWith("packs/") ? "CURRENT" : "",
      ),
    ).catch(async (error) => {
      if (!relativePath.startsWith("packs/")) throw error;
      throw new Error(`${manifest.id} pack ${relativePath} is incomplete.`);
    });
  }
  return manifest;
}

const system = await json(path.join(root, "system.json"));
verify(
  system.packs?.map(({ name }) => name).join(",") === "user-manual",
  "A clean base-system installation must contain only the User Manual pack.",
);
verify(
  officialModules.every((id) =>
    system.relationships?.recommends?.some(
      (relationship) =>
        relationship.id === id &&
        relationship.type === "module" &&
        typeof relationship.manifest === "string",
    ),
  ),
  "The base system must recommend every available official content module.",
);

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "d6e2-modular-install-"));
try {
  const stagedSystemRoot = path.join(fixtureRoot, "Data", "systems", system.id);
  await stagePackage(root, stagedSystemRoot, "system.json");
  const stagedSystem = await verifyStagedPackage(
    stagedSystemRoot,
    "system.json",
  );
  verify(
    stagedSystem.packs.length === 1 &&
      stagedSystem.packs[0].name === "user-manual",
    "The staged clean system unexpectedly contains extracted content packs.",
  );

  for (const id of officialModules) {
    const sourceRoot = path.join(root, "packages", id);
    const destinationRoot = path.join(fixtureRoot, "Data", "modules", id);
    const manifest = await stagePackage(
      sourceRoot,
      destinationRoot,
      "module.json",
    );
    verify(manifest.id === id, `${id} manifest identity is invalid.`);
    verify(
      manifest.relationships?.systems?.some(
        ({ id: systemId }) => systemId === system.id,
      ),
      `${id} does not declare support for ${system.id}.`,
    );
    verify(
      !(manifest.relationships?.requires ?? []).some(
        ({ type }) => type === "module",
      ),
      `${id} must remain independently activatable.`,
    );
    await verifyStagedPackage(destinationRoot, "module.json");
  }
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

console.info(
  "Modular content acceptance verified: clean base system plus 8 independently activatable official modules.",
);
