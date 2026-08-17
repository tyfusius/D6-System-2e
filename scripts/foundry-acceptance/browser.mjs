import { spawn } from "node:child_process";
import { chmod, lstat, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { AcceptanceError, ROLE_NAMES } from "./core.mjs";

const CHROMIUM_PROFILE_LOCKS = Object.freeze([
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
]);

function joinUserIdentity(user) {
  return {
    active: user?.active === true,
    id: user?.id ?? user?.identifier,
    name: user?.name ?? user?.label,
  };
}

export function resolveGmJoinUser(users, expectedName) {
  const identities = Array.from(users ?? [], joinUserIdentity).filter(
    (user) => typeof user.id === "string" && typeof user.name === "string",
  );
  const exact = identities.filter((user) => user.name === expectedName);
  if (exact.length > 1) {
    throw new AcceptanceError(
      "GM_USER_AMBIGUOUS",
      `Configured Foundry GM ${expectedName} is ambiguous.`,
    );
  }
  if (exact.length === 1) {
    return Object.freeze(exact[0]);
  }

  const generatedDefaults = identities.filter((user) =>
    /^Gamemaster\d*$/.test(user.name),
  );
  if (expectedName === "Gamemaster" && generatedDefaults.length === 1) {
    return Object.freeze(generatedDefaults[0]);
  }
  if (expectedName === "Gamemaster" && generatedDefaults.length > 1) {
    throw new AcceptanceError(
      "GM_USER_AMBIGUOUS",
      "Multiple Foundry-generated Gamemaster users exist; configure an exact GM display name.",
    );
  }
  throw new AcceptanceError(
    "GM_USER_ABSENT",
    `Configured Foundry GM ${expectedName} is absent from the join data.`,
  );
}

export function buildJoinUserDiscoveryExpression() {
  return `(() => {
    const username = document.querySelector('input[name="username"]#join-username');
    if (!username) throw new Error("Foundry join username input is unavailable.");
    username.value = "";
    username.focus();
    username.dispatchEvent(new Event("input", { bubbles: true }));
    const entries = [...document.querySelectorAll('#autocomplete li')].map((entry) => ({
      active: "disabled" in entry.dataset,
      identifier: entry.dataset.identifier,
      label: entry.textContent.trim(),
    }));
    return JSON.stringify({ users: entries });
  })()`;
}

export function buildFoundryReadyExpression({
  expectedUrl,
  pollIntervalMs = 100,
  timeoutMs = 20_000,
}) {
  return `(() => new Promise((resolve) => {
    const expectedUrl = ${JSON.stringify(new URL(expectedUrl).toString())};
    const deadline = globalThis.Date.now() + ${JSON.stringify(timeoutMs)};
    const poll = () => {
      const shellPresent = Boolean(globalThis.document?.querySelector?.("#sidebar"));
      const gamePresent = globalThis.game != null;
      if (globalThis.location?.href !== expectedUrl) {
        resolve(JSON.stringify({ gamePresent, ready: false, reason: "navigation", shellPresent }));
        return;
      }
      if (globalThis.game?.ready === true) {
        resolve(JSON.stringify({ gamePresent: true, ready: true, reason: "ready", shellPresent }));
        return;
      }
      if (globalThis.Date.now() > deadline) {
        resolve(JSON.stringify({
          gamePresent,
          ready: false,
          reason: gamePresent ? "timeout" : "missing-game",
          shellPresent,
        }));
        return;
      }
      globalThis.setTimeout(poll, ${JSON.stringify(pollIntervalMs)});
    };
    poll();
  }))()`;
}

function processResult(command, args, result) {
  if (result.code !== 0) {
    throw new AcceptanceError(
      "PROCESS_FAILED",
      `${path.basename(command)} ${args[0] ?? ""} failed with exit code ${result.code}: ${result.stderr.trim()}`,
      {
        args,
        code: result.code,
        stderr: result.stderr,
        stdout: result.stdout,
      },
    );
  }
  return result.stdout.trim();
}

export function resolveGStackWelcomeTab(tabsOutput) {
  const matches = String(tabsOutput)
    .split("\n")
    .map((line) =>
      line.match(
        /^\s*(?:→\s*)?\[(\d+)\]\s+.+\s+—\s+(http:\/\/127\.0\.0\.1:\d+\/welcome)$/,
      ),
    )
    .filter(Boolean)
    .map((match) => ({ id: Number(match[1]), url: match[2] }));
  if (matches.length !== 1) {
    throw new AcceptanceError(
      "GSTACK_WELCOME_AMBIGUOUS",
      "GStack startup must expose exactly one public loopback welcome tab.",
      { count: matches.length },
    );
  }
  return Object.freeze(matches[0]);
}

export class HarnessChildRegistry {
  constructor() {
    this.children = new Set();
  }

  track(child) {
    this.children.add(child);
    const release = () => this.children.delete(child);
    child.once("close", release);
    child.once("error", release);
    return release;
  }

  terminateAll(signal = "SIGKILL") {
    let signaled = 0;
    for (const child of [...this.children]) {
      if (
        typeof child.exitCode === "number" ||
        typeof child.signalCode === "string"
      ) {
        this.children.delete(child);
        continue;
      }
      child.kill(signal);
      signaled += 1;
    }
    return signaled;
  }
}

export function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const spawnImpl = options.spawnImpl ?? spawn;
    const child = spawnImpl(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const releaseChild = options.childRegistry?.track(child);
    let stdout = "";
    let stderr = "";
    let aborted = false;
    let abortReason = "";
    let forceTimer;
    let timeoutTimer;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      if (forceTimer) globalThis.clearTimeout(forceTimer);
      if (timeoutTimer) globalThis.clearTimeout(timeoutTimer);
      options.signal?.removeEventListener("abort", abortChild);
      releaseChild?.();
      callback();
    };
    const abortChild = (reason = "signal") => {
      if (aborted || settled) return;
      aborted = true;
      abortReason = typeof reason === "string" ? reason : "signal";
      child.kill("SIGTERM");
      forceTimer = globalThis.setTimeout(
        () => child.kill("SIGKILL"),
        options.abortGraceMs ?? 500,
      );
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) =>
      finish(() =>
        aborted
          ? reject(
              new AcceptanceError(
                "PROCESS_ABORTED",
                `${path.basename(command)} was aborted during ${abortReason}.`,
              ),
            )
          : reject(error),
      ),
    );
    child.on("close", (code) =>
      finish(() =>
        aborted
          ? reject(
              new AcceptanceError(
                "PROCESS_ABORTED",
                `${path.basename(command)} was aborted during ${abortReason}.`,
                { code: code ?? -1 },
              ),
            )
          : resolve({ code: code ?? -1, stderr, stdout }),
      ),
    );
    if (options.signal?.aborted) abortChild("signal");
    else options.signal?.addEventListener("abort", abortChild, { once: true });
    if (options.timeoutMs) {
      timeoutTimer = globalThis.setTimeout(
        () => abortChild("timeout"),
        options.timeoutMs,
      );
    }
    if (options.stdin !== undefined) child.stdin.end(options.stdin);
    else child.stdin.end();
  });
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function escapeRegularExpression(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findOwnedChromiumProcesses(output, { executable, profile }) {
  if (!path.isAbsolute(executable ?? "") || !path.isAbsolute(profile ?? "")) {
    throw new AcceptanceError(
      "BROWSER_PROCESS_IDENTITY_INVALID",
      "Browser process discovery requires exact absolute executable and profile paths.",
    );
  }
  const processes = String(output)
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      command: match[3],
      pid: Number(match[1]),
      ppid: Number(match[2]),
    }));
  const executablePattern = new RegExp(
    `(?:^|[\\s"'])${escapeRegularExpression(executable)}(?:[\\s"']|$)`,
  );
  const profilePattern = new RegExp(
    `(?:^|\\s)--user-data-dir=(?:"${escapeRegularExpression(profile)}"|'${escapeRegularExpression(profile)}'|${escapeRegularExpression(profile)})(?:\\s|$)`,
  );
  const owned = new Set(
    processes
      .filter(
        (process) =>
          executablePattern.test(process.command) &&
          profilePattern.test(process.command),
      )
      .map((process) => process.pid),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes) {
      if (!owned.has(process.pid) && owned.has(process.ppid)) {
        owned.add(process.pid);
        changed = true;
      }
    }
  }
  return processes
    .filter((process) => owned.has(process.pid))
    .map(({ pid, ppid }) => Object.freeze({ pid, ppid }));
}

