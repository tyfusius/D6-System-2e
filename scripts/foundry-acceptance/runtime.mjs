import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { inflateRawSync } from "node:zlib";
import { AcceptanceError, MINIMUM_FOUNDRY_VERSION } from "./core.mjs";
import { runProcess } from "./browser.mjs";

function normalizeFoundryVersion(value) {
  const match = String(value ?? "").match(/^(\d+\.\d+)(?:\.\d+)?$/);
  return match ? match[1] : "";
}

function foundryVersionAtLeast(value, minimum) {
  const [generation, build] = value.split(".").map(Number);
  const [minimumGeneration, minimumBuild] = minimum.split(".").map(Number);
  return (
    generation > minimumGeneration ||
    (generation === minimumGeneration && build >= minimumBuild)
  );
}

function normalizedEnvironmentValue(env, key) {
  const raw = env
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1)
    .trim();
  if (!raw) return "";
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function archiveFilenameVersion(archive) {
  const match = path
    .basename(archive ?? "")
    .match(/(?:^|[-_])(\d+\.\d+(?:\.\d+)?)\.zip$/iu);
  return normalizeFoundryVersion(match?.[1]);
}

function zipPackageJson(bytes) {
  const minimumEndRecordSize = 22;
  const maximumCommentSize = 65_535;
  let endOffset = -1;
  for (
    let offset = bytes.length - minimumEndRecordSize;
    offset >=
    Math.max(0, bytes.length - minimumEndRecordSize - maximumCommentSize);
    offset -= 1
  ) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0 || endOffset + minimumEndRecordSize > bytes.length) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_NOT_ZIP",
      "Cached Foundry archive has no bounded ZIP directory record.",
    );
  }
  const disk = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const totalEntries = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  const commentLength = bytes.readUInt16LE(endOffset + 20);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== totalEntries ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    endOffset + minimumEndRecordSize + commentLength !== bytes.length ||
    centralOffset + centralSize > endOffset
  ) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_ZIP_UNSUPPORTED",
      "Cached Foundry archive uses an unsupported or ambiguous ZIP directory.",
    );
  }
  let offset = centralOffset;
  let packageEntry = null;
  for (let index = 0; index < totalEntries; index += 1) {
    if (
      offset + 46 > bytes.length ||
      bytes.readUInt32LE(offset) !== 0x02014b50
    ) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_ZIP_INVALID",
        "Cached Foundry archive has a malformed central directory.",
      );
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const entryCommentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const nextOffset =
      offset + 46 + nameLength + extraLength + entryCommentLength;
    if (nextOffset > bytes.length) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_ZIP_INVALID",
        "Cached Foundry archive has an out-of-bounds directory entry.",
      );
    }
    const name = bytes
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (name === "package.json") {
      if (packageEntry) {
        throw new AcceptanceError(
          "FOUNDRY_CACHE_METADATA_AMBIGUOUS",
          "Cached Foundry archive contains multiple root package metadata entries.",
        );
      }
      packageEntry = {
        compressedSize,
        compression,
        flags,
        localOffset,
        uncompressedSize,
      };
    }
    offset = nextOffset;
  }
  if (offset !== centralOffset + centralSize || !packageEntry) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_METADATA_MISSING",
      "Cached Foundry archive has no unique root package metadata entry.",
    );
  }
  if (
    packageEntry.flags & 0x1 ||
    ![0, 8].includes(packageEntry.compression) ||
    packageEntry.uncompressedSize > 1_048_576 ||
    packageEntry.localOffset + 30 > bytes.length ||
    bytes.readUInt32LE(packageEntry.localOffset) !== 0x04034b50
  ) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_METADATA_UNSUPPORTED",
      "Cached Foundry package metadata uses an unsupported ZIP entry.",
    );
  }
  const localFlags = bytes.readUInt16LE(packageEntry.localOffset + 6);
  const localCompression = bytes.readUInt16LE(packageEntry.localOffset + 8);
  const localNameLength = bytes.readUInt16LE(packageEntry.localOffset + 26);
  const localExtraLength = bytes.readUInt16LE(packageEntry.localOffset + 28);
  const dataOffset =
    packageEntry.localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + packageEntry.compressedSize;
  if (
    localFlags !== packageEntry.flags ||
    localCompression !== packageEntry.compression ||
    dataEnd > bytes.length
  ) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_ZIP_INVALID",
      "Cached Foundry package metadata disagrees with its directory entry.",
    );
  }
  const compressed = bytes.subarray(dataOffset, dataEnd);
  const metadataBytes =
    packageEntry.compression === 0 ? compressed : inflateRawSync(compressed);
  if (metadataBytes.length !== packageEntry.uncompressedSize) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_METADATA_INVALID",
      "Cached Foundry package metadata has an invalid expanded size.",
    );
  }
  try {
    return JSON.parse(metadataBytes.toString("utf8"));
  } catch {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_METADATA_INVALID",
      "Cached Foundry package metadata is not valid JSON.",
    );
  }
}

export async function readRegularFileIdentity(file) {
  const details = await lstat(file);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new AcceptanceError(
      "RUNTIME_FILE_UNSAFE",
      "Verification artifacts must be regular non-symlink files.",
    );
  }
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    const bytes = await handle.readFile();
    const final = await handle.stat();
    if (
      opened.dev !== final.dev ||
      opened.ino !== final.ino ||
      opened.size !== final.size ||
      opened.mtimeMs !== final.mtimeMs
    ) {
      throw new AcceptanceError(
        "RUNTIME_FILE_DRIFT",
        "Verification file changed while read.",
      );
    }
    return Object.freeze({
      canonicalPath: await realpath(file),
      dev: opened.dev,
      ino: opened.ino,
      size: opened.size,
      mtimeMs: opened.mtimeMs,
      mode: opened.mode & 0o777,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } finally {
    await handle.close();
  }
}

