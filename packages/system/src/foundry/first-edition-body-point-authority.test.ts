import { woundRootRollRuntime } from "./first-edition-wound-authority";
import { firstEditionBodyPointWound } from "@d6-system-2e/core";
import type { D6RollMode } from "@d6-system-2e/core";
import type * as InitiatingMessage from "./initiating-action-message";
import { requireDestinyValue as required } from "@d6-system-2e/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type { FirstEditionBodyPointRoot } from "../application/first-edition-body-point-root";
import {
  migrateBodyPointAuthorityData,
  canOfferBodyPointNaturalHealing,
  processBodyPointRootOperation,
  setBodyPointRootRenderer,
} from "./first-edition-body-point-authority";
const f = vi.hoisted(() => ({
  authority: true,
  messageHistory: [] as Record<string, unknown>[],
  create: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
  count: 0,
  hydrate: vi.fn(),
  append: vi.fn(),
  reward: vi.fn(),
}));
vi.mock("./destiny-crypto", () => ({
  heartbeatDestinyCrypto: () => Promise.resolve(),
  destinyClientIsAuthority: () => f.authority,
  destinyActiveAuthority: () => ({ userId: "gm" }),
  destinyEnrolledGMIds: () => ["gm"],
  destinyNativeAuthor: (m: { author: { id: string } }) => m.author.id,
  sealDestiny: (_topic: string, value: unknown) =>
    Promise.resolve({ ciphertext: JSON.stringify(value) }),
  openDestinyEnvelope: (_topic: string, value: { ciphertext: string }) =>
    Promise.resolve(JSON.parse(value.ciphertext)),
}));
vi.mock("./foundry-random-id", () => ({
  foundryRandomId: () => `opaque-proof-${++f.count}`,
}));
vi.mock("./rolls/roll-service", () => ({
  retryD6MatchingResultReward: f.reward,
}));
vi.mock("./initiating-action-message", async (importOriginal) => ({
  ...(await importOriginal<typeof InitiatingMessage>()),
  hydrateD6FoundryRolls: f.hydrate,
  appendD6InitiatingActionPresentation: f.append,
}));
const gm = { id: "gm", active: true, isGM: true } as FoundryUser,
  owner = { id: "owner", active: true, isGM: false } as FoundryUser;
const stranger = { id: "stranger", active: true, isGM: false } as FoundryUser;
let docs: Map<string, unknown>,
  settings: Map<string, unknown>,
  messages: Map<string, FoundryChatMessageDocument>;
