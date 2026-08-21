import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AcceptanceError } from "./core.mjs";
import { PAGE_ACTION_PROTOCOL } from "./page-actions.mjs";
import {
  PERFORMANCE_SCENARIO,
  captureConsoleGate,
  captureConsoleGates,
  collectRollChatObservations,
  consoleErrors,
  evaluateAction,
  groupDiagnostics,
  reconnectPlayerRole,
  runNeutralSmoke,
} from "./scenarios.mjs";

function pageResult(payload) {
  return JSON.stringify({ payload, protocol: PAGE_ACTION_PROTOCOL });
}

describe("acceptance scenario contracts", () => {
  it("defines every requested repeatable performance stage without an optimization claim", () => {
    expect(PERFORMANCE_SCENARIO.stages.map(({ id }) => id)).toEqual([
      "entry",
      "idle",
      "sheets",
      "chat",
      "quickbars",
      "pause",
      "requested-rolls",
      "optional-3d-dice",
    ]);
    expect(PERFORMANCE_SCENARIO.purpose).toContain(
      "does not identify, implement, or claim",
    );
    expect(PERFORMANCE_SCENARIO.measurements).toContain(
      "CPU time and memory samples",
    );
    expect(PERFORMANCE_SCENARIO.comparisonModes).toEqual([
      "automatic",
      "full",
      "reduced",
    ]);
    expect(PERFORMANCE_SCENARIO.viewports).toEqual([
      { width: 1440, height: 900, label: "standard" },
      { width: 1366, height: 768, label: "supported-constrained" },
    ]);
    expect(PERFORMANCE_SCENARIO.zoomPercentages).toEqual([100, 200]);
    expect(PERFORMANCE_SCENARIO.operatingSystemPreference).toEqual([
      "off",
      "on",
    ]);
    expect(PERFORMANCE_SCENARIO.attributionDimensions).toContain(
      "system CSS/compositor",
    );
  });

  it("treats unapproved console errors as failures and supports exact known exceptions", () => {
    const output = [
      "INFO Foundry ready",
      "ERROR TypeError: synthetic failure",
      "ERROR known viewport warning",
    ].join("\n");
    expect(consoleErrors(output)).toHaveLength(2);
    expect(consoleErrors(output, ["known viewport warning"])).toEqual([
      "ERROR TypeError: synthetic failure",
    ]);
  });

  it.each([
    "[error] Failed to load resource: the server responded with a status of 401 (Unauthorized)",
    "[warning] genuine warning",
    '[warning] Error: The setting "core.gridTemplatesNearby" is deprecated',
    '[warning] Error: The setting "core.coneTemplateType" is deprecated',
  ])("keeps strict accounting for %s", (line) => {
    expect(consoleErrors(line)).toEqual([line]);
  });

  it("keeps duplicate diagnostics in pass/fail accounting but groups only the report", () => {
    const lines = [
      "[2026-08-16T22:46:20.597Z] [warning] Error: duplicate",
      "[2026-08-16T22:46:20.597Z] [warning] Error: duplicate",
    ];
    expect(consoleErrors(lines.join("\n"))).toHaveLength(2);
    expect(groupDiagnostics(lines)).toEqual([
      { count: 2, diagnostic: "[warning] Error: duplicate" },
    ]);
  });

  it("retains phase and network provenance for every strict console gate", async () => {
    const evidence = { checkpoint: vi.fn(async () => undefined) };
    const gate = await captureConsoleGate({
      evidence,
      phase: "authenticated-entry",
      role: "gm",
      session: {
        consoleSnapshot: vi.fn(
          async () => "[error] Failed to load resource: 401 (Unauthorized)",
        ),
        networkSnapshot: vi.fn(
          async () => "GET https://example.invalid/dev/game → 401 (2ms, 10B)",
        ),
        resourceFailuresSnapshot: vi.fn(async () =>
          JSON.stringify({
            location: "https://example.invalid/dev/game",
            resources: [],
          }),
        ),
      },
    });
    expect(gate.errors).toHaveLength(1);
    expect(gate.phase).toBe("authenticated-entry");
    expect(gate.networkOutput).toContain("/dev/game → 401");
    expect(evidence.checkpoint).toHaveBeenCalledWith(
      "gm",
      "console",
      expect.objectContaining({ phase: "authenticated-entry" }),
    );
  });

  it("checks the player console even when the GM console already fails", async () => {
    const evidence = { checkpoint: vi.fn(async () => undefined) };
    const gm = {
      consoleSnapshot: vi.fn(async () => "[error] genuine GM failure"),
      networkSnapshot: vi.fn(async () => "GET https://example.invalid/a → 500"),
      resourceFailuresSnapshot: vi.fn(async () => "{}"),
    };
    const player = {
      consoleSnapshot: vi.fn(
        async () => "[warning] genuine player warning Error:",
      ),
      networkSnapshot: vi.fn(async () => "GET https://example.invalid/b → 200"),
      resourceFailuresSnapshot: vi.fn(async () => "{}"),
    };
    const gates = await captureConsoleGates({
      evidence,
      phase: "normal-workflow",
      roleSessions: { gm, player },
    });
    expect(gates.map(({ errors, role }) => [role, errors.length])).toEqual([
      ["gm", 1],
      ["player", 1],
    ]);
    expect(player.consoleSnapshot).toHaveBeenCalledOnce();
  });

  it("reconnects the player through the shared authenticated role lifecycle", async () => {
    const events = [];
    const fixture = { playerId: "player-id" };
    await reconnectPlayerRole({
      activatePlayer: async (received) => {
        events.push("activate");
        expect(received).toBe(fixture);
      },
      fixture,
      player: { stop: async () => events.push("stop") },
    });
    expect(events).toEqual(["stop", "activate"]);
  });

  it("runs the visible-review hold after reconnect evidence and before final consoles", async () => {
    const order = [];
    const visibleReviewHold = vi.fn(async () => order.push("hold"));
    const evidence = {
      checkpoint: vi.fn(async (role, kind) => order.push(`${role}/${kind}`)),
    };
    await evidence.checkpoint("player", "reconnect-persistence", {});
    await visibleReviewHold();
    await captureConsoleGates({
      evidence,
      phase: "normal-workflow",
      roleSessions: {
        gm: {
          consoleSnapshot: async () => "",
          networkSnapshot: async () => "",
          resourceFailuresSnapshot: async () => "{}",
        },
        player: {
          consoleSnapshot: async () => "",
          networkSnapshot: async () => "",
          resourceFailuresSnapshot: async () => "{}",
        },
      },
    });
    expect(order).toEqual([
      "player/reconnect-persistence",
      "hold",
      "gm/console",
      "player/console",
    ]);
  });

  it("runs exact cleanup when the visible-review hold fails", async () => {
    const runRoot = await mkdtemp(
      path.join(os.tmpdir(), "d6-visible-review-cleanup-test-"),
    );
    const evaluated = [];
    const responseFor = (file) => {
      const name = path.basename(file);
      if (name.includes("create-fixture")) {
        return {
          actorId: "actor-id",
          playerId: "player-id",
          skillId: "skill-id",
          targetTokenId: "target-token-id",
          weaponId: "weapon-id",
          worldItemId: "world-item-id",
        };
      }
      if (name.includes("player-advancement-before")) {
        return {
          enabledAdvanceButtonCount: 1,
          mode: "advance",
          resourceDisabled: true,
        };
      }
      if (name.includes("gm-resource-mode-persistence")) {
        return {
          resourceName: "system.resources.experiencePoints.value",
          resourceValue: 37,
        };
      }
      if (name.includes("player-resource-sync")) {
        return { received: true };
      }
      if (name.includes("gm-resource-persistence-after-reload")) {
        return { received: true };
      }
      if (
        name.includes("player-mode-ready") ||
        name.includes("player-mode-advance")
      ) {
        return { elementId: "actor-sheet-1" };
      }
      if (name.includes("weapon-target-difficulty")) {
        return {
          difficulty: 15,
          distance: 20,
          finalDifficulty: 15,
          rangeBand: "medium",
        };
      }
      if (name.includes("settings-snapshot")) {
        return { modules: [], settings: [] };
      }
      if (name.includes("capture-chat-boundary")) {
        return { capturedAt: 1, messageIds: [] };
      }
      if (name.includes("observe-chat")) {
        return { candidateCount: 1, exactCardinality: true };
      }
      if (name.includes("identify-chat")) {
        return { messageId: "message-id" };
      }
      return { ok: true };
    };
    const session = () => ({
      chain: vi.fn(async () => undefined),
      command: vi.fn(async () => undefined),
      evaluateFile: vi.fn(async (file) => {
        evaluated.push(path.basename(file));
        return pageResult(responseFor(file));
      }),
      setViewport: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    });
    const gm = session();
    const player = session();
    const checkpoints = [];
    const evidence = {
      checkpoint: vi.fn(async (role, kind) => checkpoints.push([role, kind])),
      initialize: vi.fn(async () => undefined),
    };
    try {
      await expect(
        runNeutralSmoke({
          activatePlayer: vi.fn(async () => undefined),
          evidence,
          gmUserId: "gm-id",
          lease: {
            leaseNonce: "lease-nonce",
            runId: "run-id",
            systemId: "d6-system-2e",
            worldId: "d6e2-acceptance-run-id",
          },
          roleSessions: { gm, player },
          runRoot,
          visibleReviewHold: vi.fn(async () => {
            throw new AcceptanceError(
              "VISIBLE_REVIEW_TIMEOUT",
              "review timed out",
            );
          }),
        }),
      ).rejects.toThrow(/Neutral Foundry acceptance smoke failed/);
      expect(checkpoints.at(-1)).toEqual(["player", "reconnect-persistence"]);
      expect(evaluated).toContain("gm-settings-restore.js");
      expect(evaluated).toContain("gm-cleanup.js");
      expect(player.stop).toHaveBeenCalledTimes(2);
    } finally {
      await rm(runRoot, { force: true, recursive: true });
    }
  });

  it("polls bounded structural roll observations until exact cardinality appears", async () => {
    const observations = [
      { candidateCount: 0, exactCardinality: false },
      { candidateCount: 1, exactCardinality: true },
    ];
    let clock = 1_000;
    const wait = vi.fn(async (milliseconds) => {
      clock += milliseconds;
    });
    await expect(
      collectRollChatObservations({
        attempts: 8,
        now: () => clock,
        observe: vi.fn(async () => observations.shift()),
        wait,
      }),
    ).resolves.toEqual([
      {
        attempt: 1,
        candidateCount: 0,
        elapsedMs: 0,
        exactCardinality: false,
      },
      {
        attempt: 2,
        candidateCount: 1,
        elapsedMs: 250,
        exactCardinality: true,
      },
    ]);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(250);
  });

  it("stops roll observation after the configured bound when ambiguity remains", async () => {
    const observe = vi.fn(async () => ({
      candidateCount: 2,
      exactCardinality: false,
    }));
    const wait = vi.fn(async () => undefined);
    const result = await collectRollChatObservations({
      attempts: 3,
      observe,
      wait,
    });
    expect(result).toHaveLength(3);
    expect(observe).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("passes a bounded timeout and accepts only the strict page-action result", async () => {
    const runRoot = await mkdtemp(
      path.join(os.tmpdir(), "d6-page-action-test-"),
    );
    const session = {
      evaluateFile: vi.fn(async () => pageResult({ ok: true })),
    };
    try {
      await expect(
        evaluateAction({
          name: "probe",
          role: "gm",
          runRoot,
          session,
          source: "return '{}';",
        }),
      ).resolves.toEqual({ ok: true });
      expect(session.evaluateFile).toHaveBeenCalledWith(
        expect.stringContaining("gm-probe.js"),
        { timeoutMs: 35_000 },
      );
    } finally {
      await rm(runRoot, { force: true, recursive: true });
    }
  });

  it.each([
    [
      "action exception",
      new AcceptanceError("PROCESS_FAILED", "action failed"),
    ],
    [
      "timeout",
      new AcceptanceError("PROCESS_ABORTED", "eval was aborted during timeout"),
    ],
    ["daemon loss", new Error("browse daemon connection lost")],
  ])("propagates %s without treating it as a result", async (_label, error) => {
    const runRoot = await mkdtemp(
      path.join(os.tmpdir(), "d6-page-action-test-"),
    );
    try {
      await expect(
        evaluateAction({
          name: "failure",
          role: "gm",
          runRoot,
          session: { evaluateFile: vi.fn(async () => Promise.reject(error)) },
          source: "return '{}';",
        }),
      ).rejects.toBe(error);
    } finally {
      await rm(runRoot, { force: true, recursive: true });
    }
  });

  it.each(["", "not-json", JSON.stringify({ payload: {} })])(
    "fails closed for empty or malformed output %j",
    async (output) => {
      const runRoot = await mkdtemp(
        path.join(os.tmpdir(), "d6-page-action-test-"),
      );
      try {
        await expect(
          evaluateAction({
            name: "malformed",
            role: "gm",
            runRoot,
            session: { evaluateFile: vi.fn(async () => output) },
            source: "return '{}';",
          }),
        ).rejects.toMatchObject({ code: "PAGE_ACTION_RESULT" });
      } finally {
        await rm(runRoot, { force: true, recursive: true });
      }
    },
  );

  it("attempts exact-lease cleanup when fixture creation fails after a partial write", async () => {
    const runRoot = await mkdtemp(
      path.join(os.tmpdir(), "d6-page-action-test-"),
    );
    const evaluatedFiles = [];
    let call = 0;
    const gm = {
      evaluateFile: vi.fn(async (file) => {
        evaluatedFiles.push(file);
        call += 1;
        if (call === 1) return pageResult({ ready: true });
        if (call === 2) return pageResult({ modules: [], settings: [] });
        if (call === 3)
          throw new AcceptanceError(
            "PROCESS_FAILED",
            "fixture action failed after creating a marked User",
          );
        return pageResult({ changed: [], deleted: [] });
      }),
      setViewport: vi.fn(async () => undefined),
    };
    const player = { stop: vi.fn(async () => undefined) };
    const evidence = {
      checkpoint: vi.fn(async () => undefined),
      initialize: vi.fn(async () => undefined),
    };
    const lease = {
      leaseNonce: "lease",
      runId: "run",
      systemId: "d6-system-2e",
      worldId: "d6e2-acceptance-run",
    };
    try {
      await expect(
        runNeutralSmoke({
          activatePlayer: vi.fn(),
          baseUrl: "https://example.invalid/dev",
          evidence,
          gmUserId: "gm-id",
          lease,
          roleSessions: { gm, player },
          runRoot,
        }),
      ).rejects.toThrow(/Neutral Foundry acceptance smoke failed/);
      expect(
        evaluatedFiles.some((file) => file.endsWith("gm-cleanup.js")),
      ).toBe(true);
      const cleanupFile = evaluatedFiles.find((file) =>
        file.endsWith("gm-cleanup.js"),
      );
      const cleanupSource = await readFile(cleanupFile, "utf8");
      expect(cleanupSource).toContain('"leaseNonce":"lease"');
      expect(cleanupSource).toContain('game.user?.id !== "gm-id"');
      expect(cleanupSource).toContain("filter(matches)");
    } finally {
      await rm(runRoot, { force: true, recursive: true });
    }
  });
});