export async function inspectBrowserGeneration({
  childRegistry,
  executable,
  profile,
  processRunner = runProcess,
  signal,
  stateFile,
}) {
  const result = await processRunner(
    "/bin/ps",
    ["-axo", "pid=,ppid=,command="],
    { childRegistry, signal, timeoutMs: 5_000 },
  );
  processResult("/bin/ps", ["-axo"], result);
  const locks = [];
  for (const name of CHROMIUM_PROFILE_LOCKS) {
    if (await pathExists(path.join(profile, name))) locks.push(name);
  }
  return Object.freeze({
    locks: Object.freeze(locks),
    processes: Object.freeze(
      findOwnedChromiumProcesses(result.stdout, { executable, profile }),
    ),
    stateFilePresent: await pathExists(stateFile),
  });
}

export class BrowserRoleSession {
  constructor({
    binary,
    childRegistry,
    chromiumExecutable = process.env.GSTACK_CHROMIUM_PATH,
    daemonServerPath = path.resolve(path.dirname(binary), "../src/server.ts"),
    headed = true,
    profileInspector = inspectBrowserGeneration,
    generationLeaseHooks = {},
    role,
    runRoot,
    runner = runProcess,
  }) {
    if (!ROLE_NAMES.includes(role)) {
      throw new AcceptanceError(
        "INVALID_ROLE",
        `Unknown browser role ${role}.`,
      );
    }
    this.binary = binary;
    this.childRegistry = childRegistry;
    this.chromiumExecutable = chromiumExecutable;
    this.daemonServerPath = daemonServerPath;
    this.generationLeaseHooks = generationLeaseHooks;
    this.profileInspector = profileInspector;
    this.role = role;
    this.runner = runner;
    this.signal = undefined;
    this.started = false;
    this.generationCount = 0;
    this.generation = undefined;
    this.commandQueue = Promise.resolve();
    this.browserRoot = path.join(runRoot, "browser");
    this.roleRoot = path.join(this.browserRoot, role);
    this.runRoot = runRoot;
    this.generationsRoot = path.join(this.roleRoot, "generations");
    this.stateFile = undefined;
    this.profile = path.join(this.roleRoot, "chromium-profile");
    this.baseEnvironment = {
      ...process.env,
      BROWSE_HEADED: headed ? "1" : "0",
      CHROMIUM_PROFILE: this.profile,
    };
    this.environment = this.baseEnvironment;
  }

