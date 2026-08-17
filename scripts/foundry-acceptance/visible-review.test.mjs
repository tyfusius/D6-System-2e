import { EventEmitter } from "node:events";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { URL, fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSignalRestoration } from "./recovery.mjs";
import {
  VISIBLE_REVIEW_ENV,
  VISIBLE_REVIEW_FLAG,
  assertVisibleReviewReadyEvidence,
  assertVisibleReviewRuntimeRetained,
  createVisibleReviewHold,
  visibleReviewMarkerPath,
  visibleReviewRequested,
  writeVisibleReviewResumeMarker,
} from "./visible-review.mjs";

const temporaryRoots = [];

async function runFiles() {
  const runRoot = await mkdtemp(
    path.join(os.tmpdir(), "d6-visible-review-test-"),
  );
  temporaryRoots.push(runRoot);
  await chmod(runRoot, 0o700);
  const canonicalRunRoot = await realpath(runRoot);
  return {
    journalPath: path.join(canonicalRunRoot, "recovery-journal.json"),
    runRoot: canonicalRunRoot,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
  vi.useRealTimers();
});

describe("visible review authorization", () => {
  it("is disabled by default even when the environment grant exists", () => {
    expect(
      visibleReviewRequested({
        args: [],
        command: "smoke",
        env: { [VISIBLE_REVIEW_ENV]: "granted" },
      }),
    ).toBe(false);
  });

  it("requires the exact environment grant with the smoke flag", () => {
    expect(() =>
      visibleReviewRequested({
        args: [VISIBLE_REVIEW_FLAG],
        command: "smoke",
        env: {},
      }),
    ).toThrow(/VISIBLE_REVIEW_SLOT=granted/);
    expect(
      visibleReviewRequested({
        args: [VISIBLE_REVIEW_FLAG],
        command: "smoke",
        env: { [VISIBLE_REVIEW_ENV]: "granted" },
      }),
    ).toBe(true);
  });

  it("rejects the visible hold on recovery even with the grant", () => {
    expect(() =>
      visibleReviewRequested({
        args: [VISIBLE_REVIEW_FLAG],
        command: "recover",
        env: { [VISIBLE_REVIEW_ENV]: "granted" },
      }),
    ).toThrow(/only by the smoke command/);
  });

  it("fails the CLI gate before reading configuration or mutating runtime", () => {
    const runner = fileURLToPath(
      new URL("../run-foundry-acceptance.mjs", import.meta.url),
    );
    const result = spawnSync(
      process.execPath,
      [
        runner,
        "smoke",
        "--config",
        "/definitely/missing/acceptance.json",
        "--serialized-live-slot",
        VISIBLE_REVIEW_FLAG,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          FOUNDRY_ACCEPTANCE_LIVE_SLOT: "granted",
          [VISIBLE_REVIEW_ENV]: "not-granted",
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("VISIBLE_REVIEW_SLOT=granted");
    expect(result.stderr).not.toContain("ENOENT");
  });
});

describe("visible review retention", () => {
  const lease = {
    leaseNonce: "nonce",
    manifest: "/tmp/world.json",
    marker: "d6-acceptance-lease",
    markerVersion: 1,
    runId: "run-retained",
    systemId: "d6-system-2e",
    worldDirectory: "/tmp/world",
    worldId: "world-retained",
  };
  const generation = (role) => ({
    generationRoot: `/tmp/run/browser/${role}/generations/1`,
    profile: `/tmp/run/browser/${role}/profile`,
    role,
    runId: lease.runId,
    runRoot: "/tmp/run",
    stateFile: `/tmp/run/browser/${role}/generations/1/browse.json`,
    status: "active",
  });

  it("requires exact active lock, journal, lease, and role generations", () => {
    expect(
      assertVisibleReviewRuntimeRetained({
        journal: {
          browserGenerations: [generation("gm"), generation("player")],
          browserStatus: "active",
          lease,
          status: "armed",
        },
        journalPath: "/tmp/run/recovery-journal.json",
        lease,
        lockOwner: {
          command: "smoke",
          journalPath: "/tmp/run/recovery-journal.json",
          runId: lease.runId,
        },
      }),
    ).toBe(true);
  });

  it.each([
    ["restoring journal", { status: "restoring" }],
    ["retired browser status", { browserStatus: "retired" }],
    ["wrong lease", { lease: { ...lease, leaseNonce: "other" } }],
    [
      "foreign generation run",
      {
        browserGenerations: [
          generation("gm"),
          { ...generation("player"), runId: "foreign-run" },
        ],
      },
    ],
    [
      "duplicate player generation",
      {
        browserGenerations: [
          generation("gm"),
          generation("player"),
          generation("player"),
        ],
      },
    ],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      assertVisibleReviewRuntimeRetained({
        journal: {
          browserGenerations: [generation("gm"), generation("player")],
          browserStatus: "active",
          lease,
          status: "armed",
          ...override,
        },
        journalPath: "/tmp/run/recovery-journal.json",
        lease,
        lockOwner: {
          command: "smoke",
          journalPath: "/tmp/run/recovery-journal.json",
          runId: lease.runId,
        },
      }),
    ).toThrow(/exact active lock/);
  });
});

describe("visible review resume marker", () => {
  it("creates a mode-0600 exact-run marker and refuses replacement", async () => {
    const { journalPath } = await runFiles();
    const result = await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-marker",
    });
    expect(result).toMatchObject({
      runId: "run-marker",
      status: "resume-requested",
    });
    expect((await stat(result.markerPath)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(result.markerPath, "utf8"))).toEqual({
      runId: "run-marker",
      status: "resume-requested",
    });
    await expect(
      writeVisibleReviewResumeMarker({
        journalPath,
        runId: "run-marker",
      }),
    ).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("validates the exact durable ready checkpoint", async () => {
    const { runRoot } = await runFiles();
    const evidenceDirectory = path.join(runRoot, "evidence");
    await mkdir(evidenceDirectory, { mode: 0o700 });
    const evidenceFile = path.join(evidenceDirectory, "checkpoints.jsonl");
    await writeFile(
      evidenceFile,
      `${JSON.stringify({
        kind: "visible-review-ready",
        payload: {
          runId: "run-ready",
          status: "waiting",
          timeoutMs: 300000,
        },
        role: "runtime",
      })}\n`,
      { mode: 0o600 },
    );
    await expect(
      assertVisibleReviewReadyEvidence({ evidenceFile, runId: "run-ready" }),
    ).resolves.toMatchObject({ kind: "visible-review-ready" });
    await expect(
      assertVisibleReviewReadyEvidence({ evidenceFile, runId: "other" }),
    ).rejects.toMatchObject({ code: "VISIBLE_REVIEW_NOT_READY" });
  });

  it("rejects a symlinked ready-evidence file", async () => {
    const { runRoot } = await runFiles();
    const evidenceDirectory = path.join(runRoot, "evidence");
    await mkdir(evidenceDirectory, { mode: 0o700 });
    const target = path.join(runRoot, "target.jsonl");
    await writeFile(target, "{}\n", { mode: 0o600 });
    const evidenceFile = path.join(evidenceDirectory, "checkpoints.jsonl");
    await symlink(target, evidenceFile);
    await expect(
      assertVisibleReviewReadyEvidence({ evidenceFile, runId: "run" }),
    ).rejects.toMatchObject({ code: "VISIBLE_REVIEW_EVIDENCE_UNSAFE" });
  });
});

describe("visible review hold", () => {
  it("retains twice, records ready evidence, and resumes from marker", async () => {
    const { journalPath } = await runFiles();
    const retained = vi.fn(async () => undefined);
    const checkpoint = vi.fn(async () => undefined);
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: retained,
      evidence: { checkpoint },
      journalPath,
      runId: "run-1",
      signal: new globalThis.AbortController().signal,
    });
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    await writeVisibleReviewResumeMarker({ journalPath, runId: "run-1" });
    await expect(waiting).resolves.toEqual({
      runId: "run-1",
      status: "resumed",
      timeoutMs: 5_000,
    });
    expect(retained).toHaveBeenCalledTimes(2);
    expect(checkpoint).toHaveBeenCalledWith("runtime", "visible-review-ready", {
      runId: "run-1",
      status: "waiting",
      timeoutMs: 5_000,
    });
    await hold.dispose({ retireMarker: true });
    await expect(
      stat(visibleReviewMarkerPath(journalPath)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not resume until ready evidence is durably appended", async () => {
    const { journalPath } = await runFiles();
    let finishCheckpoint;
    const checkpointBlocked = new Promise((resolve) => {
      finishCheckpoint = resolve;
    });
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(() => checkpointBlocked) },
      journalPath,
      runId: "run-arming",
      signal: new globalThis.AbortController().signal,
    });
    await vi.waitFor(() => expect(hold.phase).toBe("arming"));
    await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-arming",
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
    expect(hold.phase).toBe("arming");
    finishCheckpoint();
    await expect(waiting).resolves.toMatchObject({ status: "resumed" });
  });

  it("rejects a marker that predates hold setup", async () => {
    const { journalPath } = await runFiles();
    await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-early",
    });
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    await expect(
      hold.wait({
        assertRetained: vi.fn(),
        evidence: { checkpoint: vi.fn() },
        journalPath,
        runId: "run-early",
        signal: new globalThis.AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "VISIBLE_REVIEW_MARKER_PREEXISTING" });
  });

  it("revalidates retention at resume and preserves a failed marker", async () => {
    const { journalPath } = await runFiles();
    const retained = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("journal changed"));
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: retained,
      evidence: { checkpoint: vi.fn() },
      journalPath,
      runId: "run-drift",
      signal: new globalThis.AbortController().signal,
    });
    const rejected = expect(waiting).rejects.toThrow(/journal changed/);
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-drift",
    });
    await rejected;
    await hold.dispose({ retireMarker: false });
    await expect(
      stat(visibleReviewMarkerPath(journalPath)),
    ).resolves.toBeTruthy();
  });

  it("rejects a symlinked marker without resuming", async () => {
    const { journalPath, runRoot } = await runFiles();
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-symlink",
      signal: new globalThis.AbortController().signal,
    });
    const rejected = expect(waiting).rejects.toBeTruthy();
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    const target = path.join(runRoot, "foreign-marker.json");
    await writeFile(
      target,
      `${JSON.stringify({
        runId: "run-symlink",
        status: "resume-requested",
      })}\n`,
      { mode: 0o600 },
    );
    await symlink(target, visibleReviewMarkerPath(journalPath));
    await rejected;
    expect(hold.phase).toBe("failed");
  });

  it("rejects canonical marker-directory drift while waiting", async () => {
    const { journalPath, runRoot } = await runFiles();
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-directory-drift",
      signal: new globalThis.AbortController().signal,
    });
    const rejected = expect(waiting).rejects.toMatchObject({
      code: "VISIBLE_REVIEW_DIRECTORY_DRIFT",
    });
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    const moved = `${runRoot}-moved`;
    temporaryRoots.push(moved);
    await rename(runRoot, moved);
    await mkdir(runRoot, { mode: 0o700 });
    await rejected;
  });

  it("does not unlink a replacement marker after directory drift", async () => {
    const { journalPath, runRoot } = await runFiles();
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-unlink-drift",
      signal: new globalThis.AbortController().signal,
    });
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-unlink-drift",
    });
    await waiting;
    const moved = `${runRoot}-moved`;
    temporaryRoots.push(moved);
    await rename(runRoot, moved);
    await mkdir(runRoot, { mode: 0o700 });
    const replacementMarker = visibleReviewMarkerPath(journalPath);
    await writeFile(
      replacementMarker,
      `${JSON.stringify({
        runId: "run-unlink-drift",
        status: "resume-requested",
      })}\n`,
      { mode: 0o600 },
    );
    await expect(hold.dispose({ retireMarker: true })).rejects.toMatchObject({
      code: "VISIBLE_REVIEW_DIRECTORY_DRIFT",
    });
    await expect(stat(replacementMarker)).resolves.toBeTruthy();
  });

  it("does not unlink a replacement marker in the bound directory", async () => {
    const { journalPath, runRoot } = await runFiles();
    const replacement = path.join(runRoot, "replacement-marker.json");
    const markerPath = visibleReviewMarkerPath(journalPath);
    const hold = createVisibleReviewHold({
      beforeMarkerRetire: async () => {
        await writeFile(
          replacement,
          `${JSON.stringify({
            runId: "run-file-drift",
            status: "resume-requested",
          })}\n`,
          { mode: 0o600 },
        );
        await rename(replacement, markerPath);
      },
      pollMs: 1,
      timeoutMs: 5_000,
    });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-file-drift",
      signal: new globalThis.AbortController().signal,
    });
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    await writeVisibleReviewResumeMarker({
      journalPath,
      runId: "run-file-drift",
    });
    await waiting;
    await expect(hold.dispose({ retireMarker: true })).rejects.toMatchObject({
      code: "VISIBLE_REVIEW_MARKER_DRIFT",
    });
    await expect(stat(markerPath)).resolves.toBeTruthy();
  });

  it("times out and retains recovery state", async () => {
    vi.useFakeTimers();
    const { journalPath } = await runFiles();
    const hold = createVisibleReviewHold({ pollMs: 100, timeoutMs: 300_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-timeout",
      signal: new globalThis.AbortController().signal,
    });
    const rejected = expect(waiting).rejects.toMatchObject({
      code: "VISIBLE_REVIEW_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(300_000);
    await rejected;
    expect(hold.phase).toBe("failed");
  });

  it("cannot lose an abort during asynchronous hold setup", async () => {
    const { journalPath } = await runFiles();
    const operation = new globalThis.AbortController();
    let releaseRetention;
    const retention = new Promise((resolve) => {
      releaseRetention = resolve;
    });
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(() => retention),
      evidence: { checkpoint: vi.fn() },
      journalPath,
      runId: "run-abort",
      signal: operation.signal,
    });
    operation.abort(new Error("SIGTERM restoration started"));
    releaseRetention();
    await expect(waiting).rejects.toThrow(/SIGTERM restoration started/);
    expect(hold.phase).toBe("failed");
  });

  it("lets SIGTERM enter existing guarded restoration while held", async () => {
    const { journalPath } = await runFiles();
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    processLike.exitCode = 0;
    const restored = vi.fn(async () => ({ ok: true }));
    const restoration = installSignalRestoration({
      onRestore: restored,
      processLike,
      timeoutMs: 5_000,
    });
    const hold = createVisibleReviewHold({ pollMs: 1, timeoutMs: 5_000 });
    const waiting = hold.wait({
      assertRetained: vi.fn(async () => undefined),
      evidence: { checkpoint: vi.fn(async () => undefined) },
      journalPath,
      runId: "run-sigterm",
      signal: restoration.operationSignal,
    });
    await vi.waitFor(() => expect(hold.phase).toBe("waiting"));
    processLike.emit("SIGTERM");
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    await expect(restoration.restore("finally")).resolves.toEqual({ ok: true });
    expect(restored).toHaveBeenCalledOnce();
    restoration.dispose();
  });
});
