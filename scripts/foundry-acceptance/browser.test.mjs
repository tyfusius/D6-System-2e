import { EventEmitter } from "node:events";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  BrowserRoleSession,
  authenticateBrowserSession,
  buildFoundryReadyExpression,
  buildJoinUserDiscoveryExpression,
  cookieFromSetCookie,
  enterFoundryRole,
  findOwnedChromiumProcesses,
  foundryRoute,
  requestFoundrySession,
  resolveGmJoinUser,
  resolveGStackWelcomeTab,
  runProcess,
} from "./browser.mjs";
import { AcceptanceError } from "./core.mjs";

const TEST_CHROMIUM = "/opt/chromium";

function stoppedObservation(overrides = {}) {
  return {
    locks: [],
    processes: [],
    stateFilePresent: false,
    ...overrides,
  };
}

function browserRoleSession(options) {
  const generationLeaseHooks = {
    retireArtifacts: async (spec) => {
      await rm(spec.generationRoot, { force: true, recursive: true });
      return { alreadyStopped: false };
    },
    ...options.generationLeaseHooks,
  };
  return new BrowserRoleSession({
    chromiumExecutable: TEST_CHROMIUM,
    profileInspector: async () => stoppedObservation(),
    ...options,
    generationLeaseHooks,
  });
}

describe("Foundry join GM resolution", () => {
  it("resolves an exact configured privileged user", () => {
    expect(
      resolveGmJoinUser(
        [{ id: "gm-id", name: "Acceptance GM" }],
        "Acceptance GM",
      ),
    ).toMatchObject({ id: "gm-id", name: "Acceptance GM" });
  });

  it("accepts the public join autocomplete identifier/label shape", () => {
    expect(
      resolveGmJoinUser(
        [{ identifier: "gm-id", label: "Gamemaster" }],
        "Gamemaster",
      ),
    ).toMatchObject({ id: "gm-id", name: "Gamemaster" });
  });

  it("resolves one Foundry-generated alternate default only for the default expectation", () => {
    expect(
      resolveGmJoinUser([{ id: "gm-id", name: "Gamemaster1" }], "Gamemaster"),
    ).toMatchObject({ id: "gm-id", name: "Gamemaster1" });
    expect(() =>
      resolveGmJoinUser(
        [{ id: "gm-id", name: "Gamemaster1" }],
        "Configured GM",
      ),
    ).toThrow(/Configured Foundry GM Configured GM is absent/);
  });

  it("rejects absent and ambiguous configured users", () => {
    expect(() => resolveGmJoinUser([], "Gamemaster")).toThrow(
      /is absent from the join data/,
    );
    expect(() =>
      resolveGmJoinUser(
        [
          { id: "gm-1", name: "Gamemaster1" },
          { id: "gm-2", name: "Gamemaster2" },
        ],
        "Gamemaster",
      ),
    ).toThrow(/Multiple Foundry-generated Gamemaster users/);
  });

  it("discovers IDs only from the rendered v14 join autocomplete", () => {
    const source = buildJoinUserDiscoveryExpression();
    expect(source).toContain('input[name="username"]#join-username');
    expect(source).toContain("#autocomplete li");
    expect(source).toContain("entry.dataset.identifier");
    expect(source).toContain('"disabled" in entry.dataset');
    expect(source).not.toContain("globalThis.game");
  });
});

