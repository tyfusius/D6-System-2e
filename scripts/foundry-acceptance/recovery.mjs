import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
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

export async function prepareRecoveryJournal({ config, lease, runRoot }) {
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
  await assertDisposableWorldLease(lease);
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
    },
    systemLink: {
      candidateTarget: config.candidateSystemPath,
      originalTarget: await readlink(config.runtime.systemInstallPath),
    },
    runtime: runtimeIdentity(config),
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

function receiptPath(journalPath) {
  return `${journalPath}.complete`;
}

export async function readRecoveryJournal({ config, journalPath }) {
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
  invariant(
    JSON.stringify(journal.runtime) === JSON.stringify(runtimeIdentity(config)),
    "RECOVERY_CONFIG_MISMATCH",
    "Recovery configuration does not exactly match the journaled runtime paths, endpoint, and service.",
  );
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

async function readCompletionReceipt({ config, journalPath }) {
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
  invariant(
    receipt.version === RECOVERY_JOURNAL_VERSION &&
      receipt.journalPath === journalPath &&
      JSON.stringify(receipt.runtime) ===
        JSON.stringify(runtimeIdentity(config)),
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

export async function inspectRecoveryIdentity({ config, journalPath }) {
  assertJournalPath(config, journalPath);
  if (await pathExists(journalPath)) {
    const journal = await readRecoveryJournal({ config, journalPath });
    return { complete: false, journalPath, runId: journal.lease.runId };
  }
  const receipt = await readCompletionReceipt({ config, journalPath });
  return { complete: true, journalPath, runId: receipt.runId };
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
      (envDetails.mode & 0o777) === journal.environment.mode,
    "RECOVERY_ENV_DRIFT",
    "Runtime environment file type or mode differs from both journaled states; manual recovery is required.",
  );
  const currentEnvironment = await readFile(config.runtime.envFile);
  const currentChecksum = checksum(currentEnvironment);
  const environmentState =
    currentChecksum === journal.environment.originalSha256
      ? "original"
      : currentChecksum === journal.environment.candidateSha256
        ? "candidate"
        : "drift";
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
    environmentState !== "drift" && linkState !== "drift",
    "RECOVERY_RUNTIME_DRIFT",
    "Runtime environment or system link matches neither the exact candidate nor exact original state; nothing was overwritten.",
    { currentTarget, environmentState, linkState },
  );
  return { currentEnvironment, environmentState, linkState };
}

export async function recoverFromJournal({
  browserRecoveryOptions,
  config,
  journalPath,
  onStage = async () => undefined,
  recreateService,
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
  const runtimeState = await classifyRuntimeState({ config, journal });
  if (journal.status === "armed") {
    const worldExists = await pathExists(journal.lease.worldDirectory);
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
      });
    }
    throwIfAborted(signal);
    if (runtimeState.linkState === "candidate") {
      await restoreSystemSymlink({
        installPath: config.runtime.systemInstallPath,
        target: journal.systemLink.originalTarget,
      });
    }
    throwIfAborted(signal);
    await recreateService(config.runtime, { signal });
  } else {
    invariant(
      runtimeState.environmentState === "original" &&
        runtimeState.linkState === "original",
      "RECOVERY_POST_RESTORE_DRIFT",
      "Journal says runtime was restored, but current runtime state is not the exact original state.",
    );
  }
  throwIfAborted(signal);
  const health = await waitForHealthy(config, { signal });
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

  invariant(
    journal.status === "backup-retired" && journal.browserStatus === "retired",
    "RECOVERY_STAGE_INVALID",
    `Unsupported recovery stage ${journal.status}/${journal.browserStatus}.`,
  );
  const completion = {
    health: journal.health ?? health,
    journalPath,
    runId: journal.lease.runId,
    runtime: journal.runtime,
    status: "complete",
    version: RECOVERY_JOURNAL_VERSION,
  };
  await atomicJson(receiptPath(journalPath), completion);
  await onStage("receipt-written");
  await unlink(journalPath);
  await onStage("journal-unlinked");
  return {
    health: completion.health,
    ok: true,
    receiptPath: receiptPath(journalPath),
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
