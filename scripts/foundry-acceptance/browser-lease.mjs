import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { AcceptanceError } from "./core.mjs";
import { runProcess } from "./browser.mjs";

const GENERATION_MARKER = ".d6e2-browser-generation.json";
const PROFILE_MARKER = ".d6e2-acceptance-profile.json";
const PROFILE_LOCKS = Object.freeze([
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
]);
const DARWIN_PROCESS_IDENTITY_HELPER = fileURLToPath(
  new URL("./darwin-process-identity.py", import.meta.url),
);

function invariant(condition, code, message, details = {}) {
  if (!condition) throw new AcceptanceError(code, message, details);
}

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegularExpression(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function pathExists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

async function assertSecureDirectory(
  directory,
  runRoot,
  code = "BROWSER_LEASE_DIRECTORY_UNSAFE",
) {
  const resolvedRoot = path.resolve(runRoot);
  const resolved = path.resolve(directory);
  invariant(
    resolved === resolvedRoot ||
      resolved.startsWith(`${resolvedRoot}${path.sep}`),
    code,
    "Browser lease directory escaped its exact run root.",
    { directory: resolved },
  );
  const relative = path.relative(resolvedRoot, resolved);
  const components = relative ? relative.split(path.sep) : [];
  let current = resolvedRoot;
  for (const component of components) {
    current = path.join(current, component);
    const details = await lstat(current);
    invariant(
      details.isDirectory() &&
        !details.isSymbolicLink() &&
        (details.mode & 0o077) === 0 &&
        (currentUid() === undefined || details.uid === currentUid()),
      code,
      `Browser lease directory ${current} must be a real owner-only directory.`,
      { directory: current },
    );
    invariant(
      (await realpath(current)) === current,
      code,
      `Browser lease directory ${current} changed canonical identity.`,
      { directory: current },
    );
  }
}

async function assertSecureRunRoot(runRoot) {
  const resolved = path.resolve(runRoot);
  const details = await lstat(resolved);
  invariant(
    details.isDirectory() &&
      !details.isSymbolicLink() &&
      (details.mode & 0o077) === 0 &&
      (currentUid() === undefined || details.uid === currentUid()) &&
      (await realpath(resolved)) === resolved,
    "BROWSER_LEASE_RUN_ROOT_UNSAFE",
    "Browser lease run root must be its canonical owner-only directory.",
  );
}

async function assertLeaseDirectories(lease, directories) {
  await assertSecureRunRoot(lease.runRoot);
  if (lease.directoryIdentity?.[lease.runRoot]) {
    const rootDetails = await lstat(lease.runRoot);
    const expectedRoot = lease.directoryIdentity[lease.runRoot];
    invariant(
      rootDetails.dev === expectedRoot.dev &&
        rootDetails.ino === expectedRoot.ino,
      "BROWSER_LEASE_DIRECTORY_IDENTITY_DRIFT",
      "Browser lease run root was replaced after ownership was recorded.",
    );
  }
  for (const directory of directories) {
    await assertSecureDirectory(directory, lease.runRoot);
    if (lease.directoryIdentity) {
      const relative = path.relative(lease.runRoot, directory);
      const components = relative ? relative.split(path.sep) : [];
      let current = lease.runRoot;
      for (const component of components) {
        current = path.join(current, component);
        const expected = lease.directoryIdentity[current];
        if (!expected) continue;
        const details = await lstat(current);
        invariant(
          details.dev === expected.dev && details.ino === expected.ino,
          "BROWSER_LEASE_DIRECTORY_IDENTITY_DRIFT",
          `Browser lease directory ${current} was replaced after ownership was recorded.`,
          { directory: current },
        );
      }
    }
  }
}

async function assertCanonicalExternalPaths(lease) {
  for (const [key, file] of Object.entries({
    browserBinary: lease.browserBinary,
    daemonServerPath: lease.daemonServerPath,
    executable: lease.executable,
  })) {
    const details = await lstat(file);
    invariant(
      details.isFile() &&
        !details.isSymbolicLink() &&
        (await realpath(file)) === file &&
        (!lease.externalIdentity?.[key] ||
          (details.dev === lease.externalIdentity[key].dev &&
            details.ino === lease.externalIdentity[key].ino)),
      "BROWSER_LEASE_EXTERNAL_PATH_DRIFT",
      `Browser lease ${key} changed canonical file identity.`,
      { key },
    );
  }
}

async function atomicJson(file, value, lease) {
  if (lease) await assertLeaseDirectories(lease, [path.dirname(file)]);
  const temporary = `${file}.tmp-${randomBytes(4).toString("hex")}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  if (lease) await assertLeaseDirectories(lease, [path.dirname(file)]);
  await rename(temporary, file);
  await chmod(file, 0o600);
}

async function readOwnerOnlyJson(file, code) {
  let details;
  try {
    details = await lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new AcceptanceError(
        code,
        `Browser ownership file ${file} is missing; nothing was signaled.`,
      );
    }
    throw error;
  }
  invariant(
    details.isFile() &&
      !details.isSymbolicLink() &&
      (details.mode & 0o077) === 0,
    code,
    `Browser ownership file ${file} must be an owner-only regular file.`,
  );
  return JSON.parse(await readFile(file, "utf8"));
}

async function readLeasedOwnerOnlyJson(lease, file, code) {
  await assertLeaseDirectories(lease, [path.dirname(file)]);
  return readOwnerOnlyJson(file, code);
}

function assertLeasePaths(lease) {
  for (const [key, value] of Object.entries({
    browserBinary: lease.browserBinary,
    daemonServerPath: lease.daemonServerPath,
    executable: lease.executable,
    generationRoot: lease.generationRoot,
    profile: lease.profile,
    profileRetirementReceipt: lease.profileRetirementReceipt,
    runRoot: lease.runRoot,
    stateFile: lease.stateFile,
  })) {
    invariant(
      path.isAbsolute(value ?? ""),
      "BROWSER_LEASE_PATH_INVALID",
      `Browser lease ${key} must be absolute.`,
      { key },
    );
  }
  const runRoot = path.resolve(lease.runRoot);
  for (const [key, value] of Object.entries({
    generationRoot: lease.generationRoot,
    profile: lease.profile,
    stateFile: lease.stateFile,
  })) {
    invariant(
      path.resolve(value).startsWith(`${runRoot}${path.sep}`),
      "BROWSER_LEASE_PATH_OUTSIDE_RUN",
      `Browser lease ${key} must remain inside its exact run root.`,
      { key },
    );
  }
  invariant(
    lease.stateFile === path.join(lease.generationRoot, "browse.json"),
    "BROWSER_LEASE_STATE_PATH_MISMATCH",
    "Browser lease state file must be the exact generation browse.json path.",
  );
}

export async function createBrowserGenerationLease({
  browserBinary,
  daemonServerPath,
  executable,
  generation,
  generationRoot,
  profile,
  plannedAt = new Date().toISOString(),
  role,
  runId,
  runRoot,
  stateFile,
}) {
  await assertSecureRunRoot(runRoot);
  await assertSecureDirectory(generationRoot, runRoot);
  await assertSecureDirectory(profile, runRoot);
  const canonicalRunRoot = await realpath(runRoot);
  const canonicalGenerationRoot = await realpath(generationRoot);
  const canonicalProfile = await realpath(profile);
  const canonicalBrowserBinary = await realpath(browserBinary);
  const canonicalExecutable = await realpath(executable);
  const canonicalDaemonServerPath = await realpath(daemonServerPath);
  const directoryPaths = [
    canonicalRunRoot,
    path.join(canonicalRunRoot, "browser"),
    path.dirname(canonicalProfile),
    path.dirname(canonicalGenerationRoot),
    canonicalGenerationRoot,
    canonicalProfile,
  ];
  const directoryIdentity = {};
  for (const directory of directoryPaths) {
    const details = await lstat(directory);
    directoryIdentity[directory] = { dev: details.dev, ino: details.ino };
  }
  const externalIdentity = {};
  for (const [key, file] of Object.entries({
    browserBinary: canonicalBrowserBinary,
    daemonServerPath: canonicalDaemonServerPath,
    executable: canonicalExecutable,
  })) {
    const details = await lstat(file);
    externalIdentity[key] = { dev: details.dev, ino: details.ino };
  }
  const lease = {
    browserBinary: canonicalBrowserBinary,
    daemonServerPath: canonicalDaemonServerPath,
    directoryIdentity,
    executable: canonicalExecutable,
    externalIdentity,
    generation,
    generationMarker: path.join(canonicalGenerationRoot, GENERATION_MARKER),
    generationRoot: canonicalGenerationRoot,
    identity: null,
    plannedAt,
    profile: canonicalProfile,
    profileMarker: path.join(canonicalProfile, PROFILE_MARKER),
    profileRetirementReceipt: path.join(
      path.dirname(canonicalProfile),
      ".d6e2-profile-retirement.json",
    ),
    role,
    runId,
    runRoot: canonicalRunRoot,
    stateFile: path.join(canonicalGenerationRoot, path.basename(stateFile)),
    status: "planned",
  };
  assertLeasePaths(lease);
  invariant(
    ["gm", "player"].includes(role) &&
      Number.isInteger(generation) &&
      generation > 0 &&
      typeof runId === "string" &&
      runId.length > 0,
    "BROWSER_LEASE_IDENTITY_INVALID",
    "Browser lease requires an exact run, role, and positive generation.",
  );
  return Object.freeze(lease);
}

function markerIdentity(lease) {
  return {
    browserBinary: lease.browserBinary,
    daemonServerPath: lease.daemonServerPath,
    directoryIdentity: lease.directoryIdentity,
    executable: lease.executable,
    externalIdentity: lease.externalIdentity,
    generation: lease.generation,
    generationRoot: lease.generationRoot,
    plannedAt: lease.plannedAt,
    profile: lease.profile,
    role: lease.role,
    runId: lease.runId,
    stateFile: lease.stateFile,
  };
}

function profileDirectoryIdentity(lease) {
  const roleRoot = path.dirname(lease.profile);
  const requiredPaths = [
    lease.runRoot,
    path.dirname(roleRoot),
    roleRoot,
    path.dirname(lease.generationRoot),
    lease.profile,
  ];
  return Object.fromEntries(
    requiredPaths.map((directory) => {
      invariant(
        lease.directoryIdentity[directory],
        "BROWSER_PROFILE_DIRECTORY_IDENTITY_MISSING",
        "Browser profile ownership requires every stable directory identity.",
        { directory },
      );
      return [directory, lease.directoryIdentity[directory]];
    }),
  );
}

function profileMarkerIdentity(lease) {
  return {
    browserBinary: lease.browserBinary,
    daemonServerPath: lease.daemonServerPath,
    directoryIdentity: profileDirectoryIdentity(lease),
    executable: lease.executable,
    externalIdentity: lease.externalIdentity,
    profile: lease.profile,
    role: lease.role,
    runId: lease.runId,
  };
}

export async function writeBrowserGenerationMarkers(lease) {
  assertLeasePaths(lease);
  await assertCanonicalExternalPaths(lease);
  await assertLeaseDirectories(lease, [lease.generationRoot, lease.profile]);
  const profileIdentity = profileMarkerIdentity(lease);
  if (await pathExists(lease.profileMarker)) {
    invariant(
      JSON.stringify(
        await readLeasedOwnerOnlyJson(
          lease,
          lease.profileMarker,
          "BROWSER_PROFILE_MARKER_UNSAFE",
        ),
      ) === JSON.stringify(profileIdentity),
      "BROWSER_PROFILE_MARKER_MISMATCH",
      "Browser profile marker does not match the exact run and role.",
    );
  } else {
    await atomicJson(lease.profileMarker, profileIdentity, lease);
  }
  await atomicJson(lease.generationMarker, markerIdentity(lease), lease);
}

export function parseProcessTable(output, processIdentities = {}) {
  return String(output)
    .split("\n")
    .map((line) =>
      line.match(
        /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\S+)\s+(.+)$/,
      ),
    )
    .filter(Boolean)
    .map((match) => {
      const identity = processIdentities[match[1]];
      return Object.freeze({
        birthIdentity: identity?.birthIdentity ?? null,
        command: match[6],
        commandSha256: checksum(match[6]),
        pgid: Number(match[3]),
        pid: Number(match[1]),
        ppid: Number(match[2]),
        startTime: match[4],
        state: match[5],
      });
    });
}

const PROCESS_TABLE_FIELDS = "pid=,ppid=,pgid=,lstart=,state=,command=";

async function readLinuxProcessIdentities(processes) {
  const identities = {};
  for (const entry of processes) {
    let stat;
    try {
      stat = await readFile(`/proc/${entry.pid}/stat`, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const closingName = stat.lastIndexOf(") ");
    if (closingName < 0) continue;
    const fields = stat
      .slice(closingName + 2)
      .trim()
      .split(/\s+/);
    const ppid = Number(fields[1]);
    const pgid = Number(fields[2]);
    const startTicks = fields[19];
    if (!Number.isInteger(ppid) || !Number.isInteger(pgid) || !startTicks) {
      continue;
    }
    identities[entry.pid] = {
      birthIdentity: `linux:${startTicks}`,
      pgid,
      pid: entry.pid,
      ppid,
      status: fields[0],
    };
  }
  return identities;
}

async function readProcessIdentities(
  processes,
  { childRegistry, processRunner = runProcess, signal } = {},
) {
  if (process.platform === "linux") {
    return readLinuxProcessIdentities(processes);
  }
  invariant(
    process.platform === "darwin",
    "BROWSER_PROCESS_IDENTITY_UNSUPPORTED",
    `Exact process birth inspection is unsupported on ${process.platform}.`,
  );
  const result = await processRunner(
    "/usr/bin/python3",
    [
      DARWIN_PROCESS_IDENTITY_HELPER,
      ...processes.map(({ pid }) => String(pid)),
    ],
    {
      childRegistry,
      signal,
      timeoutMs: 5_000,
    },
  );
  invariant(
    result.code === 0,
    "BROWSER_PROCESS_IDENTITY_FAILED",
    "Exact Darwin process birth inspection failed.",
    { code: result.code, stderr: result.stderr },
  );
  return JSON.parse(result.stdout);
}

function candidateProcessPids(
  processes,
  { candidatePids = [], lease, leases = [] } = {},
) {
  const scopedLeases = [...leases, ...(lease ? [lease] : [])];
  if (scopedLeases.length === 0 && candidatePids.length === 0) {
    return new Set(processes.map(({ pid }) => pid));
  }
  const roots = new Set(candidatePids);
  for (const candidateLease of scopedLeases) {
    for (const processIdentity of candidateLease.identity?.processes ?? []) {
      roots.add(processIdentity.pid);
    }
    if (candidateLease.identity?.daemon?.pid) {
      roots.add(candidateLease.identity.daemon.pid);
    }
    for (const profileProcess of profileUsingProcesses(
      processes,
      candidateLease,
    )) {
      roots.add(profileProcess.pid);
    }
  }
  return descendantsOf(processes, roots);
}

function assertProcessIdentityAgrees(entry, identity) {
  invariant(
    identity.pid === entry.pid &&
      identity.ppid === entry.ppid &&
      identity.pgid === entry.pgid,
    "BROWSER_PROCESS_IDENTITY_RACE",
    "Process parent or group identity changed during exact birth inspection.",
    { pid: entry.pid },
  );
}

async function readExactProcessSnapshot(
  pid,
  { childRegistry, processRunner, signal },
) {
  const result = await processRunner(
    "/bin/ps",
    ["-p", String(pid), "-o", PROCESS_TABLE_FIELDS],
    { childRegistry, signal, timeoutMs: 5_000 },
  );
  const parsed = parseProcessTable(result.stdout);
  invariant(
    (result.code === 0 && parsed.length === 1) ||
      (result.code === 1 && parsed.length === 0),
    "BROWSER_PROCESS_INSPECTION_FAILED",
    "Exact browser PID resampling did not return one live row or the documented absent status.",
    { code: result.code, count: parsed.length, pid, stderr: result.stderr },
  );
  invariant(
    parsed.length <= 1 && parsed.every((entry) => entry.pid === pid),
    "BROWSER_PROCESS_EXACT_RESAMPLE_AMBIGUOUS",
    "Exact PID resampling returned an ambiguous process table.",
    { count: parsed.length, pid },
  );
  if (parsed.length === 0) return null;
  const [entry] = parsed;
  const identities =
    result.processIdentities ??
    (await readProcessIdentities(parsed, {
      childRegistry,
      processRunner,
      signal,
    }));
  const identity = identities[pid];
  if (identity) {
    assertProcessIdentityAgrees(entry, identity);
    return parseProcessTable(result.stdout, identities)[0];
  }
  invariant(
    entry.state.startsWith("Z"),
    "BROWSER_PROCESS_BIRTH_IDENTITY_AMBIGUOUS",
    "A live exact-PID resample still lacks a kernel birth identity; nothing was signaled.",
    { pid, state: entry.state.slice(0, 16) },
  );
  return entry;
}

export async function readProcessTable({
  candidatePids = [],
  childRegistry,
  lease,
  leases = [],
  processPlatform = process.platform,
  processRunner = runProcess,
  signal,
} = {}) {
  const args = ["-axo", PROCESS_TABLE_FIELDS];
  const result = await processRunner("/bin/ps", args, {
    childRegistry,
    signal,
    timeoutMs: 5_000,
  });
  invariant(
    result.code === 0,
    "BROWSER_PROCESS_INSPECTION_FAILED",
    "Exact browser process inspection failed.",
    { code: result.code, stderr: result.stderr },
  );
  const parsed = parseProcessTable(result.stdout);
  if (parsed.length === 0) return parsed;
  const scopedPids = candidateProcessPids(parsed, {
    candidatePids,
    lease,
    leases,
  });
  const scopedProcesses = parsed.filter(({ pid }) => scopedPids.has(pid));
  const processIdentities =
    result.processIdentities ??
    (await readProcessIdentities(scopedProcesses, {
      childRegistry,
      processRunner,
      signal,
    }));
  const identified = new Map(
    parseProcessTable(result.stdout, processIdentities).map((entry) => [
      entry.pid,
      entry,
    ]),
  );
  for (const entry of scopedProcesses) {
    const identity = processIdentities[entry.pid];
    if (identity) {
      assertProcessIdentityAgrees(entry, identity);
      continue;
    }
    if (entry.state.startsWith("Z")) continue;
    invariant(
      processPlatform === "darwin",
      "BROWSER_PROCESS_BIRTH_IDENTITY_MISSING",
      "A live candidate process lacks an exact kernel birth identity.",
      { pid: entry.pid },
    );
    const resampled = await readExactProcessSnapshot(entry.pid, {
      childRegistry,
      processRunner,
      signal,
    });
    if (resampled) identified.set(entry.pid, resampled);
    else identified.delete(entry.pid);
  }
  return [...identified.values()];
}

function exactCommandPattern(value) {
  return new RegExp(
    `(?:^|[\\s"'])${escapeRegularExpression(value)}(?:[\\s"']|$)`,
  );
}

function profilePattern(profile) {
  return new RegExp(
    `(?:^|\\s)--user-data-dir=(?:"${escapeRegularExpression(profile)}"|'${escapeRegularExpression(profile)}'|${escapeRegularExpression(profile)})(?:\\s|$)`,
  );
}

function descendantsOf(processes, rootPids) {
  const owned = new Set(rootPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of processes) {
      if (!owned.has(entry.pid) && owned.has(entry.ppid)) {
        owned.add(entry.pid);
        changed = true;
      }
    }
  }
  return owned;
}

function exactProfileChromium(processes, lease) {
  const executable = exactCommandPattern(lease.executable);
  const profile = profilePattern(lease.profile);
  return processes.filter(
    (entry) => executable.test(entry.command) && profile.test(entry.command),
  );
}

function profileUsingProcesses(processes, lease) {
  const profile = profilePattern(lease.profile);
  return processes.filter((entry) => profile.test(entry.command));
}

function assertNoForeignProfileProcesses(processes, owned, lease) {
  for (const entry of profileUsingProcesses(processes, lease)) {
    invariant(
      owned.has(entry.pid),
      "BROWSER_PROFILE_PROCESS_AMBIGUOUS",
      "A process outside the recorded browser tree is using the exact leased profile; nothing was signaled.",
      { pid: entry.pid, role: lease.role },
    );
  }
}

function assertChromeDescendsFromDaemon(processes, daemon, chromiums, lease) {
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  for (const chromium of chromiums) {
    const seen = new Set();
    const chain = [];
    let current = chromium;
    while (current && current.pid !== daemon.pid && !seen.has(current.pid)) {
      seen.add(current.pid);
      chain.push(current.pid);
      current = byPid.get(current.ppid);
    }
    invariant(
      current?.pid === daemon.pid,
      "BROWSER_DAEMON_ANCESTRY_MISMATCH",
      "Exact-profile Chromium is not descended from the bound GStack daemon.",
      { chromePid: chromium.pid, role: lease.role, chain },
    );
  }
}

function stateBirthMatchesProcess(stateStartedAt, processStartTime) {
  const stateTime = Date.parse(stateStartedAt);
  const processTime = Date.parse(processStartTime);
  return (
    Number.isFinite(stateTime) &&
    Number.isFinite(processTime) &&
    processTime + 999 < stateTime
  );
}

function darwinBirthTimeMs(birthIdentity) {
  const match = String(birthIdentity ?? "").match(/^darwin:(\d+):(\d{1,6})$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  const microseconds = Number(match[2]);
  if (
    !Number.isSafeInteger(seconds) ||
    seconds <= 0 ||
    !Number.isInteger(microseconds) ||
    microseconds < 0 ||
    microseconds > 999_999
  ) {
    return null;
  }
  return seconds * 1_000 + microseconds / 1_000;
}

function daemonStartupTiming(stateStartedAt, daemon, plannedAt) {
  const stateTime = Date.parse(stateStartedAt);
  const plannedTime = Date.parse(plannedAt);
  const exactBirthTime = darwinBirthTimeMs(daemon?.birthIdentity);
  if (exactBirthTime !== null) {
    return Object.freeze({
      birthAfterPlan:
        Number.isFinite(plannedTime) && exactBirthTime >= plannedTime,
      exactKernelBirth: true,
      stateAfterBirth:
        Number.isFinite(stateTime) && stateTime >= exactBirthTime,
    });
  }
  if (String(daemon?.birthIdentity ?? "").startsWith("darwin:")) {
    return Object.freeze({
      birthAfterPlan: false,
      exactKernelBirth: false,
      stateAfterBirth: false,
    });
  }
  const processStartTime = Date.parse(daemon?.startTime ?? "");
  return Object.freeze({
    birthAfterPlan:
      Number.isFinite(plannedTime) && processStartTime + 999 >= plannedTime,
    exactKernelBirth: false,
    stateAfterBirth: stateBirthMatchesProcess(
      stateStartedAt,
      daemon?.startTime,
    ),
  });
}

function acceptPostStopStateMissing(shutdownTracker) {
  const state = shutdownTracker?.state;
  invariant(
    state?.phase === "public-stop-started" ||
      state?.phase === "owned-signal-started" ||
      state?.phase === "missing",
    "BROWSER_STATE_UNSAFE",
    "GStack state is missing outside an exact bound shutdown transition.",
  );
  state.phase = "missing";
  return null;
}

function markOwnedSignalStarted(shutdownTracker) {
  const state = shutdownTracker?.state;
  invariant(
    state?.phase === "strict" ||
      state?.phase === "public-stop-started" ||
      state?.phase === "owned-signal-started" ||
      state?.phase === "missing",
    "BROWSER_STATE_UNSAFE",
    "A browser signal cannot start outside an exact bound shutdown transition.",
  );
  if (state.phase === "strict") state.phase = "owned-signal-started";
}

function assertStateDidNotReappear(shutdownTracker, present) {
  invariant(
    !(shutdownTracker?.state?.phase === "missing" && present),
    "BROWSER_STATE_REAPPEARED",
    "GStack state reappeared after its observed post-stop disappearance; nothing was signaled.",
  );
}

async function readStateEvidence(lease, { shutdownTracker } = {}) {
  await assertLeaseDirectories(lease, [lease.generationRoot]);
  let before;
  try {
    before = await lstat(lease.stateFile);
  } catch (error) {
    if (error?.code === "ENOENT") {
      if (shutdownTracker) {
        return acceptPostStopStateMissing(shutdownTracker);
      }
      throw new AcceptanceError(
        "BROWSER_STATE_UNSAFE",
        "GStack state is missing; no browser control action was issued.",
      );
    }
    throw error;
  }
  invariant(
    before.isFile() &&
      !before.isSymbolicLink() &&
      (before.mode & 0o077) === 0 &&
      (currentUid() === undefined || before.uid === currentUid()),
    "BROWSER_STATE_UNSAFE",
    "GStack state must be an owner-only regular file.",
  );
  let raw;
  let after;
  try {
    raw = await readFile(lease.stateFile);
    after = await lstat(lease.stateFile);
  } catch (error) {
    if (error?.code === "ENOENT" && shutdownTracker) {
      return acceptPostStopStateMissing(shutdownTracker);
    }
    throw error;
  }
  invariant(
    before.dev === after.dev &&
      before.ino === after.ino &&
      before.mtimeMs === after.mtimeMs &&
      before.size === after.size,
    "BROWSER_STATE_FILE_IDENTITY_DRIFT",
    "GStack state changed while its durable control identity was read.",
  );
  await assertLeaseDirectories(lease, [lease.generationRoot]);
  const state = JSON.parse(raw.toString("utf8"));
  invariant(
    Math.abs(after.mtimeMs - Date.parse(state.startedAt)) <= 1_000,
    "BROWSER_STATE_FILE_IDENTITY_MISMATCH",
    "GStack state content and its owner-only file identity do not share the same creation boundary.",
  );
  return {
    fileIdentity: {
      dev: after.dev,
      ino: after.ino,
      mtimeMs: after.mtimeMs,
      size: after.size,
    },
    stateSha256: checksum(raw),
    state,
  };
}

async function validateCapturedStateControlIdentity(
  lease,
  { shutdownTracker } = {},
) {
  invariant(
    lease.identity?.stateFileIdentity && lease.identity?.stateSha256,
    "BROWSER_STATE_CONTROL_IDENTITY_MISSING",
    "Captured browser ownership lacks the exact GStack control-state identity.",
  );
  const evidence = await readStateEvidence(lease, { shutdownTracker });
  if (!evidence) return null;
  const expected = lease.identity.stateFileIdentity;
  invariant(
    evidence.fileIdentity.dev === expected.dev &&
      evidence.fileIdentity.ino === expected.ino &&
      evidence.fileIdentity.mtimeMs === expected.mtimeMs &&
      evidence.fileIdentity.size === expected.size &&
      evidence.stateSha256 === lease.identity.stateSha256,
    "BROWSER_STATE_CONTROL_IDENTITY_DRIFT",
    "GStack control state changed after durable ownership was captured; no public stop was issued.",
  );
  return evidence;
}

function bindDaemonFromState(state, processes, lease) {
  invariant(
    Number.isInteger(state.pid) &&
      state.pid > 0 &&
      typeof state.startedAt === "string" &&
      state.serverPath === lease.daemonServerPath,
    "BROWSER_STATE_IDENTITY_MISSING",
    "GStack state lacks the exact trusted daemon identity.",
  );
  const daemon = processes.find((entry) => entry.pid === state.pid);
  const timing = daemonStartupTiming(state.startedAt, daemon, lease.plannedAt);
  const commandMatches = Boolean(
    daemon && exactCommandPattern(lease.daemonServerPath).test(daemon.command),
  );
  invariant(
    daemon &&
      daemon.birthIdentity &&
      commandMatches &&
      timing.stateAfterBirth &&
      timing.birthAfterPlan,
    "BROWSER_DAEMON_NOT_VERIFIED",
    "GStack state PID, trusted server path, and OS birth identity do not match.",
    {
      birthAfterPlan: timing.birthAfterPlan,
      birthIdentityPresent: Boolean(daemon?.birthIdentity),
      commandMatches,
      daemonPresent: Boolean(daemon),
      exactKernelBirth: timing.exactKernelBirth,
      pid: state.pid,
      stateAfterBirth: timing.stateAfterBirth,
    },
  );
  return daemon;
}

function discoverBoundDaemonTree(processes, daemon, lease, { requireChrome }) {
  const chromiums = exactProfileChromium(processes, lease);
  if (requireChrome) {
    invariant(
      chromiums.length > 0,
      "BROWSER_CHROMIUM_NOT_VERIFIED",
      "No exact-profile Chromium process was found for the bound role generation.",
    );
  }
  assertChromeDescendsFromDaemon(processes, daemon, chromiums, lease);
  const owned = descendantsOf(processes, [daemon.pid]);
  assertNoForeignProfileProcesses(processes, owned, lease);
  return Object.freeze(processes.filter((entry) => owned.has(entry.pid)));
}

function exactProcessIdentityMatches(expected, current) {
  return (
    typeof expected?.birthIdentity === "string" &&
    expected.birthIdentity.length > 0 &&
    current?.birthIdentity === expected.birthIdentity &&
    current.commandSha256 === expected.commandSha256 &&
    current.pgid === expected.pgid &&
    current.ppid === expected.ppid &&
    current.startTime === expected.startTime &&
    !current.state.startsWith("Z")
  );
}

function optionalIdentityHash(value) {
  return typeof value === "string" && value.length > 0 ? checksum(value) : null;
}

const processIdentityDiagnosticProvenance = new WeakSet();
const terminalIdentityDiagnosticProvenance = new WeakSet();

function trustedDiagnostic(provenance, value) {
  const diagnostic = Object.freeze(value);
  provenance.add(diagnostic);
  return diagnostic;
}

function processIdentityDiagnostics(expected, current) {
  return trustedDiagnostic(processIdentityDiagnosticProvenance, {
    birthIdentityMatch:
      typeof expected?.birthIdentity === "string" &&
      expected.birthIdentity.length > 0 &&
      current?.birthIdentity === expected.birthIdentity,
    commandHashMatch:
      typeof expected?.commandSha256 === "string" &&
      current?.commandSha256 === expected.commandSha256,
    currentBirthIdentityHash: optionalIdentityHash(current?.birthIdentity),
    currentCommandHash: current?.commandSha256 ?? null,
    currentPresent: Boolean(current),
    currentState:
      typeof current?.state === "string" ? current.state.slice(0, 16) : null,
    currentTerminal: Boolean(current?.state?.startsWith("Z")),
    expectedBirthIdentityHash: optionalIdentityHash(expected?.birthIdentity),
    expectedCommandHash: expected?.commandSha256 ?? null,
    pgidMatch:
      Number.isInteger(expected?.pgid) && current?.pgid === expected.pgid,
    ppidMatch:
      Number.isInteger(expected?.ppid) && current?.ppid === expected.ppid,
    startTimeMatch:
      typeof expected?.startTime === "string" &&
      current?.startTime === expected.startTime,
  });
}

function terminalIdentityDiagnostics(expected, current) {
  return trustedDiagnostic(terminalIdentityDiagnosticProvenance, {
    birthIdentityMissing: current?.birthIdentity === null,
    commandIsDefunct: current?.commandSha256 === checksum("<defunct>"),
    pgidMatch:
      Number.isInteger(expected?.pgid) && current?.pgid === expected.pgid,
    ppidMatch:
      Number.isInteger(expected?.ppid) && current?.ppid === expected.ppid,
    startTimeMatch:
      typeof expected?.startTime === "string" &&
      current?.startTime === expected.startTime,
    stateIsTerminal: Boolean(current?.state?.startsWith("Z")),
  });
}

function diagnosticBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function diagnosticHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}

const DIAGNOSTIC_SHUTDOWN_PHASES = new Set([
  "live",
  "terminal",
  "strict",
  "tracked",
  "strict-daemon",
  "tracked-daemon",
  "pre-signal-SIGTERM",
  "pre-signal-SIGKILL",
]);

function diagnosticProcessState(value) {
  return typeof value === "string" &&
    /^[RIDUSZTWI?](?:[+<ENXSLs]{0,8})?$/.test(value)
    ? value
    : null;
}

export function collectBrowserProcessIdentityDrifts(error) {
  const collected = [];
  const visited = new Set();
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object" || visited.has(candidate)) {
      return;
    }
    visited.add(candidate);
    if (candidate.code === "BROWSER_PROCESS_IDENTITY_DRIFT") {
      const details = candidate.details ?? {};
      const identity = details.identity ?? {};
      const terminal = details.terminal ?? null;
      if (!processIdentityDiagnosticProvenance.has(identity)) {
        for (const nested of candidate.errors ?? []) visit(nested);
        visit(candidate.cause);
        return;
      }
      collected.push(
        Object.freeze({
          identity: Object.freeze({
            birthIdentityMatch: diagnosticBoolean(identity.birthIdentityMatch),
            commandHashMatch: diagnosticBoolean(identity.commandHashMatch),
            currentBirthIdentityHash: diagnosticHash(
              identity.currentBirthIdentityHash,
            ),
            currentCommandHash: diagnosticHash(identity.currentCommandHash),
            currentPresent: diagnosticBoolean(identity.currentPresent),
            currentState: diagnosticProcessState(identity.currentState),
            currentTerminal: diagnosticBoolean(identity.currentTerminal),
            expectedBirthIdentityHash: diagnosticHash(
              identity.expectedBirthIdentityHash,
            ),
            expectedCommandHash: diagnosticHash(identity.expectedCommandHash),
            pgidMatch: diagnosticBoolean(identity.pgidMatch),
            ppidMatch: diagnosticBoolean(identity.ppidMatch),
            startTimeMatch: diagnosticBoolean(identity.startTimeMatch),
          }),
          pid:
            Number.isInteger(details.pid) && details.pid > 0
              ? details.pid
              : null,
          role: ["gm", "player"].includes(details.role) ? details.role : null,
          shutdownPhase: DIAGNOSTIC_SHUTDOWN_PHASES.has(details.shutdownPhase)
            ? details.shutdownPhase
            : null,
          terminal: terminalIdentityDiagnosticProvenance.has(terminal)
            ? Object.freeze({
                birthIdentityMissing: diagnosticBoolean(
                  terminal.birthIdentityMissing,
                ),
                commandIsDefunct: diagnosticBoolean(terminal.commandIsDefunct),
                pgidMatch: diagnosticBoolean(terminal.pgidMatch),
                ppidMatch: diagnosticBoolean(terminal.ppidMatch),
                startTimeMatch: diagnosticBoolean(terminal.startTimeMatch),
                stateIsTerminal: diagnosticBoolean(terminal.stateIsTerminal),
              })
            : null,
        }),
      );
    }
    for (const nested of candidate.errors ?? []) visit(nested);
    visit(candidate.cause);
  };
  visit(error);
  return Object.freeze(collected);
}