function patch(
  target: Record<string, unknown>,
  changes: Record<string, unknown>,
) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let into = target;
    for (const part of parts.slice(0, -1)) {
      into[part] ??= {};
      into = into[part] as Record<string, unknown>;
    }
    into[required(parts.at(-1))] = structuredClone(value);
  }
}
function patient(wound = "mortally-wounded", uuid = "Actor.patient") {
  const actor = {
    id: "patient",
    uuid,
    name: "Patient",
    type: "character",
    isOwner: true,
    ownershipAllowed: true,
    system: {
      health: {
        firstEditionWound: wound,
        firstEditionBodyPoints: { current: 0, maximum: 20 },
        firstEditionState: {
          mortalityRounds: 60,
          source: "mortally-wounded",
          consciousness: "unconscious",
          mortalityCheckId: "previous",
        },
        tracks: {},
      },
      movement: { posture: "prone" },
      attributes: { brawn: { score: 6 } },
    },
    flags: {} as Record<string, Record<string, unknown>>,
    items: {
      contents: [] as FoundryItemDocument[],
      get: (id: string): FoundryItemDocument | undefined =>
        actor.items.contents.find((i) => i.id === id),
    },
    updateEmbeddedDocuments: vi.fn(
      async (_type: string, changes: Record<string, unknown>[]) => {
        await Promise.resolve();
        for (const change of changes) {
          const item = actor.items.get(String(change._id));
          if (item) patch(item as unknown as Record<string, unknown>, change);
        }
        return actor.items.contents;
      },
    ),
    getFlag: (namespace: string, key: string): unknown =>
      actor.flags[namespace]?.[key],
    testUserPermission: () => actor.ownershipAllowed,
    update: vi.fn((changes: Record<string, unknown>) => {
      patch(actor, changes);
      return Promise.resolve(actor);
    }),
  };
  docs.set(uuid, actor);
  return actor;
}
function invoke(
  method: string,
  rootMessageId = "abcdefghijklmnop",
  data: Record<string, unknown> = {},
  user = owner,
) {
  return processBodyPointRootOperation(
    { method, rootMessageId, ...data },
    user,
  );
}
async function record(
  root: FirstEditionBodyPointRoot,
  total = 6,
  user = owner,
  rollMode: D6RollMode = "selfroll",
) {
  const stage = required(
    root.action.stages.find((s) => s.state !== "recorded"),
  );
  if (stage.spec.kind !== "d6-roll") throw Error("check");
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: stage.spec.source.itemId ? "skill" : "attribute",
    label: "Healing",
    score: 6,
    resultModifier: total - 6,
    heroPointUse: "none",
    rollMode,
    ...(stage.spec.fixedDifficulty === undefined
      ? {}
      : { difficulty: stage.spec.fixedDifficulty }),
    source: {
      ...stage.spec.subject,
      ...stage.spec.source,
      actorName: "Patient",
    },
    ...(root.action.clock
      ? {
          context: {
            firstEditionMortality: {
              checkId: root.action.clock.checkId,
              completedRounds: root.action.clock.completedRounds.value,
              elapsedMinutes: root.action.clock.elapsedMinutes.value,
              sourcePage: 76,
            },
          },
        }
      : {}),
  };
  const runtime = woundRootRollRuntime();
  const claimed = claimFirstEditionActionStage(root.action, stage.id, user.id, {
    kind: "d6-roll",
    request,
    runtime,
  });
  expect(
    await invoke(
      "cas",
      root.action.rootMessageId,
      { revision: root.action.revision, next: claimed },
      user,
    ),
  ).toBe(true);
  const result = resolveD6Roll({
    ...runtime,
    request,
    baseFaces: [4],
    wildFaces: [2],
  });
  const saved = recordFirstEditionActionStage(claimed, stage.id, {
    kind: "d6-roll",
    result,
    artifacts: [
      {
        version: 1,
        serialized: "saved-roll",
        evidence: {
          formula: "2d6",
          faces: [4, 2],
          total: 6,
          fingerprint: "a".repeat(64),
        },
      },
    ],
  });
  expect(
    await invoke(
      "cas",
      root.action.rootMessageId,
      { revision: claimed.revision, next: saved },
      user,
    ),
  ).toBe(true);
  return (await invoke(
    "advance",
    root.action.rootMessageId,
    {},
    user,
  )) as FirstEditionBodyPointRoot;
}
beforeEach(() => {
  f.authority = true;
  f.messageHistory = [];
  f.count = 0;
  f.hydrate.mockReset().mockResolvedValue([]);
  f.append.mockReset().mockResolvedValue("appended");
  docs = new Map();
  settings = new Map<string, unknown>([
    [
      "worldRulesProfiles",
      { version: 1, activeProfileId: "open-d6", profiles: {} },
    ],
    ["gameMode", "open-d6"],
    ["firstEditionBodyPoints", "body-points"],
  ]);
  messages = new Map();
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, owner, stranger],
      get: (id: string) => [gm, owner, stranger].find((u) => u.id === id),
    },
    messages,
    settings: {
      get: (_s: string, k: string) => settings.get(k),
      set: (_s: string, k: string, value: unknown) => {
        settings.set(k, value);
        return Promise.resolve(value);
      },
    },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("fromUuid", (uuid: string) => Promise.resolve(docs.get(uuid)));
  vi.stubGlobal("ChatMessage", {
    getSpeaker: () => ({ actor: "patient" }),
    create: f.create
      .mockReset()
      .mockImplementation((data: Record<string, unknown>) => {
        f.messageHistory.push(structuredClone(data));
        const message = {
          id: String(data._id),
          author: gm,
          ...data,
          content: String(data.content),
          whisper: (data.whisper ?? []) as string[],
          blind: data.blind === true,
          flags: data.flags as Record<string, Record<string, unknown>>,
          getFlag: (namespace: string, key: string): unknown =>
            message.flags[namespace]?.[key],
          update: vi.fn((changes: Record<string, unknown>) => {
            patch(message, changes);
            f.messageHistory.push(
              structuredClone({
                content: message.content,
                whisper: message.whisper,
                blind: message.blind,
                flags: message.flags,
              }),
            );
            return Promise.resolve(message);
          }),
        };
        messages.set(
          message.id,
          message as unknown as FoundryChatMessageDocument,
        );
        return Promise.resolve(message);
      }),
  });
  setBodyPointRootRenderer((value) =>
    Promise.resolve(`status:${value.action.status}`),
  );
});
function item(
  actor: ReturnType<typeof patient>,
  id: string,
  type = "skill",
  score = 9,
  key = id,
) {
  const value = {
    id,
    uuid: `${actor.uuid}.Item.${id}`,
    type,
    name: id,
    system: { score, key, attributeId: "brawn" },
    flags: {} as Record<string, Record<string, unknown>>,
    getFlag: (namespace: string, k: string): unknown =>
      value.flags[namespace]?.[k],
  };
  actor.items.contents.push(value as unknown as FoundryItemDocument);
  return value;
}
async function assisted(minutes = 5, current = 0, maximum = 20) {
  const actor = patient(),
    healer = patient("healthy", "Actor.healer");
  healer.id = "healer";
  actor.system.health.firstEditionBodyPoints = { current, maximum };
  actor.system.health.firstEditionState.mortalityRounds = minutes * 12;
  item(actor, "skill-a");
  item(actor, "special", "specialization", 2);
  item(actor, "attribute", "attribute", 12);
  item(healer, "medicine");
  const root = (await invoke("create", undefined, {
    patientUuid: actor.uuid,
    healerUuid: healer.uuid,
    medicineItemId: "medicine",
    operation: "assisted",
    rollMode: "publicroll",
  })) as FirstEditionBodyPointRoot;
  return { actor, healer, root };
}
const advance = () => invoke("advance") as Promise<FirstEditionBodyPointRoot>;
async function poolPending(minutes = 5) {
  const f = await assisted(minutes);
  await record(f.root, 5);
  let root = await advance();
  if (minutes > 4 && minutes <= 15) {
    expect(root.action.stages.at(-1)?.spec).toMatchObject({
      purpose: "survival",
      subject: { actorUuid: f.actor.uuid },
      fixedDifficulty: minutes,
    });
    await record(root, minutes);
    root = await advance();
  }
  return { ...f, root };
}
describe("Body Point authority and receipts", () => {
  it("initializes v1 without adopting old cards and rejects future/corrupt journals", () => {
    expect(migrateBodyPointAuthorityData(null)).toEqual({
      version: 1,
      roots: {},
    });
    expect(() =>
      migrateBodyPointAuthorityData({ version: 2, roots: {} }),
    ).toThrow();
  });
  it.each(["body-points", "body-points-with-wounds"])(
    "rejects Dead at both admissions under %s before cards or writes",
    async (mode) => {
      settings.set("firstEditionBodyPoints", mode);
      const actor = patient();
      actor.system.health.firstEditionBodyPoints = {
        current: -20,
        maximum: 20,
      };
      for (const operation of ["natural", "assisted"])
        await expect(
          invoke("create", undefined, {
            patientUuid: actor.uuid,
            operation,
            rollMode: "publicroll",
            restModifierScore: 0,
          }),
        ).rejects.toMatchObject({ code: "conflict" });
      expect(f.create).not.toHaveBeenCalled();
      expect(actor.update).not.toHaveBeenCalled();
    },
  );
  it("keeps patient source and synthetic identity without substituting the base actor", async () => {
    const actor = patient(
        "mortally-wounded",
        "Scene.scene.Token.token.Actor.patient",
      ),
      base = patient();
    const root = (await invoke("create", undefined, {
      patientUuid: actor.uuid,
      operation: "natural",
      restModifierScore: 0,
      rollMode: "selfroll",
    })) as FirstEditionBodyPointRoot;
    expect(root.action.subjects[0]?.actor).toMatchObject({
      actorUuid: actor.uuid,
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    });
    await record(root, 5);
    await advance();
    await invoke("effect");
    expect(actor.system.health.firstEditionBodyPoints.current).toBe(2);
    expect(base.update).not.toHaveBeenCalled();
  });
  it("saves fixed amount without another dice stage; applies capped gain once", async () => {
    const { actor, root } = await assisted(0, 19, 20);
    await record(root, 5);
    const next = await advance();
    expect(next.fixedAmount).toMatchObject({ points: 2 });
    expect(next.action.stages.some((s) => s.spec.kind === "plain-d6")).toBe(
      false,
    );
    await invoke("effect");
    const end = await advance();
    expect(end.action.status).toBe("complete");
    expect(actor.system.health.firstEditionBodyPoints.current).toBe(20);
    expect(actor.update).toHaveBeenCalledTimes(1);
    await expect(invoke("effect")).rejects.toThrow();
    expect(actor.update).toHaveBeenCalledTimes(1);
  });
  it("retains unresolved survival and all earlier evidence without death or effects", async () => {
    const { actor, root } = await assisted(5);
    await record(root, 5);
    const next = await advance();
    expect(next.fixedAmount?.points).toBe(2);
    expect(next.action.stages.at(-1)?.state).toBe("pending");
    await invoke("load");
    await invoke("advance");
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.system.health.firstEditionBodyPoints.current).toBe(0);
    expect(
      ((await invoke("load")) as FirstEditionBodyPointRoot).action.status,
    ).toBe("open");
  });
  it("validates post-pool context for Skill loss, then reconciles an interrupted partial batch", async () => {
    const { actor } = await poolPending();
    await invoke("effect");
    expect(actor.system.health.firstEditionBodyPoints.current).toBe(2);
    await advance();
    const original = actor.updateEmbeddedDocuments.getMockImplementation();
    actor.updateEmbeddedDocuments.mockImplementationOnce(
      async (type, updates) => {
        await original?.(type, updates.slice(0, 1));
        throw Error("lost after partial batch");
      },
    );
    await expect(invoke("effect")).rejects.toThrow();
    expect(actor.items.get("skill-a")?.system.score).toBe(6);
    expect(actor.items.get("special")?.system.score).toBe(2);
    await invoke("effect");
    expect(actor.items.get("skill-a")?.system.score).toBe(6);
    expect(actor.items.get("special")?.system.score).toBe(0);
    expect(actor.items.get("attribute")?.system.score).toBe(12);
    expect(actor.updateEmbeddedDocuments.mock.calls.at(-1)?.[1]).toHaveLength(
      1,
    );
    expect((await advance()).action.status).toBe("complete");
    expect(actor.update).toHaveBeenCalledTimes(1);
  });
  it.each(["pool", "clock", "model", "dead"])(
    "rejects delayed %s changes before effect",
    async (change) => {
      const { actor } = await poolPending(0);
      if (change === "pool")
        actor.system.health.firstEditionBodyPoints.current = 1;
      if (change === "clock")
        actor.system.health.firstEditionState.mortalityRounds++;
      if (change === "model")
        settings.set("firstEditionBodyPoints", "body-points-with-wounds");
      if (change === "dead")
        actor.system.health.firstEditionBodyPoints.current = -20;
      await expect(invoke("effect")).rejects.toMatchObject({
        code: "conflict",
      });
      expect(actor.update).not.toHaveBeenCalled();
    },
  );
  it("rejects intervening post-pool changes rather than applying pending Skill loss", async () => {
    const { actor } = await poolPending();
    await invoke("effect");
    await advance();
    actor.system.health.firstEditionState.mortalityRounds++;
    await expect(invoke("effect")).rejects.toMatchObject({ code: "conflict" });
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });
  it("repairs lost pool receipt save without adding recovery again", async () => {
    const { actor } = await poolPending(0);
    const message = required(messages.get("abcdefghijklmnop"));
    const original = message.update.bind(message);
    let dropped = false;
    vi.spyOn(message, "update").mockImplementation(async (changes) => {
      const value = changes["flags.d6-system-2e.firstEditionBodyPointRoot"] as
        FirstEditionBodyPointRoot | undefined;
      if (value?.action.stages.at(-1)?.state === "recorded" && !dropped) {
        dropped = true;
        throw Error("lost receipt");
      }
      return original(changes);
    });
    await expect(invoke("effect")).rejects.toThrow();
    expect(actor.system.health.firstEditionBodyPoints.current).toBe(2);
    await invoke("effect");
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect((await advance()).action.status).toBe("complete");
  });
  it("keeps the exact rescue floor for fractional pools", async () => {
    const { actor, root } = await assisted(5, 0, 21);
    await record(root, 5);
    const next = await advance();
    expect(next.action.stages.at(-1)?.spec.kind).toBe("effect");
    await invoke("effect");
    expect(
      firstEditionBodyPointWound(
        actor.system.health.firstEditionBodyPoints.current,
        21,
      ),
    ).toBe("mortally-wounded");
    expect(actor.system.health.firstEditionState.mortalityRounds).toBe(60);
  });
  it("authenticates role and privacy before publishing receipts", async () => {
    const { root } = await assisted();
    expect(messages.get(root.action.rootMessageId)?.whisper).toEqual(["owner"]);
    await expect(invoke("load", undefined, {}, stranger)).rejects.toMatchObject(
      { code: "authority" },
    );
    await record(root, 5, owner, "blindroll");
    await advance();
    expect(messages.get(root.action.rootMessageId)?.blind).toBe(true);
    const value = (await invoke("load")) as FirstEditionBodyPointRoot;
    await record(value, 5, owner, "publicroll");
    expect(messages.get(root.action.rootMessageId)?.blind).toBe(true);
    expect(messages.get(root.action.rootMessageId)?.whisper).toEqual(["gm"]);
  });
});

