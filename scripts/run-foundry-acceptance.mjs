#!/usr/bin/env node

import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  BrowserRoleSession,
  HarnessChildRegistry,
  enterFoundryRole,
  runProcess,
} from "./foundry-acceptance/browser.mjs";
import {
  captureBrowserGenerationIdentity,
  collectBrowserProcessIdentityDrifts,
  createBrowserGenerationLease,
  retireLeasedBrowserArtifacts,
  terminateLeasedBrowserGeneration,
  writeBrowserGenerationMarkers,
} from "./foundry-acceptance/browser-lease.mjs";
import {
  AcceptanceError,
  DEFAULT_VIEWPORT,
  EvidenceRecorder,
  createRedactor,
  createRunIdentity,
  createSecureRunRoot,
  evaluatePreflight,
  provisionDisposableWorld,
  removeDisposableWorld,
  resolveEnvironmentSecret,
  validateFoundationConfig,
} from "./foundry-acceptance/core.mjs";
import {
  buildRuntimeProbeAction,
  parsePageActionResult,
  writePageAction,
} from "./foundry-acceptance/page-actions.mjs";
import {
  dockerServiceHealth,
  endpointHealth,
  recreateFoundryService,
  switchSystemSymlink,
  switchWorldEnvironment,
} from "./foundry-acceptance/runtime.mjs";
import {
  installSignalRestoration,
  inspectRecoveryIdentity,
  prepareRecoveryJournal,
  readRecoveryJournal,
  recoverFromJournal,
  activateBrowserGeneration,
  registerBrowserGeneration,
  retireRecoveryReceipt,
  transitionBrowserGeneration,
} from "./foundry-acceptance/recovery.mjs";
import {
  acquireAcceptanceLock,
  inspectAcceptanceLock,
} from "./foundry-acceptance/lock.mjs";
import {
  captureConsoleGate,
  PERFORMANCE_SCENARIO,
  runNeutralSmoke,
} from "./foundry-acceptance/scenarios.mjs";
import {
  assertVisibleReviewReadyEvidence,
  assertVisibleReviewResumeAuthorization,
  assertVisibleReviewRuntimeRetained,
  createVisibleReviewHold,
  visibleReviewRequested,
  writeVisibleReviewResumeMarker,
} from "./foundry-acceptance/visible-review.mjs";

