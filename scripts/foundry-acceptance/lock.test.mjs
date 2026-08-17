import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { acquireAcceptanceLock, inspectAcceptanceLock } from "./lock.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-lock-test-"));
  const dataPath = path.join(root, "data");
  const runtime = path.join(root, "runtime");
  const lockRoot = path.join(root, "locks");
  await mkdir(dataPath);
  await mkdir(runtime);
  const composeFile = path.join(runtime, "compose.yml");
  const envFile = path.join(runtime, ".env");
  const systemInstallPath = path.join(runtime, "system");
  await writeFile(composeFile, "services: {}\n");
  await writeFile(envFile, "FOUNDRY_WORLD=original\n");
  await symlink(path.join(root, "original"), systemInstallPath);
  return {
    config: {
      dataPath,
      runtime: { composeFile, envFile, systemInstallPath },
    },
    lockRoot,
  };
}

async function configVariant(root, baseConfig, label, sharedEnv = false) {
  const dataPath = path.join(root, `${label}-data`);
  const runtime = path.join(root, `${label}-runtime`);
  await mkdir(dataPath);
  await mkdir(runtime);
  const composeFile = path.join(runtime, "compose.yml");
  const envFile = sharedEnv
    ? baseConfig.runtime.envFile
    : path.join(runtime, ".env");
  const systemInstallPath = path.join(runtime, "system");
  await writeFile(composeFile, "services: {}\n");
  if (!sharedEnv) await writeFile(envFile, "FOUNDRY_WORLD=other\n");
  await symlink(path.join(root, `${label}-original`), systemInstallPath);
  return {
    dataPath,
    runtime: { composeFile, envFile, systemInstallPath },
  };
}

function waitForLine(child, expected) {
  return new Promise((resolve, reject) => {
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes(expected)) resolve(output);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!output.includes(expected))
        reject(new Error(`child exited ${code}: ${output}`));
    });
  });
}

function observeChildExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const finish = (callback) => {
      globalThis.clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
      callback();
    };
    const onClose = (code, signal) => finish(() => resolve({ code, signal }));
    const onError = (error) => finish(() => reject(error));
    const timer = globalThis.setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(
              `child PID ${child.pid ?? "unknown"} did not exit within ${timeoutMs}ms`,
            ),
          ),
        ),
      timeoutMs,
    );
    child.once("close", onClose);
    child.once("error", onError);
    if (child.exitCode !== null || child.signalCode !== null) {
      finish(() => resolve({ code: child.exitCode, signal: child.signalCode }));
    }
  });
}

async function terminateChild(child, stderr) {
  const gracefulExit = observeChildExit(child, 2_000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
  }
  try {
    return await gracefulExit;
  } catch (gracefulError) {
    const forcedExit = observeChildExit(child, 1_000);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    try {
      await forcedExit;
    } catch (forcedError) {
      throw new AggregateError(
        [gracefulError, forcedError],
        `Failed to reap lock-test child PID ${child.pid ?? "unknown"}; stderr: ${stderr() || "<empty>"}`,
      );
    }
    throw new Error(
      `${gracefulError.message}; child required SIGKILL; stderr: ${stderr() || "<empty>"}`,
    );
  }
}

describe("cross-process acceptance lock", () => {
  it("inspects only the exact canonical owner-only global lock", async () => {
    const { config, lockRoot } = await fixture();
    const owner = await acquireAcceptanceLock({
      command: "smoke",
      config,
      journalPath: "/tmp/exact-journal.json",
      lockRoot,
      runId: "exact-run",
    });
    await expect(
      inspectAcceptanceLock({ config, lockRoot }),
    ).resolves.toMatchObject({
      metadata: {
        command: "smoke",
        journalPath: "/tmp/exact-journal.json",
        runId: "exact-run",
      },
    });
    const other = await configVariant(path.dirname(lockRoot), config, "other");
    await expect(
      inspectAcceptanceLock({ config: other, lockRoot }),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_IDENTITY_MISMATCH" });
    await owner.release();
  });

  it("serializes every host smoke despite overlapping or different path tuples", async () => {
    const { config, lockRoot } = await fixture();
    const root = path.dirname(lockRoot);
    const overlappingConfig = await configVariant(
      root,
      config,
      "overlapping",
      true,
    );
    const differentConfig = await configVariant(root, config, "different");
    const modulePath = fileURLToPath(new URL("./lock.mjs", import.meta.url));
    const childSource = `
      import { acquireAcceptanceLock } from ${JSON.stringify(modulePath)};
      const config = JSON.parse(process.argv[1]);
      const lock = await acquireAcceptanceLock({ command: "smoke", config, lockRoot: process.argv[2], runId: "first" });
      const keepAlive = setInterval(() => undefined, 1_000);
      console.log("LOCKED");
      await new Promise((resolve, reject) => {
        process.once("SIGTERM", () => lock.release().then(resolve, reject));
      });
      clearInterval(keepAlive);
    `;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        childSource,
        JSON.stringify(config),
        lockRoot,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let childStderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      childStderr += chunk;
    });
    try {
      await waitForLine(child, "LOCKED");
      await expect(
        acquireAcceptanceLock({
          command: "smoke",
          config,
          lockRoot,
          runId: "second",
        }),
      ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_HELD" });
      await expect(
        acquireAcceptanceLock({
          command: "smoke",
          config: overlappingConfig,
          lockRoot,
          runId: "overlapping",
        }),
      ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_HELD" });
      await expect(
        acquireAcceptanceLock({
          command: "smoke",
          config: differentConfig,
          lockRoot,
          runId: "different",
        }),
      ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_HELD" });
    } finally {
      const exit = await terminateChild(child, () => childStderr);
      expect(exit).toEqual({ code: 0, signal: null });
    }
  });

  it("permits only exact dead-owner recovery and makes competing takeovers atomic", async () => {
    const { config, lockRoot } = await fixture();
    const owner = await acquireAcceptanceLock({
      command: "smoke",
      config,
      lockRoot,
      processId: 41001,
      runId: "run",
    });
    const journalPath = path.join(path.dirname(lockRoot), "journal.json");
    await owner.update({ journalPath });
    await expect(
      acquireAcceptanceLock({
        command: "recover",
        config,
        isProcessAlive: () => true,
        journalPath,
        lockRoot,
        processId: 41002,
        runId: "run",
      }),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_OWNER_ALIVE" });
    await expect(
      acquireAcceptanceLock({
        command: "recover",
        config,
        isProcessAlive: () => false,
        journalPath: `${journalPath}.wrong`,
        lockRoot,
        processId: 41002,
        runId: "run",
      }),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCK_RECOVERY_MISMATCH" });

    const alive = vi.fn((pid) => pid !== 41001);
    const attempts = await Promise.allSettled([
      acquireAcceptanceLock({
        command: "recover",
        config,
        isProcessAlive: alive,
        journalPath,
        lockRoot,
        processId: 41002,
        runId: "run",
      }),
      acquireAcceptanceLock({
        command: "recover",
        config,
        isProcessAlive: alive,
        journalPath,
        lockRoot,
        processId: 41003,
        runId: "run",
      }),
    ]);
    expect(
      attempts.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const winner = attempts.find(({ status }) => status === "fulfilled").value;
    const metadata = JSON.parse(await readFile(winner.metadataFile, "utf8"));
    expect([41002, 41003]).toContain(metadata.pid);
    await winner.release();
  });
});