  async initialize() {
    await mkdir(this.generationsRoot, { recursive: true, mode: 0o700 });
    await mkdir(this.profile, { recursive: true, mode: 0o700 });
    await chmod(this.browserRoot, 0o700);
    await chmod(this.roleRoot, 0o700);
    await chmod(this.generationsRoot, 0o700);
    await chmod(this.profile, 0o700);
  }

  async command(name, args = [], options = {}) {
    const environment = options.environment ?? this.environment;
    const current = this.commandQueue.then(() =>
      this.runner(this.binary, [name, ...args], {
        childRegistry: this.childRegistry,
        env: environment,
        signal: options.signal ?? this.signal,
        stdin: options.stdin,
        timeoutMs: options.timeoutMs,
      }),
    );
    this.commandQueue = current.catch(() => undefined);
    const result = await current;
    return processResult(this.binary, [name, ...args], result);
  }

  async inspectGeneration(generation, options = {}) {
    if (!path.isAbsolute(this.chromiumExecutable ?? "")) {
      throw new AcceptanceError(
        "BROWSER_EXECUTABLE_REQUIRED",
        `The ${this.role} browser role requires an exact Chromium executable path for lifecycle verification.`,
      );
    }
    return this.profileInspector({
      childRegistry: this.childRegistry,
      executable: this.chromiumExecutable,
      profile: this.profile,
      signal: options.signal ?? this.signal,
      stateFile: generation.stateFile,
    });
  }

