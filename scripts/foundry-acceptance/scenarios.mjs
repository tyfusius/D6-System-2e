import {
  buildCaptureChatBoundaryAction,
  buildAwaitCharacterResourceAction,
  buildAwaitRuntimeReadyAction,
  buildCleanupAction,
  buildCreateNeutralFixtureAction,
  buildExerciseGmResourceModePersistenceAction,
  buildExercisePlayerAdvancementAction,
  buildExerciseVisualEffectsAction,
  buildIdentifyRollChatAction,
  buildInspectCharacterAdvancementAction,
  buildInspectPortraitPermissionAction,
  buildInspectWeaponTargetDifficultyAction,
  buildMarkChatAsGmAction,
  buildObserveRollChatAction,
  buildOpenActorSheetAction,
  buildOpenWeaponRollAction,
  buildReadNeutralFixtureAction,
  buildRuntimeProbeAction,
  buildSeedFeatureAcceptanceAction,
  buildSetPortraitPermissionAction,
  buildSetCharacterSheetModeAction,
  buildSetCharacterSheetModeDocumentAction,
  buildSettingsRestoreAction,
  buildSettingsSnapshotAction,
  buildVerifyChatAction,
  parsePageActionResult,
  writePageAction,
} from "./page-actions.mjs";
import { AcceptanceError, DEFAULT_VIEWPORT } from "./core.mjs";

const PUBLIC_PAGE_ACTION_PROCESS_TIMEOUT_MS = 35_000;
const ROLL_CHAT_OBSERVATION_ATTEMPTS = 8;
const ROLL_CHAT_OBSERVATION_INTERVAL_MS = 250;

export const PERFORMANCE_SCENARIO = Object.freeze({
  id: "neutral-client-performance-v1",
  purpose:
    "Repeatable measurement only; it does not identify, implement, or claim an optimization.",
  prerequisites: Object.freeze([
    "The standard disposable-world preflight passes at 1440×900.",
    "The same synthetic Actor, embedded Item, standalone Item, Scene, and owned Token fixture is used in every comparison.",
    "Browser cache/profile mode, Foundry build, system ref, enabled modules, and optional 3D-dice state are recorded.",
  ]),
  comparisonModes: Object.freeze(["automatic", "full", "reduced"]),
  viewports: Object.freeze([
    Object.freeze({ width: 1440, height: 900, label: "standard" }),
    Object.freeze({ width: 1366, height: 768, label: "supported-constrained" }),
  ]),
  zoomPercentages: Object.freeze([100, 200]),
  operatingSystemPreference: Object.freeze(["off", "on"]),
  attributionDimensions: Object.freeze([
    "system CSS/compositor",
    "hook/rerender",
    "document preparation",
    "asset/bundle",
    "Foundry",
    "third-party modules",
  ]),
  stages: Object.freeze([
    { id: "entry", repeats: 3, action: "cold and warm world entry to ready" },
    { id: "idle", durationSeconds: 60, action: "idle on the synthetic Scene" },
    {
      id: "sheets",
      repeats: 10,
      action: "open, switch one tab, and close Actor and Item sheets",
    },
    {
      id: "chat",
      repeats: 10,
      action: "create and render neutral public rolls/chat cards",
    },
    {
      id: "quickbars",
      repeats: 10,
      action: "open, interact with, and close PC/GM quickbars",
    },
    {
      id: "pause",
      repeats: 10,
      action: "GM pause/unpause while the owning player observes",
    },
    {
      id: "requested-rolls",
      repeats: 5,
      action: "GM requests and player completes a neutral owned roll",
    },
    {
      id: "optional-3d-dice",
      repeats: 5,
      action:
        "repeat public rolls with Dice So Nice enabled only when WebGL and the module are available",
      optional: true,
    },
  ]),
  measurements: Object.freeze([
    "navigation-to-ready and action latency",
    "long-task count and duration",
    "CPU time and memory samples",
    "animation/frame evidence when available",
    "network/resource count and transferred bytes",
    "console and system warning/error delta",
  ]),
});

export async function evaluateAction({ name, role, runRoot, session, source }) {
  const file = await writePageAction(runRoot, `${role}-${name}`, source);
  return parsePageActionResult(
    await session.evaluateFile(file, {
      timeoutMs: PUBLIC_PAGE_ACTION_PROCESS_TIMEOUT_MS,
    }),
  );
}

