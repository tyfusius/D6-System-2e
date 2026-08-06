import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  readJson,
  referencedPaths,
  releaseDirectory,
  releasePackages,
  repository,
  root,
} from "./release-packages.mjs";

const normalizedTime = new Date("2000-01-01T00:00:00.000Z");

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

function outputArgument() {
  const index = process.argv.indexOf("--output");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function exists(file) {
  return access(file).then(
    () => true,
    () => false,
  );
}

async function copyTree(source, destination) {
  const sourceStat = await stat(source);
  if (sourceStat.isFile()) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }
  await mkdir(destination, { recursive: true });
  for (const entry of (await readdir(source, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    await copyTree(
      path.join(source, entry.name),
      path.join(destination, entry.name),
    );
  }
}

async function copyLevelDbPack(source, destination) {
  await mkdir(destination, { recursive: true });
  const current = (await readFile(path.join(source, "CURRENT"), "utf8")).trim();
  verify(/^MANIFEST-\d+$/u.test(current), `${source} has an invalid CURRENT.`);
  const allowed = new Set(["CURRENT", current]);
  for (const name of await readdir(source)) {
    if (/^\d+\.(?:ldb|log)$/u.test(name)) allowed.add(name);
  }
  for (const name of [...allowed].sort()) {
    await copyFile(path.join(source, name), path.join(destination, name));
  }
}

async function copyReleasePath(sourceRoot, destinationRoot, relativePath) {
  verify(
    !path.isAbsolute(relativePath) &&
      !relativePath.split(path.sep).includes(".."),
    `Unsafe release path: ${relativePath}`,
  );
  const source = path.join(sourceRoot, relativePath);
  const destination = path.join(destinationRoot, relativePath);
  if (relativePath.startsWith("packs/")) {
    await copyLevelDbPack(source, destination);
  } else {
    await copyTree(source, destination);
  }
}

async function normalizeTree(directory) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await normalizeTree(file);
    else await chmod(file, 0o644);
    await utimes(file, normalizedTime, normalizedTime);
  }
  await chmod(directory, 0o755);
  await utimes(directory, normalizedTime, normalizedTime);
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relativePath)),
      );
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function zipFiles(cwd, output, files) {
  await new Promise((resolve, reject) => {
    const child = spawn("zip", ["-X", "-q", output, ...files], {
      cwd,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`zip exited with code ${code}.`));
    });
  });
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

const system = await readJson(path.join(root, "system.json"));
const version = system.version;
const outputRoot = path.resolve(outputArgument() ?? releaseDirectory(version));
const stagingRoot = path.join(outputRoot, ".staging");

await rm(outputRoot, { force: true, recursive: true });
await mkdir(stagingRoot, { recursive: true });

const releaseIndex = [];
for (const specification of releasePackages) {
  const manifestPath = path.join(
    specification.sourceRoot,
    specification.manifestName,
  );
  const manifest = await readJson(manifestPath);
  verify(
    manifest.id === specification.id,
    `${specification.id} identity drifted.`,
  );
  verify(
    manifest.version === version,
    `${specification.id} version ${manifest.version} does not match ${version}.`,
  );
  verify(
    manifest.url === repository.url &&
      manifest.manifest?.includes(`${repository.owner}/${repository.name}`) &&
      manifest.download ===
        `${repository.url}/releases/download/${version}/${specification.id}.zip`,
    `${specification.id} release URLs are incomplete.`,
  );

  const packageRoot = path.join(stagingRoot, specification.id);
  await mkdir(packageRoot, { recursive: true });
  await copyFile(
    manifestPath,
    path.join(packageRoot, specification.manifestName),
  );

  const paths = new Set([
    ...referencedPaths(manifest),
    ...specification.extras,
  ]);
  for (const modulePath of manifest.esmodules ?? []) {
    const sourceMap = `${modulePath}.map`;
    if (await exists(path.join(specification.sourceRoot, sourceMap))) {
      paths.add(sourceMap);
    }
  }
  for (const relativePath of [...paths].sort()) {
    await copyReleasePath(specification.sourceRoot, packageRoot, relativePath);
  }

  await normalizeTree(packageRoot);
  const archive = path.join(outputRoot, `${specification.id}.zip`);
  const files = (await listFiles(packageRoot)).map((file) =>
    path.posix.join(specification.id, file),
  );
  await zipFiles(stagingRoot, archive, files);

  const publicManifestName = `${specification.id}-${specification.kind}.json`;
  await copyFile(manifestPath, path.join(outputRoot, publicManifestName));
  releaseIndex.push({
    download: manifest.download,
    id: specification.id,
    kind: specification.kind,
    manifest: manifest.manifest,
    manifestAsset: publicManifestName,
    sha256: await sha256(archive),
    title: manifest.title,
    version,
  });
}

await rm(stagingRoot, { force: true, recursive: true });
await writeFile(
  path.join(outputRoot, "release-manifests.json"),
  `${JSON.stringify(
    {
      distribution: "private-collaborator",
      repository: repository.url,
      version,
      packages: releaseIndex,
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  path.join(outputRoot, "SHA256SUMS.txt"),
  `${releaseIndex.map(({ id, sha256: digest }) => `${digest}  ${id}.zip`).join("\n")}\n`,
);

console.info(
  `Built ${releaseIndex.length} reproducible Foundry archives for ${version} in ${path.relative(root, outputRoot)}.`,
);