export async function assertFoundryReleaseInputs(
  config,
  _runner,
  options = {},
) {
  const expected = normalizeFoundryVersion(config.expectedFoundryVersion);
  if (!expected) {
    throw new AcceptanceError(
      "FOUNDRY_VERSION_REQUIRED",
      "expectedFoundryVersion must be configured before runtime mutation.",
    );
  }
  if (!foundryVersionAtLeast(expected, MINIMUM_FOUNDRY_VERSION)) {
    throw new AcceptanceError(
      "FOUNDRY_VERSION_BELOW_RUNTIME_FLOOR",
      `Refusing Foundry ${expected}; acceptance requires ${MINIMUM_FOUNDRY_VERSION} or newer.`,
      {
        expectedFoundryVersion: expected,
        minimumFoundryVersion: MINIMUM_FOUNDRY_VERSION,
      },
    );
  }
  const envFile = config.runtime?.envFile;
  const archive = config.runtime?.cachedFoundryArchive;
  const env = await readFile(envFile, "utf8");
  const release = normalizedEnvironmentValue(env, "FOUNDRY_RELEASE_URL");
  const configuredVersion = normalizeFoundryVersion(
    normalizedEnvironmentValue(env, "FOUNDRY_VERSION"),
  );
  let releaseVersion = "";
  if (release) {
    try {
      releaseVersion = normalizeFoundryVersion(
        new URL(release).pathname.match(/\/releases\/(\d+\.\d+)/)?.[1],
      );
    } catch {
      releaseVersion = "";
    }
  }
  if (release && releaseVersion !== expected) {
    throw new AcceptanceError(
      "FOUNDRY_RELEASE_VERSION_MISMATCH",
      "Configured Foundry release does not match expectedFoundryVersion.",
      { expectedFoundryVersion: expected, releaseMatches: false },
    );
  }
  if (!release && configuredVersion !== expected) {
    throw new AcceptanceError(
      "FOUNDRY_CONFIG_VERSION_MISMATCH",
      "A cleared Foundry release URL requires an exact FOUNDRY_VERSION match.",
      { configuredVersionMatches: false, expectedFoundryVersion: expected },
    );
  }
  if (!archive) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_REQUIRED",
      "runtime.cachedFoundryArchive is required before runtime mutation.",
    );
  }
  if (archiveFilenameVersion(archive) !== expected) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_FILENAME_MISMATCH",
      "The cached Foundry archive filename does not match expectedFoundryVersion.",
      { archiveFilenameMatches: false, expectedFoundryVersion: expected },
    );
  }
  const archiveDetails = await lstat(archive);
  if (!archiveDetails.isFile() || archiveDetails.isSymbolicLink()) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_INVALID",
      "The cached Foundry archive must be a regular non-symlink file.",
    );
  }
  if (
    (archiveDetails.mode & 0o022) !== 0 ||
    (archiveDetails.mode & 0o600) !== 0o600
  ) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_MODE_UNSAFE",
      "The cached Foundry archive must be owner-readable/writable and not group/world-writable.",
    );
  }
  const handle = await open(
    archive,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  let archiveIdentity;
  try {
    const opened = await handle.stat();
    if (
      opened.dev !== archiveDetails.dev ||
      opened.ino !== archiveDetails.ino ||
      opened.size !== archiveDetails.size ||
      opened.mtimeMs !== archiveDetails.mtimeMs
    ) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_DRIFT",
        "Cached Foundry archive changed while its identity was captured.",
      );
    }
    const bytes = globalThis.Buffer.alloc(opened.size);
    const initialRead = await handle.read({
      buffer: bytes,
      offset: 0,
      length: bytes.length,
      position: 0,
    });
    if (initialRead.bytesRead !== bytes.length) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_DRIFT",
        "Cached Foundry archive could not be read in full.",
      );
    }
    const final = await handle.stat();
    if (
      final.dev !== opened.dev ||
      final.ino !== opened.ino ||
      final.size !== opened.size ||
      final.mtimeMs !== opened.mtimeMs
    ) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_DRIFT",
        "Cached Foundry archive changed while it was being read.",
      );
    }
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_NOT_ZIP",
        "Cached Foundry archive is not a valid ZIP file.",
      );
    }
    archiveIdentity = Object.freeze({
      canonicalPath: await realpath(archive),
      dev: opened.dev,
      ino: opened.ino,
      size: opened.size,
      mtimeMs: opened.mtimeMs,
      mode: opened.mode & 0o777,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const metadata = await (options.archiveMetadataReader ?? zipPackageJson)(
      bytes,
    );
    const afterBytes = globalThis.Buffer.alloc(opened.size);
    const afterRead = await handle.read({
      buffer: afterBytes,
      offset: 0,
      length: afterBytes.length,
      position: 0,
    });
    if (
      afterRead.bytesRead !== afterBytes.length ||
      createHash("sha256").update(afterBytes).digest("hex") !==
        archiveIdentity.sha256 ||
      afterBytes.length !== archiveIdentity.size
    ) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_DRIFT",
        "Cached Foundry archive bytes changed during descriptor-bound metadata verification.",
      );
    }
    const metadataAfter = await handle.stat();
    if (
      metadataAfter.dev !== opened.dev ||
      metadataAfter.ino !== opened.ino ||
      metadataAfter.size !== opened.size ||
      metadataAfter.mtimeMs !== opened.mtimeMs
    ) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_DRIFT",
        "Cached Foundry archive changed during descriptor-bound metadata verification.",
      );
    }
    const metadataVersion = normalizeFoundryVersion(
      metadata.version ??
        metadata.release?.version ??
        (metadata.release?.generation && metadata.release?.build
          ? `${metadata.release.generation}.${metadata.release.build}`
          : ""),
    );
    if (metadataVersion !== expected) {
      throw new AcceptanceError(
        "FOUNDRY_CACHE_VERSION_MISMATCH",
        "The cached Foundry archive metadata does not match expectedFoundryVersion.",
        { expectedFoundryVersion: expected, archiveMatches: false },
      );
    }
  } finally {
    await handle.close();
  }
  if (
    options.expectedArchiveIdentity &&
    JSON.stringify(options.expectedArchiveIdentity) !==
      JSON.stringify(archiveIdentity)
  ) {
    throw new AcceptanceError(
      "FOUNDRY_CACHE_DRIFT",
      "Cached Foundry archive identity changed from the acceptance lease.",
    );
  }
  return Object.freeze({
    expectedFoundryVersion: expected,
    releaseMatches: true,
    releaseRetained: Boolean(release),
    configuredVersionMatches: release ? undefined : true,
    archiveMatches: true,
    archiveIdentity,
  });
}

