import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  captureBrowserGenerationIdentity,
  collectBrowserProcessIdentityDrifts,
  createBrowserGenerationLease,
  discoverLeasedProcesses,
  inspectLeasedBrowserGeneration,
  parseProcessTable,
  readProcessTable,
  retireLeasedBrowserArtifacts,
  retireLeasedBrowserProfile,
  retireLeasedBrowserRunArtifacts,
  terminateLeasedBrowserGeneration,
  writeBrowserGenerationMarkers,
} from "./browser-lease.mjs";

const START = "Mon Aug 17 01:21:28 2026";
const PROCESS_START = new Date(START);
const STATE_START = new Date(PROCESS_START.getTime() + 2_460).toISOString();
const PLANNED_AT = new Date(PROCESS_START.getTime() - 500).toISOString();

function processLine({
  command,
  pgid,
  pid,
  ppid,
  startTime = START,
  state = "S",
}) {
  return `${pid} ${ppid} ${pgid} ${startTime} ${state} ${command}`;
}

async function generationFixture({ markers = true, state = true } = {}) {
  const runRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "d6-browser-lease-")),
  );
  await chmod(runRoot, 0o700);
  const toolsRoot = path.join(runRoot, "tools");
  await mkdir(toolsRoot, { mode: 0o700 });
  const browserBinary = path.join(toolsRoot, "browse");
  const daemonServerPath = path.join(toolsRoot, "server.ts");
  const executable = path.join(toolsRoot, "Chrome");
  for (const file of [browserBinary, daemonServerPath, executable]) {
    await writeFile(file, "test\n", { mode: 0o700 });
  }
  const generationRoot = path.join(
    runRoot,
    "browser",
    "gm",
    "generations",
    "0001",
  );
  const profile = path.join(runRoot, "browser", "gm", "chromium-profile");
  await mkdir(generationRoot, { recursive: true, mode: 0o700 });
  await mkdir(profile, { recursive: true, mode: 0o700 });
  for (const directory of [
    path.join(runRoot, "browser"),
    path.join(runRoot, "browser", "gm"),
    path.join(runRoot, "browser", "gm", "generations"),
    generationRoot,
    profile,
  ]) {
    await chmod(directory, 0o700);
  }
  const lease = await createBrowserGenerationLease({
    browserBinary,
    daemonServerPath,
    executable,
    generation: 1,
    generationRoot,
    plannedAt: PLANNED_AT,
    profile,
    role: "gm",
    runId: "lease-run",
    runRoot,
    stateFile: path.join(generationRoot, "browse.json"),
  });
  if (markers) await writeBrowserGenerationMarkers(lease);
  if (state) {
    await writeFile(
      lease.stateFile,
      `${JSON.stringify({ pid: 100, port: 9400, serverPath: daemonServerPath, startedAt: STATE_START, token: "control-a" })}\n`,
      { mode: 0o600 },
    );
    await utimes(lease.stateFile, new Date(STATE_START), new Date(STATE_START));
  }
  const output = () =>
    [
      processLine({
        command: `bun run ${daemonServerPath}`,
        pgid: 100,
        pid: 100,
        ppid: 1,
      }),
      processLine({
        command: `${executable} --user-data-dir=${profile} about:blank`,
        pgid: 101,
        pid: 101,
        ppid: 100,
      }),
      processLine({
        command: `/opt/chrome/Helper --user-data-dir=${profile}`,
        pgid: 101,
        pid: 102,
        ppid: 101,
      }),
    ].join("\n");
  return {
    browserBinary,
    daemonServerPath,
    executable,
    lease,
    output,
    profile,
    runRoot,
  };
}

async function replaceDirectoryWithSymlink(directory) {
  const target = `${directory}-original`;
  await rename(directory, target);
  await symlink(target, directory);
  return target;
}

function processResult(output, identityOverrides = {}) {
  const processIdentities = {};
  for (const entry of parseProcessTable(output)) {
    if (entry.state.startsWith("Z") && !identityOverrides[entry.pid]) continue;
    processIdentities[entry.pid] = {
      birthIdentity: `test:${entry.pid}:${entry.startTime}`,
      pgid: entry.pgid,
      pid: entry.pid,
      ppid: entry.ppid,
      status: entry.state,
      ...identityOverrides[entry.pid],
    };
  }
  return { code: 0, processIdentities, stderr: "", stdout: output };
}

function processRunner(output, identityOverrides) {
  return vi.fn(async () => processResult(output, identityOverrides));
}

function processResultWithoutIdentity(output, pids, code = 0) {
  const result = processResult(output);
  for (const pid of pids) Reflect.deleteProperty(result.processIdentities, pid);
  return { ...result, code };
}

function queuedProcessRunner(...results) {
  return vi.fn(async () => {
    if (results.length === 0) throw new Error("Unexpected process inspection");
    return results.shift();
  });
}

function parsedProcesses(output, identityOverrides) {
  return parseProcessTable(
    output,
    processResult(output, identityOverrides).processIdentities,
  );
}