function stableProcessIdentity(entry) {
  return Object.freeze({
    birthIdentity: entry.birthIdentity,
    commandSha256: entry.commandSha256,
    pgid: entry.pgid,
    pid: entry.pid,
    ppid: entry.ppid,
    startTime: entry.startTime,
  });
}

function terminalContinuationMatches(expected, current) {
  return (
    typeof expected?.birthIdentity === "string" &&
    expected.birthIdentity.length > 0 &&
    current?.birthIdentity === null &&
    current.command === "<defunct>" &&
    current.pgid === expected.pgid &&
    current.ppid === expected.ppid &&
    current.startTime === expected.startTime &&
    current.state.startsWith("Z")
  );
}

function createShutdownTracker(lease, observation) {
  const current = new Map(
    observation.processes.map((entry) => [entry.pid, entry]),
  );
  const entries = new Map();
  for (const expected of lease.identity?.processes ?? []) {
    const live = current.get(expected.pid);
    entries.set(
      expected.pid,
      live
        ? { identity: stableProcessIdentity(live), phase: "live" }
        : { identity: stableProcessIdentity(expected), phase: "absent" },
    );
  }
  for (const entry of observation.processes) {
    if (!entries.has(entry.pid)) {
      invariant(
        entry.birthIdentity,
        "BROWSER_PROCESS_BIRTH_IDENTITY_MISSING",
        "A live leased descendant lacks an exact OS birth identity.",
        { pid: entry.pid, role: lease.role },
      );
      entries.set(entry.pid, {
        identity: stableProcessIdentity(entry),
        phase: "live",
      });
    }
  }
  return { entries, state: { phase: "strict" } };
}

