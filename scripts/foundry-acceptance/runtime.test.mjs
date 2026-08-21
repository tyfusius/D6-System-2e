import { Buffer } from "node:buffer";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertCandidateComposeBind,
  assertCandidateSystemVisible,
  assertCanonicalEnvironmentFile,
  assertEnvironmentSnapshotIdentity,
  assertFoundryReleaseInputs,
  assertFoundryRuntimeIdentity,
  createComposeSnapshot,
  createEnvironmentSnapshot,
  dockerServiceHealth,
  endpointHealth,
  readCandidateDirectoryIdentity,
  readComposeFileIdentity,
  resolveRecoveryComposeConfig,
  loadComposeSnapshot,
  recreateFoundryService,
  replaceEnvironmentValue,
  retireComposeSnapshot,
  retireEnvironmentSnapshot,
  switchSystemSymlink,
  switchWorldEnvironment,
} from "./runtime.mjs";

async function root() {
  return realpath(await mkdtemp(path.join(os.tmpdir(), "d6e2-runtime-test-")));
}

async function candidateDirectory() {
  const directory = await root();
  const candidate = path.join(directory, "candidate");
  await mkdir(candidate);
  return candidate;
}

function resolveCandidateFixture(value, candidate) {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveCandidateFixture(entry, candidate));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolveCandidateFixture(entry, candidate),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  return value
    .replace(
      "/private/tmp/d6-core-client-performance-reduced-effects",
      candidate,
    )
    .replace("/private/tmp/candidate", candidate);
}