function assertAbsolute(value, label) {
  if (!path.isAbsolute(value ?? "")) {
    throw new AcceptanceError(
      "INVALID_RUNTIME_PATH",
      `${label} must be an absolute path.`,
    );
  }
}

async function readComposeFileVerified(composeFile) {
  assertAbsolute(composeFile, "runtime.composeFile");
  const details = await lstat(composeFile);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new AcceptanceError(
      "COMPOSE_FILE_UNSAFE",
      "runtime.composeFile must be a canonical regular non-symlink file.",
    );
  }
  const canonicalPath = await realpath(composeFile);
  if (canonicalPath !== composeFile) {
    throw new AcceptanceError(
      "COMPOSE_FILE_SYMLINK",
      "runtime.composeFile must not resolve through a symlink.",
    );
  }
  const handle = await open(
    composeFile,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (
      opened.dev !== details.dev ||
      opened.ino !== details.ino ||
      opened.size !== details.size ||
      opened.mtimeMs !== details.mtimeMs
    ) {
      throw new AcceptanceError(
        "COMPOSE_FILE_DRIFT",
        "runtime.composeFile changed while its identity was captured.",
      );
    }
    const contents = await handle.readFile();
    const final = await handle.stat();
    if (
      final.dev !== opened.dev ||
      final.ino !== opened.ino ||
      final.size !== opened.size ||
      final.mtimeMs !== opened.mtimeMs
    ) {
      throw new AcceptanceError(
        "COMPOSE_FILE_DRIFT",
        "runtime.composeFile changed while it was being read.",
      );
    }
    return Object.freeze({
      contents,
      identity: Object.freeze({
        canonicalPath,
        dev: opened.dev,
        ino: opened.ino,
        size: opened.size,
        mtimeMs: opened.mtimeMs,
        mode: opened.mode & 0o777,
        sha256: createHash("sha256").update(contents).digest("hex"),
      }),
    });
  } finally {
    await handle.close();
  }
}

export async function readComposeFileIdentity(composeFile) {
  return (await readComposeFileVerified(composeFile)).identity;
}

export async function assertComposeFileIdentity(composeFile, expected) {
  const current = await readComposeFileIdentity(composeFile);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new AcceptanceError(
      "COMPOSE_FILE_IDENTITY_DRIFT",
      "runtime.composeFile identity changed; refusing the Compose operation.",
      { composeFile },
    );
  }
  return current;
}

function composeSnapshotPath(source) {
  return `${source}.d6e2-snapshot`;
}

function composeRuntimeConfig(config, source, snapshot) {
  return {
    ...config,
    runtime: {
      ...config.runtime,
      composeFile: snapshot,
      composeSourceFile: source,
      composeProjectDirectory:
        config.runtime.composeProjectDirectory ?? path.dirname(source),
    },
  };
}