function createStrictTerminalDrainTracker(lease) {
  return {
    entries: new Map(
      (lease.identity?.processes ?? []).map((expected) => [
        expected.pid,
        { identity: stableProcessIdentity(expected), phase: "live" },
      ]),
    ),
  };
}

function strictTerminalDrainPids(tracker) {
  return [...tracker.entries]
    .filter(([, tracked]) => tracked.phase === "terminal")
    .map(([pid]) => pid);
}

function validateShutdownContinuity(current, tracker, lease) {
  const tracked = tracker.entries.get(current.pid);
  invariant(
    tracked && tracked.phase !== "absent",
    "BROWSER_PROCESS_REAPPEARED",
    "A leased PID reappeared after an observed absence; nothing was signaled.",
    { pid: current.pid, role: lease.role },
  );
  if (exactProcessIdentityMatches(tracked.identity, current)) {
    invariant(
      tracked.phase === "live",
      "BROWSER_PROCESS_TERMINAL_REVERSAL",
      "A terminal leased PID returned to a live state; nothing was signaled.",
      { pid: current.pid, role: lease.role },
    );
    return current;
  }
  invariant(
    ["live", "terminal"].includes(tracked.phase) &&
      terminalContinuationMatches(tracked.identity, current),
    "BROWSER_PROCESS_IDENTITY_DRIFT",
    "A recorded browser PID was reused or changed outside the exact terminal transition; nothing was signaled.",
    {
      identity: processIdentityDiagnostics(tracked.identity, current),
      pid: current.pid,
      role: lease.role,
      shutdownPhase: tracked.phase,
      terminal: terminalIdentityDiagnostics(tracked.identity, current),
    },
  );
  tracked.phase = "terminal";
  return Object.freeze({ ...current, terminal: true });
}

