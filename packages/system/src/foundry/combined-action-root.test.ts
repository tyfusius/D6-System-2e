import type * as RollService from "./rolls/roll-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveD6Roll,
  type D6RollRequestV1,
  type D6RollInvocationOptionsV1,
  type D6RollResultV1,
  type D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import { createCombinedActionRootState } from "../application/combined-action-root";
import {
  fixture as combatFixture,
  compositionFixture,
} from "../application/combined-combat.test-fixtures";
import {
  combinedRoot,
  executeCombinedRootRoll,
  executeCombinedRootDamage,
  registerCombinedRootSocket,
  repairCombinedRootPresentation,
  resetCombinedRootForTests,
  setCombinedRootRenderer,
} from "./combined-action-root";
import {
  hasUnpresentedInitiatingActionResults,
  serializeD6FoundryRolls,
} from "./initiating-action-message";
const f = vi.hoisted(() => ({
  roll: vi.fn(),
  damage: vi.fn(),
  reward: vi.fn(),
  settings: vi.fn((_key: string, fallback: unknown) => fallback),
}));
vi.mock("./rolls/roll-service", async (importOriginal) => ({
  d6RollMessageFlags: (await importOriginal<typeof RollService>())
    .d6RollMessageFlags,
  rollAttribute: f.roll,
  rollSkill: f.roll,
  rollItem: f.roll,
  rollCombinedWeaponAttack: f.roll,
  rollSuccessfulWeaponAttackDamage: f.damage,
  retryD6MatchingResultReward: f.reward,
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ id: "second-edition" }),
}));
vi.mock("../settings/roll-outcome", () => ({
  currentSuccessRuntimeStrategy: () => ({ evaluator: "second-edition-strict" }),
  currentWildDieRuntimeStrategy: () => ({ policy: "second-edition" }),
}));
vi.mock("../settings/setting-values", () => ({
  booleanSetting: f.settings,
  numberSetting: f.settings,
}));
function requestedContext(request: D6RollRequestV1) {
  const value = request.context?.requestedRoll;
  if (!value) throw new Error("Missing fixture context");
  return value;
}
const context = {
  groupId: "group",
  stage: "command" as const,
  allocatedBonusScore: 0,
  commandDifficulty: 7,
  commandPenaltyScore: 0,
  participantCount: 2,
  leaderActorId: "leader",
  leaderName: "Leader",
  primaryActorId: "worker",
  primaryName: "Worker",
};
const gm = { id: "gm", isGM: true, active: true };
const owner = { id: "owner", isGM: false, active: true };
const stranger = { id: "stranger", isGM: false, active: true };
const binding = { rootMessageId: "root", coordinatorId: "gm" };
const subject = { kind: "attribute" as const, attributeId: "perception" };
let flags: Map<string, unknown>;
let message: FoundryChatMessageDocument & {
  rolls: FoundryRoll[];
  whisper: string[];
  blind: boolean;
};
let actor: FoundryActorDocument;
let request: D6RollRequestV1;
let result: D6RollResultV1;
let artifacts: FoundryRoll[];
let socket: (value: unknown, senderId?: string) => void;
let emit: ReturnType<typeof vi.fn>;
let failPresentation: boolean;
let writes: Record<string, unknown>[];
function artifact(formula: string, faces: number[]): FoundryRoll {
  const data = {
    formula,
    total: faces.reduce((a, b) => a + b, 0),
    dice: [{ results: faces.map((result) => ({ result })) }],
  };
  return { ...data, toJSON: () => data };
}
function options() {
  return {
    requestedRoll: request.context?.requestedRoll,
    combinedAction: { bonusScore: 0, penaltyScore: 0, context },
  };
}
beforeEach(() => {
  resetCombinedRootForTests();
  f.roll.mockReset();
  f.damage.mockReset();
  writes = [];
  failPresentation = false;
  flags = new Map();
  emit = vi.fn();
  request = {
    contractVersion: 2,
    kind: "attribute",
    label: "Command",
    score: 6,
    resultModifier: 0,
    heroPointUse: "none",
    rollMode: "publicroll",
    difficulty: 7,
    source: {
      actorId: "leader",
      actorName: "Leader",
      attributeId: "perception",
    },
    context: {
      combinedAction: context,
      requestedRoll: {
        requestId: "command",
        requesterUserId: "gm",
        requesterName: "GM",
        recipientUserId: "gm",
        rollMode: "publicroll",
        visibility: "public",
      },
    },
  };
  result = resolveD6Roll({
    request,
    profileId: "second-edition",
    successEvaluator: "second-edition-strict",
    wildPolicy: "second-edition",
    baseFaces: [4],
    wildFaces: [5],
    wildFaceGroups: [[5]],
    characterPointFaceGroups: [],
    wildTriumph: {
      automaticSuccess: false,
      enabled: false,
      characterPointAward: 0,
      metaCurrencyAward: 0,
      threshold: 3,
    },
  });
  artifacts = [artifact("1d6", [4]), artifact("1dw", [5])];
  const root = createCombinedActionRootState({
    ...binding,
    groupId: "group",
    createdAt: 1,
    label: "Team task",
    application: "single",
    participantIds: ["leader", "worker"],
    participantNames: "Leader, Worker",
    primarySubject: subject,
    steps: [
      {
        id: "command",
        actorId: "leader",
        label: "Command",
        subject,
        options: { bonusScore: 0, penaltyScore: 0, context },
        status: "requested",
        controllerId: "gm",
      },
    ],
  });
  flags.set("combinedActionRoot", root);
  message = {
    id: "root",
    rolls: [],
    whisper: [],
    blind: false,
    getFlag: (_scope: string, key: string) => flags.get(key),
    update: vi.fn((changes: Record<string, unknown>) => {
      if (failPresentation && changes.rolls)
        return Promise.reject(new Error("presentation unavailable"));
      writes.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        if (path.startsWith("flags.d6-system-2e."))
          flags.set(
            path.slice("flags.d6-system-2e.".length),
            structuredClone(value),
          );
      }
      if (changes.rolls) message.rolls = changes.rolls as FoundryRoll[];
      if (changes.whisper) message.whisper = changes.whisper as string[];
      if (typeof changes.blind === "boolean") message.blind = changes.blind;
      return Promise.resolve();
    }),
  } as unknown as typeof message;
  actor = {
    id: "leader",
    items: { get: () => undefined },
    testUserPermission: (user: { id: string }) => user.id === "owner",
  } as unknown as FoundryActorDocument;
  const users = [gm, owner, stranger];
  vi.stubGlobal("game", {
    user: gm,
    users: {
      get: (id: string) => users.find((u) => u.id === id),
      contents: users,
    },
    actors: { get: (id: string) => (id === "leader" ? actor : undefined) },
    messages: { get: (id: string) => (id === "root" ? message : undefined) },
    socket: {
      on: (_channel: string, fn: typeof socket) => {
        socket = fn;
      },
      emit,
    },
  });
  vi.stubGlobal("Roll", {
    fromJSON: (json: string) => {
      const data = JSON.parse(json) as FoundryRoll;
      return { ...data, toJSON: () => data };
    },
  });
  setCombinedRootRenderer(() => Promise.resolve("root content"));
  f.roll.mockImplementation(async (...args: unknown[]) => {
    const opts = args.at(-1) as {
      beforeDice(request: D6RollRequestV1): Promise<void>;
      captureRollExecution(
        result: D6RollResultV1,
        artifacts: FoundryRoll[],
      ): Promise<void>;
      suppressChatMessage: boolean;
    };
    expect(opts.suppressChatMessage).toBe(true);
    await opts.beforeDice(request);
    expect(combinedRoot(message)?.steps[0]?.status).toBe("rolling");
    await opts.captureRollExecution(result, artifacts);
    return result;
  });
});
afterEach(() => {
  resetCombinedRootForTests();
  vi.unstubAllGlobals();
});
describe("Combined root durable Foundry adapter", () => {
  it("records an ordinary attack with its locked Damage allocation and full flags on the same root", async () => {
    const combat = combatFixture();
    const attackStep = { ...combat.step, controllerId: "gm" };
    const root = {
      ...combat.root,
      steps: [combat.root.steps[0], attackStep, combat.root.steps[2]],
    };
    flags.set("combinedActionRoot", root);
    const requested = combat.attack.context?.requestedRoll;
    if (!requested) throw new Error("Missing attack request");
    request = {
      ...combat.attack,
      context: {
        ...combat.attack.context,
        requestedRoll: { ...requested, recipientUserId: "gm" },
      },
    };
    Object.assign(actor, {
      id: "worker",
      isOwner: true,
      items: {
        get: () => ({
          id: "weapon",
          type: "weapon",
          system: { weaponKind: "standard" },
        }),
      },
    });
    Object.assign(game, {
      actors: { get: (id: string) => (id === "worker" ? actor : undefined) },
    });
    result = resolveD6Roll({
      request,
      profileId: "second-edition",
      successEvaluator: "second-edition-strict",
      wildPolicy: "second-edition",
      baseFaces: [3, 3, 3, 3],
      wildFaces: [3],
      wildFaceGroups: [[3]],
      characterPointFaceGroups: [],
      wildTriumph: {
        automaticSuccess: false,
        enabled: false,
        characterPointAward: 0,
        metaCurrencyAward: 0,
        threshold: 3,
      },
    });
    artifacts = [artifact("5d6", [3, 3, 3, 3, 3])];
    f.roll.mockImplementation(async (...args: unknown[]) => {
      const opts = args.at(-1) as {
        suppressChatMessage: boolean;
        beforeDice(request: D6RollRequestV1): Promise<void>;
        captureRollExecution(
          result: D6RollResultV1,
          artifacts: FoundryRoll[],
        ): Promise<void>;
      };
      expect(args[2]).toMatchObject({
        weaponId: "weapon",
        targetActorId: "target",
        targetTokenId: "target-token",
      });
      expect(opts.suppressChatMessage).toBe(true);
      await opts.beforeDice(request);
      expect(combinedRoot(message)?.combatDamage?.options.bonusScore).toBe(3);
      expect(combinedRoot(message)?.steps[1]?.status).toBe("rolling");
      await opts.captureRollExecution(result, artifacts);
      return result;
    });
    const invoke = () =>
      executeCombinedRootRoll(
        actor,
        combat.step.subject,
        {
          requestedRoll: { ...requested, recipientUserId: "gm" },
          combinedAction: attackStep.options,
        },
        binding,
      );
    await invoke();
    await invoke();
    expect(f.roll).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(1);
    expect(combinedRoot(message)?.results.entries).toHaveLength(2);
    expect(flags.get("roll")).toEqual(result);
    expect(flags.get("targetActorId")).toBe("target");
    expect(flags.get("weaponId")).toBe("weapon");
    expect(flags.get("defense")).toBe(10);
    expect(combinedRoot(message)?.combatDamage?.plan).toEqual(combat.plan);
  });
  function prepareDamage() {
    const state = compositionFixture();
    flags.set("combinedActionRoot", state.attackRoot);
    flags.set("roll", state.attackRoot.steps[1]?.result);
    Object.assign(actor, { id: "worker", isOwner: true });
    Object.assign(game, {
      actors: { get: (id: string) => (id === "worker" ? actor : undefined) },
    });
    const dice = [artifact("5d6", [3, 3, 3, 3, 3])];
    f.damage.mockImplementation(
      async (
        _actor: object,
        attack: D6RollResultV1,
        plan: D6WeaponDamageContinuationRollContext,
        opts: CaptureOptions,
      ) => {
        expect(attack).toEqual(state.attackRoot.steps[1]?.result);
        expect(plan).toEqual(state.attackRoot.combatDamage?.plan);
        expect(opts.combinedAction.bonusScore).toBe(3);
        expect(opts.suppressChatMessage).toBe(true);
        await opts.beforeDice(state.damageResult.request);
        expect(combinedRoot(message)?.steps[2]?.status).toBe("rolling");
        await opts.captureRollExecution(state.damageResult, dice);
        return state.damageResult;
      },
    );
    return state;
  }
  it("runs the existing locked Damage builder through one parent claim and receipt", async () => {
    const state = prepareDamage();
    expect(await executeCombinedRootDamage(message, actor)).toEqual(
      state.damageResult,
    );
    resetCombinedRootForTests(); // Reload drops all process-local receipt caches.
    expect(await executeCombinedRootDamage(message, actor)).toEqual(
      state.damageResult,
    );
    expect(f.damage).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(1);
    expect(
      combinedRoot(message)?.results.entries.map((entry) => entry.appendId),
    ).toEqual(["command", "attack", "ordinary:root:damage"]);
    expect(flags.get("roll")).toEqual(state.attackRoot.steps[1]?.result);
  });
  it("repairs saved Damage presentation after reload without evaluating another roll", async () => {
    const state = prepareDamage();
    failPresentation = true;
    await expect(executeCombinedRootDamage(message, actor)).rejects.toThrow();
    expect(combinedRoot(message)?.steps[2]?.status).toBe("recorded");
    expect(message.rolls).toHaveLength(0);
    resetCombinedRootForTests();
    failPresentation = false;
    expect(await executeCombinedRootDamage(message, actor)).toEqual(
      state.damageResult,
    );
    // Prior fixture Command/Attack artifacts are intentionally opaque; repair the
    // saved Damage via the ordinary consumer's real append seam.
    const root = required(combinedRoot(message));
    const step = required(root.steps[2]);
    const { appendD6InitiatingActionPresentation, hydrateD6FoundryRolls } =
      await import("./initiating-action-message");
    await appendD6InitiatingActionPresentation({
      message,
      ledger: root.results,
      entry: required(root.results.entries[2]),
      artifacts: await hydrateD6FoundryRolls(required(step.artifacts)),
    });
    expect(message.rolls).toHaveLength(1);
    expect(f.damage).toHaveBeenCalledTimes(1);
  });
  it("retains an uncertain Damage claim after reload and cancellation", async () => {
    const state = prepareDamage();
    flags.set("combinedActionRoot", {
      ...state.claimedDamage,
      cancelled: true,
    });
    resetCombinedRootForTests();
    await expect(executeCombinedRootDamage(message, actor)).rejects.toThrow(
      "Uncertain",
    );
    expect(combinedRoot(message)?.steps[2]?.status).toBe("rolling");
    expect(f.damage).not.toHaveBeenCalled();
  });
  it("cancels unclaimed Damage but accepts a receipt already claimed before cancellation", async () => {
    const state = prepareDamage();
    flags.set("combinedActionRoot", { ...state.attackRoot, cancelled: true });
    await expect(executeCombinedRootDamage(message, actor)).rejects.toThrow(
      "Invalid",
    );
    expect(f.damage).not.toHaveBeenCalled();
    flags.set("combinedActionRoot", state.attackRoot);
    f.damage.mockImplementation(
      async (
        _actor: object,
        _attack: D6RollResultV1,
        _plan: D6WeaponDamageContinuationRollContext,
        opts: CaptureOptions,
      ) => {
        await opts.beforeDice(state.damageResult.request);
        flags.set("combinedActionRoot", {
          ...combinedRoot(message),
          cancelled: true,
        });
        await opts.captureRollExecution(state.damageResult, [
          artifact("5d6", [3, 3, 3, 3, 3]),
        ]);
        return state.damageResult;
      },
    );
    expect(await executeCombinedRootDamage(message, actor)).toEqual(
      state.damageResult,
    );
    expect(combinedRoot(message)).toMatchObject({
      cancelled: true,
      steps: [{}, {}, { status: "recorded" }],
    });
    expect(message.rolls).toHaveLength(1);
  });
  it("claims before dice, stores the receipt before presentation, and retries without evaluating or appending again", async () => {
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    expect(combinedRoot(message)?.steps[0]?.status).toBe("recorded");
    expect(writes.findIndex((w) => w.rolls)).toBeGreaterThan(
      writes.findIndex(
        (w) =>
          (
            w["flags.d6-system-2e.combinedActionRoot"] as
              | {
                  steps?: { status: string }[];
                }
              | undefined
          )?.steps?.[0]?.status === "recorded",
      ),
    );
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    expect(f.roll).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(2);
    expect(writes.filter((w) => w.rolls)).toHaveLength(1);
  });
  it("repairs a saved receipt after a presentation failure and reload without repeating dice", async () => {
    failPresentation = true;
    await expect(
      executeCombinedRootRoll(actor, subject, options() as never, binding),
    ).rejects.toThrow("presentation unavailable");
    const saved = combinedRoot(message);
    if (!saved) throw new Error("Missing saved root");
    expect(saved.steps[0]?.status).toBe("recorded");
    expect(hasUnpresentedInitiatingActionResults(message, saved.results)).toBe(
      true,
    );
    resetCombinedRootForTests();
    failPresentation = false;
    await repairCombinedRootPresentation(message);
    await repairCombinedRootPresentation(message);
    expect(f.roll).toHaveBeenCalledTimes(1);
    expect(message.rolls).toHaveLength(2);
    expect(hasUnpresentedInitiatingActionResults(message, saved.results)).toBe(
      false,
    );
  });
  it("rejects a second client claim after a lost reply instead of rerolling", async () => {
    f.roll.mockImplementationOnce(
      async (
        _actor: unknown,
        _id: unknown,
        opts: { beforeDice(request: D6RollRequestV1): Promise<void> },
      ) => {
        await opts.beforeDice(request);
        throw new Error("lost reply");
      },
    );
    await expect(
      executeCombinedRootRoll(actor, subject, options() as never, binding),
    ).rejects.toThrow("lost reply");
    resetCombinedRootForTests();
    await expect(
      executeCombinedRootRoll(actor, subject, options() as never, binding),
    ).rejects.toThrow("Invalid");
    expect(message.rolls).toHaveLength(0);
    expect(combinedRoot(message)?.steps[0]?.status).toBe("rolling");
  });
  it("narrows the initiating card atomically before saving private roll input", async () => {
    request = { ...request, rollMode: "blindroll" };
    result = { ...result, request };
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    expect(writes[0]).toMatchObject({
      blind: true,
      whisper: ["gm"],
      "flags.d6-system-2e.combinedActionRoot": {
        steps: [{ request: { rollMode: "blindroll" } }],
      },
    });
    expect(message.blind).toBe(true);
  });
  it("accepts targeted owner evidence only from the authenticated controller and rejects numeric forgery", async () => {
    const root = combinedRoot(message);
    if (!root) throw new Error("Missing root");
    flags.set("combinedActionRoot", {
      ...root,
      steps: [{ ...root.steps[0], controllerId: "owner" }],
    });
    request = {
      ...request,
      context: {
        ...request.context,
        requestedRoll: {
          ...requestedContext(request),
          recipientUserId: "owner",
        },
      },
    };
    result = { ...result, request };
    registerCombinedRootSocket();
    const packet = {
      type: "combined-root-operation",
      packetId: "packet",
      binding,
      id: "command",
      operation: "claim",
      payload: request,
    };
    socket(packet, "stranger");
    await vi.waitFor(() => expect(emit).toHaveBeenCalled());
    expect(combinedRoot(message)?.steps[0]?.status).toBe("requested");
    emit.mockClear();
    socket(packet, "owner");
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "system.d6-system-2e",
        { type: "combined-root-reply", packetId: "packet" },
        { recipients: ["owner"] },
      ),
    );
    const serialized = await serializeD6FoundryRolls(artifacts);
    emit.mockClear();
    socket(
      {
        ...packet,
        operation: "record",
        payload: { result: { ...result, total: 999 }, artifacts: serialized },
      },
      "owner",
    );
    await vi.waitFor(() => expect(emit).toHaveBeenCalled());
    expect(combinedRoot(message)?.steps[0]?.status).toBe("rolling");
    expect(message.rolls).toHaveLength(0);
    emit.mockClear();
    socket(
      {
        ...packet,
        operation: "record",
        payload: { result, artifacts: serialized },
      },
      "owner",
    );
    await vi.waitFor(() =>
      expect(combinedRoot(message)?.steps[0]?.status).toBe("recorded"),
    );
    expect(
      emit.mock.calls.every(
        (call) =>
          JSON.stringify(call[2]) === JSON.stringify({ recipients: ["owner"] }),
      ),
    ).toBe(true);
  });
  it("keeps private modifier identities out of the public root while retaining a once-only Actor audit", async () => {
    const audit: Record<string, unknown> = {};
    const update = vi.fn((changes: Record<string, unknown>) => {
      audit.rollAudit = changes["system.featureEconomy.rollAudit"];
      return Promise.resolve();
    });
    Object.assign(actor, { system: { featureEconomy: audit }, update });
    request = {
      ...request,
      context: {
        ...request.context,
        featureEffects: {
          version: 1,
          privateEffectCount: 0,
          effects: [
            {
              definitionId: "SECRET_ID",
              definitionLabel: "SECRET_NAME",
              effectId: "SECRET_EFFECT",
              private: true,
              providerId: "SECRET_PROVIDER",
              providerLabel: "SECRET_SOURCE",
              score: 0,
            },
          ],
        },
      },
    };
    result = { ...result, request };
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    expect(JSON.stringify(writes)).not.toContain("SECRET");
    expect(JSON.stringify(audit)).toContain("SECRET_NAME");
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("serializes per-result follow-up claims and runs reward repair from stored evidence only", async () => {
    await executeCombinedRootRoll(actor, subject, options() as never, binding);
    registerCombinedRootSocket();
    const packet = {
      type: "combined-root-operation",
      packetId: "follow",
      binding,
      id: "command",
      operation: "follow-up-claim",
      payload: {},
    };
    socket(packet, "owner");
    await vi.waitFor(() =>
      expect(combinedRoot(message)?.followUps[0]?.claimedBy).toBe("owner"),
    );
    emit.mockClear();
    socket(packet, "owner");
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "system.d6-system-2e",
        expect.objectContaining({ error: "D6E2.CombinedActions.Root.Invalid" }),
        { recipients: ["owner"] },
      ),
    );
    socket({ ...packet, operation: "follow-up-release" }, "stranger");
    await vi.waitFor(() => expect(emit.mock.calls).toHaveLength(2));
    expect(combinedRoot(message)?.followUps[0]?.claimedBy).toBe("owner");
    socket({ ...packet, operation: "follow-up-release" }, "owner");
    await vi.waitFor(() =>
      expect(combinedRoot(message)?.followUps[0]?.claimedBy).toBeUndefined(),
    );
    f.reward.mockResolvedValue(result);
    socket(
      {
        ...packet,
        operation: "matching-reward",
        payload: { result: { total: 9999 } },
      },
      "owner",
    );
    await vi.waitFor(() =>
      expect(f.reward).toHaveBeenCalledWith(actor, result),
    );
    expect(message.rolls).toHaveLength(2);
  });
  it("will not recreate a deleted root or roll after cancellation", async () => {
    const root = combinedRoot(message);
    flags.set("combinedActionRoot", { ...root, cancelled: true });
    await expect(
      executeCombinedRootRoll(actor, subject, options() as never, binding),
    ).rejects.toThrow();
    flags.delete("combinedActionRoot");
    await expect(
      executeCombinedRootRoll(actor, subject, options() as never, binding),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}

type CaptureOptions = D6RollInvocationOptionsV1 & {
  suppressChatMessage?: boolean;
  combinedAction: NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;
  requestedRoll: NonNullable<D6RollInvocationOptionsV1["requestedRoll"]>;
  beforeDice(request: D6RollRequestV1): Promise<void>;
  captureRollExecution(
    result: D6RollResultV1,
    artifacts: readonly FoundryRoll[],
  ): Promise<void>;
};