function storedPackageArchive(version = "14.367.0") {
  const name = Buffer.from("package.json", "utf8");
  const data = Buffer.from(JSON.stringify({ version }), "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const centralOffset = local.length + name.length + data.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralSize = central.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

describe("reversible runtime selection", () => {
  it("creates and retires a distinct owner-only environment snapshot without rewriting canonical bytes", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const snapshotPath = path.join(directory, "run", "candidate.env");
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    const original =
      "FOUNDRY_RELEASE_URL=https://example/releases/14.366/x\nFOUNDRY_WORLD=original\nROTATED=keep\n";
    await writeFile(envFile, original, { mode: 0o640 });
    const snapshot = await createEnvironmentSnapshot({
      envFile,
      snapshotPath,
      worldId: "candidate",
    });
    expect(await readFile(envFile, "utf8")).toBe(original);
    expect(await readFile(snapshot.path, "utf8")).toContain(
      "FOUNDRY_WORLD=candidate",
    );
    expect((await lstat(snapshot.path)).mode & 0o077).toBe(0);
    await expect(assertEnvironmentSnapshotIdentity(snapshot)).resolves.toEqual(
      snapshot.identity,
    );
    await retireEnvironmentSnapshot(snapshot);
    await expect(lstat(snapshot.path)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("requires the canonical environment to be owner-only before runtime planning", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    await writeFile(envFile, "FOUNDRY_WORLD=dev\n", { mode: 0o644 });
    await expect(assertCanonicalEnvironmentFile(envFile)).rejects.toMatchObject(
      {
        code: "RUNTIME_ENV_UNSAFE",
      },
    );
    await chmod(envFile, 0o600);
    await expect(assertCanonicalEnvironmentFile(envFile)).resolves.toEqual({
      mode: 0o600,
      safe: true,
    });
  });

  it("supports distinct candidate and canonical Compose snapshot paths", async () => {
    const directory = await root();
    const candidateSource = path.join(directory, "candidate.yml");
    const canonicalSource = path.join(directory, "canonical.yml");
    await writeFile(
      candidateSource,
      "services: {foundry-dev: {volumes: []}}\n",
    );
    await writeFile(
      canonicalSource,
      "services: {foundry-dev: {volumes: [/data]}}\n",
    );
    const config = {
      runtime: { composeFile: candidateSource },
      service: "foundry-dev",
    };
    const candidate = await createComposeSnapshot(config, {
      sourceFile: candidateSource,
      snapshotPath: path.join(directory, "run-candidate.yml"),
    });
    const canonical = await createComposeSnapshot(config, {
      sourceFile: canonicalSource,
      snapshotPath: path.join(directory, "run-canonical.yml"),
    });
    expect(candidate.composeIdentity.snapshot.canonicalPath).not.toBe(
      canonical.composeIdentity.snapshot.canonicalPath,
    );
    await retireComposeSnapshot(candidate.config, candidate.composeIdentity);
    await retireComposeSnapshot(canonical.config, canonical.composeIdentity);
  });

  it("requires matching release URL and cached archive before mutation", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const archive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/releases/14.367/FoundryVTT-Node-14.367.zip?signature=redacted\nFOUNDRY_WORLD=world\n",
    );
    await writeFile(archive, storedPackageArchive());
    await expect(
      assertFoundryReleaseInputs({
        expectedFoundryVersion: "14.367.0",
        runtime: { envFile, cachedFoundryArchive: archive },
      }),
    ).resolves.toMatchObject({ releaseMatches: true, archiveMatches: true });
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/releases/14.366/FoundryVTT-Node-14.366.zip?signature=redacted\nFOUNDRY_WORLD=world\n",
    );
    await expect(
      assertFoundryReleaseInputs({
        expectedFoundryVersion: "14.367",
        runtime: { envFile, cachedFoundryArchive: archive },
      }),
    ).rejects.toMatchObject({ code: "FOUNDRY_RELEASE_VERSION_MISMATCH" });
  });

  it("accepts a cleared timed release URL only with exact env, filename, and embedded versions", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const archive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=\nFOUNDRY_VERSION=14.367\nFOUNDRY_WORLD=world\n",
    );
    await writeFile(archive, storedPackageArchive());
    await expect(
      assertFoundryReleaseInputs({
        expectedFoundryVersion: "14.367",
        runtime: { envFile, cachedFoundryArchive: archive },
      }),
    ).resolves.toMatchObject({
      archiveMatches: true,
      configuredVersionMatches: true,
      releaseMatches: true,
      releaseRetained: false,
    });
  });

  it("rejects a cleared release URL when env or archive filename version drifts", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const staleArchive = path.join(directory, "foundryvtt-14.366.zip");
    const currentArchive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(envFile, "FOUNDRY_RELEASE_URL=\nFOUNDRY_VERSION=14.366\n");
    await writeFile(staleArchive, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    await writeFile(currentArchive, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    const runner = vi.fn();
    await expect(
      assertFoundryReleaseInputs(
        {
          expectedFoundryVersion: "14.367",
          runtime: { envFile, cachedFoundryArchive: currentArchive },
        },
        runner,
      ),
    ).rejects.toMatchObject({ code: "FOUNDRY_CONFIG_VERSION_MISMATCH" });
    await writeFile(envFile, "FOUNDRY_RELEASE_URL=\nFOUNDRY_VERSION=14.367\n");
    await expect(
      assertFoundryReleaseInputs(
        {
          expectedFoundryVersion: "14.367",
          runtime: { envFile, cachedFoundryArchive: staleArchive },
        },
        runner,
      ),
    ).rejects.toMatchObject({ code: "FOUNDRY_CACHE_FILENAME_MISMATCH" });
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects a Foundry version below the runtime floor before reading artifacts", async () => {
    const runner = vi.fn();
    await expect(
      assertFoundryReleaseInputs(
        { expectedFoundryVersion: "14.366", runtime: {} },
        runner,
      ),
    ).rejects.toMatchObject({
      code: "FOUNDRY_VERSION_BELOW_RUNTIME_FLOOR",
      details: { minimumFoundryVersion: "14.367" },
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("rejects writable group/world archive modes", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const archive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/releases/14.367/FoundryVTT-Node-14.367.zip\n",
    );
    await writeFile(archive, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    await chmod(archive, 0o666);
    await expect(
      assertFoundryReleaseInputs(
        {
          expectedFoundryVersion: "14.367",
          runtime: { envFile, cachedFoundryArchive: archive },
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "FOUNDRY_CACHE_MODE_UNSAFE" });
  });

  it("rejects same-handle archive byte drift during metadata verification", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const archive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/releases/14.367/FoundryVTT-Node-14.367.zip\n",
    );
    const original = storedPackageArchive();
    await writeFile(archive, original);
    const archiveMetadataReader = vi.fn(async () => {
      await writeFile(archive, new Uint8Array([0x50, 0x4b, 0x99, 0x99]));
      return { version: "14.367.0" };
    });
    await expect(
      assertFoundryReleaseInputs(
        {
          expectedFoundryVersion: "14.367",
          runtime: { envFile, cachedFoundryArchive: archive },
        },
        undefined,
        { archiveMetadataReader },
      ),
    ).rejects.toMatchObject({ code: "FOUNDRY_CACHE_DRIFT" });
  });

  it("requires exact running build, project, service, and worktree mounts", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify([
          {
            Id: "container-1",
            Config: {
              Labels: {
                "com.foundryvtt.version": "14.365.0",
                "com.docker.compose.project": "development",
                "com.docker.compose.service": "foundry-dev",
              },
            },
            State: { Status: "running" },
            Mounts: [
              {
                Type: "bind",
                Source: "/data-host",
                Destination: "/data",
                RW: true,
              },
              {
                Type: "bind",
                Source: "/private/tmp/candidate",
                Destination: "/private/tmp/candidate",
                RW: false,
              },
            ],
          },
        ]),
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          version: "14.366.0",
          generation: 14,
          build: 366,
        }),
      });
    await expect(
      assertFoundryRuntimeIdentity(
        {
          service: "foundry-dev",
          expectedFoundryVersion: "14.366",
          expectedComposeProject: "development",
        },
        runner,
        {
          candidatePath: "/private/tmp/candidate",
          expectedDataMountSource: "/data-host",
          phase: "candidate",
        },
      ),
    ).resolves.toMatchObject({ expectedFoundryVersion: "14.366" });
    runner.mock.results.length = 0;
    runner.mockResolvedValueOnce({
      code: 0,
      stderr: "",
      stdout: JSON.stringify([
        {
          Id: "container-2",
          Config: {
            Labels: {
              "com.foundryvtt.version": "14.365.0",
              "com.docker.compose.project": "development",
              "com.docker.compose.service": "foundry-dev",
            },
          },
          State: { Status: "running" },
          Mounts: [
            {
              Type: "bind",
              Source: "/data-host",
              Destination: "/data",
              RW: true,
            },
          ],
        },
      ]),
    });
    runner.mockResolvedValueOnce({
      code: 0,
      stderr: "",
      stdout: JSON.stringify({
        version: "14.365.0",
        generation: 14,
        build: 365,
      }),
    });
    await expect(
      assertFoundryRuntimeIdentity(
        { service: "foundry-dev", expectedFoundryVersion: "14.366" },
        runner,
      ),
    ).rejects.toMatchObject({ code: "FOUNDRY_RUNTIME_IDENTITY_MISMATCH" });
  });

  it("resolves planned and retirement-deleted snapshots only at exact journal boundaries", async () => {
    const directory = await root();
    const source = path.join(directory, "compose.yml");
    await writeFile(source, "services: {}\n");
    const sourceIdentity = await readComposeFileIdentity(source);
    const snapshot = `${source}.d6e2-snapshot`;
    const config = {
      runtime: { composeFile: source, composeSourceFile: source },
    };
    const base = {
      runtime: { composeFile: snapshot },
      composeIdentity: { source: sourceIdentity, snapshot: sourceIdentity },
    };
    await expect(
      resolveRecoveryComposeConfig(config, {
        ...base,
        snapshot: { path: snapshot, status: "planned" },
      }),
    ).resolves.toMatchObject({ runtime: { composeFile: snapshot } });
    await expect(
      resolveRecoveryComposeConfig(config, {
        ...base,
        snapshot: { path: snapshot, status: "active" },
      }),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      resolveRecoveryComposeConfig(config, {
        ...base,
        snapshot: {
          path: snapshot,
          status: "retiring",
          retirementStarted: true,
        },
      }),
    ).resolves.toMatchObject({ runtime: { composeFile: snapshot } });
    await expect(
      resolveRecoveryComposeConfig(config, {
        ...base,
        snapshot: { path: snapshot, status: "retiring" },
      }),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(snapshot, "reappeared\n");
    await expect(
      resolveRecoveryComposeConfig(config, {
        ...base,
        snapshot: { path: snapshot, status: "retired" },
      }),
    ).rejects.toMatchObject({ code: "COMPOSE_SNAPSHOT_REAPPEARED" });
  });
  it("replaces exactly one world variable and rejects ambiguous files", () => {
    expect(
      replaceEnvironmentValue(
        "A=1\nFOUNDRY_WORLD=old\nB=2\n",
        "FOUNDRY_WORLD",
        "new",
      ),
    ).toBe("A=1\nFOUNDRY_WORLD=new\nB=2\n");
    expect(() =>
      replaceEnvironmentValue("A=1\n", "FOUNDRY_WORLD", "new"),
    ).toThrow(/exactly one/);
    expect(() =>
      replaceEnvironmentValue(
        "FOUNDRY_WORLD=a\nFOUNDRY_WORLD=b\n",
        "FOUNDRY_WORLD",
        "new",
      ),
    ).toThrow(/found 2/);
  });

  it("restores environment bytes and permissions", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const original = "FOUNDRY_WORLD=original\nOTHER=value\n";
    await writeFile(envFile, original);
    await chmod(envFile, 0o640);
    const restore = await switchWorldEnvironment({
      envFile,
      worldId: "d6e2-acceptance-run",
    });
    expect(await readFile(envFile, "utf8")).toContain(
      "FOUNDRY_WORLD=d6e2-acceptance-run",
    );
    await restore();
    expect(await readFile(envFile, "utf8")).toBe(original);
    expect((await lstat(envFile)).mode & 0o777).toBe(0o640);
  });

  it("restores only FOUNDRY_WORLD and preserves rotated release/unrelated lines", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const original =
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/14.366.zip?signature=rotated\nFOUNDRY_WORLD=original\nOTHER=keep\n";
    await writeFile(envFile, original);
    const restore = await switchWorldEnvironment({
      envFile,
      worldId: "candidate",
    });
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/14.366.zip?signature=new\nFOUNDRY_WORLD=candidate\nOTHER=changed-by-operator\n",
    );
    await restore();
    expect(await readFile(envFile, "utf8")).toBe(
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/14.366.zip?signature=new\nFOUNDRY_WORLD=original\nOTHER=changed-by-operator\n",
    );
  });

  it("fails closed when the world selector drifted before restoration", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    await writeFile(envFile, "FOUNDRY_WORLD=original\nOTHER=keep\n");
    const restore = await switchWorldEnvironment({
      envFile,
      worldId: "candidate",
    });
    await writeFile(envFile, "FOUNDRY_WORLD=other-world\nOTHER=keep\n");
    await expect(restore()).rejects.toMatchObject({
      code: "RUNTIME_ENV_WORLD_DRIFT",
    });
  });

  it("refuses world switching when the release source drifts", async () => {
    const directory = await root();
    const envFile = path.join(directory, ".env");
    const archive = path.join(directory, "foundryvtt-14.367.zip");
    await writeFile(archive, "zip");
    await writeFile(
      envFile,
      "FOUNDRY_RELEASE_URL=https://downloads.invalid/releases/14.366/FoundryVTT-Node-14.366.zip?signature=redacted\nFOUNDRY_WORLD=original\n",
    );
    await expect(
      switchWorldEnvironment({
        envFile,
        worldId: "new-world",
        expectedFoundryVersion: "14.367",
        cachedFoundryArchive: archive,
      }),
    ).rejects.toMatchObject({ code: "FOUNDRY_RELEASE_VERSION_MISMATCH" });
    expect(await readFile(envFile, "utf8")).toContain("FOUNDRY_WORLD=original");
  });

  it("fails closed without replacing a symlinked environment file", async () => {
    const directory = await root();
    const target = path.join(directory, "runtime.env");
    const envFile = path.join(directory, ".env");
    const original = "FOUNDRY_WORLD=original\n";
    await writeFile(target, original);
    await symlink(target, envFile);
    await expect(
      switchWorldEnvironment({
        envFile,
        worldId: "d6e2-acceptance-run",
      }),
    ).rejects.toMatchObject({ code: "RUNTIME_ENV_SYMLINK" });
    expect((await lstat(envFile)).isSymbolicLink()).toBe(true);
    expect(await readlink(envFile)).toBe(target);
    expect(await readFile(target, "utf8")).toBe(original);
  });

  it("temporarily points only an existing system symlink at the candidate", async () => {
    const directory = await root();
    const original = path.join(directory, "original");
    const candidate = path.join(directory, "candidate");
    const install = path.join(directory, "installed-system");
    await mkdir(candidate);
    await symlink(original, install);
    const restore = await switchSystemSymlink({
      candidatePath: candidate,
      installPath: install,
    });
    expect(await readlink(install)).toBe(candidate);
    await restore();
    expect(await readlink(install)).toBe(original);
  });
});