function markShutdownAbsences(processes, tracker) {
  const present = new Set(processes.map(({ pid }) => pid));
  for (const [pid, tracked] of tracker.entries) {
    if (!present.has(pid)) tracked.phase = "absent";
  }
}

export function discoverLeasedProcesses(
  processes,
  lease,
  { shutdownTracker } = {},
) {
  assertLeasePaths(lease);
  if (shutdownTracker) markShutdownAbsences(processes, shutdownTracker);
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const recorded = lease.identity?.processes ?? [];
  for (const expected of recorded) {
    let current = byPid.get(expected.pid);
    if (!current) continue;
    if (shutdownTracker) {
      current = validateShutdownContinuity(current, shutdownTracker, lease);
      byPid.set(current.pid, current);
    }
    invariant(
      shutdownTracker || exactProcessIdentityMatches(expected, current),
      "BROWSER_PROCESS_IDENTITY_DRIFT",
      "A recorded browser PID was reused or its command changed; nothing was signaled.",
      {
        identity: processIdentityDiagnostics(expected, current),
        pid: expected.pid,
        role: lease.role,
        shutdownPhase: shutdownTracker ? "tracked" : "strict",
      },
    );
  }
  const daemonExpected = lease.identity?.daemon;
  let daemon = null;
  if (daemonExpected) {
    daemon = byPid.get(daemonExpected.pid) ?? null;
    if (daemon) {
      invariant(
        shutdownTracker || exactProcessIdentityMatches(daemonExpected, daemon),
        "BROWSER_DAEMON_IDENTITY_DRIFT",
        "The recorded GStack daemon PID was reused or changed; nothing was signaled.",
        {
          identity: processIdentityDiagnostics(daemonExpected, daemon),
          pid: daemonExpected.pid,
          role: lease.role,
          shutdownPhase: shutdownTracker ? "tracked-daemon" : "strict-daemon",
        },
      );
      if (daemon.terminal) daemon = null;
    }
  }
  const liveRecorded = recorded
    .map((expected) => byPid.get(expected.pid))
    .filter(Boolean);
  let owned = new Set();
  if (daemon) {
    owned = descendantsOf(processes, [daemon.pid]);
    for (const recordedProcess of liveRecorded) {
      invariant(
        owned.has(recordedProcess.pid),
        "BROWSER_RECORDED_PROCESS_REPARENTED",
        "A live recorded browser process left the bound daemon tree; nothing was signaled.",
        { pid: recordedProcess.pid, role: lease.role },
      );
    }
    discoverBoundDaemonTree(processes, daemon, lease, {
      requireChrome: false,
    });
  } else if (liveRecorded.length > 0) {
    owned = descendantsOf(
      processes,
      liveRecorded.map(({ pid }) => pid),
    );
  }
  assertNoForeignProfileProcesses(processes, owned, lease);
  if (shutdownTracker) {
    for (const entry of processes.filter(({ pid }) => owned.has(pid))) {
      if (!shutdownTracker.entries.has(entry.pid)) {
        invariant(
          entry.birthIdentity && !entry.state.startsWith("Z"),
          "BROWSER_PROCESS_BIRTH_IDENTITY_MISSING",
          "A newly discovered leased descendant lacks an exact live OS birth identity.",
          { pid: entry.pid, role: lease.role },
        );
        shutdownTracker.entries.set(entry.pid, {
          identity: stableProcessIdentity(entry),
          phase: "live",
        });
      } else if (!byPid.get(entry.pid)?.terminal) {
        byPid.set(
          entry.pid,
          validateShutdownContinuity(entry, shutdownTracker, lease),
        );
      }
    }
  }
  return Object.freeze({
    daemon,
    processes: Object.freeze(
      [...byPid.values()].filter((entry) => owned.has(entry.pid)),
    ),
  });
}