export async function collectRollChatObservations({
  attempts = ROLL_CHAT_OBSERVATION_ATTEMPTS,
  now = Date.now,
  observe,
  wait = (milliseconds) =>
    new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
}) {
  const startedAt = now();
  const observations = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const observation = await observe(attempt);
    observations.push({
      ...observation,
      attempt,
      elapsedMs: Math.max(0, now() - startedAt),
    });
    if (observation.exactCardinality === true || attempt === attempts) break;
    await wait(ROLL_CHAT_OBSERVATION_INTERVAL_MS);
  }
  return Object.freeze(observations);
}

export function consoleErrors(consoleOutput, allowPatterns = []) {
  const allowed = allowPatterns.map((pattern) => new RegExp(pattern, "i"));
  return String(consoleOutput)
    .split("\n")
    .filter((line) =>
      /\[warning\]|\b(error|warning|typeerror|referenceerror|unhandled|failed to load)\b/i.test(
        line,
      ),
    )
    .filter((line) => !allowed.some((pattern) => pattern.test(line)));
}

export function groupDiagnostics(lines) {
  const groups = new Map();
  for (const line of lines) {
    const normalized = String(line).replace(/^\[[^\]]+\]\s*/, "");
    const group = groups.get(normalized) ?? {
      count: 0,
      diagnostic: normalized,
    };
    group.count += 1;
    groups.set(normalized, group);
  }
  return [...groups.values()];
}

export async function captureConsoleGate({ evidence, phase, role, session }) {
  const [consoleOutput, networkOutput, resourceFailures] = await Promise.all([
    session.consoleSnapshot(),
    session.networkSnapshot(),
    session.resourceFailuresSnapshot(),
  ]);
  const errors = consoleErrors(consoleOutput);
  await evidence.checkpoint(role, "console", {
    errors,
    phase,
    reportGroups: groupDiagnostics(errors),
    consoleOutput,
    networkOutput,
    resourceFailures,
  });
  return {
    consoleOutput,
    errors,
    networkOutput,
    phase,
    resourceFailures,
    role,
  };
}

export async function captureConsoleGates({ evidence, phase, roleSessions }) {
  const gates = [];
  for (const [role, session] of Object.entries(roleSessions)) {
    gates.push(await captureConsoleGate({ evidence, phase, role, session }));
  }
  return gates;
}

export async function reconnectPlayerRole({ activatePlayer, fixture, player }) {
  await player.stop();
  await activatePlayer(fixture);
}

