import { randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  readFile,
  readlink,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { AcceptanceError } from "./core.mjs";
import { runProcess } from "./browser.mjs";

function assertAbsolute(value, label) {
  if (!path.isAbsolute(value ?? "")) {
    throw new AcceptanceError(
      "INVALID_RUNTIME_PATH",
      `${label} must be an absolute path.`,
    );
  }
}

export function replaceEnvironmentValue(source, key, value) {
  const lines = source.split(/(?<=\n)/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (new RegExp(`^${key}=`).test(lines[index])) matches.push(index);
  }
  if (matches.length !== 1) {
    throw new AcceptanceError(
      "RUNTIME_ENV_KEY_COUNT",
      `Expected exactly one ${key}= entry, found ${matches.length}; runtime selection is blocked.`,
    );
  }
  const index = matches[0];
  const newline = lines[index].endsWith("\n") ? "\n" : "";
  lines[index] = `${key}=${value}${newline}`;
  return lines.join("");
}

async function atomicWrite(file, contents, mode = 0o600) {
  const temporary = `${file}.acceptance-${randomBytes(4).toString("hex")}`;
  await writeFile(temporary, contents, { mode });
  await rename(temporary, file);
  await chmod(file, mode);
}

export async function restoreWorldEnvironment({ contents, envFile, mode }) {
  assertAbsolute(envFile, "runtime.envFile");
  const details = await lstat(envFile);
  if (details.isSymbolicLink() || !details.isFile()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_NOT_REGULAR",
      `Refusing recovery because ${envFile} is not the configured regular environment file.`,
    );
  }
  await atomicWrite(envFile, contents, mode);
}

export async function switchWorldEnvironment({
  envFile,
  variable = "FOUNDRY_WORLD",
  worldId,
}) {
  assertAbsolute(envFile, "runtime.envFile");
  const envDetails = await lstat(envFile);
  if (envDetails.isSymbolicLink()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_SYMLINK",
      `Refusing to replace symlinked environment file ${envFile}; configure its exact regular-file target instead.`,
    );
  }
  if (!envDetails.isFile()) {
    throw new AcceptanceError(
      "RUNTIME_ENV_NOT_FILE",
      `runtime.envFile must be an existing regular file: ${envFile}.`,
    );
  }
  const original = await readFile(envFile, "utf8");
  const originalMode = envDetails.mode & 0o777;
  const updated = replaceEnvironmentValue(original, variable, worldId);
  await atomicWrite(envFile, updated, originalMode);
  return async () => atomicWrite(envFile, original, originalMode);
}

async function assertSymlink(linkPath) {
  const details = await lstat(linkPath);
  if (!details.isSymbolicLink()) {
    throw new AcceptanceError(
      "SYSTEM_INSTALL_NOT_SYMLINK",
      `Refusing to replace ${linkPath}; the established candidate integration path must be a symlink.`,
    );
  }
}

async function replaceSymlink(linkPath, target) {
  const temporary = `${linkPath}.acceptance-${randomBytes(4).toString("hex")}`;
  await symlink(target, temporary);
  try {
    await rename(temporary, linkPath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function restoreSystemSymlink({ installPath, target }) {
  assertAbsolute(installPath, "runtime.systemInstallPath");
  await assertSymlink(installPath);
  await replaceSymlink(installPath, target);
}

export async function switchSystemSymlink({ candidatePath, installPath }) {
  assertAbsolute(candidatePath, "candidateSystemPath");
  assertAbsolute(installPath, "runtime.systemInstallPath");
  await assertSymlink(installPath);
  const originalTarget = await readlink(installPath);
  await replaceSymlink(installPath, candidatePath);
  return async () => replaceSymlink(installPath, originalTarget);
}

function dockerArgs(config, action) {
  const prefix = ["compose", "-f", config.composeFile];
  if (config.envFile) prefix.push("--env-file", config.envFile);
  if (action === "recreate") {
    return [
      ...prefix,
      "up",
      "-d",
      "--force-recreate",
      "--no-deps",
      config.service,
    ];
  }
  return [...prefix, "ps", "--format", "json", config.service];
}

export async function recreateFoundryService(
  config,
  runner = runProcess,
  options = {},
) {
  assertAbsolute(config.composeFile, "runtime.composeFile");
  if (config.envFile) assertAbsolute(config.envFile, "runtime.envFile");
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.service ?? "")) {
    throw new AcceptanceError(
      "INVALID_SERVICE",
      "runtime.service must be one exact Compose service name.",
    );
  }
  const result = await runner("docker", dockerArgs(config, "recreate"), {
    childRegistry: options.childRegistry,
    env: process.env,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 30_000,
  });
  if (result.code !== 0) {
    throw new AcceptanceError(
      "RUNTIME_RECREATE_FAILED",
      `Failed to recreate ${config.service}: ${result.stderr.trim()}`,
    );
  }
}

export async function dockerServiceHealth(
  config,
  runner = runProcess,
  options = {},
) {
  const result = await runner("docker", dockerArgs(config, "health"), {
    childRegistry: options.childRegistry,
    env: process.env,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (result.code !== 0)
    return { healthy: false, reason: result.stderr.trim() };
  const lines = result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const service =
    lines.find((entry) => entry.Service === config.service) ?? lines[0];
  const state = String(service?.State ?? "").toLowerCase();
  const health = String(service?.Health ?? "").toLowerCase();
  return {
    healthy: state === "running" && (!health || health === "healthy"),
    health,
    id: service?.ID ?? service?.Name ?? "",
    state,
  };
}

export async function endpointHealth(
  baseUrl,
  fetcher = globalThis.fetch,
  options = {},
) {
  try {
    const response = await fetcher(baseUrl, {
      method: "GET",
      redirect: "manual",
      signal: options.signal
        ? globalThis.AbortSignal.any([
            options.signal,
            globalThis.AbortSignal.timeout(options.timeoutMs ?? 5_000),
          ])
        : globalThis.AbortSignal.timeout(options.timeoutMs ?? 5_000),
    });
    return {
      healthy: response.status >= 200 && response.status < 500,
      location: response.headers.get("location"),
      status: response.status,
    };
  } catch (error) {
    return {
      healthy: false,
      reason: error instanceof Error ? error.message : String(error),
      status: 0,
    };
  }
}
