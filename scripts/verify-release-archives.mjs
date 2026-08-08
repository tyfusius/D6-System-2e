import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  readJson,
  referencedPaths,
  releaseDirectory,
  releasePackages,
  root,
} from "./release-packages.mjs";

const execFileAsync = promisify(execFile);

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function archiveEntries(archive) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", archive], {
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.split("\n").filter(Boolean);
}

async function archiveText(archive, entry) {
  return (
    await execFileAsync("unzip", ["-p", archive, entry], {
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout;
}

function archiveHas(entries, packageId, relativePath) {
  const expected = `${packageId}/${relativePath}`;
  return entries.some(
    (entry) => entry === expected || entry.startsWith(`${expected}/`),
  );
}

const system = await readJson(path.join(root, "system.json"));
const outputRoot = releaseDirectory(system.version);
const previousVersion = "0.1.0-beta.4";
const previousOutputRoot = releaseDirectory(previousVersion);
const releaseIndex = await readJson(
  path.join(outputRoot, "release-manifests.json"),
);
verify(
  releaseIndex.version === system.version &&
    releaseIndex.packages.length === releasePackages.length,
  "Release index package count or version is invalid.",
);

const firstHashes = new Map();
for (const specification of releasePackages) {
  const archive = path.join(outputRoot, `${specification.id}.zip`);
  const entries = await archiveEntries(archive);
  verify(entries.length > 0, `${specification.id} archive is empty.`);
  verify(
    entries.every(
      (entry) =>
        entry.startsWith(`${specification.id}/`) &&
        !entry.includes("../") &&
        !entry.includes("/LOCK") &&
        !entry.includes("/LOG") &&
        !entry.includes("/lost/"),
    ),
    `${specification.id} archive contains an unsafe or runtime-only entry.`,
  );
  const manifestEntry = `${specification.id}/${specification.manifestName}`;
  const manifest = JSON.parse(await archiveText(archive, manifestEntry));
  verify(
    manifest.id === specification.id && manifest.version === system.version,
    `${specification.id} archived manifest is invalid.`,
  );
  for (const relativePath of referencedPaths(manifest)) {
    verify(
      archiveHas(entries, specification.id, relativePath),
      `${specification.id} is missing ${relativePath}.`,
    );
    if (relativePath.startsWith("packs/")) {
      const currentEntry = `${specification.id}/${relativePath}/CURRENT`;
      const current = (await archiveText(archive, currentEntry)).trim();
      verify(
        entries.includes(`${specification.id}/${relativePath}/${current}`),
        `${specification.id} pack ${relativePath} omits its active manifest.`,
      );
    }
  }
  if (specification.kind === "system") {
    verify(
      archiveHas(entries, specification.id, "templates") &&
        archiveHas(entries, specification.id, "assets"),
      "The system archive omits templates or assets.",
    );
    const bundle = await archiveText(
      archive,
      `${specification.id}/dist/d6-system-2e.mjs`,
    );
    for (const contractMarker of [
      "profilePresetRegistry",
      "worldRulesProfiles",
      "worldSettingProfiles",
      "second-edition-default",
      "open-d6-default",
    ]) {
      verify(
        bundle.includes(contractMarker),
        `The system archive omits Profile Architecture contract ${contractMarker}.`,
      );
    }
  }
  if (specification.id === "echod6-companion-d6-system-2e") {
    verify(
      archiveHas(entries, specification.id, "art"),
      "The Echo archive omits its art.",
    );
    verify(
      (
        await archiveText(
          archive,
          `${specification.id}/echod6-companion-d6-system-2e.mjs`,
        )
      ).includes("echo-d6-recommended"),
      "The Echo archive omits its recommended Profile Preset.",
    );
  }
  const digest = await sha256(archive);
  const indexed = releaseIndex.packages.find(
    ({ id }) => id === specification.id,
  );
  verify(indexed?.sha256 === digest, `${specification.id} checksum drifted.`);
  firstHashes.set(specification.id, digest);
  await access(path.join(outputRoot, indexed.manifestAsset));
}

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "d6e2-release-"));
try {
  const secondBuild = path.join(fixtureRoot, "reproducible");
  await execFileAsync(
    process.execPath,
    ["scripts/build-release.mjs", "--output", secondBuild],
    { cwd: root },
  );
  for (const specification of releasePackages) {
    verify(
      (await sha256(path.join(secondBuild, `${specification.id}.zip`))) ===
        firstHashes.get(specification.id),
      `${specification.id} archive is not reproducible.`,
    );
  }

  const dataRoot = path.join(fixtureRoot, "clean", "Data");
  for (const specification of releasePackages) {
    const packageContainer = path.join(
      dataRoot,
      specification.kind === "system" ? "systems" : "modules",
    );
    await mkdir(packageContainer, { recursive: true });
    await execFileAsync("unzip", [
      "-oq",
      path.join(outputRoot, `${specification.id}.zip`),
      "-d",
      packageContainer,
    ]);
    const installedManifest = await readJson(
      path.join(packageContainer, specification.id, specification.manifestName),
    );
    verify(
      installedManifest.version === system.version,
      `${specification.id} clean installation failed.`,
    );
  }

  const upgradeRoot = path.join(fixtureRoot, "upgrade", "Data");
  for (const specification of releasePackages) {
    const packageContainer = path.join(
      upgradeRoot,
      specification.kind === "system" ? "systems" : "modules",
    );
    const installedRoot = path.join(packageContainer, specification.id);
    await mkdir(installedRoot, { recursive: true });
    await writeFile(path.join(installedRoot, "local-data.keep"), "preserve\n");
    await writeFile(
      path.join(installedRoot, specification.manifestName),
      `${JSON.stringify({ id: specification.id, version: "0.1.0-alpha.32" })}\n`,
    );
    await execFileAsync("unzip", [
      "-oq",
      path.join(outputRoot, `${specification.id}.zip`),
      "-d",
      packageContainer,
    ]);
    const upgradedManifest = await readJson(
      path.join(installedRoot, specification.manifestName),
    );
    verify(
      upgradedManifest.version === system.version &&
        (await readFile(
          path.join(installedRoot, "local-data.keep"),
          "utf8",
        )) === "preserve\n",
      `${specification.id} representative upgrade failed.`,
    );
  }

  const betaUpgradeRoot = path.join(fixtureRoot, "beta-upgrade", "Data");
  for (const specification of releasePackages) {
    const previousArchive = path.join(
      previousOutputRoot,
      `${specification.id}.zip`,
    );
    await access(previousArchive);
    const packageContainer = path.join(
      betaUpgradeRoot,
      specification.kind === "system" ? "systems" : "modules",
    );
    await mkdir(packageContainer, { recursive: true });
    await execFileAsync("unzip", [
      "-oq",
      previousArchive,
      "-d",
      packageContainer,
    ]);
    const installedRoot = path.join(packageContainer, specification.id);
    await writeFile(path.join(installedRoot, "local-data.keep"), "preserve\n");
    const previousManifest = await readJson(
      path.join(installedRoot, specification.manifestName),
    );
    verify(
      previousManifest.version === previousVersion,
      `${specification.id} previous Beta fixture is invalid.`,
    );
    await execFileAsync("unzip", [
      "-oq",
      path.join(outputRoot, `${specification.id}.zip`),
      "-d",
      packageContainer,
    ]);
    const upgradedManifest = await readJson(
      path.join(installedRoot, specification.manifestName),
    );
    verify(
      upgradedManifest.version === system.version &&
        (await readFile(
          path.join(installedRoot, "local-data.keep"),
          "utf8",
        )) === "preserve\n",
      `${specification.id} ${previousVersion} upgrade failed.`,
    );
  }
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

console.info(
  `Verified ${releasePackages.length} reproducible archives, clean installs, representative alpha.32 upgrades, and ${previousVersion} upgrades for ${system.version}.`,
);