  async assertProfileAvailable() {
    const stateFile =
      this.generation?.stateFile ??
      path.join(this.generationsRoot, "no-active-generation", "browse.json");
    const observation = await this.inspectGeneration({ stateFile });
    if (observation.processes.length > 0 || observation.locks.length > 0) {
      throw new AcceptanceError(
        "BROWSER_PROFILE_BUSY",
        `The ${this.role} Chromium profile is still owned or locked.`,
        {
          lockNames: observation.locks,
          processCount: observation.processes.length,
          role: this.role,
        },
      );
    }
  }

  async start() {
    if (this.generation && this.generation.status !== "stopped") {
      throw new AcceptanceError(
        "BROWSER_ROLE_ACTIVE",
        `The ${this.role} browser role still has an active or unresolved generation.`,
      );
    }
    await this.initialize();
    await this.assertProfileAvailable();
    this.generationCount += 1;
    const generationRoot = path.join(
      this.generationsRoot,
      String(this.generationCount).padStart(4, "0"),
    );
    const stateFile = path.join(generationRoot, "browse.json");
    await mkdir(generationRoot, { recursive: false, mode: 0o700 });
    const environment = {
      ...this.baseEnvironment,
      BROWSE_STATE_FILE: stateFile,
    };
    const generation = {
      generation: this.generationCount,
      environment,
      generationRoot,
      stateFile,
      status: "starting",
      stopPromise: undefined,
    };
    this.generation = generation;
    this.stateFile = stateFile;
    this.environment = environment;
    this.started = true;
    const leaseSpec = Object.freeze({
      browserBinary: this.binary,
      daemonServerPath: this.daemonServerPath,
      executable: this.chromiumExecutable,
      generation: generation.generation,
      generationRoot,
      profile: this.profile,
      role: this.role,
      runRoot: this.runRoot,
      stateFile,
    });
    generation.leaseSpec = leaseSpec;
    const bindPlannedGeneration = (planned) => {
      const exactBinding =
        planned &&
        planned.role === leaseSpec.role &&
        planned.generation === leaseSpec.generation &&
        path.resolve(planned.runRoot) === path.resolve(leaseSpec.runRoot) &&
        path.resolve(planned.generationRoot) ===
          path.resolve(leaseSpec.generationRoot) &&
        path.resolve(planned.profile) === path.resolve(leaseSpec.profile) &&
        path.resolve(planned.stateFile) === path.resolve(leaseSpec.stateFile);
      if (!exactBinding) {
        throw new AcceptanceError(
          "BROWSER_GENERATION_LEASE_BINDING_MISMATCH",
          `The ${this.role} browser generation returned a different durable lease binding.`,
          { generation: generation.generation, role: this.role },
        );
      }
      generation.leaseSpec = planned;
    };
    try {
      await this.generationLeaseHooks.beforeStart?.(
        leaseSpec,
        bindPlannedGeneration,
      );
      await this.command("newtab", [], { environment });
      await this.generationLeaseHooks.afterStart?.(leaseSpec);
      generation.status = "active";
    } catch (error) {
      generation.status = "start-failed";
      throw error;
    }
  }

  async stop(options = {}) {
    const generation = this.generation;
    if (!generation || generation.status === "stopped") {
      return { alreadyStopped: true, attempted: false };
    }
    if (!generation.stopPromise) {
      generation.stopPromise = this.stopGeneration(generation, options);
    }
    return generation.stopPromise;
  }

  async stopGeneration(generation, options = {}) {
    generation.status = "stopping";
    const result = await this.retireGeneration(generation, options);
    const alreadyStopped = result?.alreadyStopped === true;
    return { alreadyStopped, attempted: !alreadyStopped };
  }

