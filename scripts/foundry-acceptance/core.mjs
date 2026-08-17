import { randomBytes, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ACCEPTANCE_MARKER_VERSION = 1;
export const DEFAULT_MINIMUMS = Object.freeze({
  chromiumMajor: 146,
  foundryBuild: 366,
  viewport: Object.freeze({ height: 768, width: 1024 }),
});
export const DEFAULT_VIEWPORT = Object.freeze({ height: 900, width: 1440 });
export const ROLE_NAMES = Object.freeze(["setup", "gm", "player"]);
export const WORLD_ID_PREFIX = "d6e2-acceptance-";

export class AcceptanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AcceptanceError";
    this.code = code;
    this.details = details;
  }
}

function invariant(condition, code, message, details) {
  if (!condition) throw new AcceptanceError(code, message, details);
}

export function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

export function createRunIdentity(now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z")
    .toLowerCase();
  const suffix = randomBytes(4).toString("hex");
  const runId = `${stamp}-${suffix}`;
  return Object.freeze({
    runId,
    worldId: `${WORLD_ID_PREFIX}${safeSlug(runId)}`,
  });
}

export async function createSecureRunRoot(baseDirectory = os.tmpdir()) {
  const root = await mkdtemp(
    path.join(path.resolve(baseDirectory), "d6e2-acceptance-"),
  );
  await chmod(root, 0o700);
  return root;
}

function resolvedChild(root, child) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, child);
  invariant(
    resolved.startsWith(`${resolvedRoot}${path.sep}`),
    "PATH_OUTSIDE_ROOT",
    `Refusing path outside ${resolvedRoot}.`,
    { path: resolved },
  );
  return resolved;
}

export function worldLeasePaths(worldsDirectory, identity) {
  invariant(
    identity.worldId.startsWith(WORLD_ID_PREFIX),
    "WORLD_ID_NOT_DISPOSABLE",
    `Disposable world IDs must begin with ${WORLD_ID_PREFIX}.`,
  );
  const worldDirectory = resolvedChild(worldsDirectory, identity.worldId);
  return Object.freeze({
    marker: path.join(worldDirectory, ".d6e2-acceptance-world.json"),
    manifest: path.join(worldDirectory, "world.json"),
    worldDirectory,
  });
}

export function buildWorldManifest(identity, options = {}) {
  return {
    id: identity.worldId,
    title: options.title ?? "D6 System 2e · Disposable Acceptance",
    description:
      "Synthetic repository acceptance world. Safe to delete only with its matching lease marker.",
    flags: {
      "d6-system-2e": {
        acceptanceFoundation: {
          leaseNonce: options.leaseNonce,
          runId: identity.runId,
        },
      },
    },
    system: options.systemId ?? "d6-system-2e",
    coreVersion: options.foundryVersion ?? "14.366",
    compatibility: { minimum: "14", verified: "14" },
    resetKeys: false,
    safeMode: false,
    version: "1.0.0",
  };
}