export async function runNeutralSmoke({
  activatePlayer,
  evidence,
  gmUserId,
  lease,
  playerName = "Synthetic Acceptance Player",
  roleSessions,
  runRoot,
  visibleReviewHold,
  viewport = DEFAULT_VIEWPORT,
}) {
  const gm = roleSessions.gm;
  const player = roleSessions.player;
  let fixture;
  let settingsSnapshot;
  let primaryError;
  let fixtureMutationAttempted = false;
  const cleanupFailures = [];

  await evidence.initialize();
  try {
    await gm.setViewport(viewport);
    const gmProbe = await evaluateAction({
      name: "probe",
      role: "gm",
      runRoot,
      session: gm,
      source: buildRuntimeProbeAction({
        expectedRole: "gm",
        expectedUserId: gmUserId,
        lease,
      }),
    });
    await evidence.checkpoint("gm", "runtime-ready", gmProbe);

    settingsSnapshot = await evaluateAction({
      name: "settings-snapshot",
      role: "gm",
      runRoot,
      session: gm,
      source: buildSettingsSnapshotAction(),
    });
    await evidence.checkpoint(
      "gm",
      "settings-modules-before",
      settingsSnapshot,
    );

    fixtureMutationAttempted = true;
    fixture = await evaluateAction({
      name: "create-fixture",
      role: "gm",
      runRoot,
      session: gm,
      source: buildCreateNeutralFixtureAction({
        gmUserId,
        lease,
        playerName,
      }),
    });
    await evidence.checkpoint("gm", "fixture-created", fixture);

    await activatePlayer(fixture);
    await player.setViewport(viewport);
    const playerProbe = await evaluateAction({
      name: "probe",
      role: "player",
      runRoot,
      session: player,
      source: buildRuntimeProbeAction({
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        lease,
      }),
    });
    await evidence.checkpoint("player", "runtime-ready", playerProbe);

    for (const [role, session] of [
      ["gm", gm],
      ["player", player],
    ]) {
      const permissions = await evaluateAction({
        name: "fixture-permissions",
        role,
        runRoot,
        session,
        source: buildReadNeutralFixtureAction({
          actorId: fixture.actorId,
          expectedRole: role,
          leaseNonce: lease.leaseNonce,
          worldItemId: fixture.worldItemId,
        }),
      });
      await evidence.checkpoint(role, "fixture-permissions", permissions);
    }

    const featureSeed = await evaluateAction({
      name: "feature-seed",
      role: "gm",
      runRoot,
      session: gm,
      source: buildSeedFeatureAcceptanceAction({
        actorId: fixture.actorId,
        gmUserId,
        lease,
      }),
    });
    await evidence.checkpoint("gm", "feature-seed", featureSeed);

    const gmPersistence = await evaluateAction({
      name: "gm-resource-mode-persistence",
      role: "gm",
      runRoot,
      session: gm,
      source: buildExerciseGmResourceModePersistenceAction({
        actorId: fixture.actorId,
        gmUserId,
        lease,
      }),
    });
    await evidence.checkpoint(
      "gm",
      "gm-resource-mode-persistence",
      gmPersistence,
    );
    const gmNormalMode = await evaluateAction({
      name: "gm-mode-normal",
      role: "gm",
      runRoot,
      session: gm,
      source: buildSetCharacterSheetModeAction({
        actorId: fixture.actorId,
        expectedRole: "gm",
        expectedUserId: gmUserId,
        lease,
        mode: "normal",
      }),
    });
    await evidence.checkpoint("gm", "gm-mode-normal", gmNormalMode);

    await gm.command("reload");
    await gm.command("wait", ["#sidebar"]);
    await evaluateAction({
      name: "gm-reload-ready",
      role: "gm",
      runRoot,
      session: gm,
      source: buildAwaitRuntimeReadyAction({
        expectedRole: "gm",
        expectedUserId: gmUserId,
        lease,
      }),
    });
    const gmResourcePersistence = await evaluateAction({
      name: "gm-resource-persistence-after-reload",
      role: "gm",
      runRoot,
      session: gm,
      source: buildAwaitCharacterResourceAction({
        actorId: fixture.actorId,
        expectedRole: "gm",
        expectedUserId: gmUserId,
        expectedValue: gmPersistence.resourceValue,
        lease,
        resourceName: gmPersistence.resourceName,
      }),
    });
    await evidence.checkpoint(
      "gm",
      "resource-persistence-after-reload",
      gmResourcePersistence,
    );
    if (!gmResourcePersistence.received) {
      throw new AcceptanceError(
        "GM_RESOURCE_PERSISTENCE_FAILED",
        "GM resource update did not survive reload.",
        gmResourcePersistence,
      );
    }

    const playerResourceSync = await evaluateAction({
      name: "player-resource-sync",
      role: "player",
      runRoot,
      session: player,
      source: buildAwaitCharacterResourceAction({
        actorId: fixture.actorId,
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        expectedValue: gmPersistence.resourceValue,
        lease,
        resourceName: gmPersistence.resourceName,
      }),
    });
    await evidence.checkpoint("player", "resource-sync", playerResourceSync);
    if (!playerResourceSync.received) {
      await player.stop();
      await activatePlayer(fixture);
      const afterReload = await evaluateAction({
        name: "player-resource-sync-after-reload",
        role: "player",
        runRoot,
        session: player,
        source: buildAwaitCharacterResourceAction({
          actorId: fixture.actorId,
          expectedRole: "player",
          expectedUserId: fixture.playerId,
          expectedValue: gmPersistence.resourceValue,
          lease,
          resourceName: gmPersistence.resourceName,
        }),
      });
      await evidence.checkpoint(
        "player",
        "resource-sync-after-reload",
        afterReload,
      );
      throw new AcceptanceError(
        "PLAYER_RESOURCE_SYNC_FAILED",
        "Owning player did not receive the GM resource update.",
        { afterReload, beforeReload: playerResourceSync },
      );
    }

    const playerAdvanceMode = await evaluateAction({
      name: "player-mode-advance",
      role: "player",
      runRoot,
      session: player,
      source: buildSetCharacterSheetModeDocumentAction({
        actorId: fixture.actorId,
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        lease,
        mode: "advance",
      }),
    });
    const advancementBefore = await evaluateAction({
      name: "player-advancement-before",
      role: "player",
      runRoot,
      session: player,
      source: buildInspectCharacterAdvancementAction({
        actorId: fixture.actorId,
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        lease,
        skillId: fixture.skillId,
      }),
    });
    if (
      advancementBefore.mode !== "advance" ||
      advancementBefore.enabledAdvanceButtonCount < 1 ||
      advancementBefore.resourceDisabled !== true
    ) {
      throw new AcceptanceError(
        "PLAYER_ADVANCEMENT_UNAVAILABLE",
        "Owning-player Advance mode did not expose protected advancement controls.",
        advancementBefore,
      );
    }
    const playerAdvancement = await evaluateAction({
      name: "player-advancement-spend",
      role: "player",
      runRoot,
      session: player,
      source: buildExercisePlayerAdvancementAction({
        actorId: fixture.actorId,
        expectedUserId: fixture.playerId,
        lease,
        skillId: fixture.skillId,
      }),
    });
    await evidence.checkpoint("player", "advancement", {
      before: advancementBefore,
      mode: playerAdvanceMode,
      spend: playerAdvancement,
    });
    await evaluateAction({
      name: "player-mode-normal",
      role: "player",
      runRoot,
      session: player,
      source: buildSetCharacterSheetModeDocumentAction({
        actorId: fixture.actorId,
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        lease,
        mode: "normal",
      }),
    });

    await evaluateAction({
      name: "open-weapon-roll",
      role: "player",
      runRoot,
      session: player,
      source: buildOpenWeaponRollAction({
        actorId: fixture.actorId,
        expectedUserId: fixture.playerId,
        lease,
        weaponId: fixture.weaponId,
      }),
    });
    const targetDifficulty = await evaluateAction({
      name: "weapon-target-difficulty",
      role: "player",
      runRoot,
      session: player,
      source: buildInspectWeaponTargetDifficultyAction({
        actorId: fixture.actorId,
        expectedUserId: fixture.playerId,
        lease,
        targetTokenId: fixture.targetTokenId,
      }),
    });
    if (
      targetDifficulty.distance !== 20 ||
      targetDifficulty.rangeBand !== "medium" ||
      targetDifficulty.difficulty !== targetDifficulty.finalDifficulty
    ) {
      throw new AcceptanceError(
        "WEAPON_TARGET_DIFFICULTY_MISMATCH",
        "Measured 20 m target did not resolve the Medium-band final difficulty.",
      );
    }
    await evidence.checkpoint(
      "player",
      "weapon-target-difficulty",
      targetDifficulty,
    );
    await player.command("press", ["Escape"]);

    const visualEffects = [];
    for (const preference of ["full", "reduced"]) {
      visualEffects.push(
        await evaluateAction({
          name: `visual-effects-${preference}`,
          role: "player",
          runRoot,
          session: player,
          source: buildExerciseVisualEffectsAction({
            expectedUserId: fixture.playerId,
            lease,
            preference,
          }),
        }),
      );
    }
    await evidence.checkpoint("player", "visual-effects", { visualEffects });

    const portraitPermissions = [];
    for (const allowed of [false, true]) {
      await evaluateAction({
        name: `portrait-setting-${allowed ? "allowed" : "denied"}`,
        role: "gm",
        runRoot,
        session: gm,
        source: buildSetPortraitPermissionAction({
          allowed,
          gmUserId,
          lease,
        }),
      });
      portraitPermissions.push(
        await evaluateAction({
          name: `portrait-player-${allowed ? "allowed" : "denied"}`,
          role: "player",
          runRoot,
          session: player,
          source: buildInspectPortraitPermissionAction({
            actorId: fixture.actorId,
            allowed,
            expectedUserId: fixture.playerId,
            lease,
          }),
        }),
      );
    }
    await evidence.checkpoint("player", "portrait-permission", {
      portraitPermissions,
    });

    await evaluateAction({
      name: "open-actor-sheet",
      role: "player",
      runRoot,
      session: player,
      source: buildOpenActorSheetAction(fixture.actorId),
    });
    await evaluateAction({
      name: "pre-roll-authority",
      role: "player",
      runRoot,
      session: player,
      source: buildRuntimeProbeAction({
        expectedRole: "player",
        expectedUserId: fixture.playerId,
        lease,
      }),
    });
    const chatBoundary = await evaluateAction({
      name: "capture-chat-boundary",
      role: "player",
      runRoot,
      session: player,
      source: buildCaptureChatBoundaryAction({
        expectedUserId: fixture.playerId,
        lease,
      }),
    });
    await player.chain([
      ["wait", ".d6e2-character-v2"],
      [
        "click",
        `.d6e2-character-v2 [data-item-id="${fixture.skillId}"] [data-action="rollSkill"]`,
      ],
      ["wait", ".d6e2-roll-dialog"],
      ["click", '.d6e2-roll-dialog button[data-action="roll"]'],
      ["wait", "1000"],
    ]);
    const chatObservations = await collectRollChatObservations({
      observe: () =>
        evaluateAction({
          name: "observe-chat",
          role: "player",
          runRoot,
          session: player,
          source: buildObserveRollChatAction({
            boundary: chatBoundary,
            expectedUserId: fixture.playerId,
            lease,
          }),
        }),
    });
    await evidence.checkpoint("player", "roll-chat-observation", {
      attempts: chatObservations,
    });
    const identifiedChat = await evaluateAction({
      name: "identify-chat",
      role: "player",
      runRoot,
      session: player,
      source: buildIdentifyRollChatAction({
        boundary: chatBoundary,
        expectedUserId: fixture.playerId,
        lease,
      }),
    });
    const markedChat = await evaluateAction({
      name: "mark-chat",
      role: "gm",
      runRoot,
      session: gm,
      source: buildMarkChatAsGmAction({
        boundary: chatBoundary,
        expectedPlayerId: fixture.playerId,
        gmUserId,
        lease,
        messageId: identifiedChat.messageId,
      }),
    });
    const publicChat = await evaluateAction({
      name: "verify-chat",
      role: "player",
      runRoot,
      session: player,
      source: buildVerifyChatAction({
        expectedUserId: fixture.playerId,
        lease,
        messageId: identifiedChat.messageId,
      }),
    });
    await evidence.checkpoint("player", "public-roll", {
      ...identifiedChat,
      ...markedChat,
      ...publicChat,
    });

    for (const [role, session] of [
      ["gm", gm],
      ["player", player],
    ]) {
      await session.command("reload");
      await session.command("wait", ["#sidebar"]);
      const persisted = await evaluateAction({
        name: "reload-persistence",
        role,
        runRoot,
        session,
        source: buildReadNeutralFixtureAction({
          actorId: fixture.actorId,
          expectedRole: role,
          leaseNonce: lease.leaseNonce,
          worldItemId: fixture.worldItemId,
        }),
      });
      await evidence.checkpoint(role, "reload-persistence", persisted);
    }

    await reconnectPlayerRole({ activatePlayer, fixture, player });
    const reconnected = await evaluateAction({
      name: "reconnect-persistence",
      role: "player",
      runRoot,
      session: player,
      source: buildReadNeutralFixtureAction({
        actorId: fixture.actorId,
        expectedRole: "player",
        leaseNonce: lease.leaseNonce,
        worldItemId: fixture.worldItemId,
      }),
    });
    await evidence.checkpoint("player", "reconnect-persistence", reconnected);

    await visibleReviewHold?.();

    const consoleGates = await captureConsoleGates({
      evidence,
      phase: "normal-workflow",
      roleSessions: { gm, player },
    });
    const failedGates = consoleGates.filter(({ errors }) => errors.length > 0);
    if (failedGates.length > 0) {
      throw new AcceptanceError(
        "CONSOLE_ERRORS",
        failedGates
          .map(
            ({ errors, phase, role }) =>
              `${role}/${phase}: ${errors.length} unapproved error line(s)`,
          )
          .join("; "),
        { gates: failedGates },
      );
    }
  } catch (error) {
    primaryError = error;
  } finally {
    await player
      .stop()
      .catch((error) => cleanupFailures.push({ label: "stop player", error }));
    if (settingsSnapshot) {
      await evaluateAction({
        name: "settings-restore",
        role: "gm",
        runRoot,
        session: gm,
        source: buildSettingsRestoreAction({
          gmUserId,
          lease,
          snapshot: settingsSnapshot,
        }),
      }).catch((error) =>
        cleanupFailures.push({ label: "restore settings/modules", error }),
      );
    }
    if (fixtureMutationAttempted) {
      await evaluateAction({
        name: "cleanup",
        role: "gm",
        runRoot,
        session: gm,
        source: buildCleanupAction({ gmUserId, lease }),
      }).catch((error) =>
        cleanupFailures.push({ label: "delete marked fixtures", error }),
      );
    }
  }

  if (primaryError || cleanupFailures.length > 0) {
    const errors = [
      ...(primaryError ? [primaryError] : []),
      ...cleanupFailures.map(
        ({ error, label }) =>
          new AcceptanceError(
            "CLEANUP_FAILED",
            `${label}: ${error instanceof Error ? error.message : String(error)}`,
          ),
      ),
    ];
    throw new AggregateError(
      errors,
      "Neutral Foundry acceptance smoke failed.",
    );
  }
  return { fixture, ok: true };
}