  async retireGeneration(generation, options = {}) {
    if (this.generation !== generation) {
      throw new AcceptanceError(
        "BROWSER_GENERATION_MISMATCH",
        `Refusing to retire a non-current ${this.role} browser generation.`,
      );
    }
    await this.generationLeaseHooks.beforeRetire?.(generation.leaseSpec);
    if (!this.generationLeaseHooks.retireArtifacts) {
      throw new AcceptanceError(
        "BROWSER_DURABLE_RETIREMENT_REQUIRED",
        `The ${this.role} leased browser generation lacks its durable artifact-retirement hook.`,
      );
    }
    const result = await this.generationLeaseHooks.retireArtifacts(
      generation.leaseSpec,
      options,
    );
    await this.generationLeaseHooks.afterRetire?.(generation.leaseSpec);
    generation.status = "stopped";
    this.started = false;
    return result;
  }

  setSignal(signal) {
    this.signal = signal;
  }

  setGenerationLeaseHooks(hooks) {
    this.generationLeaseHooks = hooks ?? {};
  }

  async setViewport(viewport) {
    return this.command("viewport", [`${viewport.width}x${viewport.height}`]);
  }

  async navigate(url) {
    return this.command("goto", [url]);
  }

  async currentUrl() {
    return this.command("url");
  }

  async chain(commands) {
    return this.command("chain", [], { stdin: JSON.stringify(commands) });
  }

  async evaluateFile(file, options = {}) {
    return this.command("eval", [file], options);
  }

  async importCookies(file) {
    return this.command("cookie-import", [file]);
  }

  async browserVersion() {
    return this.command("js", ["navigator.userAgent"]);
  }

  async discoverJoinUsers() {
    await this.waitForJoinForm();
    return this.readJoinUsers();
  }

  async waitForJoinForm() {
    return this.command("wait", ["#join-username"]);
  }

  async readJoinUsers() {
    return this.command("js", [buildJoinUserDiscoveryExpression()]);
  }

  async waitForFoundryReady({
    expectedUrl,
    pollIntervalMs = 100,
    timeoutMs = 20_000,
  }) {
    const output = await this.command(
      "js",
      [
        buildFoundryReadyExpression({
          expectedUrl,
          pollIntervalMs,
          timeoutMs,
        }),
      ],
      { timeoutMs: timeoutMs + 5_000 },
    );
    const result = parseBrowserJson(output);
    if (result.ready === true && result.reason === "ready") return result;
    const code =
      result.reason === "navigation"
        ? "FOUNDRY_READY_NAVIGATION"
        : result.reason === "missing-game"
          ? "FOUNDRY_READY_MISSING_GAME"
          : "FOUNDRY_READY_TIMEOUT";
    throw new AcceptanceError(
      code,
      `The ${this.role} Foundry client did not reach the public game-ready lifecycle boundary.`,
      {
        gamePresent: result.gamePresent === true,
        reason: result.reason,
        role: this.role,
        shellPresent: result.shellPresent === true,
      },
    );
  }

  async consoleSnapshot() {
    return this.command("console");
  }

  async networkSnapshot() {
    return this.command("network");
  }

  async resourceFailuresSnapshot() {
    return this.command("js", [
      `JSON.stringify({
        location: globalThis.location?.href,
        resources: globalThis.performance.getEntriesByType("resource")
          .map((entry) => ({
            initiatorType: entry.initiatorType,
            name: entry.name,
            responseStatus: entry.responseStatus ?? 0,
          }))
          .filter((entry) => entry.responseStatus >= 400)
      })`,
    ]);
  }

