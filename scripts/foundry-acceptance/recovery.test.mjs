import { EventEmitter } from "node:events";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readlink,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HarnessChildRegistry, runProcess } from "./browser.mjs";
import {
  createBrowserGenerationLease,
  writeBrowserGenerationMarkers,
} from "./browser-lease.mjs";
import { provisionDisposableWorld } from "./core.mjs";
import { acquireAcceptanceLock } from "./lock.mjs";
import {
  inspectRecoveryIdentity,
  installSignalRestoration,
  prepareRecoveryJournal,
  registerBrowserGeneration,
  recoverFromJournal,
  retireRecoveryReceipt,
} from "./recovery.mjs";
import { switchSystemSymlink, switchWorldEnvironment } from "./runtime.mjs";

async function recoveryFixture() {
  const root = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "d6e2-recovery-test-")),
  );
  const dataPath = path.join(root, "data");
  const worldsDirectory = path.join(dataPath, "worlds");
  const runtimeDirectory = path.join(root, "runtime");
  const artifactRoot = path.join(root, "artifacts");
  const runRoot = path.join(artifactRoot, "run");
  await mkdir(worldsDirectory, { recursive: true });
  await mkdir(runtimeDirectory);
  await mkdir(runRoot, { recursive: true });
  await chmod(runRoot, 0o700);
  const envFile = path.join(runtimeDirectory, ".env");
  const originalEnvironment = "FOUNDRY_WORLD=original\nPRIVATE=value\n";
  await writeFile(envFile, originalEnvironment);
  await chmod(envFile, 0o640);
  const originalSystemTarget = path.join(root, "original-system");
  const candidateSystemPath = path.join(root, "candidate-system");
  const systemInstallPath = path.join(runtimeDirectory, "installed-system");
  await symlink(originalSystemTarget, systemInstallPath);
  const config = {
    artifactRoot,
    baseUrl: "https://example.test/dev",
    candidateSystemPath,
    dataPath,
    runtime: {
      composeFile: path.join(runtimeDirectory, "compose.yml"),
      envFile,
      service: "foundry-dev",
      systemInstallPath,
    },
  };
  await writeFile(config.runtime.composeFile, "services: {}\n");
  const lease = await provisionDisposableWorld({
    identity: {
      runId: "recovery-run",
      worldId: "d6e2-acceptance-recovery-run",
    },
    worldsDirectory,
  });
  return {
    candidateSystemPath,
    config,
    lease,
    originalEnvironment,
    originalSystemTarget,
    runRoot,
  };
}

async function createTestBrowserLease(fixture, generationRoot) {
  const toolsRoot = path.join(path.dirname(fixture.runRoot), "browser-tools");
  await mkdir(toolsRoot, { recursive: true, mode: 0o700 });
  await chmod(toolsRoot, 0o700);
  const browserBinary = path.join(toolsRoot, "browse");
  const daemonServerPath = path.join(toolsRoot, "server.ts");
  const executable = path.join(toolsRoot, "Chrome");
  for (const file of [browserBinary, daemonServerPath, executable]) {
    await writeFile(file, "test\n", { mode: 0o700 });
  }
  const profile = path.join(
    fixture.runRoot,
    "browser",
    "gm",
    "chromium-profile",
  );
  await mkdir(profile, { recursive: true, mode: 0o700 });
  await chmod(path.join(fixture.runRoot, "browser"), 0o700);
  await chmod(path.join(fixture.runRoot, "browser", "gm"), 0o700);
  await chmod(
    path.join(fixture.runRoot, "browser", "gm", "generations"),
    0o700,
  );
  await chmod(generationRoot, 0o700);
  return createBrowserGenerationLease({
    browserBinary,
    daemonServerPath,
    executable,
    generation: 1,
    generationRoot,
    profile,
    role: "gm",
    runId: fixture.lease.runId,
    runRoot: fixture.runRoot,
    stateFile: path.join(generationRoot, "browse.json"),
  });
}

async function switchToCandidate(fixture) {
  await switchSystemSymlink({
    candidatePath: fixture.candidateSystemPath,
    installPath: fixture.config.runtime.systemInstallPath,
  });
  await switchWorldEnvironment({
    envFile: fixture.config.runtime.envFile,
    worldId: fixture.lease.worldId,
  });
}

const healthy = () => vi.fn(async () => ({ healthy: true }));

