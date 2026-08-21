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
import path from "node:path";
import process from "node:process";
import { AcceptanceError } from "./core.mjs";
import {
  readCandidateDirectoryIdentity,
  readComposeFileIdentity,
} from "./runtime.mjs";

export const ACCEPTANCE_GLOBAL_LOCK_KEY =
  "d6e2-foundry-acceptance-host-global-v1";

function invariant(condition, code, message, details = {}) {
  if (!condition) throw new AcceptanceError(code, message, details);
}

function immutableArtifactMetadata(value) {
  if (!value) return undefined;
  invariant(
    typeof value.path === "string" &&
      typeof (value.sourcePath ?? value.path) === "string" &&
      value.identity,
    "ACCEPTANCE_ARTIFACT_METADATA_REQUIRED",
    "Artifact lock metadata requires exact path, sourcePath, and identity.",
  );
  return {
    path: value.path,
    sourcePath: value.sourcePath ?? value.path,
    identity: value.identity,
    bind: value.bind,
    runId: value.runId,
    journalPath: value.journalPath,
  };
}

function normalizeLockMetadata(values) {
  const normalized = { ...values };
  for (const key of ["snapshot", "canonicalSnapshot", "environmentSnapshot"]) {
    if (key in normalized) {
      normalized[key] = immutableArtifactMetadata(normalized[key]);
    }
  }
  return normalized;
}

function plannedArtifactMatchesLock(existing, planned) {
  if (!existing) return true;
  if (!existing.identity) {
    return existing.path === planned?.path && !existing.sourcePath;
  }
  return (
    existing.path === planned?.path &&
    existing.sourcePath === planned?.sourcePath &&
    existing.identity?.canonicalPath === planned?.path &&
    Number.isInteger(existing.identity.mode) &&
    (existing.identity.mode & 0o077) === 0
  );
}

function equivalentArtifactMetadata(existing, expected) {
  return (
    existing?.path === expected?.path &&
    (existing?.sourcePath === expected?.sourcePath ||
      existing?.sourcePath === existing?.path) &&
    existing?.identity?.canonicalPath === expected?.identity?.canonicalPath &&
    existing?.identity?.size === expected?.identity?.size &&
    existing?.identity?.mode === expected?.identity?.mode &&
    existing?.identity?.sha256 === expected?.identity?.sha256
  );
}

async function canonicalMutablePath(file) {
  return path.join(await realpath(path.dirname(file)), path.basename(file));
}