  async retireGStackWelcomeTab() {
    const currentUrl = await this.currentUrl();
    const welcome = resolveGStackWelcomeTab(await this.command("tabs"));
    if (currentUrl !== "about:blank") {
      throw new AcceptanceError(
        "GSTACK_STARTUP_LOCATION",
        "GStack startup must leave the harness-owned active tab at about:blank.",
        { currentUrl },
      );
    }
    const evidence = {
      consoleOutput: await this.consoleSnapshot(),
      currentUrl,
      networkOutput: await this.networkSnapshot(),
      welcome,
    };
    await this.command("closetab", [String(welcome.id)]);
    const remainingTabs = await this.command("tabs");
    if (remainingTabs.includes(welcome.url)) {
      throw new AcceptanceError(
        "GSTACK_WELCOME_RETAINED",
        "GStack loopback welcome tab remained after exact public close.",
      );
    }
    return { ...evidence, remainingTabs, retired: true };
  }

  async clearDiagnostics() {
    await this.command("console", ["--clear"]);
    await this.command("network", ["--clear"]);
  }
}

function normalizedBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function foundryRoute(baseUrl, relative) {
  return new URL(
    relative.replace(/^\//, ""),
    normalizedBaseUrl(baseUrl),
  ).toString();
}

function sameSite(value) {
  const normalized = value?.toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return "Lax";
}

export function cookieFromSetCookie(header, baseUrl) {
  const parts = header.split(";").map((part) => part.trim());
  const first = parts.shift();
  const separator = first?.indexOf("=") ?? -1;
  if (!first || separator <= 0) return null;
  const url = new URL(baseUrl);
  const attributes = new Map(
    parts.map((part) => {
      const index = part.indexOf("=");
      return index < 0
        ? [part.toLowerCase(), true]
        : [part.slice(0, index).toLowerCase(), part.slice(index + 1)];
    }),
  );
  const expires = attributes.get("expires");
  return {
    domain: String(attributes.get("domain") ?? url.hostname).replace(/^\./, ""),
    expires:
      typeof expires === "string" && Number.isFinite(Date.parse(expires))
        ? Math.floor(Date.parse(expires) / 1000)
        : -1,
    httpOnly: attributes.has("httponly"),
    name: first.slice(0, separator),
    path: String(attributes.get("path") ?? "/"),
    sameSite: sameSite(attributes.get("samesite")),
    secure: attributes.has("secure") || url.protocol === "https:",
    value: first.slice(separator + 1),
  };
}

function responseCookies(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values;
}

function parseResponseCookies(response, baseUrl) {
  return responseCookies(response)
    .map((header) => cookieFromSetCookie(header, baseUrl))
    .filter(Boolean);
}

function mergeCookies(...groups) {
  const merged = new Map();
  for (const cookie of groups.flat()) {
    merged.set(`${cookie.domain}\n${cookie.path}\n${cookie.name}`, cookie);
  }
  return [...merged.values()];
}

function requestCookieHeader(cookies) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

async function parseAuthenticationResult(response, route) {
  try {
    return typeof response.json === "function"
      ? await response.json()
      : JSON.parse(await response.text());
  } catch {
    throw new AcceptanceError(
      "FOUNDRY_AUTH_INVALID_RESPONSE",
      `Foundry ${route} authentication returned an invalid JSON response.`,
    );
  }
}

export async function requestFoundrySession({
  baseUrl,
  fetcher = globalThis.fetch,
  fields,
  route,
  secret,
  signal,
  timeoutMs = 10_000,
}) {
  const requestSignal = signal
    ? globalThis.AbortSignal.any([
        signal,
        globalThis.AbortSignal.timeout(timeoutMs),
      ])
    : globalThis.AbortSignal.timeout(timeoutMs);
  const routeUrl = foundryRoute(baseUrl, route);
  const entryResponse = await fetcher(routeUrl, {
    headers: { accept: "text/html" },
    method: "GET",
    redirect: "manual",
    signal: requestSignal,
  });
  if (entryResponse.status !== 200) {
    throw new AcceptanceError(
      "FOUNDRY_AUTH_ENTRY_FAILED",
      `Foundry ${route} entry failed with HTTP ${entryResponse.status}.`,
    );
  }
  const entryCookies = parseResponseCookies(entryResponse, baseUrl);
  if (entryCookies.length === 0) {
    throw new AcceptanceError(
      "FOUNDRY_AUTH_NO_COOKIE",
      `Foundry ${route} entry returned no session cookie.`,
    );
  }

  const response = await fetcher(routeUrl, {
    body: JSON.stringify({ ...fields, password: secret }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: requestCookieHeader(entryCookies),
    },
    method: "POST",
    redirect: "manual",
    signal: requestSignal,
  });
  if (response.status !== 200) {
    throw new AcceptanceError(
      "FOUNDRY_AUTH_FAILED",
      `Foundry ${route} authentication failed with HTTP ${response.status}.`,
    );
  }

  const result = await parseAuthenticationResult(response, route);
  if (
    result?.request !== fields.action ||
    result?.status !== "success" ||
    typeof result.redirect !== "string"
  ) {
    throw new AcceptanceError(
      "FOUNDRY_AUTH_AMBIGUOUS",
      `Foundry ${route} authentication returned an ambiguous result.`,
    );
  }
  const redirectUrl = new URL(result.redirect, normalizedBaseUrl(baseUrl));
  if (fields.action === "join") {
    const expectedRedirect = new URL(foundryRoute(baseUrl, "game"));
    if (redirectUrl.toString() !== expectedRedirect.toString()) {
      throw new AcceptanceError(
        "FOUNDRY_AUTH_AMBIGUOUS",
        "Foundry join authentication returned an unexpected redirect.",
      );
    }
  }

  return Object.freeze({
    cookies: mergeCookies(
      entryCookies,
      parseResponseCookies(response, baseUrl),
    ),
    redirectUrl: redirectUrl.toString(),
  });
}

function exactUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

async function assertBrowserLocation(roleSession, expectedUrl, code, message) {
  const current = exactUrl(await roleSession.currentUrl());
  const expected = exactUrl(expectedUrl);
  if (!current || !expected || current !== expected) {
    throw new AcceptanceError(code, message, {
      actualUrl: current ?? "invalid",
      expectedUrl: expected,
      role: roleSession.role,
    });
  }
  return current;
}

export async function authenticateBrowserSession({
  baseUrl,
  fetcher = globalThis.fetch,
  fields = {},
  roleSession,
  route,
  runRoot,
  secret,
  signal,
  timeoutMs,
}) {
  const joinUrl = foundryRoute(baseUrl, route);
  await assertBrowserLocation(
    roleSession,
    joinUrl,
    "BROWSER_ORIGIN_MISMATCH",
    `The ${roleSession.role} browser is not on the exact Foundry ${route} page; session import blocked.`,
  );
  const foundrySession = await requestFoundrySession({
    baseUrl,
    fetcher,
    fields,
    route,
    secret,
    signal,
    timeoutMs,
  });
  await assertBrowserLocation(
    roleSession,
    joinUrl,
    "BROWSER_ORIGIN_MISMATCH",
    `The ${roleSession.role} browser left the exact Foundry ${route} page before session import.`,
  );
  const authDirectory = path.join(runRoot, "auth");
  await mkdir(authDirectory, { recursive: true, mode: 0o700 });
  const cookieFile = path.join(
    authDirectory,
    `${roleSession.role}-${Date.now()}.json`,
  );
  await writeFile(cookieFile, JSON.stringify(foundrySession.cookies), {
    mode: 0o600,
  });
  try {
    await roleSession.importCookies(cookieFile);
  } finally {
    await rm(cookieFile, { force: true });
  }
  return foundrySession;
}

function parseBrowserJson(output) {
  const start = String(output).indexOf("{");
  const end = String(output).lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new AcceptanceError(
      "BROWSER_RESULT_INVALID",
      "Browser result contained no JSON object.",
    );
  }
  try {
    return JSON.parse(String(output).slice(start, end + 1));
  } catch {
    throw new AcceptanceError(
      "BROWSER_RESULT_INVALID",
      "Browser result contained malformed JSON.",
    );
  }
}

