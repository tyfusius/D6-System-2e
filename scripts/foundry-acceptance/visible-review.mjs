import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { AcceptanceError } from "./core.mjs";

export const VISIBLE_REVIEW_ENV = "FOUNDRY_ACCEPTANCE_VISIBLE_REVIEW_SLOT";
export const VISIBLE_REVIEW_FLAG = "--visible-review-hold";
export const VISIBLE_REVIEW_MARKER = "visible-review-resume.json";
export const DEFAULT_VISIBLE_REVIEW_TIMEOUT_MS = 5 * 60 * 1_000;
const DEFAULT_POLL_MS = 100;

function invariant(condition, code, message, details = {}) {
  if (!condition) throw new AcceptanceError(code, message, details);
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

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

async function assertOwnerOnlyDirectory(directory, expectedIdentity) {
  let details;
  let canonicalDirectory;
  try {
    details = await lstat(directory);
    canonicalDirectory = await realpath(directory);
  } catch (error) {
    if (expectedIdentity && error?.code === "ENOENT") {
      throw new AcceptanceError(
        "VISIBLE_REVIEW_DIRECTORY_DRIFT",
        "Visible-review control directory disappeared while the hold was active.",
        { directory },
      );
    }
    throw error;
  }
  invariant(
    details.isDirectory() &&
      !details.isSymbolicLink() &&
      (details.mode & 0o077) === 0 &&
      (currentUid() === undefined || details.uid === currentUid()) &&
      canonicalDirectory === path.resolve(directory),
    "VISIBLE_REVIEW_DIRECTORY_UNSAFE",
    "Visible-review control must remain in its canonical owner-only run directory.",
    { directory },
  );
  const identity = Object.freeze({
    dev: details.dev,
    ino: details.ino,
    path: path.resolve(directory),
  });
  invariant(
    !expectedIdentity ||
      (identity.path === expectedIdentity.path &&
        identity.dev === expectedIdentity.dev &&
        identity.ino === expectedIdentity.ino),
    "VISIBLE_REVIEW_DIRECTORY_DRIFT",
    "Visible-review control directory identity changed while the hold was active.",
    { directory },
  );
  return identity;
}

async function readOwnerOnlyJson(file, code, directoryIdentity) {
  await assertOwnerOnlyDirectory(path.dirname(file), directoryIdentity);
  const pathDetails = await lstat(file);
  invariant(
    pathDetails.isFile() && !pathDetails.isSymbolicLink(),
    code,
    "Visible-review control file must be an owner-only regular file.",
    { file },
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
        details.ino === pathDetails.ino &&
        (details.mode & 0o077) === 0 &&
        (currentUid() === undefined || details.uid === currentUid()),
      code,
      "Visible-review control file must be an owner-only regular file.",
      { file },
    );
    return Object.freeze({
      fileIdentity: Object.freeze({ dev: details.dev, ino: details.ino }),
      value: JSON.parse(await handle.readFile("utf8")),
    });
  } finally {
    await handle.close();
  }
}

export function visibleReviewMarkerPath(journalPath) {
  invariant(
    path.isAbsolute(journalPath ?? ""),
    "VISIBLE_REVIEW_JOURNAL_PATH",
    "Visible review requires an absolute recovery-journal path.",
  );
  return path.join(path.dirname(journalPath), VISIBLE_REVIEW_MARKER);
}

function exactLeaseMatches(left, right) {
  return [
    "leaseNonce",
    "manifest",
    "marker",
    "markerVersion",
    "runId",
    "systemId",
    "worldDirectory",
    "worldId",
  ].every((key) => left?.[key] === right?.[key]);
}

function activeGenerationMatches(generation, lease, journalPath) {
  const runRoot = path.dirname(journalPath);
  return (
    generation.status === "active" &&
    generation.runId === lease.runId &&
    generation.runRoot === runRoot &&
    typeof generation.generationRoot === "string" &&
    path
      .resolve(generation.generationRoot)
      .startsWith(`${runRoot}${path.sep}`) &&
    typeof generation.profile === "string" &&
    path.resolve(generation.profile).startsWith(`${runRoot}${path.sep}`) &&
    typeof generation.stateFile === "string" &&
    path.resolve(generation.stateFile).startsWith(`${runRoot}${path.sep}`)
  );
}

export function assertVisibleReviewRuntimeRetained({
  journal,
  journalPath,
  lease,
  lockOwner,
}) {
  const activeByRole = Object.fromEntries(
    ["gm", "player"].map((role) => [
      role,
      journal.browserGenerations.filter(
        (generation) =>
          generation.role === role &&
          activeGenerationMatches(generation, lease, journalPath),
      ),
    ]),
  );
  invariant(
    lockOwner.command === "smoke" &&
      lockOwner.journalPath === journalPath &&
      lockOwner.runId === lease.runId &&
      journal.status === "armed" &&
      journal.browserStatus === "active" &&
      exactLeaseMatches(journal.lease, lease) &&
      activeByRole.gm.length === 1 &&
      activeByRole.player.length === 1,
    "VISIBLE_REVIEW_RUNTIME_NOT_RETAINED",
    "Visible review requires the exact active lock, journal, lease, and one active generation per role.",
  );
  return true;
}