async function validateMarkers(lease, { allowMissingGeneration = false } = {}) {
  assertLeasePaths(lease);
  await assertCanonicalExternalPaths(lease);
  await assertLeaseDirectories(lease, [lease.profile]);
  const profile = await readLeasedOwnerOnlyJson(
    lease,
    lease.profileMarker,
    "BROWSER_PROFILE_MARKER_UNSAFE",
  );
  invariant(
    JSON.stringify(profile) === JSON.stringify(profileMarkerIdentity(lease)),
    "BROWSER_PROFILE_MARKER_MISMATCH",
    "Browser profile ownership marker does not match the journal lease.",
  );
  if (!(await pathExists(lease.generationRoot))) {
    invariant(
      allowMissingGeneration,
      "BROWSER_GENERATION_MARKER_MISSING",
      "Browser generation directory is missing; nothing was signaled.",
    );
    return;
  }
  await assertLeaseDirectories(lease, [lease.generationRoot]);
  invariant(
    await pathExists(lease.generationMarker),
    "BROWSER_GENERATION_MARKER_MISSING",
    "Browser generation ownership marker is missing; nothing was signaled.",
  );
  invariant(
    JSON.stringify(
      await readLeasedOwnerOnlyJson(
        lease,
        lease.generationMarker,
        "BROWSER_GENERATION_MARKER_UNSAFE",
      ),
    ) === JSON.stringify(markerIdentity(lease)),
    "BROWSER_GENERATION_MARKER_MISMATCH",
    "Browser generation ownership marker does not match the journal lease.",
  );
}