describe("role-separated browser sessions", () => {
  it("resolves exactly one public loopback GStack welcome tab", () => {
    expect(
      resolveGStackWelcomeTab(
        "  [1] GStack Browser — http://127.0.0.1:34567/welcome\n→ [2] (untitled) — about:blank",
      ),
    ).toEqual({ id: 1, url: "http://127.0.0.1:34567/welcome" });
    expect(() =>
      resolveGStackWelcomeTab(
        "[1] Other — http://example.test/welcome\n[2] Other — about:blank",
      ),
    ).toThrow(/exactly one public loopback welcome tab/);
    expect(() =>
      resolveGStackWelcomeTab(
        "[1] One — http://127.0.0.1:1/welcome\n[2] Two — http://127.0.0.1:2/welcome",
      ),
    ).toThrow(/exactly one public loopback welcome tab/);
  });

  it("retires only the exact public GStack welcome tab before Foundry navigation", async () => {
    const session = browserRoleSession({
      binary: "/opt/browse",
      role: "gm",
      runRoot: "/tmp/browser-role",
    });
    session.currentUrl = vi.fn(async () => "about:blank");
    session.consoleSnapshot = vi.fn(async () => "startup diagnostics");
    session.networkSnapshot = vi.fn(async () => "startup network");
    session.command = vi.fn(async (name, args = []) => {
      if (name === "tabs" && session.command.mock.calls.length === 1) {
        return "  [7] GStack Browser — http://127.0.0.1:34567/welcome\n→ [8] (untitled) — about:blank";
      }
      if (name === "closetab") {
        expect(args).toEqual(["7"]);
        return "Closed tab 7";
      }
      if (name === "tabs") return "→ [8] (untitled) — about:blank";
      throw new Error(`unexpected command ${name}`);
    });
    await expect(session.retireGStackWelcomeTab()).resolves.toMatchObject({
      currentUrl: "about:blank",
      retired: true,
      welcome: { id: 7, url: "http://127.0.0.1:34567/welcome" },
    });
  });
  it("assigns each role an isolated state file and Chromium profile", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "ok" }));
    const gm = browserRoleSession({
      binary: "/opt/browse",
      role: "gm",
      runRoot: root,
      runner,
    });
    const player = browserRoleSession({
      binary: "/opt/browse",
      role: "player",
      runRoot: root,
      runner,
    });
    await gm.start();
    await player.start();
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ["newtab"],
      ["newtab"],
    ]);
    expect(gm.stateFile).not.toBe(player.stateFile);
    expect(gm.profile).not.toBe(player.profile);
    expect(runner.mock.calls[0][2].env.BROWSE_STATE_FILE).toBe(gm.stateFile);
    expect(runner.mock.calls[0][2].env.CHROMIUM_PROFILE).toBe(gm.profile);
    expect(runner.mock.calls[1][2].env.BROWSE_STATE_FILE).toBe(
      player.stateFile,
    );
    expect(runner.mock.calls[1][2].env.CHROMIUM_PROFILE).toBe(player.profile);
  });

  it("durably plans and captures a generation around public startup, then journals retirement around artifact removal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const events = [];
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        afterRetire: async () => events.push("retired"),
        afterStart: async () => events.push("captured"),
        beforeRetire: async () => {
          events.push("retiring");
          expect(
            await access(session.generation.generationRoot),
          ).toBeUndefined();
        },
        retireArtifacts: async () => {
          events.push("lease-retire");
          await rm(session.generation.generationRoot, {
            force: true,
            recursive: true,
          });
        },
        beforeStart: async () => events.push("planned"),
      },
      role: "gm",
      runRoot: root,
      runner: vi.fn(async (_command, args) => {
        events.push(args[0]);
        return { code: 0, stderr: "", stdout: "ok" };
      }),
    });
    await session.start();
    await session.stop();
    expect(events).toEqual([
      "planned",
      "newtab",
      "captured",
      "retiring",
      "lease-retire",
      "retired",
    ]);
    await expect(
      access(session.generation.generationRoot),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("never directly removes a leased generation when durable retirement rejects a symlink swap", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    let movedRoot;
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        afterStart: async () => undefined,
        beforeRetire: async () => {
          movedRoot = `${session.generation.generationRoot}-owned`;
          await rename(session.generation.generationRoot, movedRoot);
          await symlink(movedRoot, session.generation.generationRoot);
        },
        beforeStart: async () => undefined,
        retireArtifacts: async () => {
          throw new AcceptanceError(
            "BROWSER_LEASE_DIRECTORY_UNSAFE",
            "simulated durable symlink rejection",
          );
        },
      },
      role: "gm",
      runRoot: root,
      runner: vi.fn(async () => ({ code: 0, stderr: "", stdout: "ok" })),
    });
    await session.start();
    await expect(session.stop()).rejects.toMatchObject({
      code: "BROWSER_LEASE_DIRECTORY_UNSAFE",
    });
    expect(session.runner.mock.calls.map(([, args]) => args)).toEqual([
      ["newtab"],
    ]);
    expect(
      (await lstat(session.generation.generationRoot)).isSymbolicLink(),
    ).toBe(true);
    expect((await lstat(movedRoot)).isDirectory()).toBe(true);
  });

  it("propagates a supported newtab startup failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({
      code: 2,
      stderr: "browser startup failed",
      stdout: "",
    }));
    const session = browserRoleSession({
      binary: "/opt/browse",
      role: "gm",
      runRoot: root,
      runner,
    });

    await expect(session.start()).rejects.toMatchObject({
      code: "PROCESS_FAILED",
      details: {
        args: ["newtab"],
        code: 2,
        stderr: "browser startup failed",
      },
    });
  });

  it("retains the exact durable planned lease when marker validation fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const durable = { marker: "durable-planned" };
    const retireArtifacts = vi.fn(async (lease) => {
      expect(lease).toBe(durable);
      await rm(lease.generationRoot, { force: true, recursive: true });
      return { alreadyStopped: true };
    });
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        beforeStart: async (spec, bindPlannedGeneration) => {
          Object.assign(durable, spec);
          bindPlannedGeneration(durable);
          throw new AcceptanceError(
            "BROWSER_PROFILE_MARKER_MISMATCH",
            "simulated reconnect marker mismatch",
          );
        },
        retireArtifacts,
      },
      role: "player",
      runRoot: root,
      runner: vi.fn(),
    });

    await expect(session.start()).rejects.toMatchObject({
      code: "BROWSER_PROFILE_MARKER_MISMATCH",
    });
    expect(session.generation.leaseSpec).toBe(durable);
    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: true,
      attempted: false,
    });
    expect(retireArtifacts).toHaveBeenCalledOnce();
    expect(session.runner).not.toHaveBeenCalled();
  });

  it("rejects a durable lease bound to another generation or profile", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        beforeStart: async (spec, bindPlannedGeneration) =>
          bindPlannedGeneration({
            ...spec,
            generation: spec.generation + 1,
            profile: `${spec.profile}-foreign`,
          }),
      },
      role: "player",
      runRoot: root,
      runner: vi.fn(),
    });

    await expect(session.start()).rejects.toMatchObject({
      code: "BROWSER_GENERATION_LEASE_BINDING_MISMATCH",
    });
    expect(session.runner).not.toHaveBeenCalled();
  });

  it("retains the planned lease when newtab or post-start capture fails", async () => {
    for (const failurePhase of ["newtab", "capture"]) {
      const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
      const events = [];
      const retireArtifacts = vi.fn(async (lease) => {
        events.push(`retire:${lease.generation}`);
        await rm(lease.generationRoot, { force: true, recursive: true });
        return { alreadyStopped: true };
      });
      const runner = vi.fn(async () =>
        failurePhase === "newtab"
          ? { code: 2, stderr: "target creation failed", stdout: "" }
          : { code: 0, stderr: "", stdout: "ok" },
      );
      const session = browserRoleSession({
        binary: "/opt/browse",
        generationLeaseHooks: {
          afterStart: async () => {
            events.push("capture");
            if (failurePhase === "capture") throw new Error("capture failed");
          },
          beforeStart: async (spec, bindPlannedGeneration) => {
            const durable = { ...spec, status: "planned" };
            events.push("journaled");
            bindPlannedGeneration(durable);
            return durable;
          },
          retireArtifacts,
        },
        role: "player",
        runRoot: root,
        runner,
      });

      await expect(session.start()).rejects.toThrow();
      expect(session.generation.leaseSpec.status).toBe("planned");
      await expect(session.stop()).resolves.toEqual({
        alreadyStopped: true,
        attempted: false,
      });
      expect(events[0]).toBe("journaled");
      expect(events.at(-1)).toBe("retire:1");
      expect(retireArtifacts).toHaveBeenCalledOnce();
    }
  });

  it("journals and binds the runner generation before marker validation", async () => {
    const source = await readFile(
      new URL("../run-foundry-acceptance.mjs", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("beforeStart: async");
    const end = source.indexOf("afterStart: async", start);
    const lifecycle = source.slice(start, end);
    expect(lifecycle.indexOf("registerBrowserGeneration")).toBeLessThan(
      lifecycle.indexOf("leasedGenerations.set"),
    );
    expect(lifecycle.indexOf("leasedGenerations.set")).toBeLessThan(
      lifecycle.indexOf("bindPlannedGeneration(generation)"),
    );
    expect(lifecycle.indexOf("bindPlannedGeneration(generation)")).toBeLessThan(
      lifecycle.indexOf("writeBrowserGenerationMarkers"),
    );
    expect(source).toContain("BROWSER_GENERATION_NOT_DURABLY_PLANNED");
  });

  it("waits for the rendered v14 join form before reading its autocomplete", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: '{"users":[]}',
    }));
    const session = browserRoleSession({
      binary: "/opt/browse",
      role: "gm",
      runRoot: root,
      runner,
    });

    await session.discoverJoinUsers();
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ["wait", "#join-username"],
      ["js", buildJoinUserDiscoveryExpression()],
    ]);
  });

  it("uses the public game.ready lifecycle even when the sidebar renders first", async () => {
    let now = 0;
    let polls = 0;
    const game = { ready: false };
    const context = {
      Date: { now: () => now },
      document: { querySelector: () => ({}) },
      game,
      location: { href: "https://example.test/dev/game" },
      setTimeout(resolve, delay) {
        polls += 1;
        now += delay;
        game.ready = true;
        globalThis.queueMicrotask(resolve);
      },
    };
    const source = buildFoundryReadyExpression({
      expectedUrl: "https://example.test/dev/game",
      pollIntervalMs: 10,
      timeoutMs: 100,
    });
    expect(source).not.toMatch(/\bawait\b/);
    const result = await runInNewContext(source, context);
    expect(JSON.parse(result)).toEqual({
      gamePresent: true,
      ready: true,
      reason: "ready",
      shellPresent: true,
    });
    expect(polls).toBe(1);
  });

  it.each([
    [
      "timeout",
      { game: { ready: false }, location: "https://example.test/dev/game" },
    ],
    [
      "missing-game",
      { game: undefined, location: "https://example.test/dev/game" },
    ],
    [
      "navigation",
      { game: { ready: false }, location: "https://other.test/game" },
    ],
  ])("returns structural diagnostics for %s", async (reason, state) => {
    let now = 0;
    const context = {
      Date: { now: () => now },
      document: { querySelector: () => null },
      game: state.game,
      location: { href: state.location },
      setTimeout(resolve, delay) {
        now += delay;
        globalThis.queueMicrotask(resolve);
      },
    };
    const result = await runInNewContext(
      buildFoundryReadyExpression({
        expectedUrl: "https://example.test/dev/game",
        pollIntervalMs: 10,
        timeoutMs: 20,
      }),
      context,
    );
    expect(JSON.parse(result)).toMatchObject({
      gamePresent: Boolean(state.game),
      ready: false,
      reason,
      shellPresent: false,
    });
  });

  it("maps lifecycle timeout diagnostics to a fail-closed acceptance error", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: JSON.stringify({
        gamePresent: true,
        ready: false,
        reason: "timeout",
        shellPresent: true,
      }),
    }));
    const session = browserRoleSession({
      binary: "/opt/browse",
      role: "player",
      runRoot: root,
      runner,
    });
    await expect(
      session.waitForFoundryReady({
        expectedUrl: "https://example.test/dev/game",
        pollIntervalMs: 10,
        timeoutMs: 20,
      }),
    ).rejects.toMatchObject({
      code: "FOUNDRY_READY_TIMEOUT",
      details: {
        gamePresent: true,
        reason: "timeout",
        shellPresent: true,
      },
    });
    expect(runner.mock.calls[0][1][0]).toBe("js");
    expect(runner.mock.calls[0][2].timeoutMs).toBeGreaterThan(20);
  });

  it("aborts only the harness-owned child and escalates it when SIGTERM is ignored", async () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: vi.fn() };
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    child.kill = vi.fn((signal) => {
      if (signal === "SIGKILL") {
        globalThis.queueMicrotask(() => child.emit("close", null));
      }
      return true;
    });
    const controller = new globalThis.AbortController();
    const running = runProcess("owned-child", ["hang"], {
      abortGraceMs: 5,
      signal: controller.signal,
      spawnImpl: vi.fn(() => child),
    });
    controller.abort();
    await expect(running).rejects.toMatchObject({ code: "PROCESS_ABORTED" });
    expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual([
      "SIGTERM",
      "SIGKILL",
    ]);
  });

  it("waits for durable leased shutdown before an immediate reconnect", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    const wait = vi.fn(async () => undefined);
    const retireArtifacts = vi.fn(async (spec) => {
      await wait();
      await rm(spec.generationRoot, { force: true, recursive: true });
      return { alreadyStopped: false };
    });
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: { retireArtifacts },
      role: "player",
      runRoot: root,
      runner,
    });
    await session.start();
    const firstStateFile = session.stateFile;
    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: false,
      attempted: true,
    });
    await session.start();
    expect(session.stateFile).not.toBe(firstStateFile);
    expect(session.profile).toContain("/browser/player/chromium-profile");
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ["newtab"],
      ["newtab"],
    ]);
    expect(runner.mock.calls[0][2].env.BROWSE_STATE_FILE).toBe(firstStateFile);
    expect(runner.mock.calls[1][2].env.BROWSE_STATE_FILE).toBe(
      session.stateFile,
    );
    expect(runner.mock.calls[0][2].env.CHROMIUM_PROFILE).toBe(
      runner.mock.calls[1][2].env.CHROMIUM_PROFILE,
    );
    expect(wait).toHaveBeenCalledTimes(1);
    expect(retireArtifacts).toHaveBeenCalledOnce();
  });

  it("uses a fresh generation instead of a stale legacy state file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const stale = path.join(root, "browser", "gm", ".gstack", "browse.json");
    await mkdir(path.dirname(stale), { recursive: true });
    await writeFile(stale, "stale", "utf8");
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    const session = browserRoleSession({
      binary: "/opt/browse",
      role: "gm",
      runRoot: root,
      runner,
    });
    await session.start();
    expect(session.stateFile).not.toBe(stale);
    expect(session.stateFile).toContain("/generations/0001/browse.json");
    await expect(readFile(stale, "utf8")).resolves.toBe("stale");
  });

  it("fails closed before start while the exact role profile is alive or locked", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn();
    const session = browserRoleSession({
      binary: "/opt/browse",
      profileInspector: async () =>
        stoppedObservation({
          locks: ["SingletonSocket"],
          processes: [{ pid: 201, ppid: 1 }],
        }),
      role: "player",
      runRoot: root,
      runner,
    });
    await expect(session.start()).rejects.toMatchObject({
      code: "BROWSER_PROFILE_BUSY",
      details: {
        lockNames: ["SingletonSocket"],
        processCount: 1,
        role: "player",
      },
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("retains the generation when durable leased shutdown times out", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        retireArtifacts: async () => {
          throw new AcceptanceError(
            "BROWSER_PROCESS_RETIREMENT_FAILED",
            "durable bounded shutdown timed out",
          );
        },
      },
      role: "gm",
      runRoot: root,
      runner,
    });
    await session.start();
    await expect(session.stop()).rejects.toMatchObject({
      code: "BROWSER_PROCESS_RETIREMENT_FAILED",
    });
    await expect(session.stop()).rejects.toMatchObject({
      code: "BROWSER_PROCESS_RETIREMENT_FAILED",
    });
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([["newtab"]]);
    await expect(
      access(session.generation.generationRoot),
    ).resolves.toBeUndefined();
  });

  it("propagates durable public-stop failure once without issuing a legacy stop", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    const retireArtifacts = vi.fn(async () => {
      throw new AcceptanceError(
        "BROWSER_PUBLIC_STOP_FAILED",
        "durable public stop rejected",
      );
    });
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: { retireArtifacts },
      role: "gm",
      runRoot: root,
      runner,
    });
    await session.start();
    await expect(session.stop()).rejects.toMatchObject({
      code: "BROWSER_PUBLIC_STOP_FAILED",
    });
    await expect(session.stop()).rejects.toMatchObject({
      code: "BROWSER_PUBLIC_STOP_FAILED",
    });
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([["newtab"]]);
    expect(retireArtifacts).toHaveBeenCalledOnce();
  });

  it("recovers cleanly from target creation failure only after positive quiescence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        code: 1,
        stderr: "Target.createTarget failed",
        stdout: "",
      })
      .mockResolvedValueOnce({ code: 0, stderr: "", stdout: "ok" });
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: {
        retireArtifacts: async (spec) => {
          await rm(spec.generationRoot, { force: true, recursive: true });
          return { alreadyStopped: true };
        },
      },
      role: "player",
      runRoot: root,
      runner,
    });
    await expect(session.start()).rejects.toMatchObject({
      code: "PROCESS_FAILED",
    });
    const failedStateFile = session.stateFile;
    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: true,
      attempted: false,
    });
    await session.start();
    expect(session.stateFile).not.toBe(failedStateFile);
  });

  it("discovers only the exact executable/profile process tree", () => {
    const profile = "/tmp/d6e2/browser/player/chromium-profile";
    const output = [
      `100 1 ${TEST_CHROMIUM} --user-data-dir=${profile} --remote-debugging-port=1`,
      "101 100 /opt/chromium-helper --type=renderer",
      "200 1 /opt/chromium --user-data-dir=/tmp/d6e2/browser/gm/chromium-profile",
      `300 1 /opt/other-chromium --user-data-dir=${profile}`,
      "400 1 /usr/bin/unrelated",
    ].join("\n");
    expect(
      findOwnedChromiumProcesses(output, {
        executable: TEST_CHROMIUM,
        profile,
      }),
    ).toEqual([
      { pid: 100, ppid: 1 },
      { pid: 101, ppid: 100 },
    ]);
  });

  it("stops each successfully started role exactly once", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-browser-test-"));
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    const retireArtifacts = vi.fn(async (spec) => {
      await rm(spec.generationRoot, { force: true, recursive: true });
      return { alreadyStopped: false };
    });
    const session = browserRoleSession({
      binary: "/opt/browse",
      generationLeaseHooks: { retireArtifacts },
      role: "player",
      runRoot: root,
      runner,
    });

    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: true,
      attempted: false,
    });
    await session.start();
    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: false,
      attempted: true,
    });
    await expect(session.stop()).resolves.toEqual({
      alreadyStopped: true,
      attempted: false,
    });
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([["newtab"]]);
    expect(retireArtifacts).toHaveBeenCalledOnce();
  });
});

