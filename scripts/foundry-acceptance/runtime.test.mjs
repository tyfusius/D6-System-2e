import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  readlink,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  dockerServiceHealth,
  endpointHealth,
  recreateFoundryService,
  replaceEnvironmentValue,
  switchSystemSymlink,
  switchWorldEnvironment,
} from "./runtime.mjs";

async function root() {
  return mkdtemp(path.join(os.tmpdir(), "d6e2-runtime-test-"));
}

describe("reversible runtime selection", () => {
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
  const config = {
    composeFile: "/runtime/compose.yml",
    envFile: "/runtime/.env",
    service: "foundry-dev",
  };

  it("recreates only the configured Compose service without dependencies", async () => {
    const runner = vi.fn(async () => ({ code: 0, stderr: "", stdout: "" }));
    await recreateFoundryService(config, runner);
    expect(runner).toHaveBeenCalledWith(
      "docker",
      [
        "compose",
        "-f",
        "/runtime/compose.yml",
        "--env-file",
        "/runtime/.env",
        "up",
        "-d",
        "--force-recreate",
        "--no-deps",
        "foundry-dev",
      ],
      expect.any(Object),
    );
  });

  it("requires both running state and reported container health", async () => {
    const runner = vi.fn(async () => ({
      code: 0,
      stderr: "",
      stdout: `${JSON.stringify({ Health: "healthy", ID: "container", Service: "foundry-dev", State: "running" })}\n`,
    }));
    expect(await dockerServiceHealth(config, runner)).toMatchObject({
      healthy: true,
    });
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
});