function assertEntryAuthority(result, { expectedRole, expectedUserId, lease }) {
  const matches =
    result?.userId === expectedUserId &&
    result?.worldId === lease.worldId &&
    result?.systemId === lease.systemId &&
    result?.runId === lease.runId &&
    result?.leaseNonce === lease.leaseNonce &&
    result?.isGM === (expectedRole === "gm");
  if (!matches) {
    throw new AcceptanceError(
      "BROWSER_AUTHORITY_MISMATCH",
      `The ${expectedRole} browser did not enter with the exact authenticated identity and disposable lease.`,
      {
        expectedRole,
        expectedUserId,
        role: result?.isGM === true ? "gm" : "player",
        systemMatches: result?.systemId === lease.systemId,
        userMatches: result?.userId === expectedUserId,
        worldMatches: result?.worldId === lease.worldId,
      },
    );
  }
}

export async function enterFoundryRole({
  baseUrl,
  expectedRole,
  expectedUserId,
  expectedUserName,
  fetcher = globalThis.fetch,
  lease,
  readinessTimeoutMs = 20_000,
  roleSession,
  runRoot,
  secret,
  signal,
  inspectStartup,
  inspectJoin,
  verifyEntry,
}) {
  if (!ROLE_NAMES.includes(expectedRole) || expectedRole !== roleSession.role) {
    throw new AcceptanceError(
      "INVALID_ROLE",
      "Foundry entry role does not match the isolated browser role.",
    );
  }
  if (typeof verifyEntry !== "function") {
    throw new AcceptanceError(
      "BROWSER_AUTHORITY_REQUIRED",
      "Foundry role entry requires an immediate authority and lease verification.",
    );
  }

  await roleSession.start();
  if (inspectStartup) {
    await inspectStartup({ role: expectedRole, session: roleSession });
  }
  const joinUrl = foundryRoute(baseUrl, "join");
  await roleSession.navigate(joinUrl);
  await assertBrowserLocation(
    roleSession,
    joinUrl,
    "BROWSER_LOCATION_MISMATCH",
    `The ${expectedRole} browser did not remain on the exact Foundry join page.`,
  );
  await roleSession.waitForJoinForm();
  if (inspectJoin)
    await inspectJoin({ role: expectedRole, session: roleSession });

  let user;
  if (typeof expectedUserId === "string" && expectedUserId.length > 0) {
    if (typeof expectedUserName !== "string" || expectedUserName.length === 0) {
      throw new AcceptanceError(
        "FOUNDRY_USER_INVALID",
        "A known Foundry user ID requires its exact display name.",
      );
    }
    user = Object.freeze({ id: expectedUserId, name: expectedUserName });
  } else {
    if (expectedRole !== "gm") {
      throw new AcceptanceError(
        "FOUNDRY_USER_INVALID",
        "Player entry requires an exact provisioned user ID.",
      );
    }
    const result = parseBrowserJson(await roleSession.readJoinUsers());
    user = resolveGmJoinUser(result.users, expectedUserName);
  }

  const foundrySession = await authenticateBrowserSession({
    baseUrl,
    fetcher,
    fields: { action: "join", userId: user.id, username: user.name },
    roleSession,
    route: "join",
    runRoot,
    secret,
    signal,
  });
  await roleSession.navigate(foundrySession.redirectUrl);
  await assertBrowserLocation(
    roleSession,
    foundrySession.redirectUrl,
    "BROWSER_LOCATION_MISMATCH",
    `The ${expectedRole} browser did not remain on the authenticated Foundry game page.`,
  );
  await roleSession.waitForFoundryReady({
    expectedUrl: foundrySession.redirectUrl,
    timeoutMs: readinessTimeoutMs,
  });
  await assertBrowserLocation(
    roleSession,
    foundrySession.redirectUrl,
    "BROWSER_LOCATION_MISMATCH",
    `The ${expectedRole} browser left the authenticated Foundry game page after readiness.`,
  );
  const authority = await verifyEntry({
    expectedRole,
    expectedUserId: user.id,
    lease,
  });
  assertEntryAuthority(authority, {
    expectedRole,
    expectedUserId: user.id,
    lease,
  });
  return Object.freeze({ authority, user });
}