export async function captureBrowserGenerationIdentity(lease, options = {}) {
  const { childRegistry, processRunner, signal } = options;
  await validateMarkers(lease);
  const stateEvidence = await readStateEvidence(lease);
  const { state } = stateEvidence;
  const processes = await readProcessTable({
    ...options,
    candidatePids: [state.pid],
    childRegistry,
    lease,
    processRunner,
    signal,
  });
  const daemon = bindDaemonFromState(state, processes, lease);
  const owned = discoverBoundDaemonTree(processes, daemon, lease, {
    requireChrome: true,
  });
  invariant(
    owned.every(
      ({ birthIdentity, state }) => birthIdentity && !state.startsWith("Z"),
    ),
    "BROWSER_PROCESS_BIRTH_IDENTITY_MISSING",
    "Every captured browser process requires an exact live OS birth identity.",
    { role: lease.role },
  );
  return Object.freeze({
    daemon: Object.freeze({
      birthIdentity: daemon.birthIdentity,
      commandSha256: daemon.commandSha256,
      pgid: daemon.pgid,
      pid: daemon.pid,
      ppid: daemon.ppid,
      startTime: daemon.startTime,
    }),
    processes: Object.freeze(
      owned.map((entry) =>
        Object.freeze({
          birthIdentity: entry.birthIdentity,
          commandSha256: entry.commandSha256,
          pgid: entry.pgid,
          pid: entry.pid,
          ppid: entry.ppid,
          startTime: entry.startTime,
        }),
      ),
    ),
    serverPath: lease.daemonServerPath,
    stateFileIdentity: stateEvidence.fileIdentity,
    stateSha256: stateEvidence.stateSha256,
    stateStartedAt: state.startedAt,
  });
}