async function pathExists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function canonicalLockIdentity(
  config,
  { journalPath = null, receiptOnly = false, expectedRunId = null } = {},
) {
  const composeSourceFile =
    config.runtime.composeSourceFile ?? config.runtime.composeFile;
  const composeSourceIdentity =
    await readComposeFileIdentity(composeSourceFile);
  let snapshotIdentity = composeSourceIdentity;
  if (receiptOnly) {
    const receiptFile = `${journalPath}.complete`;
    const details = await lstat(receiptFile);
    invariant(
      details.isFile() &&
        !details.isSymbolicLink() &&
        (details.mode & 0o077) === 0,
      "RECOVERY_RECEIPT_UNSAFE",
      "Receipt-only recovery requires an owner-only receipt.",
    );
    const handle = await open(
      receiptFile,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    let receipt;
    try {
      const opened = await handle.stat();
      invariant(
        opened.dev === details.dev && opened.ino === details.ino,
        "RECOVERY_RECEIPT_DRIFT",
        "Completion receipt changed while binding recovery.",
      );
      receipt = JSON.parse(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
    const candidateIdentity = await readCandidateDirectoryIdentity(
      config.candidateSystemPath,
    );
    invariant(
      receipt.version === 3 &&
        receipt.status === "complete" &&
        receipt.journalPath === journalPath &&
        (!expectedRunId || receipt.runId === expectedRunId) &&
        receipt.runtime?.artifactRoot === config.artifactRoot &&
        receipt.runtime?.candidateSystemPath === config.candidateSystemPath &&
        receipt.runtime?.dataMountSource === config.runtime.dataMountSource &&
        receipt.runtime?.dataPath === config.dataPath &&
        receipt.runtime?.envFile === config.runtime.envFile &&
        receipt.runtime?.service === config.runtime.service &&
        receipt.runtime?.systemInstallPath ===
          config.runtime.systemInstallPath &&
        receipt.runtime?.composeFile === config.runtime.composeFile &&
        receipt.snapshot?.status === "retired" &&
        receipt.snapshot.path === config.runtime.composeFile &&
        !(await pathExists(config.runtime.composeFile)) &&
        JSON.stringify(receipt.composeIdentity?.source) ===
          JSON.stringify(composeSourceIdentity) &&
        JSON.stringify(receipt.candidateIdentity) ===
          JSON.stringify(candidateIdentity),
      "RECOVERY_RECEIPT_MISMATCH",
      "Receipt-only recovery is not bound to the exact retired runtime identity.",
    );
    snapshotIdentity = receipt.composeIdentity.snapshot;
  }
  if (config.runtime.composeFile !== composeSourceFile && !receiptOnly) {
    try {
      snapshotIdentity = await readComposeFileIdentity(
        config.runtime.composeFile,
      );
    } catch (error) {
      if (error?.code !== "ENOENT" || !journalPath) throw error;
      const journalDetails = await lstat(journalPath);
      invariant(
        journalDetails.isFile() &&
          !journalDetails.isSymbolicLink() &&
          (journalDetails.mode & 0o077) === 0,
        "RECOVERY_JOURNAL_UNSAFE",
        "Retired snapshot recovery requires an owner-only journal.",
      );
      const handle = await open(
        journalPath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      let journal;
      try {
        const opened = await handle.stat();
        invariant(
          opened.dev === journalDetails.dev &&
            opened.ino === journalDetails.ino,
          "RECOVERY_JOURNAL_DRIFT",
          "Recovery journal changed while binding the retired snapshot.",
        );
        journal = JSON.parse(await handle.readFile("utf8"));
      } finally {
        await handle.close();
      }
      const sourceIdentity = composeSourceIdentity;
      const candidateIdentity = await readCandidateDirectoryIdentity(
        config.candidateSystemPath,
      );
      invariant(
        (journal.snapshot?.status === "planned" ||
          journal.snapshot?.status === "retired" ||
          (journal.snapshot?.status === "retiring" &&
            journal.snapshot.retirementStarted === true)) &&
          journal.snapshot?.path === config.runtime.composeFile &&
          journal.snapshot?.sourcePath === composeSourceFile &&
          JSON.stringify(journal.composeIdentity.source) ===
            JSON.stringify(sourceIdentity) &&
          JSON.stringify(journal.candidateIdentity) ===
            JSON.stringify(candidateIdentity) &&
          journal.runtime?.composeFile === config.runtime.composeFile &&
          journal.runtime?.composeSourceFile === undefined,
        "COMPOSE_SNAPSHOT_RETIREMENT_UNPROVEN",
        "A missing Compose snapshot may be bound only to an exact retired journal identity.",
      );
      snapshotIdentity = journal.composeIdentity.snapshot;
    }
    if (journalPath) {
      const journalDetails = await lstat(journalPath);
      invariant(
        journalDetails.isFile() &&
          !journalDetails.isSymbolicLink() &&
          (journalDetails.mode & 0o077) === 0,
        "RECOVERY_JOURNAL_UNSAFE",
        "Recovery lock binding requires an owner-only journal.",
      );
      const handle = await open(
        journalPath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      let journal;
      try {
        const opened = await handle.stat();
        invariant(
          opened.dev === journalDetails.dev &&
            opened.ino === journalDetails.ino,
          "RECOVERY_JOURNAL_DRIFT",
          "Recovery journal changed while checking retired snapshot absence.",
        );
        journal = JSON.parse(await handle.readFile("utf8"));
      } finally {
        await handle.close();
      }
      invariant(
        !(
          journal.snapshot?.status === "retired" &&
          journal.snapshot.path === config.runtime.composeFile &&
          (await pathExists(config.runtime.composeFile))
        ),
        "COMPOSE_SNAPSHOT_REAPPEARED",
        "A retired Compose snapshot reappeared at its journaled path.",
      );
    }
  }
  const candidateSystemIdentity = await readCandidateDirectoryIdentity(
    config.candidateSystemPath,
  );
  const paths = {
    composeFile: composeSourceIdentity.canonicalPath,
    composeFileIdentity: composeSourceIdentity,
    composeProjectDirectory:
      config.runtime.composeProjectDirectory ?? path.dirname(composeSourceFile),
    composeSourceFile: composeSourceIdentity.canonicalPath,
    composeSourceIdentity,
    candidateSystemIdentity,
    dataMountSource: await realpath(config.runtime.dataMountSource),
    dataPath: await realpath(config.dataPath),
    envFile: await canonicalMutablePath(config.runtime.envFile),
    systemInstallPath: await canonicalMutablePath(
      config.runtime.systemInstallPath,
    ),
  };
  return Object.freeze({
    key: ACCEPTANCE_GLOBAL_LOCK_KEY,
    paths: Object.freeze(paths),
    snapshot: Object.freeze({
      path: config.runtime.composeFile,
      identity: snapshotIdentity,
    }),
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
  lockRoot = path.join(
    path.dirname(config.runtime.envFile),
    ".agent-runtime",
    "foundry-acceptance-locks",
  ),
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
  lockRoot = path.join(
    path.dirname(config.runtime.envFile),
    ".agent-runtime",
    "foundry-acceptance-locks",
  ),
  processId = process.pid,
  runId,
  receiptOnly = false,
  expectedFoundryArchiveIdentity,
}) {
  invariant(
    command === "smoke" || command === "recover",
    "ACCEPTANCE_LOCK_COMMAND",
    "Acceptance lock command must be smoke or recover.",
  );
  const identity = await canonicalLockIdentity(config, {
    journalPath,
    receiptOnly,
    expectedRunId: runId,
  });
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
    snapshot:
      command === "smoke" || !identity.snapshot?.identity
        ? undefined
        : identity.snapshot,
    startedAt: new Date().toISOString(),
    token,
  };
  if (created) {
    try {
      await atomicMetadata(metadataFile, metadata);
    } catch (error) {
      await rm(lockDirectory, { recursive: true, force: true }).catch(
        () => undefined,
      );
      throw error;
    }
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
    const proofPath = receiptOnly ? `${journalPath}.complete` : journalPath;
    const journalDetails = await lstat(proofPath);
    invariant(
      journalDetails.isFile() &&
        !journalDetails.isSymbolicLink() &&
        (journalDetails.mode & 0o077) === 0,
      "RECOVERY_JOURNAL_UNSAFE",
      "Stale-lock takeover requires an owner-only recovery journal.",
    );
    const journalHandle = await open(
      proofPath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    let journal;
    try {
      const opened = await journalHandle.stat();
      invariant(
        opened.dev === journalDetails.dev && opened.ino === journalDetails.ino,
        "RECOVERY_JOURNAL_DRIFT",
        "Recovery journal changed while binding stale-lock snapshot metadata.",
      );
      journal = JSON.parse(await journalHandle.readFile("utf8"));
    } finally {
      await journalHandle.close();
    }
    invariant(
      (receiptOnly
        ? journal.runId === runId
        : journal.lease?.runId === runId) &&
        journal.snapshot?.status &&
        (journal.snapshot.status === "planned"
          ? plannedArtifactMatchesLock(existing.snapshot, journal.snapshot)
          : !existing.snapshot ||
            (existing.snapshot.path === journal.snapshot.path &&
              JSON.stringify(immutableArtifactMetadata(existing.snapshot)) ===
                JSON.stringify(
                  immutableArtifactMetadata({
                    path: journal.snapshot.path,
                    sourcePath: journal.snapshot.sourcePath,
                    identity: journal.composeIdentity?.snapshot,
                  }),
                ))),
      "ACCEPTANCE_LOCK_SNAPSHOT_MISMATCH",
      "Stale-lock takeover requires the lock snapshot metadata to match the journal.",
      {
        existingSnapshotPresent: Boolean(existing.snapshot),
        journalRunMatches:
          (receiptOnly ? journal.runId : journal.lease?.runId) === runId,
        journalSnapshotStatus: journal.snapshot?.status ?? null,
        receiptOnly,
      },
    );
    if (
      existing.foundryArchiveIdentity ||
      journal.foundryArchiveIdentity ||
      expectedFoundryArchiveIdentity
    ) {
      invariant(
        existing.foundryArchiveIdentity &&
          expectedFoundryArchiveIdentity &&
          JSON.stringify(existing.foundryArchiveIdentity) ===
            JSON.stringify(expectedFoundryArchiveIdentity) &&
          (!journal.foundryArchiveIdentity ||
            JSON.stringify(journal.foundryArchiveIdentity) ===
              JSON.stringify(expectedFoundryArchiveIdentity)),
        "ACCEPTANCE_LOCK_ARCHIVE_MISMATCH",
        "Stale-lock takeover requires the cached Foundry archive identity to match the current verified release and recovery proof.",
      );
    }
    if (existing.canonicalSnapshot || journal.canonicalSnapshot) {
      invariant(
        journal.canonicalSnapshot?.status === "planned"
          ? plannedArtifactMatchesLock(
              existing.canonicalSnapshot,
              journal.canonicalSnapshot,
            )
          : !existing.canonicalSnapshot ||
              (JSON.stringify(
                immutableArtifactMetadata(existing.canonicalSnapshot),
              ) ===
                JSON.stringify(
                  immutableArtifactMetadata({
                    ...journal.canonicalSnapshot,
                    identity:
                      journal.canonicalComposeSnapshotIdentity?.snapshot,
                  }),
                ) &&
                (!existing.canonicalSnapshotIdentity ||
                  JSON.stringify(existing.canonicalSnapshotIdentity) ===
                    JSON.stringify(journal.canonicalComposeSnapshotIdentity))),
        "ACCEPTANCE_LOCK_CANONICAL_SNAPSHOT_MISMATCH",
        "Stale-lock takeover requires canonical snapshot metadata to match the journal.",
      );
    }
    const recoveryEnvironment = receiptOnly
      ? {
          candidateIdentity: journal.environmentSnapshot?.identity,
          candidatePath: journal.environmentSnapshot?.path,
          candidateStatus: journal.environmentSnapshot?.status,
          sourcePath:
            journal.environmentSnapshot?.sourcePath ?? journal.runtime?.envFile,
        }
      : {
          candidateIdentity: journal.environment?.candidateIdentity,
          candidatePath: journal.environment?.candidatePath,
          candidateStatus: journal.environment?.candidateStatus,
          sourcePath: journal.runtime?.envFile,
        };
    if (existing.environmentSnapshot || recoveryEnvironment.candidatePath) {
      invariant(
        recoveryEnvironment.candidateStatus === "planned"
          ? plannedArtifactMatchesLock(existing.environmentSnapshot, {
              path: recoveryEnvironment.candidatePath,
              sourcePath: recoveryEnvironment.sourcePath,
            })
          : !existing.environmentSnapshot ||
              equivalentArtifactMetadata(existing.environmentSnapshot, {
                path: recoveryEnvironment.candidatePath,
                sourcePath: recoveryEnvironment.sourcePath,
                identity: recoveryEnvironment.candidateIdentity,
              }),
        "ACCEPTANCE_LOCK_ENV_SNAPSHOT_MISMATCH",
        "Stale-lock takeover requires candidate environment snapshot metadata to match the journal.",
      );
    }
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
        foundryArchiveIdentity: journal.foundryArchiveIdentity,
        snapshot:
          journal.snapshot.status === "planned"
            ? existing.snapshot
            : {
                path: journal.snapshot.path,
                sourcePath: journal.snapshot.sourcePath,
                identity: journal.composeIdentity?.snapshot,
              },
        canonicalSnapshot:
          journal.canonicalSnapshot?.status === "planned"
            ? existing.canonicalSnapshot
            : journal.canonicalSnapshot
              ? {
                  ...journal.canonicalSnapshot,
                  identity: journal.canonicalComposeSnapshotIdentity?.snapshot,
                }
              : undefined,
        canonicalSnapshotIdentity: journal.canonicalComposeSnapshotIdentity,
        environmentSnapshot:
          journal.environment?.candidateStatus === "planned"
            ? existing.environmentSnapshot
            : journal.environment?.candidatePath
              ? {
                  path: journal.environment.candidatePath,
                  sourcePath: journal.runtime.envFile,
                  identity: journal.environment.candidateIdentity,
                }
              : undefined,
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
      const normalizedValues = normalizeLockMetadata(values);
      for (const key of [
        "snapshot",
        "canonicalSnapshot",
        "environmentSnapshot",
      ]) {
        if (current[key] && normalizedValues[key]) {
          invariant(
            JSON.stringify(immutableArtifactMetadata(current[key])) ===
              JSON.stringify(immutableArtifactMetadata(normalizedValues[key])),
            "ACCEPTANCE_ARTIFACT_IMMUTABLE_DRIFT",
            `Lock artifact metadata for ${key} cannot be replaced after binding.`,
          );
        }
      }
      metadata = {
        ...current,
        ...normalizedValues,
        pid: processId,
        token,
      };
      await atomicMetadata(metadataFile, metadata);
      return metadata;
    },
  };
}