export function visibleReviewRequested({ args, command, env = process.env }) {
  const requested = args.includes(VISIBLE_REVIEW_FLAG);
  if (!requested) return false;
  invariant(
    command === "smoke",
    "VISIBLE_REVIEW_COMMAND",
    `${VISIBLE_REVIEW_FLAG} is supported only by the smoke command.`,
  );
  invariant(
    env[VISIBLE_REVIEW_ENV] === "granted",
    "VISIBLE_REVIEW_GATE",
    `Visible review is blocked without ${VISIBLE_REVIEW_ENV}=granted.`,
  );
  return true;
}

export function assertVisibleReviewResumeAuthorization(env = process.env) {
  invariant(
    env[VISIBLE_REVIEW_ENV] === "granted",
    "VISIBLE_REVIEW_GATE",
    `Visible review is blocked without ${VISIBLE_REVIEW_ENV}=granted.`,
  );
}

export async function assertVisibleReviewReadyEvidence({
  evidenceFile,
  runId,
}) {
  await assertOwnerOnlyDirectory(path.dirname(evidenceFile));
  const evidencePathDetails = await lstat(evidenceFile);
  invariant(
    evidencePathDetails.isFile() && !evidencePathDetails.isSymbolicLink(),
    "VISIBLE_REVIEW_EVIDENCE_UNSAFE",
    "Visible-review ready evidence must be an owner-only regular file.",
  );
  const evidenceHandle = await open(
    evidenceFile,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  let evidenceContents;
  try {
    const evidenceDetails = await evidenceHandle.stat();
    invariant(
      evidenceDetails.isFile() &&
        evidenceDetails.dev === evidencePathDetails.dev &&
        evidenceDetails.ino === evidencePathDetails.ino &&
        (evidenceDetails.mode & 0o077) === 0 &&
        (currentUid() === undefined || evidenceDetails.uid === currentUid()),
      "VISIBLE_REVIEW_EVIDENCE_UNSAFE",
      "Visible-review ready evidence must be an owner-only regular file.",
    );
    evidenceContents = await evidenceHandle.readFile("utf8");
  } finally {
    await evidenceHandle.close();
  }
  const records = evidenceContents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const ready = records.findLast(
    (record) =>
      record.role === "runtime" &&
      record.kind === "visible-review-ready" &&
      record.payload?.runId === runId,
  );
  invariant(
    ready &&
      Object.keys(ready.payload).sort().join(",") ===
        "runId,status,timeoutMs" &&
      ready.payload.status === "waiting" &&
      Number.isInteger(ready.payload.timeoutMs) &&
      ready.payload.timeoutMs > 0,
    "VISIBLE_REVIEW_NOT_READY",
    "The exact run has no valid durable visible-review-ready checkpoint.",
  );
  return ready;
}

export async function writeVisibleReviewResumeMarker({ journalPath, runId }) {
  const markerPath = visibleReviewMarkerPath(journalPath);
  const directoryIdentity = await assertOwnerOnlyDirectory(
    path.dirname(markerPath),
  );
  let handle;
  try {
    await assertOwnerOnlyDirectory(path.dirname(markerPath), directoryIdentity);
    handle = await open(markerPath, "wx", 0o600);
    await handle.writeFile(
      `${JSON.stringify({ runId, status: "resume-requested" })}\n`,
      "utf8",
    );
    await handle.chmod(0o600);
    await handle.sync();
  } finally {
    await handle?.close();
  }
  return { markerPath, runId, status: "resume-requested" };
}

async function readVisibleReviewResumeMarker(
  markerPath,
  runId,
  directoryIdentity,
) {
  await assertOwnerOnlyDirectory(path.dirname(markerPath), directoryIdentity);
  if (!(await pathExists(markerPath))) return null;
  const observed = await readOwnerOnlyJson(
    markerPath,
    "VISIBLE_REVIEW_MARKER_UNSAFE",
    directoryIdentity,
  );
  const marker = observed.value;
  invariant(
    Object.keys(marker).sort().join(",") === "runId,status" &&
      marker.runId === runId &&
      marker.status === "resume-requested",
    "VISIBLE_REVIEW_MARKER_MISMATCH",
    "Visible-review resume marker does not match the exact run.",
  );
  return Object.freeze({ ...observed, marker });
}

export function createVisibleReviewHold({
  beforeMarkerRetire = async () => undefined,
  clearTimeoutImpl = globalThis.clearTimeout,
  pollMs = DEFAULT_POLL_MS,
  setTimeoutImpl = globalThis.setTimeout,
  timeoutMs = DEFAULT_VISIBLE_REVIEW_TIMEOUT_MS,
} = {}) {
  invariant(
    Number.isInteger(timeoutMs) && timeoutMs > 0,
    "VISIBLE_REVIEW_TIMEOUT_CONFIG",
    "Visible-review timeout must be a positive integer.",
  );
  let phase = "idle";
  let activeFinish;
  let markerPath;
  let markerDirectoryIdentity;
  let runId;

  return {
    async dispose({ retireMarker = false } = {}) {
      if (activeFinish) {
        activeFinish(
          new AcceptanceError(
            "VISIBLE_REVIEW_DISPOSED",
            "Visible-review hold was disposed before it resumed.",
          ),
        );
      }
      if (retireMarker && markerPath) {
        const observed = await readVisibleReviewResumeMarker(
          markerPath,
          runId,
          markerDirectoryIdentity,
        );
        if (!observed) return;
        await beforeMarkerRetire();
        await assertOwnerOnlyDirectory(
          path.dirname(markerPath),
          markerDirectoryIdentity,
        );
        const beforeUnlink = await lstat(markerPath);
        invariant(
          beforeUnlink.isFile() &&
            !beforeUnlink.isSymbolicLink() &&
            beforeUnlink.dev === observed.fileIdentity.dev &&
            beforeUnlink.ino === observed.fileIdentity.ino,
          "VISIBLE_REVIEW_MARKER_DRIFT",
          "Visible-review marker changed immediately before retirement.",
        );
        await unlink(markerPath);
      }
    },
    get phase() {
      return phase;
    },
    async wait({
      assertRetained,
      evidence,
      journalPath: exactJournalPath,
      runId: exactRunId,
      signal,
    }) {
      invariant(
        phase === "idle",
        "VISIBLE_REVIEW_REUSED",
        "Visible-review hold may be armed only once per smoke run.",
      );
      invariant(
        typeof assertRetained === "function",
        "VISIBLE_REVIEW_RETENTION_PROBE",
        "Visible-review hold requires an exact runtime-retention probe.",
      );
      phase = "arming";
      markerPath = visibleReviewMarkerPath(exactJournalPath);
      runId = exactRunId;
      let readyWriteStarted = false;
      let markerPending = false;
      let pollTimer;
      let timeoutTimer;
      let settled = false;
      let resolveHeld;
      let rejectHeld;
      const held = new Promise((resolve, reject) => {
        resolveHeld = resolve;
        rejectHeld = reject;
      });
      void held.catch(() => undefined);

      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (pollTimer !== undefined) clearTimeoutImpl(pollTimer);
        if (timeoutTimer !== undefined) clearTimeoutImpl(timeoutTimer);
        signal?.removeEventListener("abort", onAbort);
        activeFinish = undefined;
        if (error) {
          phase = "failed";
          rejectHeld(error);
        } else {
          phase = "resumed";
          resolveHeld();
        }
      };
      const onAbort = () =>
        finish(
          signal.reason ??
            new AcceptanceError(
              "VISIBLE_REVIEW_ABORTED",
              "Visible-review hold was aborted.",
            ),
        );
      const poll = async () => {
        if (settled) return;
        try {
          const marker = await readVisibleReviewResumeMarker(
            markerPath,
            exactRunId,
            markerDirectoryIdentity,
          );
          if (marker) {
            invariant(
              readyWriteStarted,
              "VISIBLE_REVIEW_MARKER_EARLY",
              "Visible-review resume marker appeared before ready evidence began.",
            );
            if (phase === "arming") {
              markerPending = true;
            } else {
              await assertRetained();
              if (settled || signal?.aborted) return;
              finish();
              return;
            }
          }
          pollTimer = setTimeoutImpl(poll, pollMs);
        } catch (error) {
          finish(error);
        }
      };

      activeFinish = finish;
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      timeoutTimer = setTimeoutImpl(
        () =>
          finish(
            new AcceptanceError(
              "VISIBLE_REVIEW_TIMEOUT",
              `Visible review did not resume within ${timeoutMs}ms.`,
              { runId: exactRunId, timeoutMs },
            ),
          ),
        timeoutMs,
      );

      try {
        if (signal?.aborted) return await held;
        markerDirectoryIdentity = await assertOwnerOnlyDirectory(
          path.dirname(markerPath),
        );
        if (signal?.aborted) return await held;
        invariant(
          !(await pathExists(markerPath)),
          "VISIBLE_REVIEW_MARKER_PREEXISTING",
          "Visible-review resume marker existed before the hold was armed.",
        );
        if (signal?.aborted) return await held;
        pollTimer = setTimeoutImpl(poll, pollMs);
        await assertRetained();
        if (signal?.aborted) return await held;
        readyWriteStarted = true;
        await evidence.checkpoint("runtime", "visible-review-ready", {
          runId: exactRunId,
          status: "waiting",
          timeoutMs,
        });
        if (signal?.aborted) return await held;
        phase = "waiting";
        if (markerPending) {
          await assertRetained();
          if (!signal?.aborted) activeFinish?.();
        }
        await held;
        return { runId: exactRunId, status: "resumed", timeoutMs };
      } catch (error) {
        activeFinish?.(error);
        await held.catch(() => undefined);
        phase = "failed";
        throw error;
      }
    },
  };
}