it("a new elected GM continues pending Skill loss without rewriting the recorded pool stage", async () => {
  await poolPending();
  await invoke("effect");
  const ready = await advance();
  const prior = structuredClone(
    ready.action.stages.find((s) => s.id.endsWith(":pool")),
  );
  Object.defineProperty(game, "user", {
    value: { id: "new-gm", active: true, isGM: true },
    configurable: true,
  });
  await invoke("effect");
  const complete = await advance();
  expect(complete.action.status).toBe("complete");
  expect(complete.action.stages.find((s) => s.id.endsWith(":pool"))).toEqual(
    prior,
  );
});
it("does not treat a pool witness copied into Item flags as Skill-loss proof", async () => {
  const { actor } = await poolPending();
  await invoke("effect");
  await advance();
  const poolProof = (
    actor.getFlag("d6-system-2e", "bodyPointRootReceipts") as Record<
      string,
      unknown
    >
  ).abcdefghijklmnop;
  for (const i of actor.items.contents)
    if (["skill", "specialization"].includes(i.type))
      patch(i as unknown as Record<string, unknown>, {
        "flags.d6-system-2e.bodyPointRootReceipts.abcdefghijklmnop": poolProof,
      });
  await invoke("effect");
  expect(actor.items.get("skill-a")?.system.score).toBe(6);
  expect(actor.items.get("special")?.system.score).toBe(0);
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
});
it("preserves stage-specific follow-up claims without altering the accepted treatment roll", async () => {
  const { root } = await assisted();
  await record(root, 5);
  const ready = await advance();
  const stage = required(ready.action.stages[0]);
  expect(
    await invoke("follow-up-claim", undefined, { stageId: stage.id }),
  ).toBe(true);
  expect(
    await invoke("follow-up-claim", undefined, { stageId: stage.id }),
  ).toBe(false);
  expect(
    ((await invoke("load")) as FirstEditionBodyPointRoot).action.stages[0],
  ).toEqual(stage);
  expect(
    await invoke("follow-up-release", undefined, { stageId: stage.id }),
  ).toBe(true);
  await expect(
    invoke("follow-up-claim", undefined, { stageId: stage.id }, stranger),
  ).rejects.toMatchObject({ code: "authority" });
});

it.each([
  ["body-points", 2, 21, true],
  ["body-points", 0, 20, true],
  ["body-points", -20, 21, true],
  ["body-points", -21, 21, false],
  ["body-points-with-wounds", 2, 21, false],
  ["body-points-with-wounds", 3, 21, true],
  ["body-points-with-wounds", -21, 21, false],
] as const)(
  "preserves natural sheet offer for %s at %i/%i => %s",
  (mode, current, maximum, offered) => {
    settings.set("firstEditionBodyPoints", mode);
    const actor = patient();
    actor.system.health.firstEditionBodyPoints = { current, maximum };
    expect(
      canOfferBodyPointNaturalHealing(actor as unknown as FoundryActorDocument),
    ).toBe(offered);
    expect(actor.update).not.toHaveBeenCalled();
  },
);
