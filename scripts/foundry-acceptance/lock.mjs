import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { AcceptanceError } from "./core.mjs";

export const ACCEPTANCE_GLOBAL_LOCK_KEY =
  "d6e2-foundry-acceptance-host-global-v1";

function invariant(condition, code, message, details = {}) {
  if (!condition) throw new AcceptanceError(code, message, details);
}

async function canonicalMutablePath(file) {
  return path.join(await realpath(path.dirname(file)), path.basename(file));
}

export async function canonicalLockIdentity(config) {
  const paths = {
    composeFile: await realpath(config.runtime.composeFile),
    dataPath: await realpath(config.dataPath),
    envFile: await canonicalMutablePath(config.runtime.envFile),
    systemInstallPath: await canonicalMutablePath(
      config.runtime.systemInstallPath,
    ),
  };
  return Object.freeze({
    key: ACCEPTANCE_GLOBAL_LOCK_KEY,
    paths: Object.freeze(paths),
  });
}

export function defaultProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function atomicMetadata(file, metadata) {
  const temporary = `${file}.tmp-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, file);
  await chmod(file, 0o600);
}

async function readMetadata(file) {
  let pathDetails;
  try {
    pathDetails = await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new AcceptanceError(
        "ACCEPTANCE_LOCK_INITIALIZING",
        "Acceptance lock exists without complete metadata; retry only after the owning process exits or recover it explicitly.",
      );
    }
    throw error;
  }
  invariant(
    pathDetails.isFile() &&
      !pathDetails.isSymbolicLink() &&
      (pathDetails.mode & 0o077) === 0 &&
      (typeof process.getuid !== "function" ||
        pathDetails.uid === process.getuid()),
    "ACCEPTANCE_LOCK_METADATA_UNSAFE",
    "Acceptance lock metadata must be an owner-only regular file.",
  );
  const handle = await open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const details = await handle.stat();
    invariant(
      details.isFile() &&
        details.dev === pathDetails.dev &&
        details.ino === pathDetails.ino,
      "ACCEPTANCE_LOCK_METADATA_DRIFT",
      "Acceptance lock metadata changed while it was being read.",
    );
    return JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

export async function inspectAcceptanceLock({
  config,
  lockRoot = path.join(os.tmpdir(), "d6e2-foundry-acceptance-locks"),
}) {
  const identity = await canonicalLockIdentity(config);
  const lockDirectory = path.join(
    lockRoot,
    `${ACCEPTANCE_GLOBAL_LOCK_KEY}.lock`,
  );
  const metadataFile = path.join(lockDirectory, "owner.json");
  const [directoryDetails, metadataDetails] = await Promise.all([
    lstat(lockDirectory),
    lstat(metadataFile),
  ]);
  invariant(
    directoryDetails.isDirectory() &&
      !directoryDetails.isSymbolicLink() &&
      (directoryDetails.mode & 0o077) === 0 &&
      (typeof process.getuid !== "function" ||
        directoryDetails.uid === process.getuid()) &&
      metadataDetails.isFile() &&
      !metadataDetails.isSymbolicLink() &&
      (metadataDetails.mode & 0o077) === 0 &&
      (typeof process.getuid !== "function" ||
        metadataDetails.uid === process.getuid()),
    "ACCEPTANCE_LOCK_UNSAFE",
    "Acceptance lock inspection requires owner-only regular lock artifacts.",
  );
  const metadata = await readMetadata(metadataFile);
  invariant(
    metadata.key === identity.key &&
      JSON.stringify(metadata.paths) === JSON.stringify(identity.paths),
    "ACCEPTANCE_LOCK_IDENTITY_MISMATCH",
    "Acceptance lock does not match the configured mutable runtime paths.",
  );
  return Object.freeze({
    identity,
    lockDirectory,
    metadata,
    metadataFile,
  });
}

export async function acquireAcceptanceLock({
  command,
  config,
  isProcessAlive = defaultProcessAlive,
  journalPath = null,
  lockRoot = path.join(os.tmpdir(), "d6e2-foundry-acceptance-locks"),
  processId = process.pid,
  runId,
}) {
  invariant(
    command === "smoke" || command === "recover",
    "ACCEPTANCE_LOCK_COMMAND",
    "Acceptance lock command must be smoke or recover.",
  );
  const identity = await canonicalLockIdentity(config);
  await mkdir(lockRoot, { recursive: true, mode: 0o700 });
  await chmod(lockRoot, 0o700);
  const lockDirectory = path.join(
    lockRoot,
    `${ACCEPTANCE_GLOBAL_LOCK_KEY}.lock`,
  );
  const metadataFile = path.join(lockDirectory, "owner.json");
  const token = randomUUID();
  let created = false;
  try {
    await mkdir(lockDirectory, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  let metadata = {
    command,
    journalPath,
    key: identity.key,
    paths: identity.paths,
    pid: processId,
    runId,
    startedAt: new Date().toISOString(),
    token,
  };
  if (created) {
    await atomicMetadata(metadataFile, metadata);
  } else {
    const existing = await readMetadata(metadataFile);
    if (command !== "recover") {
      throw new AcceptanceError(
        "ACCEPTANCE_LOCK_HELD",
        `Acceptance runtime is locked by PID ${existing.pid} (${existing.command}).`,
        { lockDirectory },
      );
    }
    invariant(
      journalPath &&
        runId &&
        existing.key === identity.key &&
        JSON.stringify(existing.paths) === JSON.stringify(identity.paths) &&
        existing.journalPath === journalPath &&
        existing.runId === runId,
      "ACCEPTANCE_LOCK_RECOVERY_MISMATCH",
      "Stale-lock takeover is allowed only for the exact matching recovery journal and run.",
    );
    invariant(
      !isProcessAlive(existing.pid),
      "ACCEPTANCE_LOCK_OWNER_ALIVE",
      `Acceptance lock owner PID ${existing.pid} is still alive; takeover is blocked.`,
    );
    const claimPath = path.join(lockDirectory, "takeover.claim");
    let claim;
    try {
      claim = await open(claimPath, "wx", 0o600);
      await claim.writeFile(
        `${JSON.stringify({ journalPath, pid: processId, runId, token })}\n`,
      );
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new AcceptanceError(
          "ACCEPTANCE_LOCK_TAKEOVER_BUSY",
          "Another recovery process is already claiming this stale lock.",
        );
      }
      throw error;
    } finally {
      await claim?.close();
    }
    try {
      const confirmed = await readMetadata(metadataFile);
      invariant(
        confirmed.token === existing.token &&
          confirmed.pid === existing.pid &&
          confirmed.journalPath === journalPath &&
          confirmed.runId === runId,
        "ACCEPTANCE_LOCK_CHANGED",
        "Acceptance lock metadata changed during stale takeover.",
      );
      metadata = {
        ...metadata,
        takeoverOf: { pid: existing.pid, token: existing.token },
      };
      await atomicMetadata(metadataFile, metadata);
    } finally {
      await unlink(claimPath).catch(() => undefined);
    }
  }

  const assertOwner = async () => {
    const current = await readMetadata(metadataFile);
    invariant(
      current.pid === processId && current.token === token,
      "ACCEPTANCE_LOCK_OWNERSHIP_LOST",
      "Acceptance process no longer owns the runtime lock.",
    );
    return current;
  };
  return {
    assertOwned: assertOwner,
    identity,
    lockDirectory,
    metadataFile,
    async release() {
      await assertOwner();
      await rm(lockDirectory, { recursive: true, force: false });
    },
    async update(values) {
      const current = await assertOwner();
      metadata = { ...current, ...values, pid: processId, token };
      await atomicMetadata(metadataFile, metadata);
      return metadata;
    },
  };
}
