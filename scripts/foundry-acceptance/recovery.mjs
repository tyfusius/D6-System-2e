import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  open,
  readFile,
  readlink,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  AcceptanceError,
  assertDisposableWorldLease,
  removeDisposableWorld,
} from "./core.mjs";
import {
  replaceEnvironmentValue,
  assertFoundryReleaseInputs,
  assertComposeFileIdentity,
  assertCandidateComposeBind,
  readCandidateDirectoryIdentity,
  readComposeFileIdentity,
  retireComposeSnapshot,
  retireEnvironmentSnapshot,
  restoreSystemSymlink,
  restoreWorldEnvironment,
} from "./runtime.mjs";
import {
  retireLeasedBrowserArtifacts,
  retireLeasedBrowserProfile,
  retireLeasedBrowserRunArtifacts,
  terminateLeasedBrowserGeneration,
} from "./browser-lease.mjs";

export const RECOVERY_JOURNAL_VERSION = 3;
const journalMutationQueues = new Map();

function invariant(condition, code, message, details = {}) {
  if (!condition) throw new AcceptanceError(code, message, details);
}

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

function equivalentOwnedArtifactIdentity(current, expected) {
  return (
    current?.canonicalPath === expected?.canonicalPath &&
    current?.size === expected?.size &&
    current?.mode === expected?.mode &&
    current?.sha256 === expected?.sha256
  );
}