async function profileLocks(lease) {
  const locks = [];
  for (const name of PROFILE_LOCKS) {
    if (await pathExists(path.join(lease.profile, name))) locks.push(name);
  }
  return locks;
}

export async function inspectLeasedBrowserGeneration(lease, options = {}) {
  const {
    childRegistry,
    processRunner,
    shutdownTracker,
    signal,
    strictTerminalTracker,
  } = options;
  await validateMarkers(lease, {
    allowMissingGeneration: lease.status === "retiring",
  });
  let stateEvidence = null;
  if (shutdownTracker && shutdownTracker.state.phase !== "missing") {
    stateEvidence = lease.identity
      ? await validateCapturedStateControlIdentity(lease, { shutdownTracker })
      : await readStateEvidence(lease, { shutdownTracker });
  } else {
    const observedStateFilePresent = await pathExists(lease.stateFile);
    assertStateDidNotReappear(shutdownTracker, observedStateFilePresent);
    if (observedStateFilePresent) {
      stateEvidence = lease.identity
        ? await validateCapturedStateControlIdentity(lease)
        : await readStateEvidence(lease);
    } else if (shutdownTracker) {
      acceptPostStopStateMissing(shutdownTracker);
    }
  }
  const stateFilePresent = Boolean(stateEvidence);
  const processes = await readProcessTable({
    ...options,
    candidatePids: stateEvidence?.state?.pid ? [stateEvidence.state.pid] : [],
    childRegistry,
    lease,
    processRunner,
    signal,
  });
  let discovered = lease.identity
    ? discoverLeasedProcesses(processes, lease, {
        shutdownTracker: shutdownTracker ?? strictTerminalTracker,
      })
    : Object.freeze({ daemon: null, processes: Object.freeze([]) });
  if (!lease.identity && stateFilePresent) {
    const { state } = stateEvidence;
    const daemon = bindDaemonFromState(state, processes, lease);
    const owned = discoverBoundDaemonTree(processes, daemon, lease, {
      requireChrome: true,
    });
    discovered = Object.freeze({
      daemon,
      processes: owned,
    });
  } else if (lease.identity && stateFilePresent) {
    const { state } = stateEvidence;
    invariant(
      state.pid === lease.identity.daemon.pid &&
        state.serverPath === lease.identity.serverPath &&
        state.startedAt === lease.identity.stateStartedAt,
      "BROWSER_STATE_IDENTITY_DRIFT",
      "The live GStack state no longer matches the captured daemon identity; nothing was signaled.",
    );
  }
  invariant(
    lease.identity ||
      stateFilePresent ||
      profileUsingProcesses(processes, lease).length === 0,
    "BROWSER_STATE_IDENTITY_MISSING",
    "An exact-profile process exists without durable daemon state; nothing was signaled.",
  );
  return Object.freeze({
    daemon: discovered.daemon,
    locks: Object.freeze(await profileLocks(lease)),
    processes: discovered.processes,
    stateFilePresent,
  });
}

