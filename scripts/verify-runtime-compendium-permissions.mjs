#!/usr/bin/env node

import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const READ_WRITE = constants.R_OK | constants.W_OK;
const READ_WRITE_SEARCH = READ_WRITE | constants.X_OK;

function safePackPath(ownerRoot, declaredPath) {
  if (
    typeof declaredPath !== "string" ||
    declaredPath.length === 0 ||
    path.isAbsolute(declaredPath) ||
    declaredPath.includes("\\") ||
    /(?:^|\/)(?:\.{1,2})(?:\/|$)/u.test(declaredPath) ||
    /[:?#]/u.test(declaredPath)
  ) {
    return undefined;
  }
  const resolved = path.resolve(ownerRoot, declaredPath);
  const relative = path.relative(ownerRoot, resolved);
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`)
    ? resolved
    : undefined;
}

async function readManifest(manifestPath) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function manifestEntries(systemRoot) {
  const entries = [
    {
      manifestPath: path.join(systemRoot, "system.json"),
      ownerRoot: systemRoot,
    },
  ];
  const packagesRoot = path.join(systemRoot, "packages");
  try {
    const packages = await readdir(packagesRoot, { withFileTypes: true });
    for (const entry of packages.filter((candidate) =>
      candidate.isDirectory(),
    )) {
      entries.push({
        manifestPath: path.join(packagesRoot, entry.name, "module.json"),
        ownerRoot: path.join(packagesRoot, entry.name),
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return entries;
}

async function inspectWritableTree(pack, issues) {
  const queue = [pack.path];
  while (queue.length > 0) {
    const current = queue.shift();
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      issues.push({
        collection: pack.collection,
        kind: error?.code === "ENOENT" ? "missing" : "unreadable",
        path: current,
      });
      continue;
    }
    if (metadata.isSymbolicLink()) {
      issues.push({
        collection: pack.collection,
        kind: "unsafe-symlink",
        path: current,
      });
      continue;
    }
    const isDirectory = metadata.isDirectory();
    const requiredOwnerBits = isDirectory ? 0o700 : 0o600;
    try {
      await access(current, isDirectory ? READ_WRITE_SEARCH : READ_WRITE);
      if ((metadata.mode & requiredOwnerBits) !== requiredOwnerBits) {
        throw new Error("owner permissions are not read/write/search safe");
      }
    } catch {
      issues.push({
        collection: pack.collection,
        kind: "not-writable",
        path: current,
      });
    }
    if (!isDirectory) continue;
    for (const entry of await readdir(current))
      queue.push(path.join(current, entry));
  }
}

export async function inspectRuntimeCompendiumPermissions(systemRoot) {
  const canonicalRoot = await realpath(path.resolve(systemRoot));
  const issues = [];
  const packs = [];
  for (const entry of await manifestEntries(canonicalRoot)) {
    let manifest;
    try {
      manifest = await readManifest(entry.manifestPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      issues.push({
        collection: path.basename(entry.ownerRoot),
        kind: "invalid-manifest",
        path: entry.manifestPath,
      });
      continue;
    }
    if (!Array.isArray(manifest.packs)) continue;
    for (const declared of manifest.packs) {
      const collection = `${manifest.id}.${declared?.name ?? "<unnamed>"}`;
      const packPath = safePackPath(entry.ownerRoot, declared?.path);
      if (!packPath) {
        issues.push({ collection, kind: "unsafe-path", path: declared?.path });
        continue;
      }
      const pack = {
        collection,
        ownerId: manifest.id,
        path: packPath,
        source: manifest.type === "system" ? "system" : "bundled-module",
      };
      packs.push(pack);
      await inspectWritableTree(pack, issues);
    }
  }
  packs.sort((left, right) => left.collection.localeCompare(right.collection));
  issues.sort((left, right) =>
    `${left.collection}:${left.kind}:${left.path}`.localeCompare(
      `${right.collection}:${right.kind}:${right.path}`,
    ),
  );
  return { issues, packs };
}

export function runtimeCompendiumRegistryProbe(declaredPacks) {
  const packs = JSON.stringify(
    [...declaredPacks]
      .map(({ collection, ownerId, source }) => ({
        collection,
        ownerId,
        source,
      }))
      .sort((left, right) => left.collection.localeCompare(right.collection)),
  );
  return `(async () => {
  const declaredPacks = ${packs};
  const expectedCollections = declaredPacks
    .filter((pack) => pack.source === "system" || game.modules.get(pack.ownerId)?.active === true)
    .map((pack) => pack.collection);
  const missingCollections = [];
  const failedCollections = [];
  for (const collection of expectedCollections) {
    const pack = game.packs.get(collection);
    if (!pack) {
      missingCollections.push(collection);
      continue;
    }
    try {
      await pack.getIndex();
    } catch (error) {
      failedCollections.push({ collection, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (missingCollections.length > 0 || failedCollections.length > 0) {
    throw new Error(JSON.stringify({ failedCollections, missingCollections }));
  }
  return { openedCollections: expectedCollections };
})()`;
}

async function main() {
  const systemRoot = process.argv[2] ?? process.cwd();
  const report = await inspectRuntimeCompendiumPermissions(systemRoot);
  if (process.argv.includes("--registry-probe")) {
    process.stdout.write(`${runtimeCompendiumRegistryProbe(report.packs)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.issues.length > 0) process.exitCode = 1;
}

async function isDirectCliInvocation() {
  if (!process.argv[1]) return false;
  try {
    const [invokedPath, modulePath] = await Promise.all([
      realpath(path.resolve(process.argv[1])),
      realpath(fileURLToPath(import.meta.url)),
    ]);
    return invokedPath === modulePath;
  } catch {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (await isDirectCliInvocation()) {
  await main();
}
