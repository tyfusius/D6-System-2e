import type { D6RollMode } from "@d6-system-2e/core";
import { excludesMovementSelfRollViewer } from "./first-edition-movement-visibility";
import type * as InitiatingMessage from "./initiating-action-message";
import { requireDestinyValue as required } from "@d6-system-2e/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type { FirstEditionWoundRoot } from "../application/first-edition-wound-root";
import {
  migrateWoundAuthorityData,
  processWoundRootOperation,
  registerWoundRootSocket,
  requestWoundRoot,
  setWoundRootRenderer,
  woundRootRollRuntime,
} from "./first-edition-wound-authority";
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
function patient(wound = "stunned", uuid = "Actor.patient") {
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
        firstEditionState: {
          mortalityRounds: 11,
          mortalityCheckId: "previous",
        },
        tracks: {},
      },
      movement: { posture: "prone" },
      attributes: { brawn: { score: 6 } },
    },
    flags: {} as Record<string, Record<string, unknown>>,
    items: { contents: [] as unknown[], get: vi.fn() },
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
  return processWoundRootOperation({ method, rootMessageId, ...data }, user);
}
async function create(
  wound = "stunned",
  operation = "natural",
  extra: Record<string, unknown> = {},
  user = owner,
) {
  const actor = patient(wound);
  const root = (await invoke(
    "create",
    "abcdefghijklmnop",
    { patientUuid: actor.uuid, operation, rollMode: "selfroll", ...extra },
    user,
  )) as FirstEditionWoundRoot;
  return { actor, root };
}
async function record(
  root: FirstEditionWoundRoot,
  total = 6,
  user = owner,
  rollMode: D6RollMode = "selfroll",
) {
  const stage = required(root.action.stages[0]);
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
  )) as FirstEditionWoundRoot;
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
  setWoundRootRenderer((value) =>
    Promise.resolve(`status:${value.action.status}`),
  );
});
describe("Wound GM authority", () => {
  it("initializes and idempotently reads versioned authority data; rejects future/corrupt data", () => {
    const initial = migrateWoundAuthorityData(null);
    expect(initial).toEqual({ version: 1, roots: {} });
    expect(migrateWoundAuthorityData(initial)).toEqual(initial);
    expect(() =>
      migrateWoundAuthorityData({ version: 2, roots: {} }),
    ).toThrow();
    expect(() =>
      migrateWoundAuthorityData({ version: 1, roots: { bad: {} } }),
    ).toThrow();
  });
  it("validates snapshot bounds separately from short identifiers without changing stored bytes", () => {
    const binding = {
      version: 1,
      initiator: "owner",
      patientUuid: "Actor.patient",
      before: "x".repeat(513),
      witness: "proof",
    };
    const stored = { version: 1, roots: { abcdefghijklmnop: binding } };
    expect(migrateWoundAuthorityData(stored)).toEqual(stored);
    expect(
      migrateWoundAuthorityData({
        ...stored,
        roots: {
          abcdefghijklmnop: { ...binding, before: "x".repeat(2_000_000) },
        },
      }).roots.abcdefghijklmnop?.before.length,
    ).toBe(2_000_000);
    for (const before of ["", 42, "x".repeat(2_000_001)])
      expect(() =>
        migrateWoundAuthorityData({
          ...stored,
          roots: { abcdefghijklmnop: { ...binding, before } },
        }),
      ).toThrow("invalid");
    expect(() =>
      migrateWoundAuthorityData({
        ...stored,
        roots: { abcdefghijklmnop: { ...binding, initiator: "x".repeat(513) } },
      }),
    ).toThrow("invalid");
  });
  it("records automatic recovery atomically with opaque proof and repairs without reapplying", async () => {
    const { actor } = await create();
    await invoke("effect");
    await invoke("advance");
    await invoke("present");
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(actor.system.health.firstEditionWound).toBe("healthy");
    expect(JSON.stringify(actor.flags)).not.toMatch(/owner|healer|dice|total/);
    expect(messages.get("abcdefghijklmnop")?.whisper).toEqual(["owner"]);
    expect(f.hydrate).not.toHaveBeenCalled();
    expect(
      ((await invoke("load")) as FirstEditionWoundRoot).action.status,
    ).toBe("complete");
    expect(
      settings.get("firstEditionWoundAuthority") as object,
    ).not.toHaveProperty("roots");
  });
  it("recovers an Actor save whose reply was lost, once", async () => {
    const { actor } = await create();
    actor.update.mockImplementationOnce((changes) => {
      patch(actor, changes);
      return Promise.reject(Error("reply lost"));
    });
    await expect(invoke("effect")).rejects.toThrow();
    expect(
      ((await invoke("load")) as FirstEditionWoundRoot).action.stages[0]?.state,
    ).toBe("claimed");
    await invoke("effect");
    await invoke("advance");
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(actor.system.health.firstEditionWound).toBe("healthy");
  });
  it("leaves an unconfirmed Actor write uncertain without retrying the mutation", async () => {
    const { actor } = await create();
    actor.update.mockRejectedValueOnce(Error("not saved"));
    await expect(invoke("effect")).rejects.toThrow();
    await expect(invoke("effect")).rejects.toThrow(/uncertain/);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(actor.system.health.firstEditionWound).toBe("stunned");
  });
  it("does not apply after an external health change", async () => {
    const { actor } = await create();
    actor.system.health.firstEditionWound = "dead";
    await expect(invoke("effect")).rejects.toThrow(/conflict/);
    expect(actor.update).not.toHaveBeenCalled();
  });
  it("rejects ownership loss, forged callers and deleted roots", async () => {
    const { actor } = await create();
    actor.ownershipAllowed = false;
    await expect(invoke("effect")).rejects.toThrow(/authority/);
    await expect(
      invoke("load", "abcdefghijklmnop", {}, stranger),
    ).rejects.toThrow(/authority/);
    messages.delete("abcdefghijklmnop");
    await expect(
      invoke(
        "create",
        "abcdefghijklmnop",
        { patientUuid: actor.uuid, operation: "natural", rollMode: "selfroll" },
        gm,
      ),
    ).rejects.toThrow();
    expect(actor.update).not.toHaveBeenCalled();
  });
  it("persists owner Self dice, then applies only the saved health result", async () => {
    const { actor, root } = await create("wounded");
    await record(root);
    expect(messages.get(root.action.rootMessageId)?.whisper).toEqual(["owner"]);
    await invoke("effect");
    await invoke("advance");
    expect(actor.system.health.firstEditionWound).toBe("healthy");
    expect(actor.update).toHaveBeenCalledTimes(1);
  });
  it("cancels before dice without an Actor write", async () => {
    const { actor } = await create("wounded");
    await invoke("cancel");
    expect(
      ((await invoke("load")) as FirstEditionWoundRoot).action.status,
    ).toBe("cancelled");
    await expect(invoke("effect")).rejects.toThrow();
    expect(actor.update).not.toHaveBeenCalled();
  });
  it("deduplicates a scheduled hook before dice and blocks a later unresolved round", async () => {
    const actor = patient("mortally-wounded");
    const combat = {
      id: "combat",
      round: 2,
      combatants: { contents: [{ actor }] },
    };
    docs.set("Combat.combat", combat);
    const data = {
      patientUuid: actor.uuid,
      operation: "round-mortality",
      rollMode: "publicroll",
      combatUuid: "Combat.combat",
      checkId: "combat:round:1",
    };
    const first = await invoke("create", "abcdefghijklmnop", data, gm);
    expect(await invoke("create", "ponmlkjihgfedcba", data, gm)).toEqual(first);
    expect(f.create).toHaveBeenCalledTimes(1);
    combat.round = 3;
    await expect(
      invoke(
        "create",
        "ponmlkjihgfedcba",
        { ...data, checkId: "combat:round:2" },
        gm,
      ),
    ).rejects.toThrow(/uncertain/);
  });
  it("advances the stored clock once per successful scheduled check", async () => {
    const actor = patient("mortally-wounded");
    docs.set("Combat.combat", {
      id: "combat",
      round: 2,
      combatants: { contents: [{ actor }] },
    });
    const root = (await invoke(
      "create",
      "abcdefghijklmnop",
      {
        patientUuid: actor.uuid,
        operation: "round-mortality",
        rollMode: "publicroll",
        combatUuid: "Combat.combat",
        checkId: "combat:round:1",
      },
      gm,
    )) as FirstEditionWoundRoot;
    await record(root, 1, gm);
    await invoke("effect", root.action.rootMessageId, {}, gm);
    await invoke("advance", root.action.rootMessageId, {}, gm);
    expect(actor.system.health.firstEditionState.mortalityRounds).toBe(12);
    expect(actor.system.health.firstEditionState.mortalityCheckId).toBe(
      "combat:round:1",
    );
    expect(actor.update).toHaveBeenCalledTimes(1);
  });
  it("allows the next round after deleting a completed card, using its durable proof", async () => {
    const actor = patient("mortally-wounded");
    const combat = {
      id: "combat",
      round: 2,
      combatants: { contents: [{ actor }] },
    };
    docs.set("Combat.combat", combat);
    const data = {
      patientUuid: actor.uuid,
      operation: "round-mortality",
      rollMode: "publicroll",
      combatUuid: "Combat.combat",
      checkId: "combat:round:1",
    };
    const first = (await invoke(
      "create",
      "abcdefghijklmnop",
      data,
      gm,
    )) as FirstEditionWoundRoot;
    await record(first, 1, gm);
    await invoke("effect", first.action.rootMessageId, {}, gm);
    await invoke("advance", first.action.rootMessageId, {}, gm);
    messages.delete(first.action.rootMessageId);
    combat.round = 3;
    const second = (await invoke(
      "create",
      "ponmlkjihgfedcba",
      { ...data, checkId: "combat:round:2" },
      gm,
    )) as FirstEditionWoundRoot;
    await record(second, 1, gm);
    await invoke("effect", second.action.rootMessageId, {}, gm);
    await invoke("advance", second.action.rootMessageId, {}, gm);
    expect(actor.update).toHaveBeenCalledTimes(2);
    expect(actor.system.health.firstEditionState.mortalityRounds).toBe(13);
    expect(messages.has(first.action.rootMessageId)).toBe(false);
    expect(
      await invoke(
        "create",
        "aaaabbbbccccdddd",
        { ...data, checkId: "combat:round:2" },
        gm,
      ),
    ).toBeNull();
  });
  it("still blocks a missing unresolved card and a forged proof", async () => {
    const actor = patient("mortally-wounded");
    const combat = {
      id: "combat",
      round: 2,
      combatants: { contents: [{ actor }] },
    };
    docs.set("Combat.combat", combat);
    const data = {
      patientUuid: actor.uuid,
      operation: "round-mortality",
      rollMode: "publicroll",
      combatUuid: "Combat.combat",
      checkId: "combat:round:1",
    };
    await invoke("create", "abcdefghijklmnop", data, gm);
    messages.delete("abcdefghijklmnop");
    combat.round = 3;
    patch(actor, {
      "flags.d6-system-2e.woundRootReceipts.abcdefghijklmnop": {
        version: 1,
        witness: "forged",
      },
    });
    await expect(
      invoke(
        "create",
        "ponmlkjihgfedcba",
        { ...data, checkId: "combat:round:2" },
        gm,
      ),
    ).rejects.toThrow(/uncertain/);
    expect(actor.update).not.toHaveBeenCalled();
  });
  it("lets a GM explicitly retire a stale scheduled check without health changes or dice", async () => {
    const actor = patient("mortally-wounded");
    const combat = {
      id: "combat",
      round: 2,
      combatants: { contents: [{ actor }] },
    };
    docs.set("Combat.combat", combat);
    const data = {
      patientUuid: actor.uuid,
      operation: "round-mortality",
      rollMode: "publicroll",
      combatUuid: "Combat.combat",
      checkId: "combat:round:1",
    };
    await invoke("create", "abcdefghijklmnop", data, gm);
    await expect(invoke("cancel", "abcdefghijklmnop", {}, gm)).rejects.toThrow(
      /authority/,
    );
    actor.system.health.firstEditionWound = "wounded";
    await expect(invoke("cancel")).rejects.toThrow(/authority/);
    await invoke("cancel", "abcdefghijklmnop", {}, gm);
    expect(
      (
        (await invoke(
          "load",
          "abcdefghijklmnop",
          {},
          gm,
        )) as FirstEditionWoundRoot
      ).action.status,
    ).toBe("cancelled");
    messages.delete("abcdefghijklmnop");
    actor.system.health.firstEditionWound = "mortally-wounded";
    actor.system.health.firstEditionState.mortalityRounds = 0;
    combat.round = 3;
    const next = (await invoke(
      "create",
      "ponmlkjihgfedcba",
      { ...data, checkId: "combat:round:2" },
      gm,
    )) as FirstEditionWoundRoot;
    expect(next.action.clock?.completedRounds.value).toBe(1);
    expect(actor.update).not.toHaveBeenCalled();
  });
  it("rejects stale model selection and a foreign token sharing the Actor id", async () => {
    const { actor } = await create();
    settings.set("worldRulesProfiles", {
      version: 1,
      activeProfileId: "second-edition",
      profiles: {},
    });
    await expect(invoke("effect")).rejects.toThrow(/conflict/);
    expect(actor.update).not.toHaveBeenCalled();
    docs.set("Actor.patient", {
      ...actor,
      uuid: "Scene.scene.Token.other.Actor.patient",
    });
    await expect(invoke("load")).rejects.toThrow(/deleted/);
  });

  it.each(["ownership", "skill"])(
    "revalidates healer %s before the patient effect",
    async (change) => {
      const actor = patient("wounded"),
        healer = patient("healthy", "Actor.healer");
      healer.id = "healer";
      healer.items.get.mockReturnValue({
        id: "medicine",
        type: "skill",
        name: "Medicine",
        system: { key: "medicine", attributeId: "brawn", score: 3 },
      });
      const root = (await invoke("create", "abcdefghijklmnop", {
        patientUuid: actor.uuid,
        healerUuid: healer.uuid,
        medicineItemId: "medicine",
        operation: "assisted",
        rollMode: "publicroll",
      })) as FirstEditionWoundRoot;
      await record(root, 15);
      if (change === "ownership") healer.ownershipAllowed = false;
      else healer.items.get.mockReturnValue(undefined);
      await expect(invoke("effect")).rejects.toThrow(
        change === "ownership" ? /authority/ : /deleted/,
      );
      expect(actor.update).not.toHaveBeenCalled();
    },
  );

  it("accepts replies only from the selected native sender and targets requests privately", async () => {
    f.authority = false;
    Object.assign(game, { user: owner });
    let handler!: (packet: unknown, sender?: string) => void;
    const emit = vi.fn();
    Object.assign(game, {
      socket: {
        on: (_channel: string, callback: typeof handler) => {
          handler = callback;
        },
        emit,
      },
    });
    registerWoundRootSocket();
    const result = requestWoundRoot({
      method: "load",
      rootMessageId: "abcdefghijklmnop",
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    const packet = emit.mock.calls[0]?.[1] as { packetId: string };
    expect(emit.mock.calls[0]?.[2]).toEqual({ recipients: ["gm"] });
    handler(
      { type: "wound-root-reply", packetId: packet.packetId, value: "forged" },
      "stranger",
    );
    handler({
      type: "wound-root-reply",
      packetId: packet.packetId,
      value: "missing-native-sender",
    });
    handler(
      {
        type: "wound-root-reply",
        packetId: packet.packetId,
        value: "verified",
      },
      "gm",
    );
    expect(await result).toBe("verified");
  });
  it("includes the initiating player in GM-roll scope while preserving Blind scope", async () => {
    await create("stunned", "natural", { rollMode: "gmroll" });
    expect(messages.get("abcdefghijklmnop")?.whisper).toEqual(["gm", "owner"]);
    messages.clear();
    settings.delete("firstEditionWoundAuthority");
    await create("stunned", "natural", { rollMode: "blindroll" });
    expect(messages.get("abcdefghijklmnop")?.whisper).toEqual(["gm"]);
    expect(messages.get("abcdefghijklmnop")?.blind).toBe(true);
  });
  it.each(["blindroll", "selfroll", "publicroll"] as const)(
    "keeps default-Public identity private until final %s pre-dice admission",
    async (mode) => {
      setWoundRootRenderer((value) =>
        Promise.resolve(
          `Patient: Wounded; healer: Medic; state: ${value.action.stages[0]?.state}`,
        ),
      );
      const { root } = await create("wounded", "natural", {
        rollMode: "publicroll",
      });
      const message = required(messages.get(root.action.rootMessageId));
      expect(f.messageHistory).toHaveLength(1);
      expect(f.messageHistory[0]).toMatchObject({
        whisper: ["owner"],
        content: "Patient: Wounded; healer: Medic; state: pending",
      });
      expect(excludesMovementSelfRollViewer(message, "gm")).toBe(true);
      await record(root, 6, owner, mode);
      const expected =
        mode === "blindroll" ? ["gm"] : mode === "selfroll" ? ["owner"] : [];
      // The first audience change is the same native write that commits the claim.
      const admission = required(f.messageHistory[1]);
      expect(admission.whisper).toEqual(expected);
      expect(admission.blind).toBe(mode === "blindroll");
      expect(admission.content).toBe(
        "Patient: Wounded; healer: Medic; state: claimed",
      );
      for (const entry of f.messageHistory.slice(1))
        expect(entry.whisper).toEqual(expected);
      expect(message.whisper).toEqual(expected);
    },
  );
  it("keeps a cancelled default-Public builder card private without publishing its identity", async () => {
    await create("wounded", "natural", { rollMode: "publicroll" });
    await invoke("cancel");
    expect(f.messageHistory).toHaveLength(2);
    for (const entry of f.messageHistory)
      expect(entry.whisper).toEqual(["owner"]);
  });
});
