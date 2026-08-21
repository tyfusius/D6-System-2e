import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AcceptanceError,
  EvidenceRecorder,
  RestorationStack,
  createSecureRunRoot,
  createRedactor,
  evaluatePreflight,
  planDisposableWorldLease,
  provisionDisposableWorld,
  removeDisposableWorld,
  resolveEnvironmentSecret,
  validateFoundationConfig,
} from "./core.mjs";

async function fixtureRoot() {
  return realpath(
    await mkdtemp(path.join(os.tmpdir(), "d6e2-acceptance-test-")),
  );
}

describe("acceptance preflight", () => {
  it("creates a missing owner-only artifact parent and rejects a symlinked parent", async () => {
    const root = await fixtureRoot();
    const artifactRoot = path.join(root, "nested", "artifacts");
    const runRoot = await createSecureRunRoot(artifactRoot);
    expect(path.dirname(runRoot)).toBe(artifactRoot);
    expect((await lstat(artifactRoot)).mode & 0o077).toBe(0);
    expect((await lstat(runRoot)).mode & 0o077).toBe(0);

    const target = path.join(root, "target");
    const linked = path.join(root, "linked");
    await mkdir(target, { mode: 0o700 });
    await symlink(target, linked);
    await expect(createSecureRunRoot(linked)).rejects.toMatchObject({
      code: "ARTIFACT_ROOT_UNSAFE",
    });
  });

  it("accepts the supported build, Chromium and viewport boundary", () => {
    expect(
      evaluatePreflight({
        browserVersion: "Mozilla/5.0 HeadlessChrome/146.0.1",
        endpointHealthy: true,
        foundryVersion: "14.367",
        processHealthy: true,
        systemId: "d6-system-2e",
        viewport: { height: 768, width: 1024 },
        webglAvailable: true,
        worldId: "d6e2-acceptance-test",
      }),
    ).toMatchObject({ chromiumMajor: 146, foundryBuild: 367, ok: true });
  });

  it("returns actionable failures for every unsupported boundary", () => {
    const result = evaluatePreflight({
      browserVersion: "Chromium/145.0",
      endpointHealthy: false,
      foundryVersion: "14.366",
      processHealthy: false,
      systemId: "other",
      viewport: { height: 720, width: 1280 },
      webglAvailable: false,
      worldId: "personal-world",
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(" ")).toContain("Chromium 145");
    expect(result.failures.join(" ")).toContain("Build 366");
    expect(result.failures.join(" ")).toContain("1280×720");
    expect(result.failures.join(" ")).toContain("not an identified disposable");
    expect(result.warnings).toHaveLength(1);
  });
});

describe("disposable world lease", () => {
  it("plans exact world and marker paths without creating world state", async () => {
    const root = await fixtureRoot();
    const lease = planDisposableWorldLease({
      identity: {
        runId: "planned-run",
        worldId: "d6e2-acceptance-planned-run",
      },
      worldsDirectory: path.join(root, "worlds"),
      leaseNonce: "planned-nonce",
    });
    expect(lease).toMatchObject({
      runId: "planned-run",
      worldId: "d6e2-acceptance-planned-run",
      leaseNonce: "planned-nonce",
      status: "planned",
      marker: path.join(
        root,
        "worlds",
        "d6e2-acceptance-planned-run",
        ".d6e2-acceptance-world.json",
      ),
      manifest: path.join(
        root,
        "worlds",
        "d6e2-acceptance-planned-run",
        "world.json",
      ),
    });
  });

  it("provisions and removes only the exact marked synthetic world", async () => {
    const root = await fixtureRoot();
    const worldsDirectory = path.join(root, "worlds");
    await mkdir(worldsDirectory);
    const lease = await provisionDisposableWorld({
      identity: { runId: "test-run", worldId: "d6e2-acceptance-test-run" },
      worldsDirectory,
    });
    expect(JSON.parse(await readFile(lease.manifest, "utf8"))).toMatchObject({
      flags: {
        "d6-system-2e": {
          acceptanceFoundation: {
            leaseNonce: lease.leaseNonce,
            runId: lease.runId,
          },
        },
      },
      id: "d6e2-acceptance-test-run",
      system: "d6-system-2e",
    });
    await removeDisposableWorld(lease);
    await expect(readFile(lease.marker, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("blocks cleanup when the marker no longer matches the lease", async () => {
    const root = await fixtureRoot();
    const worldsDirectory = path.join(root, "worlds");
    await mkdir(worldsDirectory);
    const lease = await provisionDisposableWorld({
      identity: { runId: "test-run", worldId: "d6e2-acceptance-test-run" },
      worldsDirectory,
    });
    await writeFile(lease.marker, JSON.stringify({ worldId: lease.worldId }));
    await expect(removeDisposableWorld(lease)).rejects.toMatchObject({
      code: "WORLD_LEASE_MISMATCH",
    });
    expect(await readFile(lease.manifest, "utf8")).toContain(lease.worldId);
  });

  it("refuses non-disposable world identifiers", async () => {
    const root = await fixtureRoot();
    await expect(
      provisionDisposableWorld({
        identity: { runId: "test-run", worldId: "personal-campaign" },
        worldsDirectory: root,
      }),
    ).rejects.toBeInstanceOf(AcceptanceError);
  });
});

describe("secrets, evidence and restoration", () => {
  it("resolves only named environment secrets and redacts persisted evidence", async () => {
    expect(
      resolveEnvironmentSecret({ QA_SECRET: "private-value" }, "QA_SECRET"),
    ).toBe("private-value");
    expect(() =>
      resolveEnvironmentSecret({ QA_SECRET: "private-value" }, "literal-value"),
    ).toThrow(/environment variable/);
    const root = await fixtureRoot();
    const recorder = new EvidenceRecorder({
      directory: root,
      redact: createRedactor(["private-value"]),
    });
    await recorder.initialize();
    await recorder.checkpoint("gm", "secret-test", {
      authorization: "private-value",
      console: [
        "Authorization: Bearer console-bearer",
        "Cookie: session=one; preference=two",
        "Set-Cookie: connect.sid=three; Path=/; HttpOnly",
        '{"apiKey":"top-secret"}',
        '{"token":"top-secret"}',
        "sessionId=top-secret",
        "'password': 'quoted-secret'",
        "refreshToken=unquoted-secret",
        "session_key=session-underscore",
        "session-key=session-hyphen",
        "api_key=api-underscore",
        "api-key=api-hyphen",
        "access_token=access-underscore",
        "access-token=access-hyphen",
        "refresh_token=refresh-underscore",
        "refresh-token=refresh-hyphen",
      ],
      nested: {
        accessToken: "nested-access",
        array: [{ apiKey: "array-key" }, { harmless: "visible" }],
        refreshToken: "nested-refresh",
        session: { id: "nested-session" },
      },
      password: "private-value",
    });
    const evidence = await readFile(
      path.join(root, "checkpoints.jsonl"),
      "utf8",
    );
    expect(evidence).not.toContain("private-value");
    expect(evidence).not.toMatch(
      /console-bearer|session=one|preference=two|connect\.sid=three|nested-access|array-key|nested-refresh|nested-session|top-secret|quoted-secret|unquoted-secret|session-underscore|session-hyphen|api-underscore|api-hyphen|access-underscore|access-hyphen|refresh-underscore|refresh-hyphen/,
    );
    expect(evidence).toContain("visible");
    expect(evidence).toContain("[REDACTED]");
  });

  it("restores in reverse order and aggregates failures", async () => {
    const order = [];
    const stack = new RestorationStack();
    stack.add("first", () => order.push("first"));
    stack.add("second", () => {
      order.push("second");
      throw new Error("second failed");
    });
    stack.add("third", () => order.push("third"));
    const result = await stack.restoreAll();
    expect(order).toEqual(["third", "second", "first"]);
    expect(result).toMatchObject({ ok: false });
    expect(result.failures).toEqual([
      { error: "second failed", label: "second" },
    ]);
  });

  it("rejects literal credential fields in configuration", () => {
    const valid = {
      expectedFoundryVersion: "14.367",
      artifactRoot: "/Volumes/Store/acceptance-artifacts",
      baseUrl: "https://example.test/dev",
      browserBinary: "/opt/browse",
      browserChromiumExecutable: "/Volumes/Store/browsers/chromium",
      candidateSystemPath: "/worktree",
      dataPath: "/data",
      roles: { gmUserName: "Gamemaster", playerUserName: "Synthetic Player" },
      runtime: {
        composeFile: "/runtime/compose.yml",
        cachedFoundryArchive: "/runtime/foundryvtt-14.367.zip",
        dataMountSource: "/runtime/data",
        restoreComposeSourceFile: "/runtime/docker-compose.yml",
        expectedComposeProject: "development",
        envFile: "/runtime/.env",
        service: "foundry-dev",
        systemInstallPath: "/data/systems/d6-system-2e",
      },
      secrets: {
        gm: "D6_QA_GM_SECRET",
        player: null,
        setup: "D6_QA_SETUP_SECRET",
      },
      viewport: { height: 900, width: 1440 },
    };
    const normalized = validateFoundationConfig(valid);
    expect(normalized).not.toBe(valid);
    expect(normalized.runtime.composeSourceFile).toBe(
      valid.runtime.composeFile,
    );
    expect(normalized.runtime.composeProjectDirectory).toBe("/runtime");
    expect(
      validateFoundationConfig({
        ...valid,
        runtime: {
          ...valid.runtime,
          composeFile: "/snapshots/candidate.yml",
          composeSourceFile: "/snapshots/candidate.yml",
          restoreComposeSourceFile: "/canonical/docker-compose.yml",
        },
      }).runtime.composeProjectDirectory,
    ).toBe("/canonical");
    expect(() =>
      validateFoundationConfig({
        ...valid,
        expectedFoundryVersion: "14.366",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "FOUNDRY_VERSION_BELOW_RUNTIME_FLOOR",
      }),
    );
    expect(() =>
      validateFoundationConfig({
        ...valid,
        minimums: { foundryBuild: 366 },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "FOUNDRY_MINIMUM_BELOW_RUNTIME_FLOOR",
      }),
    );
    if (process.platform === "darwin") {
      expect(() =>
        validateFoundationConfig({
          ...valid,
          artifactRoot: "/private/tmp/d6-acceptance-artifacts",
        }),
      ).toThrowError(
        expect.objectContaining({ code: "ARTIFACT_ROOT_NOT_STORE_BACKED" }),
      );
    }
    expect(
      validateFoundationConfig({
        ...valid,
        timeouts: { restorationMs: 120_000, serviceHealthMs: 75_000 },
      }),
    ).toBeTruthy();
    expect(() =>
      validateFoundationConfig({
        ...valid,
        timeouts: { restorationMs: 70_000, serviceHealthMs: 60_000 },
      }),
    ).toThrow(/at least 30000ms above/);
    expect(() =>
      validateFoundationConfig({ ...valid, password: "secret" }),
    ).toThrow(/Credential-shaped/);
    expect(() =>
      validateFoundationConfig({
        ...valid,
        runtime: { ...valid.runtime, transport: { accessToken: "literal" } },
      }),
    ).toThrow(/Credential-shaped/);
    expect(() =>
      validateFoundationConfig({
        ...valid,
        roles: {
          ...valid.roles,
          recovery: [{ session_secret: "literal" }],
        },
      }),
    ).toThrow(/Credential-shaped/);
  });
});