describe("durable acceptance recovery", () => {
  it("atomically journals a planned role generation before process startup", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0001",
    );
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const generation = await createTestBrowserLease(fixture, generationRoot);
    await registerBrowserGeneration({
      config: fixture.config,
      generation,
      journalPath: prepared.journalPath,
    });
    await writeBrowserGenerationMarkers(generation);
    expect((await lstat(prepared.journalPath)).mode & 0o777).toBe(0o600);
    const journal = JSON.parse(await readFile(prepared.journalPath, "utf8"));
    expect(journal.browserGenerations).toMatchObject([
      { generation: 1, role: "gm", status: "planned" },
    ]);
  });

  it("keeps a marker-rejected reconnect generation durably planned for recovery", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0001",
    );
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const generation = await createTestBrowserLease(fixture, generationRoot);
    await registerBrowserGeneration({
      config: fixture.config,
      generation,
      journalPath: prepared.journalPath,
    });
    await writeFile(
      generation.profileMarker,
      `${JSON.stringify({ runId: "stale-prior-run" })}\n`,
      { mode: 0o600 },
    );

    await expect(
      writeBrowserGenerationMarkers(generation),
    ).rejects.toMatchObject({ code: "BROWSER_PROFILE_MARKER_MISMATCH" });
    expect(
      JSON.parse(await readFile(prepared.journalPath, "utf8"))
        .browserGenerations,
    ).toMatchObject([{ generation: 1, role: "gm", status: "planned" }]);
    await expect(
      recoverFromJournal({
        browserRecoveryOptions: {
          processRunner: vi.fn(async () => ({
            code: 0,
            stderr: "",
            stdout: "",
          })),
        },
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROFILE_MARKER_MISMATCH" });
    await expect(access(prepared.journalPath)).resolves.toBeUndefined();
  });

  it("retires exact browser ownership before receipt, journal and lock-eligible completion", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0001",
    );
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const generation = await createTestBrowserLease(fixture, generationRoot);
    await writeBrowserGenerationMarkers(generation);
    await registerBrowserGeneration({
      config: fixture.config,
      generation,
      journalPath: prepared.journalPath,
    });
    await switchToCandidate(fixture);
    const stages = [];
    const result = await recoverFromJournal({
      browserRecoveryOptions: {
        processRunner: vi.fn(async () => ({ code: 0, stderr: "", stdout: "" })),
      },
      config: fixture.config,
      journalPath: prepared.journalPath,
      onStage: async (stage) => stages.push(stage),
      recreateService: vi.fn(),
      waitForHealthy: healthy(),
    });
    expect(stages.indexOf("browser-retired")).toBeLessThan(
      stages.indexOf("receipt-written"),
    );
    await expect(access(generation.profile)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(generation.generationRoot)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(result.receiptPath)).resolves.toBeUndefined();
  });

  it("retains durable recovery state when browser ownership evidence is missing", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0001",
    );
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const generation = await createTestBrowserLease(fixture, generationRoot);
    await registerBrowserGeneration({
      config: fixture.config,
      generation,
      journalPath: prepared.journalPath,
    });
    await expect(
      recoverFromJournal({
        browserRecoveryOptions: {
          processRunner: vi.fn(async () => ({
            code: 0,
            stderr: "",
            stdout: "",
          })),
        },
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROFILE_MARKER_UNSAFE" });
    await expect(access(prepared.journalPath)).resolves.toBeUndefined();
    await expect(
      access(`${prepared.journalPath}.complete`),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("retries idempotently after profile removal by validating its durable retirement receipt", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0001",
    );
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const generation = await createTestBrowserLease(fixture, generationRoot);
    await writeBrowserGenerationMarkers(generation);
    await registerBrowserGeneration({
      config: fixture.config,
      generation,
      journalPath: prepared.journalPath,
    });
    await switchToCandidate(fixture);
    const browserRecoveryOptions = {
      processRunner: vi.fn(async () => ({ code: 0, stderr: "", stdout: "" })),
    };
    await expect(
      recoverFromJournal({
        browserRecoveryOptions,
        config: fixture.config,
        journalPath: prepared.journalPath,
        onStage: async (stage) => {
          if (stage === "browser-profile-retired:gm") {
            throw new Error("crash:browser-profile-retired");
          }
        },
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toThrow("crash:browser-profile-retired");
    await expect(access(generation.profile)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      access(generation.profileRetirementReceipt),
    ).resolves.toBeUndefined();
    await expect(access(prepared.journalPath)).resolves.toBeUndefined();

    const result = await recoverFromJournal({
      browserRecoveryOptions,
      config: fixture.config,
      journalPath: prepared.journalPath,
      recreateService: vi.fn(),
      waitForHealthy: healthy(),
    });
    expect(result.ok).toBe(true);
    await expect(
      access(path.join(fixture.runRoot, "browser")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
  it("journals before mutation and safely retries interrupted restoration", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    expect((await lstat(prepared.journalPath)).mode & 0o777).toBe(0o600);
    const journal = JSON.parse(await readFile(prepared.journalPath, "utf8"));
    expect(journal.environment).not.toHaveProperty("contents");
    expect(journal.environment.backupPath).toContain(fixture.runRoot);

    await switchToCandidate(fixture);

    const firstRecreate = vi.fn(async () => {
      throw new Error("simulated interruption after file restoration");
    });
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: firstRecreate,
        waitForHealthy: vi.fn(),
      }),
    ).rejects.toThrow(/simulated interruption/);
    expect(await readFile(fixture.config.runtime.envFile, "utf8")).toBe(
      fixture.originalEnvironment,
    );
    expect(await readlink(fixture.config.runtime.systemInstallPath)).toBe(
      fixture.originalSystemTarget,
    );

    const result = await recoverFromJournal({
      config: fixture.config,
      journalPath: prepared.journalPath,
      recreateService: vi.fn(async () => undefined),
      waitForHealthy: vi.fn(async () => ({ healthy: true })),
    });
    expect(result).toMatchObject({ ok: true, worldRemoved: true });
    await expect(access(prepared.journalPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(fixture.lease.worldDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(result.receiptPath)).resolves.toBeUndefined();
    await retireRecoveryReceipt({
      config: fixture.config,
      journalPath: prepared.journalPath,
    });
  });

  it.each([
    ["candidate env with original link", true, false],
    ["original env with candidate link", false, true],
  ])(
    "restores the safe partial mutation state: %s",
    async (_label, env, link) => {
      const fixture = await recoveryFixture();
      const prepared = await prepareRecoveryJournal(fixture);
      if (env) {
        await switchWorldEnvironment({
          envFile: fixture.config.runtime.envFile,
          worldId: fixture.lease.worldId,
        });
      }
      if (link) {
        await switchSystemSymlink({
          candidatePath: fixture.candidateSystemPath,
          installPath: fixture.config.runtime.systemInstallPath,
        });
      }
      await recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      });
      expect(await readFile(fixture.config.runtime.envFile, "utf8")).toBe(
        fixture.originalEnvironment,
      );
      expect(await readlink(fixture.config.runtime.systemInstallPath)).toBe(
        fixture.originalSystemTarget,
      );
    },
  );

  it.each(["environment", "link"])(
    "fails closed on third-state operator drift in the %s without overwriting either path",
    async (drift) => {
      const fixture = await recoveryFixture();
      const prepared = await prepareRecoveryJournal(fixture);
      await switchToCandidate(fixture);
      if (drift === "environment") {
        await writeFile(
          fixture.config.runtime.envFile,
          "FOUNDRY_WORLD=operator-world\n",
        );
        await chmod(fixture.config.runtime.envFile, 0o640);
      } else {
        await unlink(fixture.config.runtime.systemInstallPath);
        await symlink(
          path.join(path.dirname(fixture.runRoot), "operator-system"),
          fixture.config.runtime.systemInstallPath,
        );
      }
      const environmentBefore = await readFile(
        fixture.config.runtime.envFile,
        "utf8",
      );
      const linkBefore = await readlink(
        fixture.config.runtime.systemInstallPath,
      );
      await expect(
        recoverFromJournal({
          config: fixture.config,
          journalPath: prepared.journalPath,
          recreateService: vi.fn(),
          waitForHealthy: healthy(),
        }),
      ).rejects.toMatchObject({ code: "RECOVERY_RUNTIME_DRIFT" });
      expect(await readFile(fixture.config.runtime.envFile, "utf8")).toBe(
        environmentBefore,
      );
      expect(await readlink(fixture.config.runtime.systemInstallPath)).toBe(
        linkBefore,
      );
    },
  );

  it.each([
    "runtime-restored",
    "world-retiring",
    "world-removed",
    "backup-retiring",
    "backup-unlinked",
    "journal-unlinked",
  ])("retries idempotently after the %s crash boundary", async (stage) => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    await switchToCandidate(fixture);
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        onStage: async (current) => {
          if (current === stage) throw new Error(`crash:${stage}`);
        },
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toThrow(`crash:${stage}`);
    const result = await recoverFromJournal({
      config: fixture.config,
      journalPath: prepared.journalPath,
      recreateService: vi.fn(),
      waitForHealthy: healthy(),
    });
    expect(result.ok).toBe(true);
    await expect(access(prepared.journalPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      access(`${prepared.journalPath}.complete`),
    ).resolves.toBeUndefined();
    await retireRecoveryReceipt({
      config: fixture.config,
      journalPath: prepared.journalPath,
    });
  });

  it("keeps completion proof through lock release and retires it idempotently", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const lockRoot = path.join(path.dirname(fixture.runRoot), "locks");
    const initialLock = await acquireAcceptanceLock({
      command: "smoke",
      config: fixture.config,
      lockRoot,
      runId: fixture.lease.runId,
    });
    await initialLock.update({
      journalPath: prepared.journalPath,
      runId: fixture.lease.runId,
    });
    await switchToCandidate(fixture);
    const recovered = await recoverFromJournal({
      config: fixture.config,
      journalPath: prepared.journalPath,
      recreateService: vi.fn(),
      waitForHealthy: healthy(),
    });
    await expect(access(recovered.receiptPath)).resolves.toBeUndefined();
    await initialLock.release();

    const identity = await inspectRecoveryIdentity({
      config: fixture.config,
      journalPath: prepared.journalPath,
    });
    const resumedLock = await acquireAcceptanceLock({
      command: "recover",
      config: fixture.config,
      journalPath: prepared.journalPath,
      lockRoot,
      runId: identity.runId,
    });
    const resumed = await recoverFromJournal({
      config: fixture.config,
      journalPath: prepared.journalPath,
      recreateService: vi.fn(),
      waitForHealthy: healthy(),
    });
    expect(resumed).toMatchObject({ alreadyRetired: true, ok: true });
    await resumedLock.release();
    await expect(
      retireRecoveryReceipt({
        config: fixture.config,
        journalPath: prepared.journalPath,
      }),
    ).resolves.toMatchObject({ removed: true });
    await expect(
      retireRecoveryReceipt({
        config: fixture.config,
        journalPath: prepared.journalPath,
      }),
    ).resolves.toMatchObject({ removed: false });
  });

  it("rejects an absent world before its retirement intent is journaled", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    await switchToCandidate(fixture);
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        onStage: async (current) => {
          if (current === "runtime-restored") throw new Error("crash");
        },
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toThrow("crash");
    await rm(fixture.lease.worldDirectory, { recursive: true });
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toMatchObject({ code: "RECOVERY_WORLD_UNEXPECTEDLY_ABSENT" });
  });

  it("rejects an absent backup before its retirement intent is journaled", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    await switchToCandidate(fixture);
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        onStage: async (current) => {
          if (current === "world-retired") throw new Error("crash");
        },
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toThrow("crash");
    await unlink(prepared.journal.environment.backupPath);
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: healthy(),
      }),
    ).rejects.toMatchObject({ code: "RECOVERY_BACKUP_UNEXPECTEDLY_ABSENT" });
  });

  it("rejects recovery under different configured paths without writing", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    const original = await readFile(fixture.config.runtime.envFile, "utf8");
    await expect(
      recoverFromJournal({
        config: {
          ...fixture.config,
          runtime: { ...fixture.config.runtime, service: "other-service" },
        },
        journalPath: prepared.journalPath,
        recreateService: vi.fn(),
        waitForHealthy: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "RECOVERY_CONFIG_MISMATCH" });
    expect(await readFile(fixture.config.runtime.envFile, "utf8")).toBe(
      original,
    );
  });

  it("never restores or deletes a world whose lease marker changed", async () => {
    const fixture = await recoveryFixture();
    const prepared = await prepareRecoveryJournal(fixture);
    await writeFile(
      fixture.lease.marker,
      JSON.stringify({ worldId: fixture.lease.worldId }),
    );
    const recreateService = vi.fn();
    await expect(
      recoverFromJournal({
        config: fixture.config,
        journalPath: prepared.journalPath,
        recreateService,
        waitForHealthy: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "WORLD_LEASE_MISMATCH" });
    expect(recreateService).not.toHaveBeenCalled();
    expect((await lstat(fixture.lease.worldDirectory)).isDirectory()).toBe(
      true,
    );
  });

  it("coalesces SIGINT and finally onto one bounded restoration", async () => {
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    processLike.exitCode = 0;
    const onRestore = vi.fn(async () => ({ ok: true }));
    const controller = installSignalRestoration({
      onRestore,
      processLike,
      timeoutMs: 1_000,
    });
    processLike.emit("SIGINT");
    await controller.restore("finally");
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(
      "SIGINT",
      expect.objectContaining({ signal: expect.any(globalThis.AbortSignal) }),
    );
    expect(controller.interruptedBy).toBe("SIGINT");
    expect(() => controller.throwIfInterrupted()).toThrow(/SIGINT/);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(processLike.exitCode).toBe(130);
    controller.dispose();
  });

  it("allows a slow successful restoration beyond the former 30-second ceiling", async () => {
    vi.useFakeTimers();
    try {
      const processLike = new EventEmitter();
      processLike.stderr = { write: vi.fn() };
      const terminateHarness = vi.fn();
      const controller = installSignalRestoration({
        onRestore: () =>
          new Promise((resolve) =>
            globalThis.setTimeout(() => resolve({ ok: true }), 31_000),
          ),
        processLike,
        terminateHarness,
        timeoutMs: 90_000,
      });
      const restoration = controller.restore("finally");
      await vi.advanceTimersByTimeAsync(31_000);
      await expect(restoration).resolves.toEqual({ ok: true });
      expect(terminateHarness).not.toHaveBeenCalled();
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for an active mutation and rejects every later mutation after a signal", async () => {
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    let finishMutation;
    const activeMutation = new Promise((resolve) => {
      finishMutation = resolve;
    });
    const order = [];
    const controller = installSignalRestoration({
      onRestore: vi.fn(async () => order.push("restore")),
      processLike,
      timeoutMs: 1_000,
    });
    const mutation = controller.runMutation(async () => {
      order.push("mutation-start");
      await activeMutation;
      order.push("mutation-end");
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    processLike.emit("SIGTERM");
    finishMutation();
    await mutation;
    await controller.restore("finally");
    expect(order).toEqual(["mutation-start", "mutation-end", "restore"]);
    await expect(
      controller.runMutation(async () => order.push("late-mutation")),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_INTERRUPTED" });
    controller.dispose();
  });

  it("aborts bounded restoration and terminates the harness with the journal retained", async () => {
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    const terminateHarness = vi.fn();
    const onRestore = vi.fn(
      async (_reason, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const controller = installSignalRestoration({
      onRestore,
      processLike,
      terminateHarness,
      timeoutMs: 10,
    });
    processLike.emit("SIGTERM");
    await expect(controller.restore("finally")).rejects.toMatchObject({
      code: "RECOVERY_TIMEOUT",
    });
    expect(terminateHarness).toHaveBeenCalledWith(143);
    expect(processLike.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("journal retained"),
    );
    controller.dispose();
  });

  it("sends final escalation to an owned child before timeout termination", async () => {
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    const order = [];
    const registry = new HarnessChildRegistry();
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn() };
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    child.kill = vi.fn((signal) => {
      order.push(signal);
      if (signal === "SIGKILL") {
        child.signalCode = signal;
        globalThis.queueMicrotask(() => child.emit("close", null, signal));
      }
      return true;
    });
    const controller = installSignalRestoration({
      onRestore: async (_reason, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        ),
      processLike,
      terminateHarness: vi.fn(() => order.push("terminate")),
      terminateOwnedChildren: (signal) => registry.terminateAll(signal),
      timeoutMs: 10,
    });
    const running = runProcess("owned-child", ["hang"], {
      abortGraceMs: 10_000,
      childRegistry: registry,
      signal: controller.operationSignal,
      spawnImpl: vi.fn(() => child),
    });
    processLike.emit("SIGTERM");
    await expect(controller.restore("finally")).rejects.toMatchObject({
      code: "RECOVERY_TIMEOUT",
    });
    await expect(running).rejects.toMatchObject({ code: "PROCESS_ABORTED" });
    expect(order).toEqual(["SIGTERM", "SIGKILL", "terminate"]);
    controller.dispose();
  });

  it("escalates a second signal immediately", async () => {
    const processLike = new EventEmitter();
    processLike.stderr = { write: vi.fn() };
    const terminateHarness = vi.fn();
    const controller = installSignalRestoration({
      onRestore: async (_reason, { signal }) =>
        signal.aborted
          ? Promise.reject(signal.reason)
          : new Promise((resolve, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              }),
            ),
      processLike,
      terminateHarness,
      timeoutMs: 1_000,
    });
    processLike.emit("SIGINT");
    processLike.emit("SIGINT");
    await expect(controller.restore("finally")).rejects.toMatchObject({
      code: "RECOVERY_SECOND_SIGNAL",
    });
    expect(terminateHarness).toHaveBeenCalledWith(130);
    controller.dispose();
  });
});