export async function createComposeSnapshot(config, options = {}) {
  const source = options.sourceFile ?? config.runtime.composeFile;
  const sourceVerified = await readComposeFileVerified(source);
  const sourceIdentity = sourceVerified.identity;
  const snapshot = options.snapshotPath ?? composeSnapshotPath(source);
  try {
    await lstat(snapshot);
    throw new AcceptanceError(
      "COMPOSE_SNAPSHOT_EXISTS",
      "A prior Compose snapshot exists; recover or retire it before starting another run.",
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await options.beforeWrite?.({ source, snapshot });
  await writeFile(snapshot, sourceVerified.contents, {
    flag: "wx",
    mode: 0o600,
  });
  await chmod(snapshot, 0o600);
  try {
    const currentSource = await readComposeFileIdentity(source);
    if (JSON.stringify(currentSource) !== JSON.stringify(sourceIdentity)) {
      throw new AcceptanceError(
        "COMPOSE_SOURCE_DRIFT",
        "The Compose source changed while its durable snapshot was created.",
      );
    }
    const snapshotIdentity = await readComposeFileIdentity(snapshot);
    if (
      snapshotIdentity.size !== sourceIdentity.size ||
      snapshotIdentity.sha256 !== sourceIdentity.sha256
    ) {
      throw new AcceptanceError(
        "COMPOSE_SNAPSHOT_DIGEST_MISMATCH",
        "The durable Compose snapshot bytes do not equal the verified source bytes.",
      );
    }
    return Object.freeze({
      config: composeRuntimeConfig(config, source, snapshot),
      composeIdentity: Object.freeze({
        projectDirectory: path.dirname(source),
        source: sourceIdentity,
        snapshot: snapshotIdentity,
      }),
    });
  } catch (error) {
    await rm(snapshot, { force: true });
    throw error;
  }
}

export async function loadComposeSnapshot(config) {
  const source = config.runtime.composeFile;
  const snapshot = composeSnapshotPath(source);
  const sourceIdentity = await readComposeFileIdentity(source);
  const snapshotIdentity = await readComposeFileIdentity(snapshot);
  if ((snapshotIdentity.mode & 0o077) !== 0) {
    throw new AcceptanceError(
      "COMPOSE_SNAPSHOT_UNSAFE",
      "Compose snapshot must be owner-only.",
    );
  }
  return Object.freeze({
    config: composeRuntimeConfig(config, source, snapshot),
    composeIdentity: Object.freeze({
      projectDirectory: path.dirname(source),
      source: sourceIdentity,
      snapshot: snapshotIdentity,
    }),
  });
}

export async function resolveRecoveryComposeConfig(config, journal) {
  const source = config.runtime.composeSourceFile ?? config.runtime.composeFile;
  const snapshotPath = journal.runtime.composeFile;
  const plannedSnapshotPath = `${source}.d6e2-snapshot`;
  if (
    journal.snapshot?.path !== snapshotPath &&
    journal.snapshot?.status !== "planned"
  ) {
    throw new AcceptanceError(
      "COMPOSE_SNAPSHOT_STATE_INVALID",
      "Recovery snapshot path does not match the journaled runtime path.",
    );
  }
  if (
    journal.snapshot?.status === "planned" &&
    journal.snapshot.path !== plannedSnapshotPath
  ) {
    throw new AcceptanceError(
      "COMPOSE_SNAPSHOT_STATE_INVALID",
      "Planned recovery snapshot path is not the canonical source-derived path.",
    );
  }
  const sourceIdentity = await readComposeFileIdentity(source);
  if (
    JSON.stringify(sourceIdentity) !==
    JSON.stringify(journal.composeIdentity.source)
  ) {
    throw new AcceptanceError(
      "COMPOSE_SOURCE_IDENTITY_MISMATCH",
      "Recovery source does not match the journal identity.",
    );
  }
  if (journal.snapshot?.status === "active") {
    const snapshotIdentity = await readComposeFileIdentity(snapshotPath);
    if (
      JSON.stringify(snapshotIdentity) !==
      JSON.stringify(journal.composeIdentity.snapshot)
    ) {
      throw new AcceptanceError(
        "COMPOSE_SNAPSHOT_IDENTITY_MISMATCH",
        "Recovery snapshot does not match the journal identity.",
      );
    }
  } else if (journal.snapshot?.status === "retiring") {
    try {
      const snapshotIdentity = await readComposeFileIdentity(snapshotPath);
      if (
        JSON.stringify(snapshotIdentity) !==
        JSON.stringify(journal.composeIdentity.snapshot)
      ) {
        throw new AcceptanceError(
          "COMPOSE_SNAPSHOT_IDENTITY_MISMATCH",
          "Recovery snapshot does not match the journal identity.",
        );
      }
    } catch (error) {
      if (
        error?.code !== "ENOENT" ||
        journal.snapshot.retirementStarted !== true
      )
        throw error;
    }
  } else if (journal.snapshot?.status === "planned") {
    try {
      await lstat(journal.snapshot.path);
      throw new AcceptanceError(
        "COMPOSE_SNAPSHOT_UNEXPECTED",
        "A planned recovery snapshot exists without an active identity.",
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  } else if (journal.snapshot?.status === "retired") {
    try {
      await lstat(journal.snapshot.path);
      throw new AcceptanceError(
        "COMPOSE_SNAPSHOT_REAPPEARED",
        "A retired Compose snapshot reappeared at its journaled path.",
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  } else if (journal.snapshot?.status !== "retired") {
    throw new AcceptanceError(
      "COMPOSE_SNAPSHOT_STATE_INVALID",
      "Recovery journal has no supported Compose snapshot state.",
    );
  }
  return composeRuntimeConfig(config, source, snapshotPath);
}

export async function retireComposeSnapshot(config, composeIdentity) {
  const snapshot = config.runtime.composeFile;
  try {
    await assertComposeFileIdentity(snapshot, composeIdentity.snapshot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { snapshot, retired: true };
  }
  await rm(snapshot, { force: false });
  return { snapshot, retired: true };
}

export function replaceEnvironmentValue(source, key, value) {
  const lines = source.split(/(?<=\n)/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (new RegExp(`^${key}=`).test(lines[index])) matches.push(index);
  }
  if (matches.length !== 1) {
    throw new AcceptanceError(
      "RUNTIME_ENV_KEY_COUNT",
      `Expected exactly one ${key}= entry, found ${matches.length}; runtime selection is blocked.`,
    );
  }
  const index = matches[0];
  const newline = lines[index].endsWith("\n") ? "\n" : "";
  lines[index] = `${key}=${value}${newline}`;
  return lines.join("");
}

export async function assertCanonicalEnvironmentFile(envFile) {
  assertAbsolute(envFile, "runtime.envFile");
  const details = await lstat(envFile);
  if (
    !details.isFile() ||
    details.isSymbolicLink() ||
    (details.mode & 0o077) !== 0
  ) {
    throw new AcceptanceError(
      "RUNTIME_ENV_UNSAFE",
      "Canonical environment must be an owner-only regular file.",
    );
  }
  return Object.freeze({
    mode: details.mode & 0o777,
    safe: true,
  });
}

export async function createEnvironmentSnapshot({
  envFile,
  snapshotPath,
  worldId,
}) {
  assertAbsolute(envFile, "runtime.envFile");
  assertAbsolute(snapshotPath, "environment snapshot path");
  const sourceDetails = await lstat(envFile);
  if (!sourceDetails.isFile() || sourceDetails.isSymbolicLink()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_NOT_REGULAR",
      "Canonical environment must be a regular file.",
    );
  }
  const sourceHandle = await open(
    envFile,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  let sourceBytes;
  let sourceIdentity;
  try {
    const before = await sourceHandle.stat();
    sourceBytes = await sourceHandle.readFile();
    const after = await sourceHandle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      throw new AcceptanceError(
        "RUNTIME_ENV_DRIFT",
        "Canonical environment changed while snapshot was read.",
      );
    }
    sourceIdentity = Object.freeze({
      canonicalPath: await realpath(envFile),
      dev: before.dev,
      ino: before.ino,
      size: before.size,
      mtimeMs: before.mtimeMs,
      mode: before.mode & 0o777,
      sha256: createHash("sha256").update(sourceBytes).digest("hex"),
    });
  } finally {
    await sourceHandle.close();
  }
  const candidateBytes = globalThis.Buffer.from(
    replaceEnvironmentValue(
      sourceBytes.toString("utf8"),
      "FOUNDRY_WORLD",
      worldId,
    ),
  );
  await writeFile(snapshotPath, candidateBytes, { flag: "wx", mode: 0o600 });
  await chmod(snapshotPath, 0o600);
  const identity = await readRegularFileIdentity(snapshotPath);
  return Object.freeze({
    path: snapshotPath,
    sourceIdentity,
    identity,
    originalWorld: readEnvironmentValue(
      sourceBytes.toString("utf8"),
      "FOUNDRY_WORLD",
    ),
  });
}

export async function assertEnvironmentSnapshotIdentity(snapshot) {
  if (!snapshot?.path || !snapshot?.identity) {
    throw new AcceptanceError(
      "RUNTIME_ENV_SNAPSHOT_IDENTITY_REQUIRED",
      "Environment snapshot identity is required before runtime use.",
    );
  }
  const current = await readRegularFileIdentity(snapshot.path);
  if (JSON.stringify(current) !== JSON.stringify(snapshot.identity)) {
    throw new AcceptanceError(
      "RUNTIME_ENV_SNAPSHOT_DRIFT",
      "Environment snapshot identity changed before runtime use.",
    );
  }
  return current;
}

export async function retireEnvironmentSnapshot(snapshot) {
  if (!snapshot?.path || !snapshot?.identity) return { retired: true };
  try {
    const current = await readRegularFileIdentity(snapshot.path);
    if (JSON.stringify(current) !== JSON.stringify(snapshot.identity)) {
      throw new AcceptanceError(
        "RUNTIME_ENV_SNAPSHOT_DRIFT",
        "Environment snapshot identity changed during retirement.",
      );
    }
    await unlink(snapshot.path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { path: snapshot.path, retired: true };
}

async function atomicWrite(file, contents, mode = 0o600) {
  const temporary = `${file}.acceptance-${randomBytes(4).toString("hex")}`;
  await writeFile(temporary, contents, { mode });
  await rename(temporary, file);
  await chmod(file, mode);
}

function readEnvironmentValue(source, key) {
  const line = source
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1);
}

export async function restoreWorldEnvironment({
  contents,
  envFile,
  mode,
  expectedWorldId,
}) {
  assertAbsolute(envFile, "runtime.envFile");
  const details = await lstat(envFile);
  if (details.isSymbolicLink() || !details.isFile()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_NOT_REGULAR",
      `Refusing recovery because ${envFile} is not the configured regular environment file.`,
    );
  }
  const current = await readFile(envFile, "utf8");
  if (
    expectedWorldId &&
    readEnvironmentValue(current, "FOUNDRY_WORLD") !== expectedWorldId
  ) {
    throw new AcceptanceError(
      "RUNTIME_ENV_WORLD_DRIFT",
      "Refusing environment restoration because FOUNDRY_WORLD changed outside the acceptance lease.",
    );
  }
  const originalWorld = readEnvironmentValue(
    contents.toString("utf8"),
    "FOUNDRY_WORLD",
  );
  if (originalWorld === undefined) {
    throw new AcceptanceError(
      "RUNTIME_ENV_WORLD_MISSING",
      "The original environment backup has no FOUNDRY_WORLD entry.",
    );
  }
  await atomicWrite(
    envFile,
    replaceEnvironmentValue(current, "FOUNDRY_WORLD", originalWorld),
    mode,
  );
}

export async function switchWorldEnvironment({
  envFile,
  variable = "FOUNDRY_WORLD",
  worldId,
  expectedFoundryVersion,
  cachedFoundryArchive,
}) {
  assertAbsolute(envFile, "runtime.envFile");
  const envDetails = await lstat(envFile);
  if (envDetails.isSymbolicLink()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_SYMLINK",
      `Refusing to replace symlinked environment file ${envFile}; configure its exact regular-file target instead.`,
    );
  }
  if (!envDetails.isFile()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_NOT_FILE",
      `runtime.envFile must be an existing regular file: ${envFile}.`,
    );
  }
  const releaseConfig =
    expectedFoundryVersion && cachedFoundryArchive
      ? {
          expectedFoundryVersion,
          runtime: { envFile, cachedFoundryArchive },
        }
      : undefined;
  if (releaseConfig) await assertFoundryReleaseInputs(releaseConfig);
  const original = await readFile(envFile, "utf8");
  const originalWorld = readEnvironmentValue(original, variable);
  if (originalWorld === undefined) {
    throw new AcceptanceError(
      "RUNTIME_ENV_WORLD_MISSING",
      `Expected exactly one ${variable}= entry for reversible world selection.`,
    );
  }
  const originalMode = envDetails.mode & 0o777;
  const updated = replaceEnvironmentValue(original, variable, worldId);
  await atomicWrite(envFile, updated, originalMode);
  return async () => {
    if (releaseConfig) await assertFoundryReleaseInputs(releaseConfig);
    const current = await readFile(envFile, "utf8");
    if (readEnvironmentValue(current, variable) !== worldId) {
      throw new AcceptanceError(
        "RUNTIME_ENV_WORLD_DRIFT",
        `Refusing environment restoration because ${variable} changed outside the acceptance lease.`,
      );
    }
    await atomicWrite(
      envFile,
      replaceEnvironmentValue(current, variable, originalWorld),
      originalMode,
    );
  };
}

async function assertSymlink(linkPath) {
  const details = await lstat(linkPath);
  if (!details.isSymbolicLink()) {
    throw new AcceptanceError(
      "SYSTEM_INSTALL_NOT_SYMLINK",
      `Refusing to replace ${linkPath}; the established candidate integration path must be a symlink.`,
    );
  }
}

async function replaceSymlink(linkPath, target) {
  const temporary = `${linkPath}.acceptance-${randomBytes(4).toString("hex")}`;
  await symlink(target, temporary);
  try {
    await rename(temporary, linkPath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function restoreSystemSymlink({ installPath, target }) {
  assertAbsolute(installPath, "runtime.systemInstallPath");
  await assertSymlink(installPath);
  await replaceSymlink(installPath, target);
}

export async function switchSystemSymlink({
  candidateIdentity,
  candidatePath,
  installPath,
}) {
  assertAbsolute(candidatePath, "candidateSystemPath");
  assertAbsolute(installPath, "runtime.systemInstallPath");
  await assertCandidatePath(candidatePath, candidateIdentity);
  await assertSymlink(installPath);
  const originalTarget = await readlink(installPath);
  await replaceSymlink(installPath, candidatePath);
  return async () => replaceSymlink(installPath, originalTarget);
}

function dockerArgs(config, action) {
  const prefix = ["compose"];
  if (config.composeProjectDirectory) {
    prefix.push("--project-directory", config.composeProjectDirectory);
  }
  prefix.push("-f", config.composeFile);
  if (config.envFile) prefix.push("--env-file", config.envFile);
  if (action === "recreate") {
    return [
      ...prefix,
      "up",
      "-d",
      "--force-recreate",
      "--no-deps",
      config.service,
    ];
  }
  if (action === "stop") {
    return [...prefix, "stop", config.service];
  }
  if (action === "running") {
    return [...prefix, "ps", "--status", "running", "--quiet", config.service];
  }
  return [...prefix, "ps", "--format", "json", config.service];
}

function dockerEnvironment(config) {
  return {
    ...process.env,
    ...(config.envFile ? { D6E2_ACCEPTANCE_ENV_FILE: config.envFile } : {}),
  };
}

async function retireStaleFoundryLock({ dataMountSource, runRoot }) {
  assertAbsolute(dataMountSource, "runtime.dataMountSource");
  assertAbsolute(runRoot, "acceptance run root");
  const lockPath = path.join(dataMountSource, "Config", "options.json.lock");
  let details;
  try {
    details = await lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new AcceptanceError(
      "FOUNDRY_DATA_LOCK_UNSAFE",
      "Foundry's data lock must be an exact empty non-symlink directory before recoverable retirement.",
    );
  }
  if ((await readdir(lockPath)).length !== 0) {
    throw new AcceptanceError(
      "FOUNDRY_DATA_LOCK_NOT_EMPTY",
      "Foundry's data lock directory is not empty; refusing automatic retirement.",
    );
  }
  const retiredRoot = path.join(runRoot, "retired-foundry-locks");
  await mkdir(retiredRoot, { recursive: true, mode: 0o700 });
  await chmod(retiredRoot, 0o700);
  let retiredPath;
  for (let sequence = 1; sequence <= 16; sequence += 1) {
    const candidate = path.join(
      retiredRoot,
      `options.json.lock-${String(sequence).padStart(2, "0")}`,
    );
    try {
      await lstat(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      retiredPath = candidate;
      break;
    }
  }
  if (!retiredPath) {
    throw new AcceptanceError(
      "FOUNDRY_DATA_LOCK_RETIREMENT_LIMIT",
      "The run exceeded the bounded number of recoverable Foundry lock retirements.",
    );
  }
  await rename(lockPath, retiredPath);
  return retiredPath;
}

export async function readCandidateDirectoryIdentity(candidatePath) {
  assertAbsolute(candidatePath, "candidateSystemPath");
  if (candidatePath.includes("\n") || candidatePath.includes("\r")) {
    throw new AcceptanceError(
      "INVALID_SYSTEM_PATH",
      "candidateSystemPath cannot contain newlines.",
    );
  }
  const details = await lstat(candidatePath);
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new AcceptanceError(
      "CANDIDATE_PATH_UNSAFE",
      "candidateSystemPath must be a canonical non-symlink directory.",
    );
  }
  const canonical = await realpath(candidatePath);
  if (canonical !== candidatePath) {
    throw new AcceptanceError(
      "CANDIDATE_PATH_SYMLINK",
      "candidateSystemPath must resolve to the configured canonical path.",
    );
  }
  return Object.freeze({
    canonicalPath: canonical,
    dev: details.dev,
    ino: details.ino,
    size: details.size,
    mtimeMs: details.mtimeMs,
  });
}

async function assertCandidatePath(candidatePath, expected) {
  const current = await readCandidateDirectoryIdentity(candidatePath);
  if (
    expected &&
    (current.canonicalPath !== expected.canonicalPath ||
      current.dev !== expected.dev ||
      current.ino !== expected.ino ||
      current.size !== expected.size ||
      current.mtimeMs !== expected.mtimeMs)
  ) {
    throw new AcceptanceError(
      "CANDIDATE_PATH_DRIFT",
      "candidateSystemPath identity changed from its preflight lease.",
    );
  }
  return current;
}

export async function assertCandidateComposeBind(
  config,
  candidatePath,
  runner = runProcess,
  options = {},
) {
  const phase = options.phase ?? "candidate";
  const candidateIdentity =
    phase === "canonical"
      ? undefined
      : await assertCandidatePath(candidatePath, options.candidateIdentity);
  const composeIdentity = await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  const prefix = ["compose"];
  if (config.composeProjectDirectory) {
    prefix.push("--project-directory", config.composeProjectDirectory);
  }
  prefix.push("-f", config.composeFile);
  if (config.envFile) prefix.push("--env-file", config.envFile);
  await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  if (phase !== "canonical") {
    await assertCandidatePath(candidatePath, candidateIdentity);
  }
  const result = await runner(
    "docker",
    [...prefix, "config", "--format", "json"],
    {
      childRegistry: options.childRegistry,
      env: dockerEnvironment(config),
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 10_000,
    },
  );
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = undefined;
  }
  const mounts = parsed?.services?.[config.service]?.volumes;
  const exact =
    candidatePath && Array.isArray(mounts)
      ? mounts.filter(
          (mount) =>
            mount?.type === "bind" &&
            mount.source === candidatePath &&
            mount.target === candidatePath &&
            mount.read_only === true,
        )
      : [];
  const conflicting =
    candidatePath && Array.isArray(mounts)
      ? mounts.filter(
          (mount) =>
            (typeof mount?.target === "string" &&
              (mount.target === candidatePath ||
                mount.target.startsWith(`${candidatePath}${path.sep}`) ||
                candidatePath.startsWith(`${mount.target}${path.sep}`))) ||
            (mount?.type === "bind" &&
              (mount.source === candidatePath ||
                candidatePath.startsWith(`${mount.source ?? ""}${path.sep}`))),
        )
      : [];
  const staleWorktreeMounts = Array.isArray(mounts)
    ? mounts.filter((mount) => {
        const values = [mount?.source, mount?.target].filter(
          (value) => typeof value === "string",
        );
        return (
          values.some((value) => value.startsWith("/private/tmp/d6-")) &&
          !(mount?.source === candidatePath && mount?.target === candidatePath)
        );
      })
    : [];
  const dataMountSource = options.dataMountSource;
  const dataMounts = dataMountSource
    ? Array.isArray(mounts)
      ? mounts.filter(
          (mount) =>
            mount?.type === "bind" &&
            mount.source === dataMountSource &&
            mount.target === "/data" &&
            mount.read_only !== true,
        )
      : []
    : undefined;
  const invalidDataMounts = dataMountSource
    ? Array.isArray(mounts)
      ? mounts.filter(
          (mount) =>
            mount?.target === "/data" ||
            (typeof mount?.source === "string" &&
              (mount.source === dataMountSource ||
                mount.source.startsWith(`${dataMountSource}${path.sep}`))),
        )
      : []
    : [];
  if (!dataMountSource) {
    throw new AcceptanceError(
      "COMPOSE_MOUNT_ALLOWLIST_REQUIRED",
      "Exact Compose mount validation requires the canonical dataPath.",
    );
  }
  const expectedMounts =
    phase === "canonical"
      ? [
          {
            type: "bind",
            source: dataMountSource,
            target: "/data",
            read_only: false,
          },
        ]
      : [
          {
            type: "bind",
            source: dataMountSource,
            target: "/data",
            read_only: false,
          },
          {
            type: "bind",
            source: candidatePath,
            target: candidatePath,
            read_only: true,
          },
        ];
  const normalizedMounts = Array.isArray(mounts)
    ? mounts.map((mount) => ({
        type: mount?.type,
        source: mount?.source,
        target: mount?.target,
        read_only: mount?.read_only === true,
      }))
    : [];
  const exactMountSet =
    normalizedMounts.length === expectedMounts.length &&
    expectedMounts.every((expectedMount) =>
      normalizedMounts.some(
        (mount) =>
          mount.type === expectedMount.type &&
          mount.source === expectedMount.source &&
          mount.target === expectedMount.target &&
          mount.read_only === expectedMount.read_only,
      ),
    );
  if (
    result.code !== 0 ||
    (candidatePath && exact.length !== 1) ||
    (candidatePath && conflicting.length !== 1) ||
    staleWorktreeMounts.length > 0 ||
    (dataMountSource &&
      (dataMounts.length !== 1 || invalidDataMounts.length !== 1)) ||
    !exactMountSet
  ) {
    throw new AcceptanceError(
      "CANDIDATE_COMPOSE_BIND_MISSING",
      "The candidate system path is not present as the exact read-only Compose bind.",
      { candidatePath, phase, mountCount: normalizedMounts.length },
    );
  }
  return {
    candidateIdentity,
    candidatePath,
    bind: `${candidatePath}:ro`,
    composeIdentity,
  };
}

export async function assertCandidateSystemVisible(
  config,
  candidatePath,
  runner = runProcess,
  options = {},
) {
  const candidateIdentity = await assertCandidatePath(
    candidatePath,
    options.candidateIdentity,
  );
  const composeIdentity = await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  const prefix = ["compose"];
  if (config.composeProjectDirectory) {
    prefix.push("--project-directory", config.composeProjectDirectory);
  }
  prefix.push("-f", config.composeFile);
  if (config.envFile) prefix.push("--env-file", config.envFile);
  await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  await assertCandidatePath(candidatePath, candidateIdentity);
  const result = await runner(
    "docker",
    [
      ...prefix,
      "exec",
      "-T",
      config.service,
      "test",
      "-r",
      path.join(candidatePath, "system.json"),
    ],
    {
      childRegistry: options.childRegistry,
      env: dockerEnvironment(config),
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 10_000,
    },
  );
  if (result.code !== 0) {
    throw new AcceptanceError(
      "CANDIDATE_SYSTEM_NOT_VISIBLE",
      "The candidate system.json is not readable inside the exact Foundry container.",
      { candidatePath, service: config.service },
    );
  }
  return { candidateIdentity, candidatePath, visible: true, composeIdentity };
}

export async function recreateFoundryService(
  config,
  runner = runProcess,
  options = {},
) {
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  if (config.envFile) assertAbsolute(config.envFile, "runtime.envFile");
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.service ?? "")) {
    throw new AcceptanceError(
      "INVALID_SERVICE",
      "runtime.service must be one exact Compose service name.",
    );
  }
  if (!options.dataMountSource || !options.runRoot) {
    throw new AcceptanceError(
      "RUNTIME_RECREATE_BOUNDARY_REQUIRED",
      "Foundry recreation requires the exact data mount source and secure run root.",
    );
  }
  const stopResult = await runner("docker", dockerArgs(config, "stop"), {
    childRegistry: options.childRegistry,
    env: dockerEnvironment(config),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 30_000,
  });
  if (stopResult.code !== 0) {
    throw new AcceptanceError(
      "RUNTIME_STOP_FAILED",
      `Failed to stop ${config.service} before recreation: ${stopResult.stderr.trim()}`,
    );
  }
  const runningResult = await runner("docker", dockerArgs(config, "running"), {
    childRegistry: options.childRegistry,
    env: dockerEnvironment(config),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (runningResult.code !== 0 || runningResult.stdout.trim() !== "") {
    throw new AcceptanceError(
      "RUNTIME_STOP_INCOMPLETE",
      `Foundry service ${config.service} is still running after the bounded stop.`,
    );
  }
  await retireStaleFoundryLock({
    dataMountSource: options.dataMountSource,
    runRoot: options.runRoot,
  });
  await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  const result = await runner("docker", dockerArgs(config, "recreate"), {
    childRegistry: options.childRegistry,
    env: dockerEnvironment(config),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 30_000,
  });
  if (result.code !== 0) {
    throw new AcceptanceError(
      "RUNTIME_RECREATE_FAILED",
      `Failed to recreate ${config.service}: ${result.stderr.trim()}`,
    );
  }
}

export async function dockerServiceHealth(
  config,
  runner = runProcess,
  options = {},
) {
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  await assertComposeFileIdentity(
    config.composeFile,
    options.composeFileIdentity,
  );
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  const result = await runner("docker", dockerArgs(config, "health"), {
    childRegistry: options.childRegistry,
    env: dockerEnvironment(config),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (result.code !== 0)
    return { healthy: false, reason: result.stderr.trim() };
  const lines = result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const service =
    lines.find((entry) => entry.Service === config.service) ?? lines[0];
  const state = String(service?.State ?? "").toLowerCase();
  const health = String(service?.Health ?? "").toLowerCase();
  let identity;
  if (options.expectedFoundryVersion) {
    try {
      identity = await assertFoundryRuntimeIdentity(config, runner, options);
    } catch (error) {
      if (error?.code !== "FOUNDRY_RUNTIME_IDENTITY_MISMATCH") throw error;
      return {
        healthy: false,
        health,
        id: service?.ID ?? service?.Name ?? "",
        reason: error.code,
        state,
      };
    }
  }
  return {
    healthy: state === "running" && (!health || health === "healthy"),
    health,
    id: service?.ID ?? service?.Name ?? "",
    state,
    identity,
  };
}

export async function assertFoundryRuntimeIdentity(
  config,
  runner = runProcess,
  options = {},
) {
  const expected = normalizeFoundryVersion(
    options.expectedFoundryVersion ?? config.expectedFoundryVersion,
  );
  if (!expected) {
    throw new AcceptanceError(
      "FOUNDRY_VERSION_REQUIRED",
      "expectedFoundryVersion must be configured before runtime mutation.",
    );
  }
  const result = await runner("docker", ["inspect", config.service], {
    childRegistry: options.childRegistry,
    env: dockerEnvironment(config),
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  let container;
  try {
    container = JSON.parse(result.stdout)?.[0];
  } catch {
    container = undefined;
  }
  const labels = container?.Config?.Labels ?? {};
  const project =
    options.expectedComposeProject ??
    config.expectedComposeProject ??
    "development";
  const installedMetadataResult = container?.Id
    ? await runner(
        "docker",
        [
          "exec",
          container.Id,
          "node",
          "-e",
          "const p=require('./resources/app/package.json');process.stdout.write(JSON.stringify({version:p.version,generation:p.release?.generation,build:p.release?.build}))",
        ],
        {
          childRegistry: options.childRegistry,
          env: dockerEnvironment(config),
          signal: options.signal,
          timeoutMs: options.timeoutMs ?? 10_000,
        },
      )
    : undefined;
  let installedMetadata;
  try {
    installedMetadata = JSON.parse(installedMetadataResult?.stdout ?? "");
  } catch {
    installedMetadata = undefined;
  }
  const version = normalizeFoundryVersion(installedMetadata?.version);
  const [expectedGeneration, expectedBuild] = expected.split(".").map(Number);
  const installedBuildMatches =
    installedMetadataResult?.code === 0 &&
    installedMetadata?.generation === expectedGeneration &&
    installedMetadata?.build === expectedBuild;
  const service = labels["com.docker.compose.service"];
  const projectLabel = labels["com.docker.compose.project"];
  const mounts = Array.isArray(container?.Mounts) ? container.Mounts : [];
  const candidatePath = options.candidatePath;
  const candidateMounts = candidatePath
    ? mounts.filter(
        (mount) =>
          mount?.Type === "bind" &&
          mount.Source === candidatePath &&
          mount.Destination === candidatePath &&
          mount.RW === false,
      )
    : [];
  const staleWorktreeMounts = mounts.filter((mount) => {
    const values = [mount?.Source, mount?.Destination].filter(
      (value) => typeof value === "string",
    );
    return (
      values.some((value) => value.startsWith("/private/tmp/d6-")) &&
      !values.includes(candidatePath)
    );
  });
  const canonicalDataMount = mounts.some(
    (mount) => mount?.Destination === "/data" && mount?.Type === "bind",
  );
  const expectedDataMountSource = options.expectedDataMountSource;
  const dataMounts = expectedDataMountSource
    ? mounts.filter(
        (mount) =>
          mount?.Type === "bind" &&
          mount.Source === expectedDataMountSource &&
          mount.Destination === "/data" &&
          mount.RW === true,
      )
    : [];
  const invalidDataMounts = expectedDataMountSource
    ? mounts.filter(
        (mount) =>
          mount?.Destination === "/data" ||
          mount?.Source === expectedDataMountSource,
      )
    : [];
  const phase = options.phase ?? (candidatePath ? "candidate" : "canonical");
  const expectedMounts =
    phase === "candidate"
      ? [
          {
            Type: "bind",
            Source: expectedDataMountSource,
            Destination: "/data",
            RW: true,
          },
          {
            Type: "bind",
            Source: candidatePath,
            Destination: candidatePath,
            RW: false,
          },
        ]
      : [
          {
            Type: "bind",
            Source: expectedDataMountSource,
            Destination: "/data",
            RW: true,
          },
        ];
  const exactMountSet =
    expectedDataMountSource &&
    expectedMounts.length === mounts.length &&
    expectedMounts.every((expectedMount) =>
      mounts.some(
        (mount) =>
          mount?.Type === expectedMount.Type &&
          mount?.Source === expectedMount.Source &&
          mount?.Destination === expectedMount.Destination &&
          Boolean(mount?.RW) === expectedMount.RW,
      ),
    );
  if (
    result.code !== 0 ||
    !container ||
    String(container?.State?.Status ?? "").toLowerCase() !== "running" ||
    version !== expected ||
    !installedBuildMatches ||
    projectLabel !== project ||
    service !== config.service ||
    !canonicalDataMount ||
    (expectedDataMountSource &&
      (dataMounts.length !== 1 || invalidDataMounts.length !== 1)) ||
    staleWorktreeMounts.length > 0 ||
    (candidatePath && candidateMounts.length !== 1) ||
    (!candidatePath &&
      mounts.some((mount) =>
        [mount?.Source, mount?.Destination].some(
          (value) =>
            typeof value === "string" && value.startsWith("/private/tmp/d6-"),
        ),
      )) ||
    !exactMountSet
  ) {
    throw new AcceptanceError(
      "FOUNDRY_RUNTIME_IDENTITY_MISMATCH",
      "Running Foundry service identity, build, project, or mounts do not match the acceptance lease.",
      {
        expectedFoundryVersion: expected,
        installedBuildMatches,
        versionMatches: version === expected,
        projectMatches: projectLabel === project,
        serviceMatches: service === config.service,
        candidateMounts: candidateMounts.length,
        staleWorktreeMounts: staleWorktreeMounts.length,
        dataMounts: dataMounts.length,
        phase,
        mountCount: mounts.length,
      },
    );
  }
  return Object.freeze({
    expectedFoundryVersion: expected,
    project,
    service,
    candidateMount: candidatePath ? candidatePath : null,
  });
}

export async function endpointHealth(
  baseUrl,
  fetcher = globalThis.fetch,
  options = {},
) {
  if (options.candidatePath) {
    await assertCandidatePath(options.candidatePath, options.candidateIdentity);
  }
  try {
    const response = await fetcher(baseUrl, {
      method: "GET",
      redirect: "manual",
      signal: options.signal
        ? globalThis.AbortSignal.any([
            options.signal,
            globalThis.AbortSignal.timeout(options.timeoutMs ?? 5_000),
          ])
        : globalThis.AbortSignal.timeout(options.timeoutMs ?? 5_000),
    });
    return {
      healthy:
        response.status >= 200 &&
        response.status < 500 &&
        (!options.expectedLocation ||
          response.headers.get("location") === options.expectedLocation),
      location: response.headers.get("location"),
      status: response.status,
    };
  } catch (error) {
    return {
      healthy: false,
      reason: error instanceof Error ? error.message : String(error),
      status: 0,
    };
  }
}