describe("durable browser generation ownership", () => {
  it("parses stable PID, parent, process-group, start-time and command identities", () => {
    expect(
      parseProcessTable(
        processLine({
          command: "bun run /opt/gstack/server.ts",
          pgid: 10,
          pid: 10,
          ppid: 1,
        }),
      ),
    ).toMatchObject([{ pgid: 10, pid: 10, ppid: 1, startTime: START }]);
  });

  it("fails closed when kernel birth inspection races a parent or process-group change", async () => {
    const output = processLine({
      command: "bun run /opt/gstack/server.ts",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    await expect(
      readProcessTable({
        processRunner: processRunner(output, {
          10: {
            birthIdentity: "test:10:replacement",
            pgid: 10,
            pid: 10,
            ppid: 99,
            status: "S",
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_IDENTITY_RACE" });
  });

  it("classifies a stale live Darwin row absent only after exact-PID resampling proves it gone", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    const runner = queuedProcessRunner(
      processResultWithoutIdentity(output, [10]),
      { code: 1, processIdentities: {}, stderr: "", stdout: "" },
    );
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: runner,
      }),
    ).resolves.toEqual([]);
    expect(runner.mock.calls[1][1]).toEqual([
      "-p",
      "10",
      "-o",
      "pid=,ppid=,pgid=,lstart=,state=,command=",
    ]);
  });

  it("classifies an exiting Darwin row absent only after a second exact-PID sample proves it gone", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
      state: "E",
    });
    const runner = queuedProcessRunner(
      processResultWithoutIdentity(output, [10]),
      processResultWithoutIdentity(output, [10]),
      { code: 1, processIdentities: {}, stderr: "", stdout: "" },
    );
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: runner,
      }),
    ).resolves.toEqual([]);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it("rejects an empty successful exact-PID response as ambiguous rather than absent", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: queuedProcessRunner(
          processResultWithoutIdentity(output, [10]),
          { code: 0, processIdentities: {}, stderr: "", stdout: "" },
        ),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_PROCESS_INSPECTION_FAILED",
      details: { code: 0, count: 0, pid: 10 },
    });
  });

  it.each([
    {
      label: "whitespace successful output",
      result: { code: 0, processIdentities: {}, stderr: "", stdout: "  \n" },
    },
    {
      label: "malformed successful output",
      result: {
        code: 0,
        processIdentities: {},
        stderr: "",
        stdout: "not-a-process-row\n",
      },
    },
    {
      label: "mismatched PID",
      result: processResult(
        processLine({
          command: "/opt/browser replacement",
          pgid: 11,
          pid: 11,
          ppid: 1,
        }),
      ),
    },
    {
      label: "multiple successful rows",
      result: processResult(
        [
          processLine({
            command: "/opt/browser helper",
            pgid: 10,
            pid: 10,
            ppid: 1,
          }),
          processLine({
            command: "/opt/browser replacement",
            pgid: 11,
            pid: 11,
            ppid: 1,
          }),
        ].join("\n"),
      ),
    },
    {
      label: "absent-status response containing a row",
      result: {
        ...processResult(
          processLine({
            command: "/opt/browser helper",
            pgid: 10,
            pid: 10,
            ppid: 1,
          }),
        ),
        code: 1,
      },
    },
    {
      label: "unexpected status",
      result: { code: 2, processIdentities: {}, stderr: "failed", stdout: "" },
    },
  ])("fails closed for exact-PID $label", async ({ result }) => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: queuedProcessRunner(
          processResultWithoutIdentity(output, [10]),
          result,
        ),
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        /^BROWSER_PROCESS_(?:INSPECTION_FAILED|EXACT_RESAMPLE_AMBIGUOUS)$/,
      ),
    });
  });

  it("accepts a fresh exact-PID row only with a valid same-process birth identity", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    const runner = queuedProcessRunner(
      processResultWithoutIdentity(output, [10]),
      processResult(output),
    );
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: runner,
      }),
    ).resolves.toMatchObject([
      {
        birthIdentity: `test:10:${START}`,
        commandSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        pid: 10,
      },
    ]);
  });

  it("exposes a freshly resampled reused PID birth for strict lease comparison", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    const replacementBirth = "darwin:10:replacement-birth";
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: queuedProcessRunner(
          processResultWithoutIdentity(output, [10]),
          processResult(output, {
            10: { birthIdentity: replacementBirth },
          }),
        ),
      }),
    ).resolves.toMatchObject([{ birthIdentity: replacementBirth, pid: 10 }]);
  });

  it("fails closed when an exact-PID resample still lacks a live birth identity", async () => {
    const output = processLine({
      command: "/opt/browser helper",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    await expect(
      readProcessTable({
        candidatePids: [10],
        processPlatform: "darwin",
        processRunner: queuedProcessRunner(
          processResultWithoutIdentity(output, [10]),
          processResultWithoutIdentity(output, [10]),
          processResultWithoutIdentity(output, [10]),
        ),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_PROCESS_BIRTH_IDENTITY_AMBIGUOUS",
      details: { pid: 10, state: "S" },
    });
  });

  it("ignores unrelated host identity churn outside leased candidates", async () => {
    const candidate = processLine({
      command: "/opt/browser candidate",
      pgid: 10,
      pid: 10,
      ppid: 1,
    });
    const unrelated = processLine({
      command: "/opt/unrelated",
      pgid: 20,
      pid: 20,
      ppid: 1,
    });
    await expect(
      readProcessTable({
        candidatePids: [10],
        processRunner: processRunner(`${candidate}\n${unrelated}`, {
          20: { pgid: 999 },
        }),
      }),
    ).resolves.toHaveLength(2);
  });

  it("writes owner-only exact run/role generation and profile markers", async () => {
    const { lease } = await generationFixture({ state: false });
    expect((await lstat(lease.generationMarker)).mode & 0o777).toBe(0o600);
    expect((await lstat(lease.profileMarker)).mode & 0o777).toBe(0o600);
    expect(
      JSON.parse(await readFile(lease.generationMarker, "utf8")),
    ).toMatchObject({
      generation: 1,
      role: "gm",
      runId: "lease-run",
      stateFile: lease.stateFile,
    });
  });

  it("reuses one stable exact profile marker across fresh reconnect generations", async () => {
    const fixture = await generationFixture({ state: false });
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0002",
    );
    await mkdir(generationRoot, { mode: 0o700 });
    const reconnect = await createBrowserGenerationLease({
      browserBinary: fixture.browserBinary,
      daemonServerPath: fixture.daemonServerPath,
      executable: fixture.executable,
      generation: 2,
      generationRoot,
      plannedAt: new Date(PROCESS_START.getTime() + 500).toISOString(),
      profile: fixture.profile,
      role: "gm",
      runId: fixture.lease.runId,
      runRoot: fixture.runRoot,
      stateFile: path.join(generationRoot, "browse.json"),
    });

    await expect(
      writeBrowserGenerationMarkers(reconnect),
    ).resolves.toBeUndefined();
    const profileMarker = JSON.parse(
      await readFile(reconnect.profileMarker, "utf8"),
    );
    expect(profileMarker.directoryIdentity).not.toHaveProperty(
      fixture.lease.generationRoot,
    );
    expect(profileMarker.directoryIdentity).not.toHaveProperty(
      reconnect.generationRoot,
    );
    expect(profileMarker.directoryIdentity).toHaveProperty(reconnect.profile);
  });

  it("rejects a stale run profile marker and a prior generation marker", async () => {
    const fixture = await generationFixture({ state: false });
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0002",
    );
    await mkdir(generationRoot, { mode: 0o700 });
    const reconnect = await createBrowserGenerationLease({
      browserBinary: fixture.browserBinary,
      daemonServerPath: fixture.daemonServerPath,
      executable: fixture.executable,
      generation: 2,
      generationRoot,
      profile: fixture.profile,
      role: "gm",
      runId: fixture.lease.runId,
      runRoot: fixture.runRoot,
      stateFile: path.join(generationRoot, "browse.json"),
    });
    const staleRun = await createBrowserGenerationLease({
      browserBinary: fixture.browserBinary,
      daemonServerPath: fixture.daemonServerPath,
      executable: fixture.executable,
      generation: 2,
      generationRoot,
      profile: fixture.profile,
      role: "gm",
      runId: "stale-run",
      runRoot: fixture.runRoot,
      stateFile: path.join(generationRoot, "browse.json"),
    });
    await expect(writeBrowserGenerationMarkers(staleRun)).rejects.toMatchObject(
      { code: "BROWSER_PROFILE_MARKER_MISMATCH" },
    );

    await writeBrowserGenerationMarkers(reconnect);
    await writeFile(
      reconnect.generationMarker,
      await readFile(fixture.lease.generationMarker, "utf8"),
      { mode: 0o600 },
    );
    await expect(
      captureBrowserGenerationIdentity(reconnect, {
        processRunner: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_GENERATION_MARKER_MISMATCH" });
  });

  it("captures the exact detached daemon and Chrome tree after startup", async () => {
    const { lease, output } = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(lease, {
      processRunner: processRunner(output()),
    });
    expect(identity.daemon).toMatchObject({ pgid: 100, pid: 100, ppid: 1 });
    expect(identity.processes.map(({ pid }) => pid)).toEqual([100, 101, 102]);
    expect(
      identity.processes.every(
        ({ commandSha256 }) => commandSha256.length === 64,
      ),
    ).toBe(true);
    expect(identity.stateSha256).toHaveLength(64);
    expect(JSON.stringify(identity)).not.toContain("control-a");
  });

  it("binds a reconnect daemon from exact Darwin birth inside the same ps second", async () => {
    const fixture = await generationFixture();
    const generationRoot = path.join(
      fixture.runRoot,
      "browser",
      "gm",
      "generations",
      "0002",
    );
    await mkdir(generationRoot, { mode: 0o700 });
    const reconnect = await createBrowserGenerationLease({
      browserBinary: fixture.browserBinary,
      daemonServerPath: fixture.daemonServerPath,
      executable: fixture.executable,
      generation: 2,
      generationRoot,
      plannedAt: PLANNED_AT,
      profile: fixture.profile,
      role: "gm",
      runId: fixture.lease.runId,
      runRoot: fixture.runRoot,
      stateFile: path.join(generationRoot, "browse.json"),
    });
    await writeBrowserGenerationMarkers(reconnect);
    const birthSeconds = Math.floor(PROCESS_START.getTime() / 1_000);
    const birthMicroseconds = 21_356;
    const stateStartedAt = new Date(
      birthSeconds * 1_000 + birthMicroseconds / 1_000 + 936.644,
    ).toISOString();
    await writeFile(
      reconnect.stateFile,
      `${JSON.stringify({
        pid: 100,
        port: 9400,
        serverPath: fixture.daemonServerPath,
        startedAt: stateStartedAt,
        token: "control-a",
      })}\n`,
      { mode: 0o600 },
    );
    await utimes(
      reconnect.stateFile,
      new Date(stateStartedAt),
      new Date(stateStartedAt),
    );

    await expect(
      captureBrowserGenerationIdentity(reconnect, {
        processRunner: processRunner(fixture.output(), {
          100: {
            birthIdentity: `darwin:${birthSeconds}:${birthMicroseconds}`,
          },
        }),
      }),
    ).resolves.toMatchObject({
      daemon: {
        birthIdentity: `darwin:${birthSeconds}:${birthMicroseconds}`,
        pid: 100,
      },
    });
  });

  it("rejects an exact Darwin birth after the state or durable plan boundary", async () => {
    const fixture = await generationFixture();
    const stateTime = Date.parse(STATE_START);
    const afterStateSeconds = Math.floor(stateTime / 1_000) + 1;
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(fixture.output(), {
          100: { birthIdentity: `darwin:${afterStateSeconds}:1` },
        }),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_DAEMON_NOT_VERIFIED",
      details: {
        exactKernelBirth: true,
        stateAfterBirth: false,
      },
    });

    const beforePlanMilliseconds = Date.parse(fixture.lease.plannedAt) - 1;
    const beforePlanSeconds = Math.floor(beforePlanMilliseconds / 1_000);
    const beforePlanMicroseconds =
      (beforePlanMilliseconds - beforePlanSeconds * 1_000) * 1_000;
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(fixture.output(), {
          100: {
            birthIdentity: `darwin:${beforePlanSeconds}:${beforePlanMicroseconds}`,
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_DAEMON_NOT_VERIFIED",
      details: {
        birthAfterPlan: false,
        exactKernelBirth: true,
      },
    });
  });

  it("rejects a malformed Darwin birth instead of falling back to coarse ps time", async () => {
    const fixture = await generationFixture();
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(fixture.output(), {
          100: { birthIdentity: "darwin:invalid:identity" },
        }),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_DAEMON_NOT_VERIFIED",
      details: {
        birthAfterPlan: false,
        exactKernelBirth: false,
        stateAfterBirth: false,
      },
    });
  });

  it("rejects a trusted PID whose live daemon command drifted before adoption", async () => {
    const fixture = await generationFixture();
    const drifted = fixture
      .output()
      .replace(
        `bun run ${fixture.daemonServerPath}`,
        `bun run ${fixture.daemonServerPath}.replacement`,
      );
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(drifted),
      }),
    ).rejects.toMatchObject({
      code: "BROWSER_DAEMON_NOT_VERIFIED",
      details: { commandMatches: false },
    });
  });

  it("ignores an unrelated process using the same executable with another profile", async () => {
    const { lease, output } = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(lease, {
      processRunner: processRunner(output()),
    });
    const processOutput = `${output()}\n${processLine({ command: `${lease.executable} --user-data-dir=/tmp/unrelated`, pgid: 900, pid: 900, ppid: 1 })}`;
    const processes = parsedProcesses(processOutput);
    expect(
      discoverLeasedProcesses(processes, { ...lease, identity }).processes.map(
        ({ pid }) => pid,
      ),
    ).toEqual([100, 101, 102]);
  });

  it("fails closed on PID reuse or altered recorded command", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const lease = { ...fixture.lease, identity, status: "active" };
    const changed = fixture
      .output()
      .replace(
        `bun run ${fixture.daemonServerPath}`,
        "bun run /opt/other/server.ts",
      );
    let failure;
    try {
      await inspectLeasedBrowserGeneration(lease, {
        processRunner: processRunner(changed),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "BROWSER_PROCESS_IDENTITY_DRIFT",
      details: {
        identity: {
          birthIdentityMatch: true,
          commandHashMatch: false,
          currentPresent: true,
          currentState: "S",
          currentTerminal: false,
          pgidMatch: true,
          ppidMatch: true,
          startTimeMatch: true,
        },
        pid: 100,
        role: "gm",
        shutdownPhase: "strict",
      },
    });
    expect(failure.details.identity.currentCommandHash).toHaveLength(64);
    expect(failure.details.identity.expectedCommandHash).toHaveLength(64);
    expect(JSON.stringify(failure.details)).not.toContain(
      "/opt/other/server.ts",
    );
    expect(JSON.stringify(failure.details)).not.toContain("control-a");
  });

  it("rejects stale state birth identity and an untrusted daemon server path", async () => {
    const stale = await generationFixture();
    const staleStartedAt = new Date(
      Date.parse(STATE_START) - 60_000,
    ).toISOString();
    await writeFile(
      stale.lease.stateFile,
      `${JSON.stringify({
        pid: 100,
        serverPath: stale.daemonServerPath,
        startedAt: staleStartedAt,
      })}\n`,
      { mode: 0o600 },
    );
    await utimes(
      stale.lease.stateFile,
      new Date(staleStartedAt),
      new Date(staleStartedAt),
    );
    await expect(
      captureBrowserGenerationIdentity(stale.lease, {
        processRunner: processRunner(stale.output()),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_DAEMON_NOT_VERIFIED" });

    const untrusted = await generationFixture();
    await writeFile(
      untrusted.lease.stateFile,
      `${JSON.stringify({
        pid: 100,
        serverPath: path.join(untrusted.runRoot, "untrusted-server.ts"),
        startedAt: STATE_START,
      })}\n`,
      { mode: 0o600 },
    );
    await utimes(
      untrusted.lease.stateFile,
      new Date(STATE_START),
      new Date(STATE_START),
    );
    await expect(
      captureBrowserGenerationIdentity(untrusted.lease, {
        processRunner: processRunner(untrusted.output()),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_IDENTITY_MISSING" });
  });

  it("rejects rapid PID reuse inside the former two-second birth tolerance", async () => {
    const fixture = await generationFixture();
    const nearReuse = fixture
      .output()
      .replace(
        `${START} S bun run ${fixture.daemonServerPath}`,
        `Mon Aug 17 01:21:31 2026 S bun run ${fixture.daemonServerPath}`,
      );
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(nearReuse),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_DAEMON_NOT_VERIFIED" });
  });

  it("rejects disconnected or partial daemon-to-Chrome ancestry", async () => {
    const fixture = await generationFixture();
    const disconnected = fixture.output().replace("101 100 101", "101 1 101");
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(disconnected),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_DAEMON_ANCESTRY_MISMATCH" });

    const partial = [
      processLine({
        command: `bun run ${fixture.daemonServerPath}`,
        pgid: 100,
        pid: 100,
        ppid: 1,
      }),
      processLine({
        command: `${fixture.executable} --user-data-dir=${fixture.profile}`,
        pgid: 101,
        pid: 101,
        ppid: 105,
      }),
    ].join("\n");
    await expect(
      captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(partial),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_DAEMON_ANCESTRY_MISMATCH" });
  });

  it("captures launcher intermediaries and their later exact descendants", async () => {
    const fixture = await generationFixture();
    const output = [
      processLine({
        command: `bun run ${fixture.daemonServerPath}`,
        pgid: 100,
        pid: 100,
        ppid: 1,
      }),
      processLine({
        command: "/bin/sh launcher",
        pgid: 100,
        pid: 105,
        ppid: 100,
      }),
      processLine({
        command: `${fixture.executable} --user-data-dir=${fixture.profile}`,
        pgid: 101,
        pid: 101,
        ppid: 105,
      }),
      processLine({
        command: "/opt/chrome/Helper",
        pgid: 101,
        pid: 102,
        ppid: 101,
      }),
    ].join("\n");
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(output),
    });
    expect(identity.processes.map(({ pid }) => pid)).toEqual([
      100, 105, 101, 102,
    ]);
    const respawned = `${output}\n${processLine({
      command: `${fixture.executable} --user-data-dir=${fixture.profile} new`,
      pgid: 106,
      pid: 106,
      ppid: 105,
    })}`;
    const observation = await inspectLeasedBrowserGeneration(
      { ...fixture.lease, identity, status: "active" },
      { processRunner: processRunner(respawned) },
    );
    expect(observation.processes.map(({ pid }) => pid)).toContain(106);
  });

  it("fails closed when a recorded launcher is reparented outside a still-live daemon", async () => {
    const fixture = await generationFixture();
    const output = [
      processLine({
        command: `bun run ${fixture.daemonServerPath}`,
        pgid: 100,
        pid: 100,
        ppid: 1,
      }),
      processLine({
        command: "/bin/sh launcher",
        pgid: 100,
        pid: 105,
        ppid: 100,
      }),
      processLine({
        command: `${fixture.executable} --user-data-dir=${fixture.profile}`,
        pgid: 101,
        pid: 101,
        ppid: 105,
      }),
    ].join("\n");
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(output),
    });
    const reparented = output.replace(
      processLine({
        command: "/bin/sh launcher",
        pgid: 100,
        pid: 105,
        ppid: 100,
      }),
      processLine({
        command: "/bin/sh launcher",
        pgid: 100,
        pid: 105,
        ppid: 1,
      }),
    );
    await expect(
      inspectLeasedBrowserGeneration(
        { ...fixture.lease, identity, status: "active" },
        { processRunner: processRunner(reparented) },
      ),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_IDENTITY_DRIFT" });
  });

  it("treats a foreign executable on the exact profile and Singleton lock as durable ambiguity", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    await writeFile(path.join(fixture.profile, "SingletonLock"), "locked\n");
    const foreign = `${fixture.output()}\n${processLine({
      command: `/Applications/Foreign Chromium --user-data-dir=${fixture.profile}`,
      pgid: 900,
      pid: 900,
      ppid: 1,
    })}`;
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processRunner: processRunner(foreign),
        publicStop: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROFILE_PROCESS_AMBIGUOUS" });
    expect(killProcess).not.toHaveBeenCalled();
    expect(
      (await lstat(path.join(fixture.profile, "SingletonLock"))).isFile(),
    ).toBe(true);
  });

  it("retains artifacts while a profile lock remains after process drain", async () => {
    const fixture = await generationFixture({ state: false });
    await writeFile(path.join(fixture.profile, "SingletonLock"), "locked\n");
    await expect(
      terminateLeasedBrowserGeneration(fixture.lease, {
        gracefulMs: 0,
        killMs: 0,
        pollMs: 0,
        processRunner: processRunner(""),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_RETIREMENT_FAILED" });
    await expect(
      retireLeasedBrowserArtifacts(fixture.lease, {
        processRunner: processRunner(""),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_ARTIFACTS_PROCESS_ACTIVE" });
    expect((await lstat(fixture.lease.generationRoot)).isDirectory()).toBe(
      true,
    );
  });

  it("rejects symlink drift at every browser directory ancestor before marker writes", async () => {
    for (const selector of [
      ({ runRoot }) => path.join(runRoot, "browser"),
      ({ runRoot }) => path.join(runRoot, "browser", "gm"),
      ({ runRoot }) => path.join(runRoot, "browser", "gm", "generations"),
      ({ lease }) => lease.generationRoot,
      ({ lease }) => lease.profile,
    ]) {
      const fixture = await generationFixture({ markers: false, state: false });
      await replaceDirectoryWithSymlink(selector(fixture));
      await expect(
        writeBrowserGenerationMarkers(fixture.lease),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/DIRECTORY/),
      });
    }
  });

  it("rejects symlink/canonical drift before marker reads and every recursive removal", async () => {
    const readDrift = await generationFixture();
    await replaceDirectoryWithSymlink(readDrift.lease.profile);
    await expect(
      inspectLeasedBrowserGeneration(readDrift.lease, {
        processRunner: processRunner(""),
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/DIRECTORY/) });

    const generationDrift = await generationFixture({ state: false });
    await replaceDirectoryWithSymlink(generationDrift.lease.generationRoot);
    await expect(
      retireLeasedBrowserArtifacts(
        { ...generationDrift.lease, status: "retiring" },
        { processRunner: processRunner("") },
      ),
    ).rejects.toMatchObject({ code: expect.stringMatching(/DIRECTORY/) });

    const profileDrift = await generationFixture({ state: false });
    await replaceDirectoryWithSymlink(profileDrift.lease.profile);
    await expect(
      retireLeasedBrowserProfile(
        [{ ...profileDrift.lease, status: "retiring" }],
        { processRunner: processRunner("") },
      ),
    ).rejects.toMatchObject({ code: expect.stringMatching(/DIRECTORY/) });

    const runDrift = await generationFixture({ state: false });
    await replaceDirectoryWithSymlink(path.join(runDrift.runRoot, "browser"));
    await expect(
      retireLeasedBrowserRunArtifacts([runDrift.lease], {
        processRunner: processRunner(""),
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/DIRECTORY/) });

    const executableDrift = await generationFixture({ state: false });
    await rename(
      executableDrift.executable,
      `${executableDrift.executable}.original`,
    );
    await writeFile(executableDrift.executable, "replacement\n", {
      mode: 0o700,
    });
    await expect(
      inspectLeasedBrowserGeneration(executableDrift.lease, {
        processRunner: processRunner(""),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_LEASE_EXTERNAL_PATH_DRIFT" });
  });

  it("fails closed when state or ownership markers are absent or unsafe", async () => {
    const missingState = await generationFixture({ state: false });
    await expect(
      captureBrowserGenerationIdentity(missingState.lease, {
        processRunner: processRunner(missingState.output()),
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/BROWSER_STATE/) });

    const missingMarker = await generationFixture();
    await rm(missingMarker.lease.profileMarker);
    await expect(
      inspectLeasedBrowserGeneration(missingMarker.lease, {
        processRunner: processRunner(missingMarker.output()),
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/MARKER/) });

    const unsafe = await generationFixture();
    await chmod(unsafe.lease.profileMarker, 0o644);
    await expect(
      inspectLeasedBrowserGeneration(unsafe.lease, {
        processRunner: processRunner(unsafe.output()),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROFILE_MARKER_UNSAFE" });
  });

  it("is idempotent when the exact generation is already stopped", async () => {
    const { lease } = await generationFixture({ state: false });
    await expect(
      terminateLeasedBrowserGeneration(lease, {
        processRunner: processRunner(""),
      }),
    ).resolves.toMatchObject({ alreadyStopped: true, escalated: false });
  });

  it("prefers the exact public stop and avoids signals when the leased daemon drains", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let alive = true;
    const publicStop = vi.fn(async () => {
      alive = false;
      await rm(fixture.lease.stateFile);
    });
    const killProcess = vi.fn();
    const result = await terminateLeasedBrowserGeneration(activeLease, {
      gracefulMs: 0,
      killProcess,
      pollMs: 0,
      processRunner: vi.fn(async () =>
        processResult(alive ? fixture.output() : ""),
      ),
      publicStop,
      wait: async () => undefined,
    });
    expect(result).toMatchObject({ escalated: false, termCount: 0 });
    expect(publicStop).toHaveBeenCalledOnce();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("accepts state removal only after the exact bound public stop begins", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let stopped = false;
    const publicStop = vi.fn(async () => {
      stopped = true;
      await rm(fixture.lease.stateFile);
    });
    const result = await terminateLeasedBrowserGeneration(activeLease, {
      gracefulMs: 0,
      processRunner: vi.fn(async () =>
        processResult(stopped ? "" : fixture.output()),
      ),
      publicStop,
      wait: async () => undefined,
    });
    expect(result).toMatchObject({ escalated: false, termCount: 0 });
    expect(publicStop).toHaveBeenCalledOnce();
  });

  it("fails closed when state disappears before the bound public stop begins", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let removed = false;
    const runner = vi.fn(async () => {
      if (!removed) {
        removed = true;
        await rm(fixture.lease.stateFile);
      }
      return processResult(fixture.output());
    });
    const publicStop = vi.fn();
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processRunner: runner,
        publicStop,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_UNSAFE" });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("rejects state reappearance after observed public-stop removal", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let stopped = false;
    let restored = false;
    const publicStop = vi.fn(async () => {
      stopped = true;
      await rm(fixture.lease.stateFile);
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: vi.fn(async () => processResult(fixture.output())),
        publicStop,
        wait: async () => {
          if (!stopped || restored) return;
          restored = true;
          await writeFile(
            fixture.lease.stateFile,
            `${JSON.stringify({ pid: 100, port: 9401, serverPath: fixture.daemonServerPath, startedAt: STATE_START, token: "redirected-control" })}\n`,
            { mode: 0o600 },
          );
          await utimes(
            fixture.lease.stateFile,
            new Date(STATE_START),
            new Date(STATE_START),
          );
        },
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_REAPPEARED" });
    expect(publicStop).toHaveBeenCalledOnce();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("treats crash-before-stop, intent-only, and interrupted-stop missing state as no-signal ambiguity", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        processRunner: processRunner(fixture.output()),
        publicStop: vi.fn(async () => {
          await rm(fixture.lease.stateFile);
          throw new Error("simulated stop interruption");
        }),
      }),
    ).rejects.toThrow("simulated stop interruption");

    const publicStop = vi.fn();
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 0,
        killProcess,
        pollMs: 0,
        processRunner: processRunner(fixture.output()),
        publicStop,
        termMs: 0,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_AUTHORITY_MISSING" });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();

    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processRunner: processRunner(""),
        publicStop,
      }),
    ).resolves.toMatchObject({ alreadyStopped: true });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("allows a fresh missing-state recovery only to observe bounded natural drain", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "retiring" };
    await rm(fixture.lease.stateFile);
    const killProcess = vi.fn();
    const publicStop = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: queuedProcessRunner(
          processResult(fixture.output()),
          processResult(""),
        ),
        publicStop,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({
      alreadyStopped: false,
      escalated: false,
      termCount: 0,
    });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("keeps exact process signaling and lock gates after public-stop state removal", async () => {
    const processFixture = await generationFixture();
    const processIdentity = await captureBrowserGenerationIdentity(
      processFixture.lease,
      { processRunner: processRunner(processFixture.output()) },
    );
    const processLease = {
      ...processFixture.lease,
      identity: processIdentity,
      status: "active",
    };
    let processAlive = true;
    const signals = [];
    await expect(
      terminateLeasedBrowserGeneration(processLease, {
        gracefulMs: 0,
        killProcess: (pid, signal) => {
          signals.push([pid, signal]);
          if (signal === "SIGTERM") processAlive = false;
        },
        pollMs: 0,
        processRunner: vi.fn(async () =>
          processResult(processAlive ? processFixture.output() : ""),
        ),
        publicStop: vi.fn(async () => {
          await rm(processFixture.lease.stateFile);
        }),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 1 });
    expect(signals).toEqual([[102, "SIGTERM"]]);

    const lockFixture = await generationFixture();
    const lockIdentity = await captureBrowserGenerationIdentity(
      lockFixture.lease,
      { processRunner: processRunner(lockFixture.output()) },
    );
    const lockLease = {
      ...lockFixture.lease,
      identity: lockIdentity,
      status: "active",
    };
    await writeFile(
      path.join(lockFixture.profile, "SingletonLock"),
      "locked\n",
    );
    let lockStopStarted = false;
    await expect(
      terminateLeasedBrowserGeneration(lockLease, {
        gracefulMs: 0,
        killMs: 0,
        pollMs: 0,
        processRunner: vi.fn(async () =>
          processResult(lockStopStarted ? "" : lockFixture.output()),
        ),
        publicStop: vi.fn(async () => {
          lockStopStarted = true;
          await rm(lockFixture.lease.stateFile);
        }),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_RETIREMENT_FAILED" });
    expect(
      (await lstat(path.join(lockFixture.profile, "SingletonLock"))).isFile(),
    ).toBe(true);
    await rm(path.join(lockFixture.profile, "SingletonLock"));
    await expect(
      terminateLeasedBrowserGeneration(lockLease, {
        processRunner: processRunner(""),
      }),
    ).resolves.toMatchObject({ alreadyStopped: true });
  });

  it("waits for an exact first-seen terminal process to reap without control or signals", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminalDaemon = processLine({
      command: "<defunct>",
      pgid: 100,
      pid: 100,
      ppid: 1,
      state: "Z",
    });
    const runner = queuedProcessRunner(
      processResult(terminalDaemon),
      processResult(""),
      processResult(""),
      processResult(""),
      processResult(""),
    );
    const publicStop = vi.fn();
    const killProcess = vi.fn();

    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        firstSeenTerminalMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: runner,
        publicStop,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("fails closed when an exact first-seen terminal process persists", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    const publicStop = vi.fn();
    const killProcess = vi.fn();

    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        firstSeenTerminalMs: 0,
        killProcess,
        pollMs: 0,
        processRunner: processRunner(terminal),
        publicStop,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_FIRST_SEEN_TERMINAL_PERSISTED" });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("rejects a first-seen terminal process that returns live", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    const liveAgain = processLine({
      command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
      pgid: 101,
      pid: 102,
      ppid: 101,
    });
    const publicStop = vi.fn();
    const killProcess = vi.fn();

    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        firstSeenTerminalMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: queuedProcessRunner(
          processResult(terminal),
          processResult(liveAgain),
        ),
        publicStop,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_TERMINAL_REVERSAL" });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("rejects mismatched first-seen terminal identities and PID reuse", async () => {
    const cases = [
      {
        output: processLine({
          command: "<defunct>",
          pgid: 101,
          pid: 102,
          ppid: 999,
          state: "Z",
        }),
      },
      {
        output: processLine({
          command: "<defunct>",
          pgid: 999,
          pid: 102,
          ppid: 101,
          state: "Z",
        }),
      },
      {
        output: processLine({
          command: "<defunct>",
          pgid: 101,
          pid: 102,
          ppid: 101,
          startTime: "Mon Aug 17 01:21:29 2026",
          state: "Z",
        }),
      },
      {
        output: processLine({
          command: "not-defunct",
          pgid: 101,
          pid: 102,
          ppid: 101,
          state: "Z",
        }),
      },
      {
        removeExpectedBirth: true,
        output: processLine({
          command: "<defunct>",
          pgid: 101,
          pid: 102,
          ppid: 101,
          state: "Z",
        }),
      },
      {
        output: processLine({
          command: "/opt/other-live-process",
          pgid: 101,
          pid: 102,
          ppid: 101,
          state: "S",
        }),
      },
      {
        identities: {
          102: {
            birthIdentity: "test:reused",
            pgid: 101,
            pid: 102,
            ppid: 101,
            status: "S",
          },
        },
        output: processLine({
          command: `/opt/chrome/Helper --user-data-dir=PROFILE`,
          pgid: 101,
          pid: 102,
          ppid: 101,
          state: "S",
        }),
        replaceProfile: true,
      },
    ];

    for (const candidate of cases) {
      const fixture = await generationFixture();
      const identity = await captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(fixture.output()),
      });
      const authorityIdentity = candidate.removeExpectedBirth
        ? {
            ...identity,
            processes: identity.processes.map((process) =>
              process.pid === 102
                ? { ...process, birthIdentity: null }
                : process,
            ),
          }
        : identity;
      const activeLease = {
        ...fixture.lease,
        identity: authorityIdentity,
        status: "active",
      };
      const output = candidate.replaceProfile
        ? candidate.output.replace("PROFILE", fixture.profile)
        : candidate.output;
      const publicStop = vi.fn();
      const killProcess = vi.fn();
      await expect(
        terminateLeasedBrowserGeneration(activeLease, {
          killProcess,
          processRunner: processRunner(output, candidate.identities),
          publicStop,
        }),
      ).rejects.toMatchObject({ code: "BROWSER_PROCESS_IDENTITY_DRIFT" });
      expect(publicStop).not.toHaveBeenCalled();
      expect(killProcess).not.toHaveBeenCalled();
    }
  });

  it("waits for a first-seen terminal child before controlling the remaining live tree", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const daemonAndChrome = fixture.output().split("\n").slice(0, 2).join("\n");
    const mixed = `${daemonAndChrome}\n${processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    })}`;
    let terminalReaped = false;
    let stopped = false;
    const runner = vi.fn(async () => {
      if (stopped) return processResult("");
      if (!terminalReaped) {
        terminalReaped = true;
        return processResult(mixed);
      }
      return processResult(daemonAndChrome);
    });
    const publicStop = vi.fn(async () => {
      expect(terminalReaped).toBe(true);
      stopped = true;
      await rm(fixture.lease.stateFile);
    });
    const killProcess = vi.fn();

    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        firstSeenTerminalMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: runner,
        publicStop,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(publicStop).toHaveBeenCalledOnce();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("accepts only the observed macOS Z/<defunct> continuation after bound public stop", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    let stopped = false;
    let terminalObserved = false;
    const runner = vi.fn(async () => {
      if (!stopped) return processResult(fixture.output());
      if (!terminalObserved) {
        terminalObserved = true;
        return processResult(terminal);
      }
      return processResult("");
    });
    const publicStop = vi.fn(async () => {
      stopped = true;
      await rm(fixture.lease.stateFile);
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: runner,
        publicStop,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(publicStop).toHaveBeenCalledOnce();
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("resamples a torn live row to a terminal continuation without signaling it", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const staleLive = processLine({
      command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
      pgid: 101,
      pid: 102,
      ppid: 101,
    });
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    let stopped = false;
    const runner = queuedProcessRunner(
      processResult(fixture.output()),
      processResultWithoutIdentity(staleLive, [102]),
      processResult(terminal),
      processResult(""),
    );
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 10,
        killProcess,
        pollMs: 0,
        processPlatform: "darwin",
        processRunner: runner,
        publicStop: vi.fn(async () => {
          stopped = true;
          await rm(fixture.lease.stateFile);
        }),
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(stopped).toBe(true);
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("never signals from a stale live row when exact resampling proves the PID gone", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const staleLive = processLine({
      command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
      pgid: 101,
      pid: 102,
      ppid: 101,
    });
    const runner = queuedProcessRunner(
      processResult(fixture.output()),
      processResultWithoutIdentity(staleLive, [102]),
      { code: 1, processIdentities: {}, stderr: "", stdout: "" },
    );
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 0,
        killMs: 0,
        killProcess,
        pollMs: 0,
        processPlatform: "darwin",
        processRunner: runner,
        publicStop: vi.fn(async () => {
          await rm(fixture.lease.stateFile);
        }),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("fails closed on a different birth after torn-row exact resampling", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "retiring" };
    await rm(fixture.lease.stateFile);
    const reused = processLine({
      command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
      pgid: 101,
      pid: 102,
      ppid: 101,
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processPlatform: "darwin",
        processRunner: queuedProcessRunner(
          processResultWithoutIdentity(reused, [102]),
          processResult(reused, {
            102: { birthIdentity: "darwin:102:reused" },
          }),
        ),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_IDENTITY_DRIFT" });
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("never signals a terminal process and retains recovery state until it is reaped", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    let stopped = false;
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 0,
        killMs: 0,
        killProcess,
        pollMs: 0,
        processRunner: vi.fn(async () =>
          processResult(stopped ? terminal : fixture.output()),
        ),
        publicStop: vi.fn(async () => {
          stopped = true;
          await rm(fixture.lease.stateFile);
        }),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_RETIREMENT_FAILED" });
    expect(killProcess).not.toHaveBeenCalled();
    expect((await lstat(fixture.lease.generationRoot)).isDirectory()).toBe(
      true,
    );
  });

  it("does not signal when a live process becomes terminal during the immediate signal recheck", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const liveChild = processLine({
      command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
      pgid: 101,
      pid: 102,
      ppid: 101,
    });
    const terminalChild = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    let stopped = false;
    let reads = 0;
    const runner = vi.fn(async () => {
      if (!stopped) return processResult(fixture.output());
      reads += 1;
      if (reads === 1) return processResult(liveChild);
      if (reads === 2) return processResult(terminalChild);
      return processResult("");
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        gracefulMs: 0,
        killProcess,
        pollMs: 0,
        processRunner: runner,
        publicStop: vi.fn(async () => {
          stopped = true;
          await rm(fixture.lease.stateFile);
        }),
        termMs: 10,
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ escalated: false, termCount: 0 });
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("rejects live command drift and exact-second PID reuse after stop begins", async () => {
    for (const replacement of [
      () => ({
        output: processLine({
          command: "/opt/other/live-process",
          pgid: 101,
          pid: 102,
          ppid: 101,
        }),
      }),
      ({ fixture }) => ({
        identities: {
          102: {
            birthIdentity: "test:replacement-birth",
            pgid: 101,
            pid: 102,
            ppid: 101,
            status: "S",
          },
        },
        output: processLine({
          command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
          pgid: 101,
          pid: 102,
          ppid: 101,
        }),
      }),
      ({ fixture }) => ({
        identities: {
          102: {
            birthIdentity: `test:102:${START}`,
            pgid: 101,
            pid: 102,
            ppid: 101,
            status: "S",
          },
        },
        output: processLine({
          command: `/opt/chrome/Helper --user-data-dir=${fixture.profile}`,
          pgid: 101,
          pid: 102,
          ppid: 101,
          startTime: "Mon Aug 17 01:21:29 2026",
        }),
      }),
    ]) {
      const fixture = await generationFixture();
      const identity = await captureBrowserGenerationIdentity(fixture.lease, {
        processRunner: processRunner(fixture.output()),
      });
      const activeLease = { ...fixture.lease, identity, status: "active" };
      const changed = replacement({ fixture });
      let stopped = false;
      const killProcess = vi.fn();
      await expect(
        terminateLeasedBrowserGeneration(activeLease, {
          killProcess,
          processRunner: vi.fn(async () =>
            stopped
              ? processResult(changed.output, changed.identities)
              : processResult(fixture.output()),
          ),
          publicStop: vi.fn(async () => {
            stopped = true;
          }),
        }),
      ).rejects.toMatchObject({ code: "BROWSER_PROCESS_IDENTITY_DRIFT" });
      expect(killProcess).not.toHaveBeenCalled();
    }
  });

  it("reports only secret-safe comparison facts for a rejected terminal candidate", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    const terminalWithWrongParent = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 999,
      state: "Z",
    });
    let stopped = false;
    let failure;
    try {
      await terminateLeasedBrowserGeneration(activeLease, {
        processRunner: vi.fn(async () =>
          processResult(stopped ? terminalWithWrongParent : fixture.output()),
        ),
        publicStop: vi.fn(async () => {
          stopped = true;
        }),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "BROWSER_PROCESS_IDENTITY_DRIFT",
      details: {
        identity: {
          birthIdentityMatch: false,
          commandHashMatch: false,
          currentState: "Z",
          currentTerminal: true,
          pgidMatch: true,
          ppidMatch: false,
          startTimeMatch: true,
        },
        pid: 102,
        role: "gm",
        shutdownPhase: "live",
        terminal: {
          birthIdentityMissing: true,
          commandIsDefunct: true,
          pgidMatch: true,
          ppidMatch: false,
          startTimeMatch: true,
          stateIsTerminal: true,
        },
      },
    });
    expect(JSON.stringify(failure.details)).not.toContain("control-a");
    expect(JSON.stringify(failure.details)).not.toContain(
      fixture.daemonServerPath,
    );
    expect(collectBrowserProcessIdentityDrifts(failure)).toEqual([
      {
        identity: {
          birthIdentityMatch: false,
          commandHashMatch: false,
          currentBirthIdentityHash: null,
          currentCommandHash: failure.details.identity.currentCommandHash,
          currentPresent: true,
          currentState: "Z",
          currentTerminal: true,
          expectedBirthIdentityHash:
            failure.details.identity.expectedBirthIdentityHash,
          expectedCommandHash: failure.details.identity.expectedCommandHash,
          pgidMatch: true,
          ppidMatch: false,
          startTimeMatch: true,
        },
        pid: 102,
        role: "gm",
        shutdownPhase: "live",
        terminal: {
          birthIdentityMissing: true,
          commandIsDefunct: true,
          pgidMatch: true,
          ppidMatch: false,
          startTimeMatch: true,
          stateIsTerminal: true,
        },
      },
    ]);
  });

  it("rejects fabricated drift diagnostics even when secrets look like valid hashes and labels", () => {
    const drift = {
      code: "BROWSER_PROCESS_IDENTITY_DRIFT",
      details: {
        identity: {
          birthIdentityMatch: true,
          currentCommandHash: "a".repeat(64),
          currentState: "topsecret",
        },
        pid: 123,
        role: "player",
        shutdownPhase: "accessToken",
      },
    };
    const nested = new AggregateError([drift], "outer top-secret");
    expect(collectBrowserProcessIdentityDrifts(nested)).toEqual([]);
  });

  it("rejects disappearance followed by PID reappearance during one shutdown", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let stopped = false;
    let postStopReads = 0;
    const runner = vi.fn(async () => {
      if (!stopped) return processResult(fixture.output());
      postStopReads += 1;
      return processResult(postStopReads === 1 ? "" : fixture.output());
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processRunner: runner,
        publicStop: vi.fn(async () => {
          stopped = true;
        }),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_PROCESS_REAPPEARED" });
    expect(killProcess).not.toHaveBeenCalled();
  });

  it("allows a fresh recovery to observe an exact first-seen terminal reap without signaling", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "retiring" };
    await rm(fixture.lease.stateFile);
    const terminal = processLine({
      command: "<defunct>",
      pgid: 101,
      pid: 102,
      ppid: 101,
      state: "Z",
    });
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        firstSeenTerminalMs: 10,
        killProcess,
        pollMs: 0,
        processRunner: queuedProcessRunner(
          processResult(terminal),
          processResult(""),
          processResult(""),
        ),
        wait: async () => undefined,
      }),
    ).resolves.toMatchObject({ alreadyStopped: true, termCount: 0 });
    expect(killProcess).not.toHaveBeenCalled();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        processRunner: processRunner(""),
      }),
    ).resolves.toMatchObject({ alreadyStopped: true });
  });

  it("rejects redirected control state immediately before durable public stop", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    await writeFile(
      fixture.lease.stateFile,
      `${JSON.stringify({ pid: 100, port: 9401, serverPath: fixture.daemonServerPath, startedAt: STATE_START, token: "control-b" })}\n`,
      { mode: 0o600 },
    );
    await utimes(
      fixture.lease.stateFile,
      new Date(STATE_START),
      new Date(STATE_START),
    );
    const publicStop = vi.fn();
    const killProcess = vi.fn();
    await expect(
      terminateLeasedBrowserGeneration(activeLease, {
        killProcess,
        processRunner: processRunner(fixture.output()),
        publicStop,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_CONTROL_IDENTITY_DRIFT" });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).not.toHaveBeenCalled();
    expect((await lstat(fixture.lease.generationRoot)).isDirectory()).toBe(
      true,
    );
  });

  it("skips public stop for planned recovery and signals only the newly bound tree", async () => {
    const fixture = await generationFixture();
    let alive = true;
    const publicStop = vi.fn();
    const calls = [];
    const result = await terminateLeasedBrowserGeneration(fixture.lease, {
      gracefulMs: 0,
      killProcess: (_pid, signal) => {
        calls.push(signal);
        if (signal === "SIGTERM") alive = false;
      },
      pollMs: 0,
      processRunner: vi.fn(async () =>
        processResult(alive ? fixture.output() : ""),
      ),
      publicStop,
      termMs: 0,
      wait: async () => undefined,
    });
    expect(result).toMatchObject({ alreadyStopped: false, escalated: false });
    expect(publicStop).not.toHaveBeenCalled();
    expect(calls).toEqual(["SIGTERM"]);
  });

  it("accepts planned-recovery state unlink only after an exact owned signal is delivered", async () => {
    const fixture = await generationFixture();
    let signaled = false;
    let stateRemoved = false;
    const publicStop = vi.fn();
    const killProcess = vi.fn((_pid, signal) => {
      if (signal === "SIGTERM") signaled = true;
    });
    const result = await terminateLeasedBrowserGeneration(fixture.lease, {
      gracefulMs: 0,
      killProcess,
      pollMs: 0,
      processRunner: vi.fn(async () => {
        if (signaled && !stateRemoved) {
          stateRemoved = true;
          await rm(fixture.lease.stateFile);
        }
        return processResult(signaled ? "" : fixture.output());
      }),
      publicStop,
      termMs: 0,
      wait: async () => undefined,
    });
    expect(result).toMatchObject({
      alreadyStopped: false,
      escalated: false,
      termCount: 1,
    });
    expect(publicStop).not.toHaveBeenCalled();
    expect(killProcess).toHaveBeenCalledWith(102, "SIGTERM");
  });

  it("does not authorize planned-recovery state loss when the owned signal was not delivered", async () => {
    const fixture = await generationFixture();
    let signalAttempted = false;
    let stateRemoved = false;
    const killProcess = vi.fn(() => {
      signalAttempted = true;
      const error = new Error("already absent");
      error.code = "ESRCH";
      throw error;
    });
    await expect(
      terminateLeasedBrowserGeneration(fixture.lease, {
        gracefulMs: 0,
        killProcess,
        pollMs: 0,
        processRunner: vi.fn(async () => {
          if (signalAttempted && !stateRemoved) {
            stateRemoved = true;
            await rm(fixture.lease.stateFile);
          }
          return processResult(signalAttempted ? "" : fixture.output());
        }),
        publicStop: vi.fn(),
        termMs: 0,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_STATE_UNSAFE" });
    expect(killProcess).toHaveBeenCalled();
  });

  it("uses exact public stop, then TERM, and drains a surviving Chrome child", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let alive = true;
    const calls = [];
    const runner = vi.fn(async () =>
      processResult(
        alive
          ? processLine({
              command: `${fixture.executable} --user-data-dir=${fixture.profile} about:blank`,
              pgid: 101,
              pid: 101,
              ppid: 100,
            })
          : "",
      ),
    );
    const publicStop = vi.fn();
    const result = await terminateLeasedBrowserGeneration(activeLease, {
      gracefulMs: 0,
      killProcess: (pid, signal) => {
        calls.push([pid, signal]);
        if (signal === "SIGTERM") alive = false;
      },
      pollMs: 0,
      processRunner: runner,
      publicStop,
      termMs: 0,
      wait: async () => undefined,
    });
    expect(result).toMatchObject({ escalated: false, termCount: 1 });
    expect(calls).toEqual([[101, "SIGTERM"]]);
    expect(publicStop).not.toHaveBeenCalled();
  });

  it("escalates only the still-matched exact process to KILL", async () => {
    const fixture = await generationFixture();
    const identity = await captureBrowserGenerationIdentity(fixture.lease, {
      processRunner: processRunner(fixture.output()),
    });
    const activeLease = { ...fixture.lease, identity, status: "active" };
    let alive = true;
    const calls = [];
    const runner = vi.fn(async () =>
      processResult(
        alive
          ? processLine({
              command: `${fixture.executable} --user-data-dir=${fixture.profile} about:blank`,
              pgid: 101,
              pid: 101,
              ppid: 100,
            })
          : "",
      ),
    );
    const result = await terminateLeasedBrowserGeneration(activeLease, {
      gracefulMs: 0,
      killMs: 0,
      killProcess: (_pid, signal) => {
        calls.push(signal);
        if (signal === "SIGKILL") alive = false;
      },
      pollMs: 0,
      processRunner: runner,
      publicStop: vi.fn(),
      termMs: 0,
      wait: async () => undefined,
    });
    expect(result.escalated).toBe(true);
    expect(calls).toEqual(["SIGTERM", "SIGKILL"]);
  });
});