describe("health probes", () => {
  async function composeIdentity(runtime) {
    return readComposeFileIdentity(runtime.composeFile);
  }

  it("recreates only the configured Compose service without dependencies", async () => {
    const directory = await root();
    const config = {
      composeFile: path.join(directory, "compose.yml"),
      envFile: path.join(directory, ".env"),
      service: "foundry-dev",
    };
    await writeFile(config.composeFile, "services: {}\n");
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    await recreateFoundryService(config, runner, {
      composeFileIdentity: await composeIdentity(config),
      dataMountSource: directory,
      runRoot: directory,
    });
    expect(runner).toHaveBeenNthCalledWith(
      1,
      "docker",
      [
        "compose",
        "-f",
        config.composeFile,
        "--env-file",
        config.envFile,
        "stop",
        "foundry-dev",
      ],
      expect.any(Object),
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      "docker",
      [
        "compose",
        "-f",
        config.composeFile,
        "--env-file",
        config.envFile,
        "ps",
        "--status",
        "running",
        "--quiet",
        "foundry-dev",
      ],
      expect.any(Object),
    );
    expect(runner).toHaveBeenNthCalledWith(
      3,
      "docker",
      [
        "compose",
        "-f",
        config.composeFile,
        "--env-file",
        config.envFile,
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "foundry-dev",
      ],
      expect.any(Object),
    );
    expect(runner.mock.calls[2][2].env.D6E2_ACCEPTANCE_ENV_FILE).toBe(
      config.envFile,
    );
  });

  it("recoverably retires only an empty Foundry data lock after the exact service stops", async () => {
    const directory = await root();
    const configDirectory = path.join(directory, "Config");
    const lockDirectory = path.join(configDirectory, "options.json.lock");
    const composeFile = path.join(directory, "compose.yml");
    await mkdir(lockDirectory, { recursive: true });
    await writeFile(composeFile, "services: {}\n");
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    await recreateFoundryService(
      { composeFile, service: "foundry-dev" },
      runner,
      {
        composeFileIdentity: await composeIdentity({ composeFile }),
        dataMountSource: directory,
        runRoot: directory,
      },
    );
    await expect(lstat(lockDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      lstat(
        path.join(directory, "retired-foundry-locks", "options.json.lock-01"),
      ),
    ).resolves.toMatchObject({ mode: expect.any(Number) });
  });

  it("requires both running state and reported container health", async () => {
    const directory = await root();
    const config = {
      composeFile: path.join(directory, "compose.yml"),
      service: "foundry-dev",
    };
    await writeFile(config.composeFile, "services: {}\n");
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: `${JSON.stringify({ Health: "healthy", ID: "container", Service: "foundry-dev", State: "running" })}\n`,
    }));
    expect(
      await dockerServiceHealth(config, runner, {
        composeFileIdentity: await composeIdentity(config),
      }),
    ).toMatchObject({
      healthy: true,
    });
  });

  it("reports transient installed-build identity mismatch as retryable unhealthy state", async () => {
    const directory = await root();
    const config = {
      composeFile: path.join(directory, "compose.yml"),
      service: "foundry-dev",
      expectedComposeProject: "development",
    };
    await writeFile(config.composeFile, "services: {}\n");
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: `${JSON.stringify({ Health: "healthy", ID: "container", Service: "foundry-dev", State: "running" })}\n`,
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify([
          {
            Id: "container",
            Config: {
              Labels: {
                "com.docker.compose.project": "development",
                "com.docker.compose.service": "foundry-dev",
              },
            },
            State: { Status: "running" },
            Mounts: [
              {
                Type: "bind",
                Source: "/data-host",
                Destination: "/data",
                RW: true,
              },
            ],
          },
        ]),
      })
      .mockResolvedValueOnce({ code: 1, stderr: "starting", stdout: "" });
    await expect(
      dockerServiceHealth(config, runner, {
        composeFileIdentity: await composeIdentity(config),
        expectedDataMountSource: "/data-host",
        expectedFoundryVersion: "14.367",
        phase: "canonical",
      }),
    ).resolves.toMatchObject({
      healthy: false,
      reason: "FOUNDRY_RUNTIME_IDENTITY_MISMATCH",
    });
  });

  it("refuses Compose health or recreate when the leased candidate identity drifted", async () => {
    const directory = await root();
    const candidate = path.join(directory, "candidate");
    const composeFile = path.join(directory, "compose.yml");
    await mkdir(candidate);
    await writeFile(composeFile, "services: {}\n");
    const candidateIdentity = await readCandidateDirectoryIdentity(candidate);
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    await writeFile(path.join(candidate, "drift"), "changed");
    await expect(
      recreateFoundryService({ composeFile, service: "foundry-dev" }, runner, {
        candidatePath: candidate,
        candidateIdentity,
        composeFileIdentity: await composeIdentity({ composeFile }),
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_PATH_DRIFT" });
    expect(runner).not.toHaveBeenCalled();
  });

  it("records redirecting Foundry endpoints as reachable", async () => {
    const response = {
      headers: { get: () => "/dev/join" },
      status: 302,
    };
    expect(
      await endpointHealth(
        "https://example.test/dev",
        vi.fn(async () => response),
      ),
    ).toEqual({
      healthy: true,
      location: "/dev/join",
      status: 302,
    });
  });

  it("does not treat setup mode as candidate join readiness", async () => {
    const response = {
      headers: { get: () => "/dev/setup" },
      status: 302,
    };
    expect(
      await endpointHealth(
        "https://example.test/dev",
        vi.fn(async () => response),
        { expectedLocation: "/dev/join" },
      ),
    ).toMatchObject({ healthy: false, location: "/dev/setup", status: 302 });
  });

  it("rejects a symlinked Compose file before identity capture", async () => {
    const directory = await root();
    const target = path.join(directory, "compose-target.yml");
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(target, "services: {}\n");
    await symlink(target, composeFile);
    await expect(readComposeFileIdentity(composeFile)).rejects.toMatchObject({
      code: "COMPOSE_FILE_UNSAFE",
    });
  });

  it("creates and reloads an owner-only snapshot with project-directory semantics", async () => {
    const directory = await root();
    const source = path.join(directory, "compose.yml");
    await writeFile(source, "services:\n  foundry-dev: {}\n");
    const prepared = await createComposeSnapshot({
      runtime: { composeFile: source },
    });
    expect(prepared.config.runtime.composeProjectDirectory).toBe(directory);
    expect(prepared.config.runtime.composeFile).toBe(`${source}.d6e2-snapshot`);
    expect(prepared.composeIdentity.source.sha256).toBeTruthy();
    expect(
      (await lstat(prepared.config.runtime.composeFile)).mode & 0o077,
    ).toBe(0);
    const loaded = await loadComposeSnapshot({
      runtime: { composeFile: source },
    });
    expect(loaded.composeIdentity).toEqual(prepared.composeIdentity);
    await retireComposeSnapshot(loaded.config, loaded.composeIdentity);
    await expect(
      lstat(prepared.config.runtime.composeFile),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed when the source changes during snapshot creation", async () => {
    const directory = await root();
    const source = path.join(directory, "compose.yml");
    await writeFile(source, "services:\n  foundry-dev: {}\n");
    await expect(
      createComposeSnapshot(
        { runtime: { composeFile: source } },
        {
          beforeWrite: async () =>
            writeFile(source, "services: {changed: true}\n"),
        },
      ),
    ).rejects.toMatchObject({ code: "COMPOSE_SOURCE_DRIFT" });
    await expect(lstat(`${source}.d6e2-snapshot`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a symlinked candidate directory", async () => {
    const directory = await root();
    const candidate = path.join(directory, "candidate-link");
    const target = path.join(directory, "candidate-target");
    await mkdir(target);
    await symlink(target, candidate);
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(composeFile, "services: {}\n");
    await expect(
      assertCandidateComposeBind(
        { composeFile, service: "foundry-dev" },
        candidate,
        vi.fn(),
        { composeFileIdentity: await composeIdentity({ composeFile }) },
      ),
    ).rejects.toMatchObject({ code: "CANDIDATE_PATH_UNSAFE" });
  });

  it("requires the exact read-only candidate bind and container visibility", async () => {
    const candidate = await candidateDirectory();
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          services: {
            "foundry-dev": {
              volumes: [
                {
                  type: "bind",
                  source: "/data-host",
                  target: "/data",
                  read_only: false,
                },
                {
                  type: "bind",
                  source: candidate,
                  target: candidate,
                  read_only: true,
                },
              ],
            },
          },
        }),
      })
      .mockResolvedValueOnce({ code: 0, stderr: "", stdout: "" });
    const runtime = {
      composeFile: path.join(await root(), "compose.yml"),
      envFile: "/runtime/.env",
      service: "foundry-dev",
    };
    await writeFile(runtime.composeFile, "services: {}\n");
    const identity = await composeIdentity(runtime);
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: identity,
      }),
    ).resolves.toMatchObject({ bind: `${candidate}:ro` });
    await expect(
      assertCandidateSystemVisible(runtime, candidate, runner, {
        composeFileIdentity: identity,
      }),
    ).resolves.toMatchObject({ visible: true });
    expect(runner.mock.calls[0][1]).toEqual(
      expect.arrayContaining(["config", "--format", "json"]),
    );
    expect(runner.mock.calls[1][1]).toContain("exec");
  });

  it("rejects a missing candidate bind before container access", async () => {
    const directory = await root();
    const candidate = await candidateDirectory();
    const runtime = {
      composeFile: path.join(directory, "compose.yml"),
      service: "foundry-dev",
    };
    await writeFile(runtime.composeFile, "services: {}\n");
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: "services:\n  foundry-dev:\n    volumes: []\n",
    }));
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: await composeIdentity(runtime),
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_COMPOSE_BIND_MISSING" });
  });

  it.each([
    ["wrong service", { other: { volumes: [] } }],
    [
      "writable exact bind",
      {
        "foundry-dev": {
          volumes: [
            {
              type: "bind",
              source: "/private/tmp/candidate",
              target: "/private/tmp/candidate",
              read_only: false,
            },
          ],
        },
      },
    ],
    [
      "parent bind",
      {
        "foundry-dev": {
          volumes: [
            {
              type: "bind",
              source: "/private/tmp",
              target: "/private/tmp",
              read_only: true,
            },
          ],
        },
      },
    ],
    [
      "duplicate exact binds",
      {
        "foundry-dev": {
          volumes: [
            {
              type: "bind",
              source: "/private/tmp/candidate",
              target: "/private/tmp/candidate",
              read_only: true,
            },
            {
              type: "bind",
              source: "/private/tmp/candidate",
              target: "/private/tmp/candidate",
              read_only: true,
            },
          ],
        },
      },
    ],
    [
      "wrong target",
      {
        "foundry-dev": {
          volumes: [
            {
              type: "bind",
              source: "/private/tmp/candidate",
              target: "/candidate",
              read_only: true,
            },
          ],
        },
      },
    ],
    [
      "descendant overlay",
      {
        "foundry-dev": {
          volumes: [
            {
              type: "tmpfs",
              target:
                "/private/tmp/d6-core-client-performance-reduced-effects/packages",
            },
          ],
        },
      },
    ],
  ])("rejects %s Compose mount", async (_label, services) => {
    const candidate = await candidateDirectory();
    services = resolveCandidateFixture(services, candidate);
    const directory = await root();
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(composeFile, "services: {}\n");
    const runtime = { composeFile, service: "foundry-dev" };
    const identity = await composeIdentity(runtime);
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: JSON.stringify({ services }),
    }));
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: identity,
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_COMPOSE_BIND_MISSING" });
  });

  it("rejects malformed Compose JSON and identity drift", async () => {
    const directory = await root();
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(composeFile, "services: {}\n");
    const runtime = { composeFile, service: "foundry-dev" };
    const candidate = await candidateDirectory();
    const identity = await composeIdentity(runtime);
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: "not-json",
    }));
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: identity,
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_COMPOSE_BIND_MISSING" });
    await writeFile(composeFile, "services: {changed: true}\n");
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: identity,
      }),
    ).rejects.toMatchObject({ code: "COMPOSE_FILE_IDENTITY_DRIFT" });
  });

  it("rejects stale d6 worktree mounts even when the exact candidate bind exists", async () => {
    const directory = await root();
    const candidate = await candidateDirectory();
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(composeFile, "services: {}\n");
    const runtime = { composeFile, service: "foundry-dev" };
    const runner = vi.fn().mockResolvedValue({
      code: 0,
      stderr: "",
      stdout: JSON.stringify({
        services: {
          "foundry-dev": {
            volumes: [
              {
                type: "bind",
                source: "/data-host",
                target: "/data",
                read_only: false,
              },
              {
                type: "bind",
                source: candidate,
                target: candidate,
                read_only: true,
              },
              {
                type: "bind",
                source: "/private/tmp/d6-core-automated-foundry-acceptance",
                target: "/private/tmp/d6-core-automated-foundry-acceptance",
                read_only: true,
              },
            ],
          },
        },
      }),
    });
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: "/data-host",
        phase: "candidate",
        composeFileIdentity: await composeIdentity(runtime),
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_COMPOSE_BIND_MISSING" });
  });

  it("requires one writable canonical /data bind", async () => {
    const directory = await root();
    const candidate = await candidateDirectory();
    const dataPath = path.join(directory, "data");
    const composeFile = path.join(directory, "compose.yml");
    await mkdir(dataPath);
    await writeFile(composeFile, "services: {}\n");
    const runtime = { composeFile, service: "foundry-dev" };
    const runner = vi.fn().mockResolvedValue({
      code: 0,
      stderr: "",
      stdout: JSON.stringify({
        services: {
          "foundry-dev": {
            volumes: [
              {
                type: "bind",
                source: candidate,
                target: candidate,
                read_only: true,
              },
              {
                type: "bind",
                source: "/wrong/data",
                target: "/data",
                read_only: false,
              },
            ],
          },
        },
      }),
    });
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        dataMountSource: dataPath,
        phase: "candidate",
        composeFileIdentity: await composeIdentity(runtime),
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_COMPOSE_BIND_MISSING" });
  });

  it("rejects candidate replacement before the initial Compose validation without spawning Docker", async () => {
    const directory = await root();
    const candidate = path.join(directory, "candidate");
    await mkdir(candidate);
    const composeFile = path.join(directory, "compose.yml");
    await writeFile(composeFile, "services: {}\n");
    const runtime = { composeFile, service: "foundry-dev" };
    const runner = vi.fn();
    const candidateIdentity = await readCandidateDirectoryIdentity(candidate);
    await writeFile(path.join(candidate, "replacement-marker"), "drift\n");
    await expect(
      assertCandidateComposeBind(runtime, candidate, runner, {
        candidateIdentity,
        composeFileIdentity: await composeIdentity(runtime),
      }),
    ).rejects.toMatchObject({ code: "CANDIDATE_PATH_DRIFT" });
    expect(runner).not.toHaveBeenCalled();
  });
});