function usage() {
  return `Usage:
  node scripts/run-foundry-acceptance.mjs plan
  node scripts/run-foundry-acceptance.mjs smoke --config /absolute/config.json --serialized-live-slot [--visible-review-hold]
  node scripts/run-foundry-acceptance.mjs resume-visible-review --config /absolute/config.json --journal /absolute/recovery-journal.json --serialized-live-slot
  node scripts/run-foundry-acceptance.mjs recover --config /absolute/config.json --journal /absolute/recovery-journal.json --serialized-live-slot

The smoke and recover commands also require FOUNDRY_ACCEPTANCE_LIVE_SLOT=granted.
Visible review additionally requires FOUNDRY_ACCEPTANCE_VISIBLE_REVIEW_SLOT=granted.`;
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function secretValue(config, role, values) {
  const variable = config.secrets[role];
  if (!variable) return "";
  const value = resolveEnvironmentSecret(process.env, variable);
  values.push(value);
  return value;
}

const DEFAULT_SERVICE_HEALTH_TIMEOUT_MS = 60_000;
const DEFAULT_RESTORATION_TIMEOUT_MS = 90_000;

async function waitForHealthy(config, options = {}, attempts) {
  const maximumAttempts =
    attempts ??
    Math.max(
      1,
      Math.ceil(
        (config.timeouts?.serviceHealthMs ??
          DEFAULT_SERVICE_HEALTH_TIMEOUT_MS) / 1_000,
      ),
    );
  let last = {};
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason;
    const [endpoint, service] = await Promise.all([
      endpointHealth(config.baseUrl, globalThis.fetch, options),
      dockerServiceHealth(config.runtime, runProcess, options),
    ]);
    last = { attempt, endpoint, service };
    if (endpoint.healthy && service.healthy) return last;
    await new Promise((resolve, reject) => {
      const finish = (callback) => {
        options.signal?.removeEventListener("abort", onAbort);
        callback();
      };
      const timer = globalThis.setTimeout(() => finish(resolve), 1_000);
      const onAbort = () => {
        globalThis.clearTimeout(timer);
        finish(() => reject(options.signal.reason));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  throw new Error(`Foundry did not become healthy: ${JSON.stringify(last)}`);
}

async function candidateSourceState(
  candidateSystemPath,
  signal,
  childRegistry,
) {
  const command = async (args) => {
    const result = await runProcess("git", args, {
      childRegistry,
      cwd: candidateSystemPath,
      env: process.env,
      signal,
      timeoutMs: 10_000,
    });
    if (result.code !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  };
  return {
    branch: await command(["branch", "--show-current"]),
    head: await command(["rev-parse", "HEAD"]),
    status: await command(["status", "--short", "--untracked-files=all"]),
  };
}

async function runSmoke(config, { visibleReviewHold } = {}) {
  const identity = createRunIdentity();
  const runRoot = await createSecureRunRoot(config.artifactRoot);
  const secrets = [];
  const gmSecret = secretValue(config, "gm", secrets);
  const playerSecret = secretValue(config, "player", secrets);
  const evidence = new EvidenceRecorder({
    directory: path.join(runRoot, "evidence"),
    redact: createRedactor(secrets),
  });
  const childRegistry = new HarnessChildRegistry();
  const roleSessions = {
    gm: new BrowserRoleSession({
      binary: config.browserBinary,
      childRegistry,
      role: "gm",
      runRoot,
    }),
    player: new BrowserRoleSession({
      binary: config.browserBinary,
      childRegistry,
      role: "player",
      runRoot,
    }),
  };
  let lease;
  let journalPath;
  let recoveryReceipt;
  let primaryError;
  const recoveryErrors = [];
  const leasedGenerations = new Map();
  const requireLeasedGeneration = (spec) => {
    const generation = leasedGenerations.get(`${spec.role}:${spec.generation}`);
    if (!generation) {
      throw new AcceptanceError(
        "BROWSER_GENERATION_NOT_DURABLY_PLANNED",
        `The ${spec.role} browser generation is not present in the durable lease registry.`,
        { generation: spec.generation, role: spec.role },
      );
    }
    return generation;
  };
  let signalRestoration;
  const acceptanceLock = await acquireAcceptanceLock({
    command: "smoke",
    config,
    runId: identity.runId,
  });

  const restoreAcceptance = async (reason, options = {}) => {
    const failures = [];
    await roleSessions.player
      .stop(options)
      .catch((error) => failures.push(new Error(`stop player: ${error}`)));
    await roleSessions.gm
      .stop(options)
      .catch((error) => failures.push(new Error(`stop GM: ${error}`)));
    let result;
    if (journalPath) {
      await recoverFromJournal({
        config,
        journalPath,
        recreateService: (runtime, childOptions) =>
          recreateFoundryService(runtime, runProcess, {
            ...childOptions,
            childRegistry,
          }),
        signal: options.signal,
        waitForHealthy: (healthConfig, healthOptions) =>
          waitForHealthy(healthConfig, {
            ...healthOptions,
            childRegistry,
          }),
      })
        .then((recovered) => {
          result = recovered;
          recoveryReceipt = recovered.receiptPath;
          journalPath = undefined;
        })
        .catch((error) => failures.push(error));
    } else if (lease) {
      await removeDisposableWorld(lease).catch((error) => failures.push(error));
    }
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Acceptance ${reason} restoration failed; use the durable recovery journal if retained.`,
      );
    }
    return result;
  };

  signalRestoration = installSignalRestoration({
    onRestore: restoreAcceptance,
    terminateOwnedChildren: (signal) => childRegistry.terminateAll(signal),
    timeoutMs: config.timeouts?.restorationMs ?? DEFAULT_RESTORATION_TIMEOUT_MS,
  });
  roleSessions.gm.setSignal(signalRestoration.operationSignal);
  roleSessions.player.setSignal(signalRestoration.operationSignal);

  try {
    const originalHealth = await waitForHealthy(
      config,
      {
        childRegistry,
        signal: signalRestoration.operationSignal,
      },
      1,
    );
    await evidence.initialize();
    await evidence.checkpoint("runtime", "before", originalHealth);
    await evidence.checkpoint("runtime", "candidate-source", {
      candidateSystemPath: config.candidateSystemPath,
      installPath: config.runtime.systemInstallPath,
      ...(await candidateSourceState(
        config.candidateSystemPath,
        signalRestoration.operationSignal,
        childRegistry,
      )),
    });

    await signalRestoration.runMutation(async () => {
      lease = await provisionDisposableWorld({
        foundryVersion: `14.${config.minimums?.foundryBuild ?? 366}`,
        identity,
        systemId: "d6-system-2e",
        worldsDirectory: path.join(config.dataPath, "worlds"),
      });
    });
    await signalRestoration.runMutation(async () => {
      ({ journalPath } = await prepareRecoveryJournal({
        config,
        lease,
        runRoot,
      }));
      await acceptanceLock.update({ journalPath, runId: lease.runId });
    });
    for (const session of Object.values(roleSessions)) {
      session.setGenerationLeaseHooks({
        beforeStart: async (spec, bindPlannedGeneration) => {
          const generation = await createBrowserGenerationLease({
            ...spec,
            runId: lease.runId,
          });
          await registerBrowserGeneration({
            config,
            generation,
            journalPath,
          });
          leasedGenerations.set(
            `${generation.role}:${generation.generation}`,
            generation,
          );
          bindPlannedGeneration(generation);
          await writeBrowserGenerationMarkers(generation);
          return generation;
        },
        afterStart: async (spec) => {
          const generation = requireLeasedGeneration(spec);
          const processIdentity = await captureBrowserGenerationIdentity(
            generation,
            {
              childRegistry,
              signal: signalRestoration.operationSignal,
            },
          );
          await activateBrowserGeneration({
            config,
            generation,
            identity: processIdentity,
            journalPath,
          });
          leasedGenerations.set(`${generation.role}:${generation.generation}`, {
            ...generation,
            identity: processIdentity,
            status: "active",
          });
        },
        beforeRetire: async (spec) => {
          const generation = requireLeasedGeneration(spec);
          await transitionBrowserGeneration({
            config,
            generation,
            journalPath,
            status: "retiring",
          });
          leasedGenerations.set(`${generation.role}:${generation.generation}`, {
            ...generation,
            status: "retiring",
          });
        },
        retireArtifacts: async (spec) => {
          const generation = requireLeasedGeneration(spec);
          const result = await terminateLeasedBrowserGeneration(generation, {
            childRegistry,
            signal: signalRestoration.operationSignal,
          });
          await retireLeasedBrowserArtifacts(generation, {
            childRegistry,
            signal: signalRestoration.operationSignal,
          });
          return result;
        },
        afterRetire: async (spec) => {
          const generation = requireLeasedGeneration(spec);
          await transitionBrowserGeneration({
            config,
            generation,
            journalPath,
            status: "retired",
          });
          leasedGenerations.set(`${generation.role}:${generation.generation}`, {
            ...generation,
            status: "retired",
          });
        },
      });
    }
    await evidence.checkpoint("runtime", "recovery-armed", {
      journalPath,
      lease: {
        runId: lease.runId,
        systemId: lease.systemId,
        worldId: lease.worldId,
      },
    });
    await signalRestoration.runMutation(() =>
      switchSystemSymlink({
        candidatePath: config.candidateSystemPath,
        installPath: config.runtime.systemInstallPath,
      }),
    );
    await signalRestoration.runMutation(() =>
      switchWorldEnvironment({
        envFile: config.runtime.envFile,
        worldId: lease.worldId,
      }),
    );
    await signalRestoration.runMutation((signal) =>
      recreateFoundryService(config.runtime, runProcess, {
        childRegistry,
        signal,
      }),
    );
    signalRestoration.throwIfInterrupted();
    const candidateHealth = await waitForHealthy(config, {
      childRegistry,
      signal: signalRestoration.operationSignal,
    });
    await evidence.checkpoint("runtime", "candidate-healthy", candidateHealth);

    const gmEntry = await enterFoundryRole({
      baseUrl: config.baseUrl,
      expectedRole: "gm",
      expectedUserName: config.roles.gmUserName,
      lease,
      roleSession: roleSessions.gm,
      runRoot,
      secret: gmSecret,
      signal: signalRestoration.operationSignal,
      inspectStartup: async () => {
        const platform = await roleSessions.gm.retireGStackWelcomeTab();
        await evidence.checkpoint("gm", "browser-platform-retired", {
          ...platform,
          phase: "gstack-startup",
        });
        await roleSessions.gm.clearDiagnostics();
      },
      inspectJoin: async () => {
        const gate = await captureConsoleGate({
          evidence,
          phase: "unauthenticated-join",
          role: "gm",
          session: roleSessions.gm,
        });
        if (gate.errors.length > 0) {
          throw new Error(
            `gm/unauthenticated-join: ${gate.errors.length} unapproved error line(s).`,
          );
        }
        await roleSessions.gm.clearDiagnostics();
      },
      verifyEntry: async ({ expectedRole, expectedUserId }) => {
        const file = await writePageAction(
          runRoot,
          "gm-entry-authority",
          buildRuntimeProbeAction({ expectedRole, expectedUserId, lease }),
        );
        return parsePageActionResult(
          await roleSessions.gm.evaluateFile(file, { timeoutMs: 35_000 }),
        );
      },
    });
    const gmUser = gmEntry.user;
    const gmEntryConsole = await captureConsoleGate({
      evidence,
      phase: "authenticated-entry",
      role: "gm",
      session: roleSessions.gm,
    });
    if (gmEntryConsole.errors.length > 0) {
      throw new Error(
        `gm/authenticated-entry: ${gmEntryConsole.errors.length} unapproved error line(s).`,
      );
    }
    await roleSessions.gm.clearDiagnostics();
    await roleSessions.gm.setViewport(config.viewport ?? DEFAULT_VIEWPORT);

    const preflight = evaluatePreflight(
      {
        ...gmEntry.authority,
        browserVersion: await roleSessions.gm.browserVersion(),
        endpointHealthy: candidateHealth.endpoint.healthy,
        processHealthy: candidateHealth.service.healthy,
        viewport: config.viewport ?? DEFAULT_VIEWPORT,
      },
      config.minimums,
    );
    await evidence.checkpoint("runtime", "preflight", preflight);
    if (!preflight.ok) throw new Error(preflight.failures.join("\n"));

    await runNeutralSmoke({
      activatePlayer: async (fixture) => {
        await enterFoundryRole({
          baseUrl: config.baseUrl,
          expectedRole: "player",
          expectedUserId: fixture.playerId,
          expectedUserName: config.roles.playerUserName,
          lease,
          roleSession: roleSessions.player,
          runRoot,
          secret: playerSecret,
          signal: signalRestoration.operationSignal,
          inspectStartup: async () => {
            const platform = await roleSessions.player.retireGStackWelcomeTab();
            await evidence.checkpoint("player", "browser-platform-retired", {
              ...platform,
              phase: "gstack-startup",
            });
            await roleSessions.player.clearDiagnostics();
          },
          inspectJoin: async () => {
            const gate = await captureConsoleGate({
              evidence,
              phase: "unauthenticated-join",
              role: "player",
              session: roleSessions.player,
            });
            if (gate.errors.length > 0) {
              throw new Error(
                `player/unauthenticated-join: ${gate.errors.length} unapproved error line(s).`,
              );
            }
            await roleSessions.player.clearDiagnostics();
          },
          verifyEntry: async ({ expectedRole, expectedUserId }) => {
            const file = await writePageAction(
              runRoot,
              "player-entry-authority",
              buildRuntimeProbeAction({ expectedRole, expectedUserId, lease }),
            );
            return parsePageActionResult(
              await roleSessions.player.evaluateFile(file, {
                timeoutMs: 35_000,
              }),
            );
          },
        });
        const playerEntryConsole = await captureConsoleGate({
          evidence,
          phase: "authenticated-entry",
          role: "player",
          session: roleSessions.player,
        });
        if (playerEntryConsole.errors.length > 0) {
          throw new Error(
            `player/authenticated-entry: ${playerEntryConsole.errors.length} unapproved error line(s).`,
          );
        }
        await roleSessions.player.clearDiagnostics();
      },
      evidence,
      gmUserId: gmUser.id,
      lease,
      playerName: config.roles.playerUserName,
      roleSessions,
      runRoot,
      visibleReviewHold: visibleReviewHold
        ? () =>
            visibleReviewHold.wait({
              assertRetained: async () => {
                const [lockOwner, journal] = await Promise.all([
                  acceptanceLock.assertOwned(),
                  readRecoveryJournal({ config, journalPath }),
                ]);
                assertVisibleReviewRuntimeRetained({
                  journal,
                  journalPath,
                  lease,
                  lockOwner,
                });
              },
              evidence,
              journalPath,
              runId: lease.runId,
              signal: signalRestoration.operationSignal,
            })
        : undefined,
      viewport: config.viewport ?? DEFAULT_VIEWPORT,
    });
  } catch (error) {
    primaryError = error;
  } finally {
    let restorationCompleted = false;
    const restore = signalRestoration
      ? signalRestoration.restore("finally")
      : restoreAcceptance("finally");
    await restore
      .then(async (result) => {
        if (result?.health) {
          await evidence.checkpoint(
            "runtime",
            "after-restoration",
            result.health,
          );
        }
        restorationCompleted = true;
      })
      .catch((error) => recoveryErrors.push(error));
    signalRestoration?.dispose();
    if (restorationCompleted) {
      await acceptanceLock
        .release()
        .catch((error) => recoveryErrors.push(error));
      if (recoveryErrors.length === 0 && recoveryReceipt) {
        await retireRecoveryReceipt({
          config,
          journalPath: recoveryReceipt.replace(/\.complete$/, ""),
        }).catch((error) => recoveryErrors.push(error));
      }
    }
    if (restorationCompleted && recoveryErrors.length === 0) {
      await rm(path.join(runRoot, "auth"), { recursive: true, force: true });
      await rm(path.join(runRoot, "browser"), { recursive: true, force: true });
      await rm(path.join(runRoot, "page-actions"), {
        recursive: true,
        force: true,
      });
    }
  }

  if (primaryError || recoveryErrors.length > 0) {
    const failures = [
      ...(primaryError ? [primaryError] : []),
      ...recoveryErrors,
    ];
    const processIdentityDrifts = failures.flatMap((failure) =>
      collectBrowserProcessIdentityDrifts(failure),
    );
    if (processIdentityDrifts.length > 0) {
      await evidence.checkpoint("runtime", "browser-process-identity-drift", {
        events: processIdentityDrifts,
      });
    }
    throw new AggregateError(
      failures,
      `Foundry acceptance failed; retained evidence at ${path.join(runRoot, "evidence")}.`,
    );
  }
  return {
    evidenceDirectory: path.join(runRoot, "evidence"),
    runId: identity.runId,
  };
}

const [command = "", ...args] = process.argv.slice(2);

if (command === "plan") {
  console.log(
    JSON.stringify(
      {
        guard:
          "Smoke and recovery require both an explicit flag and a serialized-live-slot environment grant, then acquire the same host-global D6 Foundry acceptance lock.",
        minimums: {
          chromiumMajor: 146,
          foundryBuild: 366,
          viewport: "1024x768",
        },
        neutralSmoke: [
          "marker-verified disposable world",
          "atomic cross-process smoke/recovery runtime lock",
          "isolated GM and owning-player browser profiles",
          "Actor, embedded and standalone Items, Scene and owned Token",
          "public roll, permission separation, reload and reconnect persistence",
          "console, endpoint and process evidence",
          "lease-scoped fixture cleanup and reverse runtime restoration",
          "owner-only durable crash journal and idempotent recovery command",
          "durably leased detached browser generations with exact process retirement",
          "optional dual-gated owner-only marker visible-review hold before final console cleanup",
        ],
        performance: PERFORMANCE_SCENARIO,
      },
      null,
      2,
    ),
  );
} else if (
  command === "smoke" ||
  command === "recover" ||
  command === "resume-visible-review"
) {
  if (
    !args.includes("--serialized-live-slot") ||
    process.env.FOUNDRY_ACCEPTANCE_LIVE_SLOT !== "granted"
  ) {
    throw new Error(
      "Live acceptance is blocked without --serialized-live-slot and FOUNDRY_ACCEPTANCE_LIVE_SLOT=granted.",
    );
  }
  if (command === "resume-visible-review") {
    assertVisibleReviewResumeAuthorization(process.env);
  }
  const holdRequested =
    command === "resume-visible-review"
      ? false
      : visibleReviewRequested({ args, command, env: process.env });
  const configPath = option(args, "--config");
  if (!configPath || !path.isAbsolute(configPath))
    throw new Error("--config must be an absolute path.");
  const config = validateFoundationConfig(
    JSON.parse(await readFile(configPath, "utf8")),
  );
  let result;
  if (command === "smoke") {
    const visibleReviewHold = holdRequested
      ? createVisibleReviewHold()
      : undefined;
    let smokeCompleted = false;
    try {
      result = await runSmoke(config, { visibleReviewHold });
      smokeCompleted = true;
    } finally {
      await visibleReviewHold?.dispose({ retireMarker: smokeCompleted });
    }
  } else if (command === "recover") {
    const journalPath = option(args, "--journal");
    const recovery = await inspectRecoveryIdentity({ config, journalPath });
    const acceptanceLock = await acquireAcceptanceLock({
      command: "recover",
      config,
      journalPath,
      runId: recovery.runId,
    });
    const childRegistry = new HarnessChildRegistry();
    const signalRestoration = installSignalRestoration({
      onRestore: (_reason, options) =>
        recoverFromJournal({
          config,
          journalPath,
          recreateService: (runtime, childOptions) =>
            recreateFoundryService(runtime, runProcess, {
              ...childOptions,
              childRegistry,
            }),
          signal: options.signal,
          waitForHealthy: (healthConfig, healthOptions) =>
            waitForHealthy(healthConfig, {
              ...healthOptions,
              childRegistry,
            }),
        }),
      terminateOwnedChildren: (signal) => childRegistry.terminateAll(signal),
      timeoutMs:
        config.timeouts?.restorationMs ?? DEFAULT_RESTORATION_TIMEOUT_MS,
    });
    let recoveryCompleted = false;
    try {
      result = await signalRestoration.restore("recover");
      recoveryCompleted = true;
    } finally {
      signalRestoration.dispose();
      if (recoveryCompleted) await acceptanceLock.release();
    }
    if (recoveryCompleted) {
      await retireRecoveryReceipt({ config, journalPath });
    }
  } else {
    const journalPath = option(args, "--journal");
    if (!journalPath || !path.isAbsolute(journalPath)) {
      throw new Error("--journal must be an absolute path.");
    }
    const [{ metadata: lockOwner }, journal] = await Promise.all([
      inspectAcceptanceLock({ config }),
      readRecoveryJournal({ config, journalPath }),
    ]);
    assertVisibleReviewRuntimeRetained({
      journal,
      journalPath,
      lease: journal.lease,
      lockOwner,
    });
    await assertVisibleReviewReadyEvidence({
      evidenceFile: path.join(
        path.dirname(journalPath),
        "evidence",
        "checkpoints.jsonl",
      ),
      runId: journal.lease.runId,
    });
    result = await writeVisibleReviewResumeMarker({
      journalPath,
      runId: journal.lease.runId,
    });
  }
  console.log(JSON.stringify(result, null, 2));
} else {
  console.error(usage());
  process.exitCode = 1;
}