function waitForDelay(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function waitForNoOwnedProcesses(lease, options, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observation;
  do {
    observation = await inspectLeasedBrowserGeneration(lease, options);
    if (observation.processes.length === 0 && observation.locks.length === 0) {
      return observation;
    }
    await (options.wait ?? waitForDelay)(options.pollMs ?? 100);
  } while (Date.now() <= deadline);
  return observation;
}

async function waitForStrictTerminalReap(lease, options, tracker, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let observation;
  do {
    observation = await inspectLeasedBrowserGeneration(lease, {
      ...options,
      strictTerminalTracker: tracker,
    });
    if (strictTerminalDrainPids(tracker).length === 0) return observation;
    await (options.wait ?? waitForDelay)(options.pollMs ?? 100);
  } while (Date.now() <= deadline);
  throw new AcceptanceError(
    "BROWSER_FIRST_SEEN_TERMINAL_PERSISTED",
    "A recorded process first observed as terminal did not reap within the bounded no-control drain; nothing was signaled.",
    { pids: strictTerminalDrainPids(tracker), role: lease.role },
  );
}

async function retireLeasedBrowserStateFile(lease, { shutdownTracker } = {}) {
  await assertLeaseDirectories(lease, [lease.generationRoot]);
  const evidence = lease.identity
    ? await validateCapturedStateControlIdentity(lease, { shutdownTracker })
    : await readStateEvidence(lease, { shutdownTracker });
  if (!evidence) return;
  await assertLeaseDirectories(lease, [lease.generationRoot]);
  try {
    await rm(lease.stateFile, { force: false });
    if (shutdownTracker) shutdownTracker.state.phase = "missing";
  } catch (error) {
    if (error?.code === "ENOENT" && shutdownTracker) {
      acceptPostStopStateMissing(shutdownTracker);
      return;
    }
    throw error;
  }
}

async function signalVerifiedProcesses(lease, observation, signal, options) {
  let count = 0;
  for (const expected of [...observation.processes].reverse()) {
    if (expected.terminal) continue;
    const current = await inspectLeasedBrowserGeneration(lease, options);
    const match = current.processes.find((entry) => entry.pid === expected.pid);
    if (!match || match.terminal) continue;
    invariant(
      exactProcessIdentityMatches(expected, match),
      "BROWSER_PROCESS_IDENTITY_DRIFT",
      "Browser process identity changed immediately before signaling.",
      {
        identity: processIdentityDiagnostics(expected, match),
        pid: expected.pid,
        role: lease.role,
        shutdownPhase: `pre-signal-${signal}`,
      },
    );
    try {
      (options.killProcess ?? process.kill)(expected.pid, signal);
      markOwnedSignalStarted(options.shutdownTracker);
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    count += 1;
  }
  return count;
}

export async function terminateLeasedBrowserGeneration(lease, options = {}) {
  await validateMarkers(lease, {
    allowMissingGeneration: lease.status === "retiring",
  });
  const capturedBeforeRecovery = Boolean(lease.identity);
  let authorityLease = lease;
  if (!capturedBeforeRecovery && (await pathExists(lease.stateFile))) {
    const identity = await captureBrowserGenerationIdentity(lease, options);
    authorityLease = { ...lease, identity };
  }
  let observation;
  if (capturedBeforeRecovery) {
    const strictTerminalTracker =
      createStrictTerminalDrainTracker(authorityLease);
    observation = await inspectLeasedBrowserGeneration(authorityLease, {
      ...options,
      strictTerminalTracker,
    });
    if (strictTerminalDrainPids(strictTerminalTracker).length > 0) {
      await waitForStrictTerminalReap(
        authorityLease,
        options,
        strictTerminalTracker,
        options.firstSeenTerminalMs ?? options.gracefulMs ?? 3_000,
      );
      observation = await inspectLeasedBrowserGeneration(
        authorityLease,
        options,
      );
    }
  } else {
    observation = await inspectLeasedBrowserGeneration(authorityLease, options);
  }
  const beganWithoutControlState =
    capturedBeforeRecovery && !observation.stateFilePresent;
  let shutdownTracker;
  if (
    observation.processes.length === 0 &&
    observation.locks.length === 0 &&
    !observation.stateFilePresent
  ) {
    return { alreadyStopped: true, escalated: false, termCount: 0 };
  }
  if (
    capturedBeforeRecovery &&
    observation.stateFilePresent &&
    observation.daemon
  ) {
    shutdownTracker = createShutdownTracker(authorityLease, observation);
    await validateMarkers(authorityLease, {
      allowMissingGeneration: authorityLease.status === "retiring",
    });
    await validateCapturedStateControlIdentity(authorityLease);
    const publicStop =
      options.publicStop ??
      (async () => {
        const result = await runProcess(
          authorityLease.browserBinary,
          ["stop"],
          {
            childRegistry: options.childRegistry,
            env: {
              ...process.env,
              BROWSE_STATE_FILE: authorityLease.stateFile,
              CHROMIUM_PROFILE: authorityLease.profile,
              GSTACK_CHROMIUM_PATH: authorityLease.executable,
            },
            signal: options.signal,
            timeoutMs: options.commandTimeoutMs ?? 10_000,
          },
        );
        invariant(
          result.code === 0,
          "BROWSER_PUBLIC_STOP_FAILED",
          "GStack public stop failed for the exact leased generation.",
          { code: result.code, stderr: result.stderr },
        );
      });
    const publicStopResult = publicStop(authorityLease);
    shutdownTracker.state.phase = "public-stop-started";
    await publicStopResult;
  }
  const shutdownOptions = () =>
    shutdownTracker ? { ...options, shutdownTracker } : options;
  observation = await waitForNoOwnedProcesses(
    authorityLease,
    shutdownOptions(),
    options.gracefulMs ?? 3_000,
  );
  if (beganWithoutControlState) {
    invariant(
      observation.processes.length === 0 &&
        observation.locks.length === 0 &&
        observation.stateFilePresent === false,
      "BROWSER_STATE_AUTHORITY_MISSING",
      "A fresh recovery invocation cannot signal or retire a live browser generation whose bound control state was already missing.",
      {
        count: observation.processes.length,
        lockNames: observation.locks,
        role: lease.role,
        stateFilePresent: observation.stateFilePresent,
      },
    );
    return { alreadyStopped: false, escalated: false, termCount: 0 };
  }
  let termCount = 0;
  if (observation.processes.length > 0) {
    if (!shutdownTracker && observation.stateFilePresent) {
      shutdownTracker = createShutdownTracker(authorityLease, observation);
    }
    termCount = await signalVerifiedProcesses(
      authorityLease,
      observation,
      "SIGTERM",
      shutdownOptions(),
    );
    observation = await waitForNoOwnedProcesses(
      authorityLease,
      shutdownOptions(),
      options.termMs ?? 2_000,
    );
  }
  if (
    observation.processes.length === 0 &&
    observation.locks.length === 0 &&
    observation.stateFilePresent
  ) {
    await retireLeasedBrowserStateFile(authorityLease, shutdownOptions());
    observation = await inspectLeasedBrowserGeneration(
      authorityLease,
      shutdownOptions(),
    );
  }
  let escalated = false;
  if (observation.processes.length > 0) {
    const killCount = await signalVerifiedProcesses(
      authorityLease,
      observation,
      "SIGKILL",
      shutdownOptions(),
    );
    escalated = killCount > 0;
    observation = await waitForNoOwnedProcesses(
      authorityLease,
      shutdownOptions(),
      options.killMs ?? 2_000,
    );
  }
  if (
    observation.processes.length === 0 &&
    observation.locks.length === 0 &&
    observation.stateFilePresent
  ) {
    await retireLeasedBrowserStateFile(authorityLease, shutdownOptions());
    observation = await inspectLeasedBrowserGeneration(
      authorityLease,
      shutdownOptions(),
    );
  }
  invariant(
    observation.processes.length === 0 &&
      observation.locks.length === 0 &&
      observation.stateFilePresent === false,
    "BROWSER_PROCESS_RETIREMENT_FAILED",
    "Exact leased browser processes, profile locks, or daemon state remain after bounded escalation; durable recovery state was retained.",
    {
      count: observation.processes.length,
      lockNames: observation.locks,
      role: lease.role,
      stateFilePresent: observation.stateFilePresent,
    },
  );
  return { alreadyStopped: false, escalated, termCount };
}

export async function retireLeasedBrowserArtifacts(lease, options = {}) {
  const observation = await inspectLeasedBrowserGeneration(lease, options);
  invariant(
    observation.processes.length === 0 &&
      observation.locks.length === 0 &&
      observation.stateFilePresent === false,
    "BROWSER_ARTIFACTS_PROCESS_ACTIVE",
    "Browser artifacts cannot be retired while an exact leased process, profile lock, or daemon state remains.",
  );
  if (await pathExists(lease.generationRoot)) {
    await assertLeaseDirectories(lease, [lease.generationRoot]);
    await rm(lease.generationRoot, { force: true, recursive: true });
  }
}

export async function retireLeasedBrowserProfile(leases, options = {}) {
  if (leases.length === 0) return;
  const [first] = leases;
  const receiptIdentity = {
    executable: first.executable,
    generations: leases
      .map(({ generation }) => generation)
      .sort((a, b) => a - b),
    profile: first.profile,
    role: first.role,
    runId: first.runId,
  };
  if (!(await pathExists(first.profile))) {
    invariant(
      JSON.stringify(
        await readLeasedOwnerOnlyJson(
          first,
          first.profileRetirementReceipt,
          "BROWSER_PROFILE_RETIREMENT_RECEIPT_UNSAFE",
        ),
      ) === JSON.stringify(receiptIdentity),
      "BROWSER_PROFILE_RETIREMENT_RECEIPT_MISMATCH",
      "Missing browser profile lacks its exact durable retirement receipt.",
    );
    await verifyNoLeasedBrowserProcesses(leases, options);
    return;
  }
  await assertLeaseDirectories(first, [
    first.profile,
    path.dirname(first.profileRetirementReceipt),
  ]);
  for (const lease of leases) {
    invariant(
      lease.runId === first.runId &&
        lease.role === first.role &&
        lease.profile === first.profile,
      "BROWSER_PROFILE_LEASE_MISMATCH",
      "Only one exact run/role profile may be retired together.",
    );
    const observation = await inspectLeasedBrowserGeneration(
      { ...lease, status: "retiring" },
      options,
    );
    invariant(
      observation.processes.length === 0 &&
        observation.locks.length === 0 &&
        observation.stateFilePresent === false,
      "BROWSER_PROFILE_PROCESS_ACTIVE",
      "Browser profile cannot be retired while an exact leased process, profile lock, or daemon state remains.",
    );
  }
  await atomicJson(first.profileRetirementReceipt, receiptIdentity, first);
  await assertLeaseDirectories(first, [first.profile]);
  await rm(first.profile, { force: true, recursive: true });
}

export async function verifyNoLeasedBrowserProcesses(leases, options = {}) {
  const processes = await readProcessTable({ ...options, leases });
  for (const lease of leases) {
    const discovered = discoverLeasedProcesses(processes, lease);
    invariant(
      discovered.processes.length === 0,
      "BROWSER_RETIRED_PROCESS_REAPPEARED",
      "An exact leased browser process exists after journaled retirement.",
      { count: discovered.processes.length, role: lease.role },
    );
  }
}

export async function retireLeasedBrowserRunArtifacts(leases, options = {}) {
  if (leases.length === 0) return;
  await verifyNoLeasedBrowserProcesses(leases, options);
  const browserRoot = path.join(leases[0].runRoot, "browser");
  if (await pathExists(browserRoot)) {
    await assertLeaseDirectories(leases[0], [browserRoot]);
    await rm(browserRoot, { force: true, recursive: true });
  }
}