export async function provisionDisposableWorld({
  identity,
  worldsDirectory,
  systemId = "d6-system-2e",
  foundryVersion = "14.366",
}) {
  const paths = worldLeasePaths(worldsDirectory, identity);
  let exists = false;
  try {
    await stat(paths.worldDirectory);
    exists = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  invariant(
    !exists,
    "WORLD_ALREADY_EXISTS",
    `Refusing to reuse existing world directory ${paths.worldDirectory}.`,
  );

  const leaseNonce = randomUUID();
  await mkdir(paths.worldDirectory, { recursive: false, mode: 0o700 });
  const marker = {
    markerVersion: ACCEPTANCE_MARKER_VERSION,
    runId: identity.runId,
    worldId: identity.worldId,
    leaseNonce,
    systemId,
  };
  await writeFile(paths.marker, `${JSON.stringify(marker, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeFile(
    paths.manifest,
    `${JSON.stringify(
      buildWorldManifest(identity, { foundryVersion, leaseNonce, systemId }),
      null,
      2,
    )}\n`,
    "utf8",
  );
  return Object.freeze({ ...marker, ...paths });
}

export async function assertDisposableWorldLease(lease) {
  invariant(
    lease.worldId?.startsWith(WORLD_ID_PREFIX),
    "WORLD_ID_NOT_DISPOSABLE",
    "Refusing a world without the disposable acceptance prefix.",
  );
  const marker = JSON.parse(await readFile(lease.marker, "utf8"));
  invariant(
    marker.markerVersion === ACCEPTANCE_MARKER_VERSION &&
      marker.runId === lease.runId &&
      marker.worldId === lease.worldId &&
      marker.leaseNonce === lease.leaseNonce &&
      marker.systemId === lease.systemId,
    "WORLD_LEASE_MISMATCH",
    "Disposable-world marker does not match the active lease; cleanup is blocked.",
    { worldDirectory: lease.worldDirectory },
  );
  const manifest = JSON.parse(await readFile(lease.manifest, "utf8"));
  const manifestLease = manifest.flags?.["d6-system-2e"]?.acceptanceFoundation;
  invariant(
    manifest.id === lease.worldId &&
      manifest.system === lease.systemId &&
      manifestLease?.runId === lease.runId &&
      manifestLease?.leaseNonce === lease.leaseNonce,
    "WORLD_MANIFEST_MISMATCH",
    "World manifest no longer matches the disposable lease; cleanup is blocked.",
  );
  return true;
}

export async function removeDisposableWorld(lease) {
  await assertDisposableWorldLease(lease);
  await rm(lease.worldDirectory, { recursive: true, force: false });
}

export function parseFoundryBuild(value) {
  const match = String(value ?? "").match(/(?:^|\D)14[.\s-]*(\d{3})(?:\D|$)/i);
  return match ? Number(match[1]) : null;
}

export function parseChromiumMajor(value) {
  const match = String(value ?? "").match(
    /(?:chromium|chrome(?: for testing)?)\/?\s*(\d{2,3})(?:\.|\D|$)/i,
  );
  return match ? Number(match[1]) : null;
}

export function evaluatePreflight(observation, minimums = DEFAULT_MINIMUMS) {
  const failures = [];
  const warnings = [];
  const foundryBuild = parseFoundryBuild(observation.foundryVersion);
  const chromiumMajor = parseChromiumMajor(observation.browserVersion);
  if (foundryBuild === null) {
    failures.push(
      "Foundry build could not be determined from the rendered runtime.",
    );
  } else if (foundryBuild < minimums.foundryBuild) {
    failures.push(
      `Foundry Build ${foundryBuild} is below required Build ${minimums.foundryBuild}; recreate the QA runtime from the accepted image before continuing.`,
    );
  }
  if (chromiumMajor === null) {
    failures.push(
      "Chromium major version could not be determined from the acceptance browser.",
    );
  } else if (chromiumMajor < minimums.chromiumMajor) {
    failures.push(
      `Chromium ${chromiumMajor} is below required Chromium ${minimums.chromiumMajor}; update the acceptance browser before testing Foundry Build ${minimums.foundryBuild}.`,
    );
  }
  const viewport = observation.viewport ?? {};
  if (
    !Number.isInteger(viewport.width) ||
    !Number.isInteger(viewport.height) ||
    viewport.width < minimums.viewport.width ||
    viewport.height < minimums.viewport.height
  ) {
    failures.push(
      `Viewport ${viewport.width ?? "?"}×${viewport.height ?? "?"} is below ${minimums.viewport.width}×${minimums.viewport.height}; use ${DEFAULT_VIEWPORT.width}×${DEFAULT_VIEWPORT.height} for acceptance.`,
    );
  }
  if (observation.endpointHealthy !== true) {
    failures.push("Foundry endpoint health probe did not pass.");
  }
  if (observation.processHealthy !== true) {
    failures.push("Foundry process/container health probe did not pass.");
  }
  if (observation.systemId !== "d6-system-2e") {
    failures.push(
      `Rendered world uses ${observation.systemId ?? "an unknown system"}, not d6-system-2e.`,
    );
  }
  if (!String(observation.worldId ?? "").startsWith(WORLD_ID_PREFIX)) {
    failures.push(
      "Rendered world is not an identified disposable acceptance world.",
    );
  }
  if (observation.webglAvailable === false) {
    warnings.push(
      "WebGL is unavailable; ordinary document/API checks may continue, but canvas targeting and 3D dice must remain unclaimed.",
    );
  }
  return Object.freeze({
    chromiumMajor,
    failures: Object.freeze(failures),
    foundryBuild,
    ok: failures.length === 0,
    warnings: Object.freeze(warnings),
  });
}

export function resolveEnvironmentSecret(environment, variableName) {
  invariant(
    typeof variableName === "string" && /^[A-Z][A-Z0-9_]+$/.test(variableName),
    "INVALID_SECRET_ENV",
    "Secret configuration must name an uppercase environment variable, never contain a literal credential.",
  );
  const value = environment[variableName];
  invariant(
    typeof value === "string" && value.length > 0,
    "MISSING_SECRET_ENV",
    `Required secret environment variable ${variableName} is not set.`,
  );
  return value;
}

export function createRedactor(secretValues = []) {
  const secrets = secretValues
    .filter((value) => typeof value === "string" && value.length > 0)
    .sort((left, right) => right.length - left.length);
  const sensitiveKey = (key) =>
    /(?:authorization|cookie|password|passphrase|token|apikey|secret|session)/i.test(
      String(key).replace(/[^a-z0-9]/gi, ""),
    );
  const redactString = (input) => {
    let output = input;
    for (const secret of secrets)
      output = output.replaceAll(secret, "[REDACTED]");
    return output
      .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
      .replace(
        /(^|\n)(\s*(?:authorization|cookie|set-cookie)\s*:\s*)[^\n]*/gi,
        "$1$2[REDACTED]",
      )
      .replace(
        /((?:["']?)(?:authorization|cookie|set[-_]?cookie|password|passphrase|token|access[-_]?token|refresh[-_]?token|api[-_]?key|secret|session(?:[-_]?(?:id|key|token))?)(?:["']?)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
        "$1[REDACTED]",
      )
      .replace(/connect\.sid=[^;\s]+/gi, "connect.sid=[REDACTED]");
  };
  const visit = (input) => {
    if (typeof input === "string") return redactString(input);
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input).map(([key, nested]) => [
          key,
          sensitiveKey(key) ? "[REDACTED]" : visit(nested),
        ]),
      );
    }
    return input;
  };
  return (value) => JSON.stringify(visit(value));
}

export class EvidenceRecorder {
  constructor({ directory, redact = createRedactor() }) {
    this.directory = path.resolve(directory);
    this.redact = redact;
    this.file = path.join(this.directory, "checkpoints.jsonl");
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
  }

  async checkpoint(role, kind, payload) {
    invariant(
      ROLE_NAMES.includes(role) || role === "runtime",
      "INVALID_ROLE",
      `Unknown evidence role ${role}.`,
    );
    const record = {
      at: new Date().toISOString(),
      kind,
      payload: JSON.parse(this.redact(payload)),
      role,
    };
    await writeFile(this.file, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      flag: "a",
      mode: 0o600,
    });
    return record;
  }
}

export class RestorationStack {
  #entries = [];

  add(label, restore) {
    invariant(
      typeof restore === "function",
      "INVALID_RESTORATION",
      `Restoration ${label} must be callable.`,
    );
    this.#entries.push({ label, restore });
  }

  get size() {
    return this.#entries.length;
  }

  async restoreAll() {
    const failures = [];
    while (this.#entries.length > 0) {
      const entry = this.#entries.pop();
      try {
        await entry.restore();
      } catch (error) {
        failures.push({
          error: error instanceof Error ? error.message : String(error),
          label: entry.label,
        });
      }
    }
    return Object.freeze({
      failures: Object.freeze(failures),
      ok: failures.length === 0,
    });
  }
}

export function validateFoundationConfig(config) {
  invariant(
    config && typeof config === "object",
    "INVALID_CONFIG",
    "Acceptance config must be an object.",
  );
  invariant(
    /^https?:\/\//.test(config.baseUrl ?? ""),
    "INVALID_BASE_URL",
    "baseUrl must be an HTTP(S) URL.",
  );
  invariant(
    path.isAbsolute(config.dataPath ?? ""),
    "INVALID_DATA_PATH",
    "dataPath must be absolute.",
  );
  invariant(
    path.isAbsolute(config.browserBinary ?? ""),
    "INVALID_BROWSER_BINARY",
    "browserBinary must be absolute.",
  );
  invariant(
    path.isAbsolute(config.candidateSystemPath ?? ""),
    "INVALID_SYSTEM_PATH",
    "candidateSystemPath must be absolute.",
  );
  invariant(
    path.isAbsolute(config.artifactRoot ?? ""),
    "INVALID_ARTIFACT_ROOT",
    "artifactRoot must be an absolute temporary path outside the repository.",
  );
  for (const [label, value] of [
    ["runtime.composeFile", config.runtime?.composeFile],
    ["runtime.envFile", config.runtime?.envFile],
    ["runtime.systemInstallPath", config.runtime?.systemInstallPath],
  ]) {
    invariant(
      path.isAbsolute(value ?? ""),
      "INVALID_RUNTIME_PATH",
      `${label} must be absolute.`,
    );
  }
  invariant(
    /^[a-zA-Z0-9_.-]+$/.test(config.runtime?.service ?? ""),
    "INVALID_SERVICE",
    "runtime.service must name one exact Compose service.",
  );
  invariant(
    typeof config.roles?.gmUserName === "string" &&
      config.roles.gmUserName.length > 0 &&
      typeof config.roles?.playerUserName === "string" &&
      config.roles.playerUserName.length > 0,
    "INVALID_ROLES",
    "GM and player display names are required.",
  );
  invariant(
    Number.isInteger(config.viewport?.width) &&
      Number.isInteger(config.viewport?.height),
    "INVALID_VIEWPORT",
    "viewport width and height must be integers.",
  );
  const serviceHealthMs = config.timeouts?.serviceHealthMs ?? 60_000;
  const restorationMs = config.timeouts?.restorationMs ?? 90_000;
  invariant(
    Number.isInteger(serviceHealthMs) &&
      serviceHealthMs >= 5_000 &&
      serviceHealthMs <= 300_000,
    "INVALID_TIMEOUTS",
    "timeouts.serviceHealthMs must be an integer from 5000 through 300000.",
  );
  invariant(
    Number.isInteger(restorationMs) &&
      restorationMs >= serviceHealthMs + 30_000 &&
      restorationMs <= 360_000,
    "INVALID_TIMEOUTS",
    "timeouts.restorationMs must be an integer at least 30000ms above serviceHealthMs and no greater than 360000.",
  );
  invariant(
    config.secrets &&
      Object.values(config.secrets).every(
        (name) => name === null || /^[A-Z][A-Z0-9_]+$/.test(name),
      ),
    "INVALID_SECRET_CONFIG",
    "Every configured secret must be an environment-variable name.",
  );
  const credentialKey =
    /(?:authorization|cookie|password|passphrase|token|apikey|secret|session|credential)/i;
  const findCredentialField = (value, segments = []) => {
    if (!value || typeof value !== "object") return null;
    for (const [key, nested] of Object.entries(value)) {
      if (segments.length === 0 && key === "secrets") continue;
      const normalized = key.replace(/[^a-z0-9]/gi, "");
      if (credentialKey.test(normalized)) return [...segments, key].join(".");
      const match = findCredentialField(nested, [...segments, key]);
      if (match) return match;
    }
    return null;
  };
  const credentialField = findCredentialField(config);
  invariant(
    !credentialField,
    "LITERAL_SECRET_FIELD",
    "Credential-shaped fields are forbidden; use the secrets environment-variable map.",
    { field: credentialField },
  );
  return config;
}
