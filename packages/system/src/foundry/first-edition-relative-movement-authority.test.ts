import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  requireDestinyValue as required,
  resolveD6Roll,
  createCombatantRoundState,
  commitFirstEditionActions,
  recordFirstEditionSegmentMovement,
  type D6CombatantRoundStateV1,
  type D6RollRequestV1,
} from "@d6-system-2e/core";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import {
  parseFirstEditionRelativeMovement,
  type FirstEditionRelativeMovement,
} from "../application/first-edition-relative-movement";
import {
  executePrivateRelativeMovement,
  setRelativeMovementRenderer,
  relativeMovementRollRuntime,
} from "./first-edition-relative-movement-authority";
const f = vi.hoisted(() => ({
  authority: true,
  segmentState: null as D6CombatantRoundStateV1 | null,
  segmentRecord: vi.fn(),
  next: "c",
  ready: true,
  distance: 4,
  revision: 2,
  remaining: 1,
  private: true,
  blocked: false,
  receipts: new Map<string, unknown>(),
  spend: vi.fn(),
  hydrate: vi.fn(),
  append: vi.fn(),
  combat: {},
  movementId: "open-d6.movement.relative",
}));
vi.mock("./combat-round-private", () => ({
  activeGridCombat: () => f.combat,
  PRIVATE_COMBAT_AUTHORITY: Symbol("authority"),
  registerPrivateMovementRootExecutor: vi.fn(),
  confidentialMovementReceipt: (_c: unknown, key: string) =>
    f.receipts.get(key),
  bindConfidentialMovementRoot: (_c: unknown, key: string, value: unknown) => {
    if (f.receipts.has(key)) throw Error("duplicate");
    f.receipts.set(key, structuredClone(value));
  },
}));
vi.mock("./destiny-crypto", () => ({
  destinyClientIsAuthority: () => f.authority,
  destinyNativeAuthor: (m: { author: { id: string } }) => m.author.id,
}));
vi.mock("./combat-service", () => ({
  readCombatantRound: () => ({
    combatantId: "c",
    revision: f.revision,
    firstEditionCommitment: {},
    firstEditionRemainingActionCount: f.remaining,
    ...(f.segmentState
      ? {
          ...f.segmentState,
          firstEditionSegmentReady: f.ready,
          firstEditionNextCombatantId: f.next,
        }
      : {}),
  }),
  spendFirstEditionCombatantAction: f.spend,
  recordFirstEditionCombatantSegmentMovement: f.segmentRecord,
}));
vi.mock("../settings/movement", () => ({
  currentMovementRuntimeStrategy: () => ({
    id: f.movementId,
    segment: f.segmentState ? "round-robin-rate" : "free-or-action",
    reactive: "consume-next-action-no-chain",
  }),
}));
vi.mock("../settings/action-economy", () => ({
  currentActionEconomyRuntimeStrategy: () => ({
    id: "economy",
    declaration: "action-commitment",
    turnScheduling: f.segmentState ? "round-robin-segments" : "free-commitment",
  }),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ id: "first-edition" }),
}));
vi.mock("../settings/roll-outcome", () => ({
  currentSuccessRuntimeStrategy: () => ({ evaluator: "first-edition-meets" }),
  currentWildDieRuntimeStrategy: () => ({ policy: "first-edition" }),
}));
vi.mock("../settings/setting-values", () => ({
  booleanSetting: () => false,
  numberSetting: (_key: string, fallback: number) => fallback,
}));
vi.mock("./token-movement-service", () => ({
  previewActorTokenMovementPath: () => ({
    distance: f.distance,
    blocked: f.blocked,
  }),
  previewActorTokenMovement: (
    _a: unknown,
    request: { destination: unknown },
  ) => ({
    blocked: f.blocked,
    canMove: true,
    distance: f.distance,
    destination: request.destination,
  }),
}));
vi.mock("./rolls/roll-service", () => ({
  firstEditionMovementCheckSource: () => ({
    attributeId: "agility",
    itemId: "running",
  }),
  retryD6MatchingResultReward: vi.fn(),
}));
vi.mock("./initiating-action-message", () => ({
  hydrateD6FoundryRolls: f.hydrate,
  appendD6InitiatingActionPresentation: f.append,
  initiatingActionVisibilityIntersection: () => ({}),
}));
const gm = { id: "gm", active: true, isGM: true } as FoundryUser;
const owner = { id: "owner", active: true, isGM: false } as FoundryUser;
let token: {
  id: string;
  uuid: string;
  x: number;
  y: number;
  actor: FoundryActorDocument;
  parent: {
    id: string;
    uuid: string;
    grid: { size: number; distance: number; units: string };
  };
  getCenterPoint: () => { x: number; y: number };
  getFlag: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
let c: Record<string, unknown>;
let messages: Map<string, FoundryChatMessageDocument>;
let create: ReturnType<typeof vi.fn>;
let tokenReceipts: Record<string, unknown>;
let failRootRecord: boolean;
const ROOT = "ABCDEFGHIJKLMNOP";
const FLAG = "firstEditionRelativeMovement";
function root(): FirstEditionRelativeMovement {
  return required(
    parseFirstEditionRelativeMovement(
      messages.get(ROOT)?.getFlag("d6-system-2e", FLAG),
    ),
  );
}
function call(
  method: string,
  data: Record<string, unknown> = {},
  user = owner,
): Promise<unknown> {
  return executePrivateRelativeMovement(
    {
      kind: "relative-movement-root",
      actorId: "actor",
      combatantId: "c",
      revision: 2,
      data: { method, rootMessageId: ROOT, ...data },
    },
    user,
  );
}
async function start(): Promise<FirstEditionRelativeMovement> {
  return (await call("create", {
    tokenUuid: token.uuid,
    origin: { x: 0, y: 0 },
    destination: { x: 54, y: 50 },
    type: "land",
  })) as FirstEditionRelativeMovement;
}
async function check(success: boolean, complication = false) {
  const value = root(),
    stage = required(value.action.stages[0]);
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: "skill",
    label: "Movement",
    score: f.segmentState ? 9 : 6,
    resultModifier: 0,
    difficulty: value.plan.difficulty,
    heroPointUse: "none",
    rollMode: "gmroll",
    source: {
      actorId: "actor",
      actorName: "Mover",
      attributeId: "agility",
      itemId: "running",
    },
  };
  const runtime = relativeMovementRollRuntime();
  const claimed = claimFirstEditionActionStage(
    value.action,
    stage.id,
    owner.id,
    { kind: "d6-roll", request, runtime },
  );
  await call("cas", {
    revision: value.action.revision,
    next: claimed,
    scope: "gmroll",
  });
  const faces = f.segmentState
    ? complication
      ? [4, 4, 1]
      : success
        ? [6, 6, 4]
        : [2, 2, 2]
    : success
      ? [4, 4]
      : [2, 2];
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: faces.slice(0, -1),
    wildFaces: [required(faces.at(-1))],
    ...(complication
      ? { choice: "first-edition-remove-highest" as const }
      : {}),
  });
  const receipt = {
    kind: "d6-roll" as const,
    result,
    artifacts: [
      {
        version: 1 as const,
        serialized: "saved",
        evidence: {
          faces,
          formula: f.segmentState ? "3d6" : "2d6",
          total: faces.reduce((a, b) => a + b, 0),
          fingerprint: "a".repeat(64),
        },
      },
    ],
  };
  const next = recordFirstEditionActionStage(claimed, stage.id, receipt);
  await call("cas", { revision: claimed.revision, next, scope: "gmroll" });
}
beforeEach(() => {
  vi.clearAllMocks();
  f.authority = true;
  f.segmentState = null;
  f.next = "c";
  f.ready = true;
  f.distance = 4;
  f.revision = 2;
  f.remaining = 1;
  f.blocked = false;
  f.movementId = "open-d6.movement.relative";
  f.receipts.clear();
  messages = new Map();
  tokenReceipts = {};
  failRootRecord = false;
  const actor = {
    id: "actor",
    uuid: "Actor.actor",
    isOwner: true,
    name: "Mover",
    system: { movement: { base: 10 } },
    testUserPermission: (u: FoundryUser) => u.id === owner.id,
  } as unknown as FoundryActorDocument;
  token = {
    id: "token",
    uuid: "Scene.scene.Token.token",
    x: 0,
    y: 0,
    actor,
    parent: {
      id: "scene",
      uuid: "Scene.scene",
      grid: { size: 100, distance: 1, units: "m" },
    },
    getCenterPoint: () => ({ x: token.x + 50, y: token.y + 50 }),
    getFlag: vi.fn(() => tokenReceipts),
    update: vi.fn(async (changes: Record<string, unknown>) => {
      await Promise.resolve();
      token.x = changes.x as number;
      token.y = changes.y as number;
      for (const [key, value] of Object.entries(changes))
        if (key.startsWith("flags."))
          tokenReceipts[required(key.split(".").at(-1))] = value;
    }),
  };
  c = {
    id: "c",
    actor,
    token,
    tokenId: "token",
    hidden: true,
    getFlag: () => ({ privateRound: 1 }),
  };
  f.combat = { id: "combat", combatants: { contents: [c] } };
  create = vi.fn(
    async (data: {
      _id: string;
      flags: Record<string, Record<string, unknown>>;
      content: string;
    }) => {
      await Promise.resolve();
      let value = structuredClone(required(data.flags["d6-system-2e"])[FLAG]);
      const message = {
        id: data._id,
        author: gm,
        content: data.content,
        getFlag: () => value,
        update: vi.fn(async (changes: Record<string, unknown>) => {
          await Promise.resolve();
          const next = changes[`flags.d6-system-2e.${FLAG}`] as
            FirstEditionRelativeMovement | undefined;
          if (next) {
            if (
              failRootRecord &&
              next.action.stages.some((s) => s.receipt?.kind === "effect")
            ) {
              failRootRecord = false;
              throw Error("root save failed");
            }
            value = structuredClone(next);
          }
        }),
      } as unknown as FoundryChatMessageDocument;
      messages.set(data._id, message);
      return message;
    },
  );
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, owner],
      get: (id: string) => [gm, owner].find((u) => u.id === id),
    },
    messages,
  });
  vi.stubGlobal("canvas", { scene: { id: "scene" } });
  vi.stubGlobal("fromUuid", (uuid: string) =>
    Promise.resolve(
      uuid === token.uuid ? token : uuid === actor.uuid ? actor : null,
    ),
  );
  vi.stubGlobal("ChatMessage", { create, getSpeaker: () => ({}) });
  setRelativeMovementRenderer(() => Promise.resolve("saved content"));
  f.spend.mockImplementation(
    async (
      _a: unknown,
      revision: number,
      _symbol: unknown,
      _id: unknown,
      receipt: { key: string; value: unknown },
    ) => {
      await Promise.resolve();
      if (revision !== f.revision) throw Error("stale");
      f.revision++;
      f.receipts.set(receipt.key, structuredClone(receipt.value));
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("relative Movement private authority", () => {
  it("creates a trusted root before a free no-roll translation and completes without a dice append", async () => {
    await start();
    expect(token.update).not.toHaveBeenCalled();
    await call("effect");
    await call("advance");
    await call("present");
    expect(root().action.status).toBe("complete");
    expect(token.update).toHaveBeenCalledTimes(1);
    expect(f.spend).not.toHaveBeenCalled();
    expect(f.append).not.toHaveBeenCalled();
  });
  it("rejects player-authored copied roots even when their saved coordinator names the GM", async () => {
    await start();
    Object.assign(required(messages.get(ROOT)), { author: owner });
    await expect(call("effect")).rejects.toThrow();
    expect(token.update).not.toHaveBeenCalled();
  });
  it("rejects a GM-authored lookalike without its encrypted authority binding", async () => {
    await start();
    f.receipts.delete(`root:${ROOT}`);
    await expect(call("effect")).rejects.toThrow();
    expect(token.update).not.toHaveBeenCalled();
  });
  it("rejects same embedded Token ID and linked Actor in a different Scene", async () => {
    c.token = {
      ...token,
      uuid: "Scene.other.Token.token",
      parent: { id: "other", uuid: "Scene.other" },
    };
    await expect(start()).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it.each(["off-scene", "units"])(
    "returns unsupported before root/effects for %s",
    async (kind) => {
      if (kind === "off-scene")
        vi.stubGlobal("canvas", { scene: { id: "other" } });
      else token.parent.grid.units = "ft";
      expect(await start()).toBeNull();
      expect(create).not.toHaveBeenCalled();
      expect(f.receipts.size).toBe(0);
    },
  );
  it("reconciles an acknowledged translation after the root save fails, preserving newer native motion", async () => {
    await start();
    failRootRecord = true;
    await expect(call("effect")).rejects.toThrow("root save failed");
    expect(root().action.stages[0]?.state).toBe("claimed");
    token.x = 900;
    await call("effect");
    await call("advance");
    await call("present");
    expect(token.x).toBe(900);
    expect(token.update).toHaveBeenCalledTimes(1);
    expect(root().action.status).toBe("complete");
  });
  it("does not retry a claimed translation when its durable receipt is missing", async () => {
    await start();
    token.update.mockRejectedValueOnce(Error("unknown update"));
    await expect(call("effect")).rejects.toThrow("unknown update");
    await expect(call("effect")).rejects.toThrow();
    expect(token.update).toHaveBeenCalledTimes(1);
  });
  it("rejects a client CAS carrying a fabricated effect receipt and a forged owner-writable Token receipt", async () => {
    const value = await start(),
      stage = required(value.action.stages[0]);
    const claimed = claimFirstEditionActionStage(
      value.action,
      stage.id,
      owner.id,
      { kind: "effect" },
    );
    await call("cas", { revision: 0, next: claimed, scope: "preserve" });
    const receipt = {
      kind: "effect" as const,
      receiptKey: `${stage.id}:effect`,
      plan: value.translation,
      authorityReceiptId: "forged",
      outcome: "applied" as const,
    };
    const next = recordFirstEditionActionStage(claimed, stage.id, receipt);
    await expect(
      call("cas", { revision: 1, next, scope: "preserve" }),
    ).rejects.toThrow();
    tokenReceipts[receipt.receiptKey] = receipt;
    await expect(call("effect")).rejects.toThrow();
    expect(root().action.stages[0]?.state).toBe("claimed");
    expect(token.update).not.toHaveBeenCalled();
  });
  it.each(["origin", "scene", "grid", "revision", "profile", "collision"])(
    "blocks observable %s changes without effects or rollback",
    async (change) => {
      await start();
      if (change === "origin") token.x = 20;
      if (change === "scene")
        vi.stubGlobal("canvas", { scene: { id: "other" } });
      if (change === "grid") token.parent.grid.size = 200;
      if (change === "revision") f.revision++;
      if (change === "profile") f.movementId = "other";
      if (change === "collision") f.blocked = true;
      await expect(call("effect")).rejects.toThrow();
      expect(token.update).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])(
    "spends exactly one committed action after saved check success=%s",
    async (success) => {
      f.distance = 15;
      await start();
      await check(success);
      await call("advance");
      await call("effect");
      await call("advance");
      if (success) {
        await call("effect");
        await call("advance");
      }
      expect(root().action.status).toBe("complete");
      expect(f.spend).toHaveBeenCalledTimes(1);
      expect(token.update).toHaveBeenCalledTimes(success ? 1 : 0);
      await call("present");
      await call("present");
      expect(f.spend).toHaveBeenCalledTimes(1);
      expect(token.update).toHaveBeenCalledTimes(success ? 1 : 0);
    },
  );
  it("repairs a saved action-spend receipt after root-save failure without spending twice", async () => {
    f.distance = 8;
    await start();
    failRootRecord = true;
    await expect(call("effect")).rejects.toThrow("root save failed");
    await call("effect", {}, gm);
    expect(f.spend).toHaveBeenCalledTimes(1);
    await call("advance");
    await call("effect");
    await call("advance");
    expect(token.update).toHaveBeenCalledTimes(1);
  });
  it("cancels before any claim and refuses cancellation after a claimed effect", async () => {
    await start();
    await call("cancel");
    expect(root().action.status).toBe("cancelled");
    await expect(call("effect")).rejects.toThrow();
    expect(token.update).not.toHaveBeenCalled();
  });
  it("rejects a second controller and lost authority", async () => {
    await start();
    await expect(
      call("load", {}, { ...owner, id: "stranger" }),
    ).rejects.toThrow();
    f.authority = false;
    await expect(call("effect")).rejects.toThrow();
  });
});

function segmented(distance = 6) {
  f.distance = distance;
  f.movementId = "open-d6.movement.segmented";
  f.segmentState = {
    ...commitFirstEditionActions(
      createCombatantRoundState(1),
      3,
      1,
      "none",
      0,
      [
        { id: "run", kind: "move", label: "Run", effectiveScore: 9 },
        { id: "later-a", kind: "skill", label: "Later", effectiveScore: 12 },
        { id: "later-b", kind: "skill", label: "Later", effectiveScore: 12 },
      ],
    ),
    revision: 2,
  };
  f.segmentRecord.mockImplementation(
    async (
      _a: unknown,
      revision: number,
      input: Parameters<typeof recordFirstEditionSegmentMovement>[1],
      _authority: unknown,
      combatantId: string,
      receipt: { key: string; value: unknown },
    ) => {
      await Promise.resolve();
      expect(combatantId).toBe("c");
      if (revision !== f.segmentState?.revision) throw Error("stale");
      f.segmentState = recordFirstEditionSegmentMovement(f.segmentState, input);
      f.receipts.set(receipt.key, structuredClone(receipt.value));
    },
  );
}
async function finish() {
  for (let n = 0; n < 5 && root().action.status === "open"; n++) {
    const current = root().action.stages.find((s) => s.state !== "recorded");
    await call(current ? "effect" : "advance");
  }
}
describe("segmented Running through the existing private Movement authority", () => {
  it.each([
    [true, false, 3],
    [true, false, 6],
    [false, false, 3],
    [false, false, 6],
    [false, true, 3],
    [false, true, 6],
  ] as const)(
    "preserves success %s / first-face-one %s at %s meters",
    async (success, complication, distance) => {
      segmented(distance);
      await start();
      expect(root()).toMatchObject({
        version: 2,
        segment: {
          actionId: "run",
          round: 1,
          plan: {
            normalDistance: 3,
            maximumDistance: 6,
            runningDifficulty: 15,
          },
        },
        plan: { rollRequired: true, difficulty: 15 },
      });
      await check(success, complication);
      await finish();
      expect(root().action.status).toBe("complete");
      expect(f.segmentRecord).toHaveBeenCalledTimes(1);
      expect(f.spend).not.toHaveBeenCalled();
      const translated = (!complication && success) || distance <= 3;
      expect(token.update).toHaveBeenCalledTimes(translated ? 1 : 0);
      expect(f.segmentState?.firstEditionCommitment?.spentActionCount).toBe(
        complication ? 3 : 1,
      );
      expect(
        f.segmentState?.firstEditionSegmentMovement?.remainingMovementDistance,
      ).toBe(translated ? 0 : 3);
      expect(
        f.segmentState?.actionAnnotations?.outcomes["later-a"]?.reason,
      ).toBe(complication ? "running-complication" : undefined);
      // Reconnecting and duplicate create delivery recover the same root even
      // after its queue slot has advanced; no fallback to the legacy resolver.
      expect((await start()).action.rootMessageId).toBe(ROOT);
      await call("present");
      await call("advance");
      expect(f.segmentRecord).toHaveBeenCalledTimes(1);
      if (!translated) {
        const follow = recordFirstEditionSegmentMovement(
          required(f.segmentState),
          { distance: 2, normalDistance: 3 },
        );
        expect(
          follow.firstEditionSegmentMovement?.remainingMovementDistance,
        ).toBe(0);
        expect(follow.firstEditionCommitment).toEqual(
          f.segmentState?.firstEditionCommitment,
        );
      }
    },
  );
  it("reconciles a co-written segment receipt after the root save fails, without charging again", async () => {
    segmented();
    await start();
    await check(true);
    await call("advance");
    failRootRecord = true;
    await expect(call("effect")).rejects.toThrow("root save failed");
    expect(root().action.stages[1]?.state).toBe("claimed");
    expect(f.segmentRecord).toHaveBeenCalledTimes(1);
    await call("effect", {}, gm);
    await finish();
    expect(f.segmentRecord).toHaveBeenCalledTimes(1);
    expect(token.update).toHaveBeenCalledTimes(1);
  });
  it("does not reapply an unknown claimed segment effect", async () => {
    segmented();
    await start();
    await check(true);
    await call("advance");
    f.segmentRecord.mockRejectedValueOnce(Error("uncertain write"));
    await expect(call("effect")).rejects.toThrow();
    await expect(call("effect")).rejects.toThrow();
    expect(f.segmentRecord).toHaveBeenCalledTimes(1);
  });
  it.each([
    "revision",
    "round",
    "action",
    "pool",
    "origin",
    "blocked",
    "runtime",
  ])("rejects changed %s before a segment effect", async (change) => {
    segmented();
    await start();
    await check(true);
    await call("advance");
    const state = required(f.segmentState);
    if (change === "revision") f.segmentState = { ...state, revision: 3 };
    if (change === "round") f.segmentState = { ...state, round: 2 };
    if (change === "action")
      f.segmentState = {
        ...state,
        actions: state.actions.map((a, i) =>
          i === 0 ? { ...a, id: "replacement" } : a,
        ),
      };
    if (change === "pool")
      f.segmentState = {
        ...state,
        actions: state.actions.map((a, i) =>
          i === 0 ? { ...a, effectiveScore: 6 } : a,
        ),
      };
    if (change === "origin") token.x = 1;
    if (change === "blocked") f.blocked = true;
    if (change === "runtime") f.movementId = "open-d6.movement.relative";
    await expect(call("effect")).rejects.toThrow();
    expect(f.segmentRecord).not.toHaveBeenCalled();
    expect(token.update).not.toHaveBeenCalled();
  });
  it("cancels pending Running without dice or effects and rejects wrong-turn/non-land admission", async () => {
    segmented();
    f.next = "other";
    await expect(start()).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    f.next = "c";
    await expect(
      call("create", {
        tokenUuid: token.uuid,
        origin: { x: 0, y: 0 },
        destination: { x: 56, y: 50 },
        type: "swim",
      }),
    ).rejects.toThrow();
    await start();
    await call("cancel");
    expect(root().action.status).toBe("cancelled");
    expect(f.segmentRecord).not.toHaveBeenCalled();
    expect(token.update).not.toHaveBeenCalled();
  });
  it("binds reactive Running to the reactor's own next action and preserves no-chain annotation", async () => {
    segmented();
    f.next = "other";
    await call("create", {
      tokenUuid: token.uuid,
      origin: { x: 0, y: 0 },
      destination: { x: 56, y: 50 },
      type: "land",
      reactive: true,
    });
    expect(root().segment?.reactive).toBe(true);
    await check(true);
    await finish();
    expect(f.segmentState?.actionAnnotations?.outcomes.run?.reason).toBe(
      "reactive-movement",
    );
  });
  it("leaves ordinary segmented movement and pending remainder outside root admission", async () => {
    segmented();
    const state = required(f.segmentState);
    f.segmentState = {
      ...state,
      actions: state.actions.map((a, i) =>
        i === 0 ? { ...a, kind: "skill" } : a,
      ),
    };
    expect(await start()).toBeNull();
    expect(create).not.toHaveBeenCalled();
    f.segmentState = {
      ...state,
      firstEditionSegmentMovement: {
        complication: false,
        movementUsedAtSpentActionCount: 0,
        remainingMovementDistance: 3,
      },
    };
    expect(await start()).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