async function assertOwnedArtifact(
  pathname,
  identity,
  { allowMissing = false } = {},
) {
  try {
    const details = await lstat(pathname);
    invariant(
      details.isFile() &&
        !details.isSymbolicLink() &&
        (details.mode & 0o077) === 0,
      "RECOVERY_ARTIFACT_UNSAFE",
      "Recovery artifact must be an owner-only regular file.",
    );
    const handle = await open(
      pathname,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    try {
      const opened = await handle.stat();
      const bytes = await handle.readFile();
      const final = await handle.stat();
      invariant(
        opened.dev === final.dev &&
          opened.ino === final.ino &&
          opened.size === final.size &&
          opened.mtimeMs === final.mtimeMs,
        "RECOVERY_ARTIFACT_DRIFT",
        "Recovery artifact changed while it was being validated.",
      );
      const current = {
        canonicalPath: pathname,
        dev: opened.dev,
        ino: opened.ino,
        size: opened.size,
        mtimeMs: opened.mtimeMs,
        mode: opened.mode & 0o777,
        sha256: checksum(bytes),
      };
      invariant(
        !identity || JSON.stringify(current) === JSON.stringify(identity),
        "RECOVERY_ARTIFACT_IDENTITY_MISMATCH",
        "Recovery artifact identity differs from the journal.",
      );
      return current;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code === "ENOENT" && allowMissing) return undefined;
    throw error;
  }
}

async function atomicJson(file, value) {
  const temporary = `${file}.tmp-${randomBytes(4).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, file);
  await chmod(file, 0o600);
}

function runtimeIdentity(config) {
  return {
    artifactRoot: config.artifactRoot,
    baseUrl: config.baseUrl,
    candidateSystemPath: config.candidateSystemPath,
    composeFile: config.runtime.composeFile,
    dataMountSource: config.runtime.dataMountSource,
    dataPath: config.dataPath,
    envFile: config.runtime.envFile,
    service: config.runtime.service,
    systemInstallPath: config.runtime.systemInstallPath,
  };
}

function assertJournalPath(config, journalPath) {
  invariant(
    path.isAbsolute(journalPath ?? ""),
    "RECOVERY_JOURNAL_PATH",
    "Recovery journal path must be absolute.",
  );
  const artifactRoot = path.resolve(config.artifactRoot);
  const resolved = path.resolve(journalPath);
  invariant(
    resolved.startsWith(`${artifactRoot}${path.sep}`),
    "RECOVERY_JOURNAL_OUTSIDE_ROOT",
    "Recovery journal must remain inside the configured temporary artifact root.",
    { journalPath: resolved },
  );
}

export async function prepareRecoveryJournal({
  candidateIdentity,
  composeIdentity,
  canonicalComposeIdentity,
  canonicalSnapshot,
  config,
  foundryArchiveIdentity,
  environmentSnapshot,
  lease,
  runRoot,
  snapshotPath = config.runtime.composeFile,
  snapshotStatus = "active",
}) {
  const journalPath = path.join(runRoot, "recovery-journal.json");
  const backupPath = path.join(runRoot, "original-runtime.env.backup");
  assertJournalPath(config, journalPath);
  const envDetails = await lstat(config.runtime.envFile);
  invariant(
    envDetails.isFile() && !envDetails.isSymbolicLink(),
    "RUNTIME_ENV_NOT_REGULAR",
    "Recovery requires runtime.envFile to be an exact regular file, not a symlink.",
  );
  const linkDetails = await lstat(config.runtime.systemInstallPath);
  invariant(
    linkDetails.isSymbolicLink(),
    "SYSTEM_INSTALL_NOT_SYMLINK",
    "Recovery requires the configured system installation to be a symlink.",
  );
  invariant(
    lease?.status === "planned" || lease?.status === "active",
    "WORLD_LEASE_STATUS_INVALID",
    "Recovery journal requires a planned or active disposable lease.",
  );
  if (lease.status !== "planned") await assertDisposableWorldLease(lease);
  invariant(
    composeIdentity?.source &&
      (snapshotStatus === "planned" || composeIdentity?.snapshot),
    "COMPOSE_IDENTITY_REQUIRED",
    "Recovery journal requires the single verified Compose snapshot identity.",
  );
  invariant(
    !config.runtime.restoreComposeSourceFile || canonicalComposeIdentity,
    "CANONICAL_COMPOSE_IDENTITY_REQUIRED",
    "Recovery journal requires a separately verified canonical Compose identity.",
  );
  invariant(
    candidateIdentity?.canonicalPath &&
      candidateIdentity?.dev !== undefined &&
      candidateIdentity?.ino !== undefined,
    "CANDIDATE_IDENTITY_REQUIRED",
    "Recovery journal requires the single verified candidate directory identity.",
  );
  if (snapshotStatus !== "planned") {
    await assertComposeFileIdentity(
      config.runtime.composeFile,
      composeIdentity.snapshot,
    );
  }
  await assertComposeFileIdentity(
    config.runtime.composeSourceFile,
    composeIdentity.source,
  );
  const originalEnvironment = await readFile(config.runtime.envFile);
  const candidateEnvironment = globalThis.Buffer.from(
    replaceEnvironmentValue(
      originalEnvironment.toString("utf8"),
      "FOUNDRY_WORLD",
      lease.worldId,
    ),
  );
  await writeFile(backupPath, originalEnvironment, { flag: "wx", mode: 0o600 });
  await chmod(backupPath, 0o600);
  const journal = {
    browserGenerations: [],
    browserStatus: "active",
    environment: {
      backupPath,
      candidateSha256: checksum(candidateEnvironment),
      mode: envDetails.mode & 0o777,
      originalSha256: checksum(originalEnvironment),
      candidatePath: environmentSnapshot?.path,
      candidateIdentity: environmentSnapshot?.identity,
      candidateStatus: environmentSnapshot ? "planned" : undefined,
      expected: environmentSnapshot
        ? {
            size: candidateEnvironment.length,
            sha256: checksum(candidateEnvironment),
          }
        : undefined,
    },
    lease: {
      leaseNonce: lease.leaseNonce,
      manifest: lease.manifest,
      marker: lease.marker,
      markerVersion: lease.markerVersion,
      runId: lease.runId,
      systemId: lease.systemId,
      worldDirectory: lease.worldDirectory,
      worldId: lease.worldId,
      status: lease.status ?? "active",
    },
    systemLink: {
      candidateTarget: config.candidateSystemPath,
      originalTarget: await readlink(config.runtime.systemInstallPath),
    },
    runtime: {
      ...runtimeIdentity(config),
      composeFile: snapshotPath,
    },
    composeIdentity: canonicalComposeIdentity
      ? {
          ...(snapshotStatus === "planned"
            ? {
                projectDirectory: composeIdentity.projectDirectory,
                source: composeIdentity.source,
              }
            : composeIdentity),
          canonical: canonicalComposeIdentity,
        }
      : snapshotStatus === "planned"
        ? {
            projectDirectory: composeIdentity.projectDirectory,
            source: composeIdentity.source,
          }
        : composeIdentity,
    foundryArchiveIdentity,
    snapshot: {
      path: snapshotPath,
      sourcePath: config.runtime.composeSourceFile,
      status: snapshotStatus,
      ...(snapshotStatus === "planned"
        ? { expected: composeIdentity.snapshot }
        : {}),
    },
    canonicalSnapshot: canonicalSnapshot
      ? {
          ...canonicalSnapshot,
          status: canonicalSnapshot.status ?? "planned",
          ...(canonicalSnapshot.status === "planned"
            ? {
                expected:
                  canonicalComposeIdentity?.snapshot ??
                  canonicalComposeIdentity,
              }
            : {}),
        }
      : undefined,
    canonicalComposeSnapshotIdentity:
      canonicalSnapshot?.status === "active"
        ? canonicalComposeIdentity
        : undefined,
    candidateIdentity,
    status: "armed",
    version: RECOVERY_JOURNAL_VERSION,
  };
  await atomicJson(journalPath, journal);
  return Object.freeze({ journal, journalPath });
}

async function mutateRecoveryJournal({ config, journalPath, mutate }) {
  const previous = journalMutationQueues.get(journalPath) ?? Promise.resolve();
  const current = previous.then(async () => {
    const journal = await readRecoveryJournal({ config, journalPath });
    const updated = await mutate(journal);
    await atomicJson(journalPath, updated);
    return updated;
  });
  const queued = current.catch(() => undefined);
  journalMutationQueues.set(journalPath, queued);
  try {
    return await current;
  } finally {
    if (journalMutationQueues.get(journalPath) === queued) {
      journalMutationQueues.delete(journalPath);
    }
  }
}

export async function activatePlannedRecoveryLease({
  config,
  journalPath,
  lease,
}) {
  await assertDisposableWorldLease(lease);
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (journal) => {
      invariant(
        journal.lease?.runId === lease.runId &&
          journal.lease.worldId === lease.worldId &&
          journal.lease.leaseNonce === lease.leaseNonce &&
          journal.lease.status === "planned",
        "WORLD_LEASE_ACTIVATION_INVALID",
        "Only the exact planned disposable lease may become active.",
      );
      return {
        ...journal,
        lease: { ...journal.lease, status: "active" },
      };
    },
  });
}

export async function transitionEnvironmentSnapshot({
  config,
  journalPath,
  snapshot,
  status,
}) {
  invariant(
    ["planned", "active", "retiring", "retired"].includes(status),
    "ENV_SNAPSHOT_STATUS",
    "Unsupported environment snapshot status.",
  );
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (journal) => ({
      ...journal,
      environment: {
        ...journal.environment,
        candidatePath: snapshot?.path ?? journal.environment.candidatePath,
        candidateIdentity:
          snapshot?.identity ?? journal.environment.candidateIdentity,
        candidateStatus: status,
      },
    }),
  });
}

async function drainJournalMutations(journalPath) {
  await (journalMutationQueues.get(journalPath) ?? Promise.resolve());
}

function generationIndex(journal, lease) {
  return journal.browserGenerations.findIndex(
    (entry) =>
      entry.runId === lease.runId &&
      entry.role === lease.role &&
      entry.generation === lease.generation,
  );
}

function replaceGeneration(journal, index, generation) {
  const browserGenerations = [...journal.browserGenerations];
  browserGenerations[index] = generation;
  return { ...journal, browserGenerations };
}

export async function registerBrowserGeneration({
  config,
  generation,
  journalPath,
}) {
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (journal) => {
      invariant(
        journal.browserStatus === "active" &&
          generation.runId === journal.lease.runId &&
          generation.runRoot === path.dirname(journalPath) &&
          generation.status === "planned",
        "BROWSER_LEASE_JOURNAL_MISMATCH",
        "Planned browser generation does not match the active recovery journal.",
      );
      invariant(
        generationIndex(journal, generation) === -1,
        "BROWSER_LEASE_DUPLICATE",
        "Browser generation is already present in the recovery journal.",
      );
      return {
        ...journal,
        browserGenerations: [...journal.browserGenerations, generation],
      };
    },
  });
}

export async function activateBrowserGeneration({
  config,
  generation,
  identity,
  journalPath,
}) {
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (journal) => {
      const index = generationIndex(journal, generation);
      invariant(
        index >= 0 && journal.browserGenerations[index].status === "planned",
        "BROWSER_LEASE_ACTIVATION_INVALID",
        "Only an exact planned browser generation may become active.",
      );
      return replaceGeneration(journal, index, {
        ...journal.browserGenerations[index],
        identity,
        status: "active",
      });
    },
  });
}

export async function transitionBrowserGeneration({
  config,
  generation,
  journalPath,
  status,
}) {
  invariant(
    ["retiring", "retired"].includes(status),
    "BROWSER_LEASE_STATUS_INVALID",
    "Browser generation status transition is invalid.",
  );
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (journal) => {
      const index = generationIndex(journal, generation);
      invariant(
        index >= 0,
        "BROWSER_LEASE_MISSING",
        "Browser generation is absent from the recovery journal.",
      );
      const current = journal.browserGenerations[index];
      const allowed =
        status === "retiring"
          ? ["planned", "active", "retiring"].includes(current.status)
          : ["retiring", "retired"].includes(current.status);
      invariant(
        allowed,
        "BROWSER_LEASE_TRANSITION_INVALID",
        `Browser generation cannot transition from ${current.status} to ${status}.`,
      );
      return replaceGeneration(journal, index, { ...current, status });
    },
  });
}

export async function transitionComposeSnapshot({
  composeIdentity,
  config,
  journalPath,
  status,
  snapshotKey = "snapshot",
}) {
  return mutateRecoveryJournal({
    config,
    journalPath,
    mutate: async (journal) => {
      const current = journal[snapshotKey]?.status;
      const allowed =
        (status === "active" && current === "planned") ||
        (status === "retiring" && current === "active") ||
        (status === "retired" && current === "retiring");
      invariant(
        allowed,
        "COMPOSE_SNAPSHOT_TRANSITION_INVALID",
        `Compose snapshot cannot transition from ${current} to ${status}.`,
      );
      if (status === "active") {
        await assertComposeFileIdentity(
          composeIdentity.snapshot.canonicalPath,
          composeIdentity.snapshot,
        );
      }
      if (status === "retired") {
        try {
          await lstat(composeIdentity.snapshot.canonicalPath);
          throw new AcceptanceError(
            "COMPOSE_SNAPSHOT_NOT_RETIRED",
            "Compose snapshot still exists while retiring it.",
          );
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      return {
        ...journal,
        ...(snapshotKey === "snapshot"
          ? { composeIdentity }
          : { canonicalComposeSnapshotIdentity: composeIdentity }),
        runtime:
          snapshotKey === "snapshot"
            ? {
                ...journal.runtime,
                composeFile: composeIdentity.snapshot.canonicalPath,
              }
            : journal.runtime,
        [snapshotKey]: {
          path: composeIdentity.snapshot.canonicalPath,
          sourcePath: composeIdentity.source.canonicalPath,
          status,
          ...(status === "active"
            ? { identity: composeIdentity.snapshot }
            : {}),
          ...(status === "retiring" ? { retirementStarted: true } : {}),
        },
      };
    },
  });
}

function receiptPath(journalPath) {
  return `${journalPath}.complete`;
}

export async function readRecoveryJournal({
  config,
  journalPath,
  sourceConfig = false,
}) {
  assertJournalPath(config, journalPath);
  const journalDetails = await lstat(journalPath);
  invariant(
    journalDetails.isFile() &&
      !journalDetails.isSymbolicLink() &&
      (journalDetails.mode & 0o077) === 0,
    "RECOVERY_JOURNAL_UNSAFE",
    "Recovery journal must be an owner-only regular file.",
  );
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  invariant(
    journal.version === RECOVERY_JOURNAL_VERSION,
    "RECOVERY_JOURNAL_VERSION",
    "Unsupported recovery journal version.",
  );
  const expectedRuntime = runtimeIdentity(config);
  if (sourceConfig) {
    expectedRuntime.composeFile = `${config.runtime.composeSourceFile}.d6e2-snapshot`;
  }
  invariant(
    JSON.stringify(journal.runtime) === JSON.stringify(expectedRuntime),
    "RECOVERY_CONFIG_MISMATCH",
    "Recovery configuration does not exactly match the journaled runtime paths, endpoint, and service.",
  );
  if (journal.snapshot?.status === "active") {
    await assertComposeFileIdentity(
      journal.runtime.composeFile,
      journal.composeIdentity.snapshot,
    );
  } else if (journal.snapshot?.status === "retiring") {
    try {
      await assertComposeFileIdentity(
        journal.runtime.composeFile,
        journal.composeIdentity.snapshot,
      );
    } catch (error) {
      if (
        error?.code !== "ENOENT" ||
        journal.snapshot.retirementStarted !== true
      ) {
        throw error;
      }
    }
  }
  const candidateIdentity = await readCandidateDirectoryIdentity(
    config.candidateSystemPath,
  );
  invariant(
    JSON.stringify(candidateIdentity) ===
      JSON.stringify(journal.candidateIdentity),
    "CANDIDATE_PATH_DRIFT",
    "Candidate directory identity changed from the recovery journal.",
  );
  await assertComposeFileIdentity(
    config.runtime.composeSourceFile,
    journal.composeIdentity.source,
  );
  const plannedSnapshotPath = `${config.runtime.composeSourceFile ?? config.runtime.composeFile}.d6e2-snapshot`;
  invariant(
    (journal.snapshot?.status === "planned"
      ? journal.snapshot?.path === plannedSnapshotPath
      : journal.snapshot?.path === journal.runtime.composeFile) &&
      journal.snapshot?.sourcePath === config.runtime.composeSourceFile &&
      ["planned", "active", "retiring", "retired"].includes(
        journal.snapshot?.status,
      ),
    "COMPOSE_SNAPSHOT_STATE_INVALID",
    "Recovery snapshot state is not bound to the configured snapshot paths.",
  );
  const snapshotStatuses = ["planned", "active", "retiring", "retired"];
  invariant(
    snapshotStatuses.includes(journal.snapshot.status),
    "COMPOSE_SNAPSHOT_STATE_INVALID",
    "Candidate Compose snapshot lifecycle is invalid.",
  );
  if (journal.snapshot.status === "active") {
    await assertOwnedArtifact(
      journal.snapshot.path,
      journal.composeIdentity.snapshot,
    );
    await assertCandidateComposeBind(
      { ...config.runtime, composeFile: journal.snapshot.path },
      config.candidateSystemPath,
      config.runtime.composeRunner,
      {
        phase: "candidate",
        dataMountSource: config.runtime.dataMountSource,
        candidateIdentity: journal.candidateIdentity,
        composeFileIdentity: journal.composeIdentity.snapshot,
      },
    );
  } else if (journal.snapshot.status === "retiring") {
    await assertOwnedArtifact(
      journal.snapshot.path,
      journal.composeIdentity.snapshot,
      {
        allowMissing: journal.snapshot.retirementStarted === true,
      },
    );
  } else if (journal.snapshot.status === "retired") {
    invariant(
      !(await pathExists(journal.snapshot.path)),
      "COMPOSE_SNAPSHOT_REAPPEARED",
      "A retired candidate Compose snapshot reappeared.",
    );
  }
  if (journal.canonicalSnapshot) {
    invariant(
      journal.canonicalSnapshot.path !== journal.snapshot.path,
      "CANONICAL_SNAPSHOT_NOT_DISTINCT",
      "Canonical and candidate Compose snapshots must be distinct.",
    );
    const canonicalStatus = journal.canonicalSnapshot.status;
    invariant(
      snapshotStatuses.includes(canonicalStatus),
      "CANONICAL_SNAPSHOT_STATE_INVALID",
      "Canonical Compose snapshot lifecycle is invalid.",
    );
    if (canonicalStatus === "active") {
      invariant(
        journal.canonicalComposeSnapshotIdentity,
        "CANONICAL_SNAPSHOT_IDENTITY_REQUIRED",
        "Active canonical snapshot identity is missing.",
      );
      await assertOwnedArtifact(
        journal.canonicalSnapshot.path,
        journal.canonicalComposeSnapshotIdentity.snapshot,
      );
      await assertCandidateComposeBind(
        { ...config.runtime, composeFile: journal.canonicalSnapshot.path },
        undefined,
        config.runtime.composeRunner,
        {
          phase: "canonical",
          dataMountSource: config.runtime.dataMountSource,
          composeFileIdentity:
            journal.canonicalComposeSnapshotIdentity.snapshot,
        },
      );
    } else if (canonicalStatus === "retiring") {
      await assertOwnedArtifact(
        journal.canonicalSnapshot.path,
        journal.canonicalComposeSnapshotIdentity?.snapshot,
        { allowMissing: journal.canonicalSnapshot.retirementStarted === true },
      );
    } else if (canonicalStatus === "retired") {
      invariant(
        !(await pathExists(journal.canonicalSnapshot.path)),
        "CANONICAL_SNAPSHOT_REAPPEARED",
        "A retired canonical Compose snapshot reappeared.",
      );
    }
  }
  if (journal.environment?.candidatePath) {
    invariant(
      path.dirname(journal.environment.candidatePath) ===
        path.dirname(journalPath),
      "RUNTIME_ENV_SNAPSHOT_PATH_MISMATCH",
      "Candidate environment snapshot must be beside its recovery journal.",
    );
    const envStatus = journal.environment.candidateStatus;
    invariant(
      snapshotStatuses.includes(envStatus),
      "RUNTIME_ENV_SNAPSHOT_STATE_INVALID",
      "Candidate environment snapshot lifecycle is invalid.",
    );
    if (envStatus === "active") {
      const current = await assertOwnedArtifact(
        journal.environment.candidatePath,
      );
      invariant(
        equivalentOwnedArtifactIdentity(
          current,
          journal.environment.candidateIdentity,
        ),
        "RECOVERY_ARTIFACT_IDENTITY_MISMATCH",
        "Active environment snapshot content or permissions differ from the journal.",
      );
      journal.environment.candidateIdentity = current;
    } else if (envStatus === "retiring") {
      const current = await assertOwnedArtifact(
        journal.environment.candidatePath,
        undefined,
        {
          allowMissing: journal.environment.candidateRetirementStarted === true,
        },
      );
      invariant(
        !current ||
          equivalentOwnedArtifactIdentity(
            current,
            journal.environment.candidateIdentity,
          ),
        "RECOVERY_ARTIFACT_IDENTITY_MISMATCH",
        "Retiring environment snapshot content or permissions differ from the journal.",
      );
      if (current) journal.environment.candidateIdentity = current;
    } else if (envStatus === "retired") {
      invariant(
        !(await pathExists(journal.environment.candidatePath)),
        "RUNTIME_ENV_SNAPSHOT_REAPPEARED",
        "A retired candidate environment snapshot reappeared.",
      );
    }
  }
  const expectedWorldDirectory = path.join(
    config.dataPath,
    "worlds",
    journal.lease.worldId,
  );
  invariant(
    journal.lease.worldDirectory === expectedWorldDirectory &&
      journal.lease.marker ===
        path.join(expectedWorldDirectory, ".d6e2-acceptance-world.json") &&
      journal.lease.manifest ===
        path.join(expectedWorldDirectory, "world.json"),
    "RECOVERY_WORLD_PATH_MISMATCH",
    "Journaled disposable-world paths do not match the configured data path.",
  );
  invariant(
    path.dirname(journal.environment.backupPath) === path.dirname(journalPath),
    "RECOVERY_BACKUP_PATH_MISMATCH",
    "Environment backup must be beside its recovery journal.",
  );
  return journal;
}

async function readCompletionReceipt({
  config,
  journalPath,
  sourceConfig = false,
}) {
  const file = receiptPath(journalPath);
  const details = await lstat(file);
  invariant(
    details.isFile() &&
      !details.isSymbolicLink() &&
      (details.mode & 0o077) === 0,
    "RECOVERY_RECEIPT_UNSAFE",
    "Recovery completion receipt must be an owner-only regular file.",
  );
  const receipt = JSON.parse(await readFile(file, "utf8"));
  const expectedRuntime = runtimeIdentity(config);
  if (sourceConfig) {
    expectedRuntime.composeFile = `${config.runtime.composeSourceFile}.d6e2-snapshot`;
  }
  invariant(
    receipt.version === RECOVERY_JOURNAL_VERSION &&
      receipt.journalPath === journalPath &&
      JSON.stringify(receipt.runtime) === JSON.stringify(expectedRuntime) &&
      receipt.snapshot?.status === "retired" &&
      receipt.snapshot.path === receipt.runtime.composeFile &&
      !(await pathExists(receipt.snapshot.path)) &&
      (!receipt.canonicalSnapshot ||
        (receipt.canonicalSnapshot.status === "retired" &&
          !(await pathExists(receipt.canonicalSnapshot.path)))) &&
      (!receipt.environmentSnapshot?.path ||
        (receipt.environmentSnapshot.status === "retired" &&
          !(await pathExists(receipt.environmentSnapshot.path)))) &&
      receipt.candidateIdentity,
    "RECOVERY_RECEIPT_MISMATCH",
    "Recovery completion receipt does not match the configured runtime and journal path.",
  );
  return receipt;
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

export async function inspectRecoveryIdentity({
  config,
  journalPath,
  sourceConfig = false,
}) {
  assertJournalPath(config, journalPath);
  if (await pathExists(journalPath)) {
    const journal = await readRecoveryJournal({
      config,
      journalPath,
      sourceConfig,
    });
    return {
      candidateIdentity: journal.candidateIdentity,
      composeIdentity: journal.composeIdentity,
      complete: false,
      journalPath,
      runId: journal.lease.runId,
      snapshot: journal.snapshot,
    };
  }
  const receipt = await readCompletionReceipt({
    config,
    journalPath,
    sourceConfig,
  });
  const candidateIdentity = await readCandidateDirectoryIdentity(
    config.candidateSystemPath,
  );
  const sourceIdentity = await assertComposeFileIdentity(
    config.runtime.composeSourceFile ?? config.runtime.composeFile,
    receipt.composeIdentity.source,
  );
  invariant(
    JSON.stringify(candidateIdentity) ===
      JSON.stringify(receipt.candidateIdentity) &&
      JSON.stringify(sourceIdentity) ===
        JSON.stringify(receipt.composeIdentity.source),
    "RECOVERY_RECEIPT_MISMATCH",
    "Recovery completion receipt does not match current source/candidate identity.",
  );
  return {
    candidateIdentity,
    complete: true,
    composeIdentity: receipt.composeIdentity,
    journalPath,
    runId: receipt.runId,
    snapshot: receipt.snapshot,
  };
}

export async function retireRecoveryReceipt({ config, journalPath }) {
  assertJournalPath(config, journalPath);
  const file = receiptPath(journalPath);
  if (!(await pathExists(file))) return { receiptPath: file, removed: false };
  await readCompletionReceipt({ config, journalPath });
  await unlink(file);
  return { receiptPath: file, removed: true };
}

async function recoverBrowserGenerationLeases({
  browserRecoveryOptions = {},
  config,
  journalPath,
  onStage = async () => undefined,
}) {
  await drainJournalMutations(journalPath);
  let journal = await readRecoveryJournal({ config, journalPath });
  if (journal.foundryArchiveIdentity) {
    await assertFoundryReleaseInputs(config, undefined, {
      expectedArchiveIdentity: journal.foundryArchiveIdentity,
    });
  }
  if (journal.browserStatus === "retired") {
    await retireLeasedBrowserRunArtifacts(
      journal.browserGenerations,
      browserRecoveryOptions,
    );
    return journal;
  }

  for (const recorded of journal.browserGenerations) {
    if (recorded.status !== "retired") {
      await transitionBrowserGeneration({
        config,
        generation: recorded,
        journalPath,
        status: "retiring",
      });
      await onStage(
        `browser-process-retiring:${recorded.role}:${recorded.generation}`,
      );
      journal = await readRecoveryJournal({ config, journalPath });
      const current =
        journal.browserGenerations[generationIndex(journal, recorded)];
      await terminateLeasedBrowserGeneration(current, browserRecoveryOptions);
      await onStage(
        `browser-process-retired:${recorded.role}:${recorded.generation}`,
      );
      await retireLeasedBrowserArtifacts(current, browserRecoveryOptions);
      await onStage(
        `browser-artifacts-retired:${recorded.role}:${recorded.generation}`,
      );
      await transitionBrowserGeneration({
        config,
        generation: current,
        journalPath,
        status: "retired",
      });
    }
  }

  journal = await readRecoveryJournal({ config, journalPath });
  journal = await mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (current) => ({ ...current, browserStatus: "profiles-retiring" }),
  });
  await onStage("browser-profiles-retiring");
  const profiles = new Map();
  for (const generation of journal.browserGenerations) {
    const key = `${generation.role}\0${generation.profile}`;
    if (!profiles.has(key)) profiles.set(key, []);
    profiles.get(key).push(generation);
  }
  for (const generations of profiles.values()) {
    await retireLeasedBrowserProfile(generations, browserRecoveryOptions);
    await onStage(`browser-profile-retired:${generations[0].role}`);
  }
  journal = await mutateRecoveryJournal({
    config,
    journalPath,
    mutate: (current) => {
      invariant(
        current.browserGenerations.every(
          (generation) => generation.status === "retired",
        ),
        "BROWSER_LEASES_NOT_RETIRED",
        "Recovery cannot retire browser ownership while a generation remains active.",
      );
      return { ...current, browserStatus: "retired" };
    },
  });
  await onStage("browser-retired");
  await retireLeasedBrowserRunArtifacts(
    journal.browserGenerations,
    browserRecoveryOptions,
  );
  await onStage("browser-artifacts-fully-retired");
  return journal;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new AcceptanceError(
      "RECOVERY_ABORTED",
      "Recovery was aborted; the durable journal is retained.",
    );
  }
}

async function classifyRuntimeState({ config, journal }) {
  const envDetails = await lstat(config.runtime.envFile);
  invariant(
    envDetails.isFile() &&
      !envDetails.isSymbolicLink() &&
      (envDetails.mode & 0o077) === 0,
    "RECOVERY_ENV_DRIFT",
    "Canonical environment must remain an owner-only regular file.",
  );
  const linkDetails = await lstat(config.runtime.systemInstallPath);
  invariant(
    linkDetails.isSymbolicLink(),
    "RECOVERY_LINK_DRIFT",
    "Configured system installation is no longer a symlink; manual recovery is required.",
  );
  const currentTarget = await readlink(config.runtime.systemInstallPath);
  const linkState =
    currentTarget === journal.systemLink.originalTarget
      ? "original"
      : currentTarget === journal.systemLink.candidateTarget
        ? "candidate"
        : "drift";
  invariant(
    linkState !== "drift",
    "RECOVERY_RUNTIME_DRIFT",
    "Runtime environment or system link matches neither the exact candidate nor exact original state; nothing was overwritten.",
    { currentTarget, environmentState: "canonical-untouched", linkState },
  );
  return { environmentState: "original", linkState };
}

async function adoptPlannedComposeSnapshot({
  config,
  journal,
  journalPath,
  snapshotKey,
}) {
  const snapshot = journal[snapshotKey];
  if (snapshot?.status !== "planned" || !(await pathExists(snapshot.path))) {
    return journal;
  }
  const canonical = snapshotKey === "canonicalSnapshot";
  const recordedSource = canonical
    ? journal.composeIdentity.canonical
    : journal.composeIdentity;
  const sourceIdentity = recordedSource?.source ?? recordedSource;
  invariant(
    sourceIdentity?.canonicalPath === snapshot.sourcePath,
    "COMPOSE_SNAPSHOT_SOURCE_MISMATCH",
    "A planned Compose snapshot is not bound to its journaled source.",
  );
  await assertComposeFileIdentity(snapshot.sourcePath, sourceIdentity);
  const snapshotIdentity = await readComposeFileIdentity(snapshot.path);
  invariant(
    (snapshotIdentity.mode & 0o077) === 0 &&
      snapshotIdentity.size === sourceIdentity.size &&
      snapshotIdentity.sha256 === sourceIdentity.sha256,
    "COMPOSE_SNAPSHOT_ADOPTION_MISMATCH",
    "A planned Compose snapshot exists but does not exactly match its verified source.",
  );
  const composeIdentity = {
    projectDirectory:
      recordedSource?.projectDirectory ??
      config.runtime.composeProjectDirectory ??
      path.dirname(snapshot.sourcePath),
    source: sourceIdentity,
    snapshot: snapshotIdentity,
  };
  await assertCandidateComposeBind(
    { ...config.runtime, composeFile: snapshot.path },
    canonical ? undefined : config.candidateSystemPath,
    config.runtime.composeRunner,
    {
      phase: canonical ? "canonical" : "candidate",
      dataMountSource: config.runtime.dataMountSource,
      candidateIdentity: canonical ? undefined : journal.candidateIdentity,
      composeFileIdentity: snapshotIdentity,
    },
  );
  const updated = {
    ...journal,
    ...(canonical
      ? { canonicalComposeSnapshotIdentity: composeIdentity }
      : {
          composeIdentity: {
            ...composeIdentity,
            ...(journal.composeIdentity.canonical
              ? { canonical: journal.composeIdentity.canonical }
              : {}),
          },
        }),
    [snapshotKey]: {
      ...snapshot,
      identity: snapshotIdentity,
      status: "active",
    },
  };
  await atomicJson(journalPath, updated);
  return updated;
}

export async function recoverFromJournal({
  browserRecoveryOptions,
  config,
  journalPath,
  onStage = async () => undefined,
  recreateService,
  retireSnapshot = retireComposeSnapshot,
  retireEnvironment = retireEnvironmentSnapshot,
  signal,
  waitForHealthy,
}) {
  throwIfAborted(signal);
  if (!(await pathExists(journalPath))) {
    const receipt = await readCompletionReceipt({ config, journalPath });
    return {
      alreadyRetired: true,
      health: receipt.health,
      ok: true,
      receiptPath: receiptPath(journalPath),
      worldRemoved: false,
    };
  }
  await recoverBrowserGenerationLeases({
    browserRecoveryOptions,
    config,
    journalPath,
    onStage,
  });
  let journal = await readRecoveryJournal({ config, journalPath });
  journal = await adoptPlannedComposeSnapshot({
    config,
    journal,
    journalPath,
    snapshotKey: "snapshot",
  });
  if (journal.canonicalSnapshot) {
    journal = await adoptPlannedComposeSnapshot({
      config,
      journal,
      journalPath,
      snapshotKey: "canonicalSnapshot",
    });
  }
  const snapshotExists = await pathExists(journal.snapshot.path);
  const canonicalRestoreIdentity =
    journal.canonicalComposeSnapshotIdentity ??
    journal.composeIdentity.canonical;
  if (config.runtime.restoreComposeSourceFile && !canonicalRestoreIdentity) {
    throw new AcceptanceError(
      "CANONICAL_COMPOSE_IDENTITY_REQUIRED",
      "Recovery requires the separately journaled canonical Compose identity before restoration.",
    );
  }
  const restoreComposeIdentity =
    canonicalRestoreIdentity?.snapshot ??
    canonicalRestoreIdentity ??
    journal.composeIdentity.snapshot;
  const canonicalRestoreConfig = restoreComposeIdentity?.canonicalPath
    ? {
        ...config,
        runtime: {
          ...config.runtime,
          composeFile: restoreComposeIdentity.canonicalPath,
          composeSourceFile:
            canonicalRestoreIdentity?.source?.canonicalPath ??
            restoreComposeIdentity.canonicalPath,
          composeProjectDirectory:
            canonicalRestoreIdentity?.projectDirectory ??
            config.runtime.composeProjectDirectory ??
            path.dirname(restoreComposeIdentity.canonicalPath),
        },
      }
    : config;
  invariant(
    journal.snapshot.status !== "active" || snapshotExists,
    "COMPOSE_SNAPSHOT_REQUIRED",
    "An active recovery snapshot must exist before any Docker operation.",
  );
  const snapshotBacked =
    (journal.snapshot.status === "active" && snapshotExists) ||
    (journal.snapshot.status === "retiring" && snapshotExists);
  if (journal.status === "armed") {
    invariant(
      snapshotBacked ||
        (journal.snapshot.status === "planned" && !snapshotExists),
      "COMPOSE_SNAPSHOT_REQUIRED",
      "Recovery cannot skip snapshot-backed restoration before a planned snapshot is created.",
    );
  }
  const runtimeState = await classifyRuntimeState({ config, journal });
  const worldExists = await pathExists(journal.lease.worldDirectory);
  if (
    journal.status === "armed" &&
    journal.lease.status === "planned" &&
    !worldExists
  ) {
    invariant(
      runtimeState.environmentState === "original" &&
        runtimeState.linkState === "original" &&
        journal.snapshot.status === "planned" &&
        !snapshotExists &&
        (!journal.environment.candidatePath ||
          (journal.environment.candidateStatus === "planned" &&
            !(await pathExists(journal.environment.candidatePath)))),
      "RECOVERY_PRE_WORLD_DRIFT",
      "Pre-world recovery requires the exact original runtime and no active candidate artifacts.",
    );
    const backupDetails = await lstat(journal.environment.backupPath);
    invariant(
      backupDetails.isFile() &&
        !backupDetails.isSymbolicLink() &&
        (backupDetails.mode & 0o077) === 0,
      "RECOVERY_BACKUP_UNSAFE",
      "Environment backup must be an owner-only regular file.",
    );
    const backup = await readFile(journal.environment.backupPath);
    invariant(
      checksum(backup) === journal.environment.originalSha256,
      "RECOVERY_BACKUP_MISMATCH",
      "Environment backup checksum does not match the recovery journal.",
    );
    journal = {
      ...journal,
      health: { skipped: "world-not-created" },
      lease: { ...journal.lease, status: "retired" },
      status: "world-retired",
    };
    await atomicJson(journalPath, journal);
    await onStage("pre-world-runtime-unchanged");
  }
  if (journal.status === "armed") {
    invariant(
      worldExists,
      "RECOVERY_WORLD_UNVERIFIED",
      "Disposable world is absent before runtime restoration can validate its lease; automatic recovery is blocked.",
    );
    await assertDisposableWorldLease(journal.lease);
    const backupDetails = await lstat(journal.environment.backupPath);
    invariant(
      backupDetails.isFile() &&
        !backupDetails.isSymbolicLink() &&
        (backupDetails.mode & 0o077) === 0,
      "RECOVERY_BACKUP_UNSAFE",
      "Environment backup must be an owner-only regular file.",
    );
    const backup = await readFile(journal.environment.backupPath);
    invariant(
      checksum(backup) === journal.environment.originalSha256,
      "RECOVERY_BACKUP_MISMATCH",
      "Environment backup checksum does not match the recovery journal.",
    );
    throwIfAborted(signal);
    if (runtimeState.environmentState === "candidate") {
      await restoreWorldEnvironment({
        contents: backup,
        envFile: config.runtime.envFile,
        mode: journal.environment.mode,
        expectedWorldId: journal.lease.worldId,
      });
    }
    throwIfAborted(signal);
    if (runtimeState.linkState === "candidate") {
      await restoreSystemSymlink({
        installPath: config.runtime.systemInstallPath,
        target: journal.systemLink.originalTarget,
      });
    }
    if (snapshotBacked) {
      throwIfAborted(signal);
      await recreateService(canonicalRestoreConfig.runtime, {
        signal,
        composeFileIdentity: restoreComposeIdentity,
      });
    }
  } else {
    invariant(
      runtimeState.environmentState === "original" &&
        runtimeState.linkState === "original",
      "RECOVERY_POST_RESTORE_DRIFT",
      "Journal says runtime was restored, but current runtime state is not the exact original state.",
    );
  }
  throwIfAborted(signal);
  const health = snapshotBacked
    ? await waitForHealthy(canonicalRestoreConfig, {
        signal,
        composeFileIdentity: restoreComposeIdentity,
      })
    : (journal.health ?? { skipped: "compose-snapshot-not-present" });
  if (journal.status === "armed") {
    journal = { ...journal, health, status: "runtime-restored" };
    await atomicJson(journalPath, journal);
    await onStage("runtime-restored");
  }

  if (journal.status === "runtime-restored") {
    invariant(
      await pathExists(journal.lease.worldDirectory),
      "RECOVERY_WORLD_UNEXPECTEDLY_ABSENT",
      "Disposable world disappeared before its retirement was journaled; automatic recovery is blocked.",
    );
    await assertDisposableWorldLease(journal.lease);
    journal = { ...journal, status: "world-retiring" };
    await atomicJson(journalPath, journal);
    await onStage("world-retiring");
  }

  if (journal.status === "world-retiring") {
    if (await pathExists(journal.lease.worldDirectory)) {
      await assertDisposableWorldLease(journal.lease);
      throwIfAborted(signal);
      await removeDisposableWorld(journal.lease);
      await onStage("world-removed");
    }
    journal = { ...journal, status: "world-retired" };
    await atomicJson(journalPath, journal);
    await onStage("world-retired");
  } else {
    invariant(
      !(await pathExists(journal.lease.worldDirectory)),
      "RECOVERY_WORLD_REAPPEARED",
      "Disposable world exists after its journaled retirement; automatic deletion is blocked.",
    );
  }

  if (journal.status === "world-retired") {
    invariant(
      await pathExists(journal.environment.backupPath),
      "RECOVERY_BACKUP_UNEXPECTEDLY_ABSENT",
      "Environment backup disappeared before its retirement was journaled; automatic recovery is blocked.",
    );
    const backup = await readFile(journal.environment.backupPath);
    invariant(
      checksum(backup) === journal.environment.originalSha256,
      "RECOVERY_BACKUP_MISMATCH",
      "Environment backup changed before retirement.",
    );
    journal = { ...journal, status: "backup-retiring" };
    await atomicJson(journalPath, journal);
    await onStage("backup-retiring");
  }

  if (journal.status === "backup-retiring") {
    if (await pathExists(journal.environment.backupPath)) {
      const backup = await readFile(journal.environment.backupPath);
      invariant(
        checksum(backup) === journal.environment.originalSha256,
        "RECOVERY_BACKUP_MISMATCH",
        "Environment backup changed during retirement.",
      );
      throwIfAborted(signal);
      await unlink(journal.environment.backupPath);
      await onStage("backup-unlinked");
    }
    journal = { ...journal, status: "backup-retired" };
    await atomicJson(journalPath, journal);
    await onStage("backup-retired");
  }

  const environmentSnapshot = journal.environment?.candidatePath
    ? {
        path: journal.environment.candidatePath,
        identity: journal.environment.candidateIdentity,
      }
    : undefined;
  if (
    environmentSnapshot &&
    journal.environment.candidateStatus !== "retired"
  ) {
    if (journal.environment.candidateStatus === "planned") {
      invariant(
        !(await pathExists(environmentSnapshot.path)),
        "RUNTIME_ENV_SNAPSHOT_UNEXPECTED",
        "A planned environment snapshot exists without an active journal identity.",
      );
      journal = {
        ...journal,
        environment: { ...journal.environment, candidateStatus: "retired" },
      };
      await atomicJson(journalPath, journal);
    } else {
      invariant(
        journal.environment.candidateStatus === "active" ||
          journal.environment.candidateStatus === "retiring",
        "RUNTIME_ENV_SNAPSHOT_STATUS",
        "Environment snapshot status is not recoverable.",
      );
      journal = {
        ...journal,
        environment: { ...journal.environment, candidateStatus: "retiring" },
      };
      await atomicJson(journalPath, journal);
      if (await pathExists(environmentSnapshot.path)) {
        invariant(
          typeof retireEnvironment === "function",
          "RUNTIME_ENV_RETIRE_UNAVAILABLE",
          "Environment snapshot retirement is unavailable.",
        );
        await retireEnvironment(environmentSnapshot);
      }
      invariant(
        !(await pathExists(environmentSnapshot.path)),
        "RUNTIME_ENV_SNAPSHOT_NOT_RETIRED",
        "Environment snapshot still exists after retirement.",
      );
      journal = {
        ...journal,
        environment: { ...journal.environment, candidateStatus: "retired" },
      };
      await atomicJson(journalPath, journal);
    }
  }

  invariant(
    journal.status === "backup-retired" && journal.browserStatus === "retired",
    "RECOVERY_STAGE_INVALID",
    `Unsupported recovery stage ${journal.status}/${journal.browserStatus}.`,
  );
  if (journal.snapshot?.status !== "retired") {
    if (journal.snapshot?.status === "planned") {
      invariant(
        !(await pathExists(journal.snapshot.path)),
        "COMPOSE_SNAPSHOT_UNEXPECTED",
        "A planned Compose snapshot exists without an active journal identity.",
      );
      journal = {
        ...journal,
        snapshot: {
          ...journal.snapshot,
          status: "retiring",
          retirementStarted: true,
        },
      };
      await atomicJson(journalPath, journal);
    } else if (journal.snapshot?.status === "active") {
      journal = await transitionComposeSnapshot({
        composeIdentity: journal.composeIdentity,
        config,
        journalPath,
        status: "retiring",
      });
    } else {
      invariant(
        journal.snapshot?.status === "retiring" &&
          journal.snapshot.retirementStarted === true,
        "COMPOSE_SNAPSHOT_RETIREMENT_UNPROVEN",
        "A retiring Compose snapshot must carry an authorized retirement marker.",
      );
    }
    await onStage("snapshot-retiring");
    if (
      journal.snapshot.status === "retiring" &&
      (await pathExists(journal.snapshot.path))
    ) {
      await retireSnapshot(config, journal.composeIdentity);
    }
    invariant(
      !(await pathExists(journal.snapshot.path)),
      "COMPOSE_SNAPSHOT_NOT_RETIRED",
      "Compose snapshot still exists after retirement.",
    );
    journal = {
      ...journal,
      snapshot: { ...journal.snapshot, status: "retired" },
    };
    await atomicJson(journalPath, journal);
    await onStage("snapshot-retired");
  }
  if (
    journal.canonicalSnapshot &&
    journal.canonicalSnapshot.status !== "retired"
  ) {
    const canonicalIdentity = journal.canonicalComposeSnapshotIdentity;
    const canonicalSnapshotIdentity =
      canonicalIdentity?.snapshot ?? canonicalIdentity;
    if (journal.canonicalSnapshot.status === "planned") {
      invariant(
        !(await pathExists(journal.canonicalSnapshot.path)),
        "CANONICAL_SNAPSHOT_UNEXPECTED",
        "A planned canonical snapshot exists without an active identity.",
      );
      journal = {
        ...journal,
        canonicalSnapshot: { ...journal.canonicalSnapshot, status: "retired" },
      };
      await atomicJson(journalPath, journal);
    } else {
      invariant(
        canonicalIdentity,
        "CANONICAL_SNAPSHOT_IDENTITY_REQUIRED",
        "Canonical Compose snapshot identity is missing.",
      );
      if (journal.canonicalSnapshot.status === "active") {
        journal = {
          ...journal,
          canonicalSnapshot: {
            ...journal.canonicalSnapshot,
            status: "retiring",
            retirementStarted: true,
          },
        };
        await atomicJson(journalPath, journal);
      } else {
        invariant(
          journal.canonicalSnapshot.status === "retiring" &&
            journal.canonicalSnapshot.retirementStarted === true,
          "CANONICAL_SNAPSHOT_RETIREMENT_UNPROVEN",
          "Canonical snapshot retirement is not authorized.",
        );
      }
      if (await pathExists(journal.canonicalSnapshot.path)) {
        await retireSnapshot(
          {
            ...config,
            runtime: {
              ...config.runtime,
              composeFile: canonicalSnapshotIdentity.canonicalPath,
            },
          },
          { snapshot: canonicalSnapshotIdentity },
        );
      }
      invariant(
        !(await pathExists(journal.canonicalSnapshot.path)),
        "CANONICAL_SNAPSHOT_NOT_RETIRED",
        "Canonical Compose snapshot still exists after retirement.",
      );
      journal = {
        ...journal,
        canonicalSnapshot: { ...journal.canonicalSnapshot, status: "retired" },
      };
      await atomicJson(journalPath, journal);
    }
  }
  const completion = {
    health: journal.health ?? health,
    journalPath,
    runId: journal.lease.runId,
    runtime: journal.runtime,
    composeIdentity: journal.composeIdentity,
    canonicalComposeSnapshotIdentity: journal.canonicalComposeSnapshotIdentity,
    candidateIdentity: journal.candidateIdentity,
    foundryArchiveIdentity: journal.foundryArchiveIdentity,
    status: "complete",
    snapshot: {
      ...journal.snapshot,
      identity: journal.composeIdentity?.snapshot,
    },
    canonicalSnapshot: journal.canonicalSnapshot
      ? {
          ...journal.canonicalSnapshot,
          identity: journal.canonicalComposeSnapshotIdentity?.snapshot,
        }
      : undefined,
    environmentSnapshot: {
      path: journal.environment?.candidatePath,
      sourcePath: journal.runtime.envFile,
      identity: journal.environment?.candidateIdentity,
      status: journal.environment?.candidateStatus,
    },
    version: RECOVERY_JOURNAL_VERSION,
  };
  invariant(
    !(await pathExists(journal.snapshot.path)),
    "COMPOSE_SNAPSHOT_REAPPEARED",
    "Compose snapshot reappeared before recovery completion could be retired.",
  );
  invariant(
    !journal.canonicalSnapshot ||
      !(await pathExists(journal.canonicalSnapshot.path)),
    "CANONICAL_SNAPSHOT_REAPPEARED",
    "Canonical Compose snapshot reappeared before completion proof.",
  );
  invariant(
    !journal.environment?.candidatePath ||
      !(await pathExists(journal.environment.candidatePath)),
    "RUNTIME_ENV_SNAPSHOT_REAPPEARED",
    "Candidate environment snapshot reappeared before completion proof.",
  );
  await atomicJson(receiptPath(journalPath), completion);
  await onStage("receipt-written");
  invariant(
    !(await pathExists(journal.snapshot.path)),
    "COMPOSE_SNAPSHOT_REAPPEARED",
    "Compose snapshot reappeared before the recovery journal could be retired.",
  );
  invariant(
    !journal.canonicalSnapshot ||
      !(await pathExists(journal.canonicalSnapshot.path)),
    "CANONICAL_SNAPSHOT_REAPPEARED",
    "Canonical Compose snapshot reappeared before journal retirement.",
  );
  invariant(
    !journal.environment?.candidatePath ||
      !(await pathExists(journal.environment.candidatePath)),
    "RUNTIME_ENV_SNAPSHOT_REAPPEARED",
    "Candidate environment snapshot reappeared before journal retirement.",
  );
  await unlink(journalPath);
  await onStage("journal-unlinked");
  return {
    health: completion.health,
    ok: true,
    receiptPath: receiptPath(journalPath),
    snapshot: completion.snapshot,
    worldRemoved: true,
  };
}

export function installSignalRestoration({
  onRestore,
  processLike = process,
  terminateOwnedChildren = () => undefined,
  terminateHarness = (code) => process.exit(code),
  timeoutMs = 90_000,
}) {
  let interruptedBy = null;
  let mutationQueue = Promise.resolve();
  let restoration;
  let terminated = false;
  const operationAbort = new globalThis.AbortController();
  const recoveryAbort = new globalThis.AbortController();
  const exitCode = () =>
    interruptedBy === "SIGINT" ? 130 : interruptedBy === "SIGTERM" ? 143 : 1;
  const restore = (reason) => {
    if (!restoration) {
      const timer = globalThis.setTimeout(() => {
        terminated = true;
        recoveryAbort.abort(
          new AcceptanceError(
            "RECOVERY_TIMEOUT",
            `Recovery exceeded ${timeoutMs}ms; the durable journal was retained.`,
          ),
        );
        processLike.stderr?.write?.(
          `Acceptance recovery timed out after ${timeoutMs}ms; terminating the harness with its journal retained.\n`,
        );
        terminateOwnedChildren("SIGKILL");
        terminateHarness(exitCode());
      }, timeoutMs);
      restoration = mutationQueue
        .then(() => onRestore(reason, { signal: recoveryAbort.signal }))
        .finally(() => globalThis.clearTimeout(timer));
    }
    return restoration;
  };
  const handlers = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => [
      signal,
      () => {
        if (interruptedBy) {
          terminated = true;
          operationAbort.abort();
          recoveryAbort.abort(
            new AcceptanceError(
              "RECOVERY_SECOND_SIGNAL",
              `A second signal interrupted recovery; the durable journal was retained.`,
            ),
          );
          processLike.stderr?.write?.(
            "Second signal received; terminating only the acceptance harness and its owned child commands.\n",
          );
          terminateOwnedChildren("SIGKILL");
          terminateHarness(exitCode());
          return;
        }
        interruptedBy = signal;
        operationAbort.abort();
        void restore(signal)
          .catch((error) => {
            processLike.stderr?.write?.(
              `Acceptance recovery failed: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          })
          .finally(() => {
            processLike.exitCode = signal === "SIGINT" ? 130 : 143;
          });
      },
    ]),
  );
  for (const [signal, handler] of handlers) processLike.on(signal, handler);
  return {
    dispose() {
      for (const [signal, handler] of handlers)
        processLike.off(signal, handler);
    },
    get interruptedBy() {
      return interruptedBy;
    },
    get operationSignal() {
      return operationAbort.signal;
    },
    runMutation(operation) {
      if (interruptedBy || terminated) {
        return Promise.reject(
          new AcceptanceError(
            "ACCEPTANCE_INTERRUPTED",
            `Acceptance interrupted by ${interruptedBy}; no further runtime mutation is allowed.`,
          ),
        );
      }
      const current = mutationQueue.then(() => {
        if (interruptedBy || terminated) {
          throw new AcceptanceError(
            "ACCEPTANCE_INTERRUPTED",
            `Acceptance interrupted by ${interruptedBy}; no further runtime mutation is allowed.`,
          );
        }
        return operation(operationAbort.signal);
      });
      mutationQueue = current.catch(() => undefined);
      return current;
    },
    restore,
    throwIfInterrupted() {
      if (interruptedBy) {
        throw new AcceptanceError(
          "ACCEPTANCE_INTERRUPTED",
          `Acceptance interrupted by ${interruptedBy}; restoration was started.`,
        );
      }
    },
  };
}