describe("secret-safe Foundry session import", () => {
  function response({ cookies = [], json, status = 200 } = {}) {
    return {
      headers: { getSetCookie: () => cookies },
      json: async () => json,
      status,
    };
  }

  it("preserves the GET session and posts the exact v14 join JSON", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          cookies: [
            "session=opaque-token; Path=/dev; HttpOnly; Secure; SameSite=Strict",
          ],
        }),
      )
      .mockImplementationOnce(async (_url, request) => {
        expect(request.headers.cookie).toBe("session=opaque-token");
        expect(request.headers["content-type"]).toBe("application/json");
        expect(JSON.parse(request.body)).toEqual({
          action: "join",
          password: "secret-value",
          userId: "player-id",
          username: "Synthetic Player",
        });
        return response({
          json: {
            message: "JOIN.LoginSuccess",
            redirect: "/dev/game",
            request: "join",
            status: "success",
          },
        });
      });
    const session = await requestFoundrySession({
      baseUrl: "https://example.test/dev",
      fetcher,
      fields: {
        action: "join",
        userId: "player-id",
        username: "Synthetic Player",
      },
      route: "join",
      secret: "secret-value",
    });
    expect(fetcher.mock.calls.map(([, request]) => request.method)).toEqual([
      "GET",
      "POST",
    ]);
    expect(session.redirectUrl).toBe("https://example.test/dev/game");
    expect(session.cookies).toEqual([
      expect.objectContaining({
        httpOnly: true,
        name: "session",
        path: "/dev",
        sameSite: "Strict",
        secure: true,
        value: "opaque-token",
      }),
    ]);
  });

  it.each([
    ["an intentionally blank access key", ""],
    ["a configured nonblank access key", "configured-secret"],
  ])(
    "represents %s exactly as the official client does",
    async (_label, secret) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          response({ cookies: ["session=entry; Path=/dev; HttpOnly"] }),
        )
        .mockImplementationOnce(async (_url, request) => {
          expect(JSON.parse(request.body).password).toBe(secret);
          return response({
            json: {
              redirect: "/dev/game",
              request: "join",
              status: "success",
            },
          });
        });
      await requestFoundrySession({
        baseUrl: "https://example.test/dev",
        fetcher,
        fields: {
          action: "join",
          userId: "gm-id",
          username: "Gamemaster",
        },
        route: "join",
        secret,
      });
    },
  );

  it("hard-stops on a 401 without importing a session", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({ cookies: ["session=entry; Path=/dev; HttpOnly"] }),
      )
      .mockResolvedValueOnce(response({ status: 401 }));
    await expect(
      requestFoundrySession({
        baseUrl: "https://example.test/dev",
        fetcher,
        fields: {
          action: "join",
          userId: "gm-id",
          username: "Gamemaster",
        },
        route: "join",
        secret: "",
      }),
    ).rejects.toMatchObject({ code: "FOUNDRY_AUTH_FAILED" });
  });

  it.each([
    ["an HTTP redirect", response({ status: 302 })],
    [
      "a different game redirect",
      response({
        json: {
          redirect: "/dev/other",
          request: "join",
          status: "success",
        },
      }),
    ],
    [
      "a response without the matching request identity",
      response({
        json: { redirect: "/dev/game", status: "success" },
      }),
    ],
  ])("hard-stops on %s", async (_label, authenticationResponse) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({ cookies: ["session=entry; Path=/dev; HttpOnly"] }),
      )
      .mockResolvedValueOnce(authenticationResponse);
    await expect(
      requestFoundrySession({
        baseUrl: "https://example.test/dev",
        fetcher,
        fields: {
          action: "join",
          userId: "gm-id",
          username: "Gamemaster",
        },
        route: "join",
        secret: "",
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it.each(["operation abort", "authentication timeout"])(
    "aborts a hanging Foundry authentication fetch on %s",
    async (mode) => {
      const operation = new globalThis.AbortController();
      let observedSignal;
      const fetcher = vi.fn(
        async (_url, request) =>
          new Promise((_resolve, reject) => {
            observedSignal = request.signal;
            const rejectAborted = () => reject(request.signal.reason);
            if (request.signal.aborted) rejectAborted();
            else
              request.signal.addEventListener("abort", rejectAborted, {
                once: true,
              });
          }),
      );
      const pending = requestFoundrySession({
        baseUrl: "https://example.test/dev",
        fetcher,
        fields: {
          action: "join",
          userId: "player-id",
          username: "Synthetic Player",
        },
        route: "join",
        secret: "secret-value",
        signal: operation.signal,
        timeoutMs: mode === "operation abort" ? 1_000 : 10,
      });
      if (mode === "operation abort") operation.abort(new Error("stopped"));
      await expect(pending).rejects.toBeInstanceOf(Error);
      expect(observedSignal.aborted).toBe(true);
    },
  );

  it("imports a mode-0600 temporary cookie file and removes it immediately", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "d6e2-auth-test-"));
    let importedFile;
    const roleSession = {
      role: "gm",
      async currentUrl() {
        return "https://example.test/dev/join";
      },
      async importCookies(file) {
        importedFile = file;
        expect((await stat(file)).mode & 0o777).toBe(0o600);
        expect(await readFile(file, "utf8")).toContain("opaque-token");
      },
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          cookies: ["session=opaque-token; Path=/; HttpOnly"],
        }),
      )
      .mockResolvedValueOnce(
        response({
          json: {
            redirect: "/dev/game",
            request: "join",
            status: "success",
          },
        }),
      );
    try {
      await authenticateBrowserSession({
        baseUrl: "https://example.test/dev",
        fields: {
          action: "join",
          userId: "gm-id",
          username: "Gamemaster",
        },
        roleSession,
        route: "join",
        runRoot: root,
        secret: "secret-value",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    await expect(access(importedFile)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    ["an originless page", "about:blank"],
    ["a different origin", "https://other.test/dev/join"],
  ])(
    "rejects cookie import from %s before authentication",
    async (_label, url) => {
      const fetcher = vi.fn();
      await expect(
        authenticateBrowserSession({
          baseUrl: "https://example.test/dev",
          fetcher,
          fields: {
            action: "join",
            userId: "player-id",
            username: "Synthetic Player",
          },
          roleSession: {
            role: "player",
            currentUrl: async () => url,
            importCookies: vi.fn(),
          },
          route: "join",
          runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-auth-test-")),
          secret: "",
        }),
      ).rejects.toMatchObject({ code: "BROWSER_ORIGIN_MISMATCH" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("propagates an exact-origin cookie import failure", async () => {
    const roleSession = {
      role: "player",
      currentUrl: vi.fn(async () => "https://example.test/dev/join"),
      importCookies: vi.fn(async () => {
        throw new Error("cookie import rejected");
      }),
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({ cookies: ["session=entry; Path=/dev; HttpOnly"] }),
      )
      .mockResolvedValueOnce(
        response({
          json: {
            redirect: "/dev/game",
            request: "join",
            status: "success",
          },
        }),
      );
    await expect(
      authenticateBrowserSession({
        baseUrl: "https://example.test/dev",
        fetcher,
        fields: {
          action: "join",
          userId: "player-id",
          username: "Synthetic Player",
        },
        roleSession,
        route: "join",
        runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-auth-test-")),
        secret: "",
      }),
    ).rejects.toThrow("cookie import rejected");
    expect(roleSession.currentUrl).toHaveBeenCalledTimes(2);
  });

  it("preserves the configured Foundry route prefix", () => {
    expect(foundryRoute("https://example.test/dev", "join")).toBe(
      "https://example.test/dev/join",
    );
    expect(
      cookieFromSetCookie(
        "session=value; Path=/dev; SameSite=None",
        "https://example.test/dev",
      ),
    ).toMatchObject({ domain: "example.test", path: "/dev", sameSite: "None" });
  });
});

describe("origin-safe Foundry role entry", () => {
  function response({ cookies = [], json, status = 200 } = {}) {
    return {
      headers: { getSetCookie: () => cookies },
      json: async () => json,
      status,
    };
  }

  function fetcher(events) {
    return vi
      .fn()
      .mockImplementationOnce(async () => {
        events.push("auth-get");
        return response({ cookies: ["session=entry; Path=/dev; HttpOnly"] });
      })
      .mockImplementationOnce(async () => {
        events.push("auth-post");
        return response({
          json: {
            redirect: "/dev/game",
            request: "join",
            status: "success",
          },
        });
      });
  }

  function roleSession(role, events, options = {}) {
    let url = "about:blank";
    return {
      role,
      start: vi.fn(async () => events.push("start")),
      navigate: vi.fn(async (next) => {
        events.push(`navigate:${next}`);
        url =
          options.redirectJoin && next.endsWith("/join")
            ? "https://unexpected.test/join"
            : next;
      }),
      currentUrl: vi.fn(async () => {
        events.push(`url:${url}`);
        return url;
      }),
      waitForJoinForm: vi.fn(async () => events.push("wait:join")),
      readJoinUsers: vi.fn(async () => {
        events.push("discover-users");
        return JSON.stringify({
          users: [{ identifier: "gm-id", label: "Gamemaster" }],
        });
      }),
      importCookies: vi.fn(async () => events.push("cookie-import")),
      waitForFoundryReady: vi.fn(async ({ expectedUrl }) =>
        events.push(`wait:game-ready:${expectedUrl}`),
      ),
    };
  }

  const lease = {
    leaseNonce: "nonce",
    runId: "run",
    systemId: "d6-system-2e",
    worldId: "world",
  };

  function verified(role, userId) {
    return {
      isGM: role === "gm",
      leaseNonce: lease.leaseNonce,
      runId: lease.runId,
      systemId: lease.systemId,
      userId,
      worldId: lease.worldId,
    };
  }

  it("uses the shared origin-first sequence for a known player without discovery", async () => {
    const events = [];
    const session = roleSession("player", events);
    await enterFoundryRole({
      baseUrl: "https://example.test/dev",
      expectedRole: "player",
      expectedUserId: "player-id",
      expectedUserName: "Synthetic Player",
      fetcher: fetcher(events),
      lease,
      roleSession: session,
      runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-entry-test-")),
      secret: "",
      inspectStartup: async () => events.push("inspect-startup"),
      verifyEntry: async () => {
        events.push("verify-entry");
        return verified("player", "player-id");
      },
    });
    expect(events).toEqual([
      "start",
      "inspect-startup",
      "navigate:https://example.test/dev/join",
      "url:https://example.test/dev/join",
      "wait:join",
      "url:https://example.test/dev/join",
      "auth-get",
      "auth-post",
      "url:https://example.test/dev/join",
      "cookie-import",
      "navigate:https://example.test/dev/game",
      "url:https://example.test/dev/game",
      "wait:game-ready:https://example.test/dev/game",
      "url:https://example.test/dev/game",
      "verify-entry",
    ]);
    expect(session.readJoinUsers).not.toHaveBeenCalled();
  });

  it("discovers the GM only after exact join-origin readiness", async () => {
    const events = [];
    const session = roleSession("gm", events);
    const result = await enterFoundryRole({
      baseUrl: "https://example.test/dev",
      expectedRole: "gm",
      expectedUserName: "Gamemaster",
      fetcher: fetcher(events),
      lease,
      roleSession: session,
      runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-entry-test-")),
      secret: "",
      verifyEntry: async ({ expectedUserId }) => {
        events.push("verify-entry");
        return verified("gm", expectedUserId);
      },
    });
    expect(result.user).toMatchObject({ id: "gm-id", name: "Gamemaster" });
    expect(events.indexOf("wait:join")).toBeLessThan(
      events.indexOf("discover-users"),
    );
    expect(events.indexOf("discover-users")).toBeLessThan(
      events.indexOf("auth-get"),
    );
  });

  it("hard-stops an unexpected join navigation redirect before authentication", async () => {
    const events = [];
    const session = roleSession("player", events, { redirectJoin: true });
    const sessionFetcher = fetcher(events);
    await expect(
      enterFoundryRole({
        baseUrl: "https://example.test/dev",
        expectedRole: "player",
        expectedUserId: "player-id",
        expectedUserName: "Synthetic Player",
        fetcher: sessionFetcher,
        lease,
        roleSession: session,
        runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-entry-test-")),
        secret: "",
        verifyEntry: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_LOCATION_MISMATCH" });
    expect(sessionFetcher).not.toHaveBeenCalled();
    expect(session.importCookies).not.toHaveBeenCalled();
  });

  it.each([
    ["player", true],
    ["gm", false],
  ])("rejects mismatched post-entry %s authority", async (role, isGM) => {
    const events = [];
    await expect(
      enterFoundryRole({
        baseUrl: "https://example.test/dev",
        expectedRole: role,
        expectedUserId: `${role}-id`,
        expectedUserName: role,
        fetcher: fetcher(events),
        lease,
        roleSession: roleSession(role, events),
        runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-entry-test-")),
        secret: "",
        verifyEntry: async () => ({
          ...verified(role, `${role}-id`),
          isGM,
        }),
      }),
    ).rejects.toMatchObject({ code: "BROWSER_AUTHORITY_MISMATCH" });
  });

  it("does not run the authority probe before delayed lifecycle readiness", async () => {
    const events = [];
    let releaseReady;
    const ready = new Promise((resolve) => {
      releaseReady = resolve;
    });
    const session = roleSession("player", events);
    session.waitForFoundryReady = vi.fn(async () => {
      events.push("wait:game-ready:start");
      await ready;
      events.push("wait:game-ready:done");
    });
    const verifyEntry = vi.fn(async () => verified("player", "player-id"));
    const pending = enterFoundryRole({
      baseUrl: "https://example.test/dev",
      expectedRole: "player",
      expectedUserId: "player-id",
      expectedUserName: "Synthetic Player",
      fetcher: fetcher(events),
      lease,
      roleSession: session,
      runRoot: await mkdtemp(path.join(os.tmpdir(), "d6e2-entry-test-")),
      secret: "",
      verifyEntry,
    });
    await vi.waitFor(() => expect(events).toContain("wait:game-ready:start"));
    expect(verifyEntry).not.toHaveBeenCalled();
    releaseReady();
    await pending;
    expect(verifyEntry).toHaveBeenCalledTimes(1);
    expect(events).toContain("wait:game-ready:done");
  });
});
