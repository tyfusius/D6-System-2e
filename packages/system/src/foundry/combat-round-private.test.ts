import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  authority: true,
  fail: false,
  seal: vi.fn(),
  open: vi.fn(),
  grant: vi.fn(),
  values: new Map<string, unknown>(),
}));
vi.mock("./destiny-crypto", () => ({
  destinyActiveAuthority: () => ({ userId: "gm", keyId: "key" }),
  destinyClientIsAuthority: () => f.authority,
  destinyEnrolledGMIds: () => ["gm", "forged-player"],
  initializeDestinyCrypto: () => Promise.resolve(),
  heartbeatDestinyCrypto: () => Promise.resolve(),
  grantDestinyLedgerKeys: f.grant,
  sealDestiny: f.seal,
  openDestinyEnvelope: f.open,
}));
import {
  hydratePrivateCombat,
  confidentialMovementReceipt,
  bindConfidentialMovementRoot,
  registerPrivateMovementRootExecutor,
  persistConfidentialRound,
  readConfidentialRound,
  registerPrivateCombat,
  replaceRoundFlag,
  type GridCombatant,
} from "./combat-round-private";
let raw: Record<string, unknown>;
let updates: Record<string, unknown>[];
let hooks: Map<string, (...args: unknown[]) => unknown>;
let receive: (value: unknown, senderId?: string) => void;
let emit: ReturnType<typeof vi.fn>;
let c: GridCombatant;
const plain = () => ({
  round: 1,
  revision: 4,
  contractVersion: 2,
  actions: [
    {
      id: "secret-id",
      kind: "attack",
      label: "SECRET SPELL",
      sourceId: "SECRET SOURCE",
    },
  ],
  completedActionIds: [],
});
beforeEach(() => {
  vi.useFakeTimers();
  f.authority = true;
  f.fail = false;
  f.values.clear();
  f.seal.mockReset();
  f.open.mockReset();
  f.grant.mockReset();
  updates = [];
  raw = plain();
  hooks = new Map();
  emit = vi.fn();
  f.seal.mockImplementation(
    (topic: string, payload: unknown, recipients: readonly string[]) => {
      if (f.fail) return Promise.reject(new Error("encryption failed"));
      const id = `cipher-${f.values.size}`;
      f.values.set(id, structuredClone(payload));
      return Promise.resolve({
        version: 1,
        topic,
        ciphertext: id,
        recipients: recipients.map((userId: string) => ({
          userId,
          keyId: "key",
          wrappedKey: "opaque",
        })),
      });
    },
  );
  f.open.mockImplementation(
    (topic: string, envelope: { topic: string; ciphertext: string }) => {
      if (f.fail) return Promise.reject(new Error("missing key"));
      if (topic !== envelope.topic)
        return Promise.reject(new Error("wrong topic"));
      return Promise.resolve(
        structuredClone(f.values.get(envelope.ciphertext)),
      );
    },
  );
  const actor = {
    id: "npc",
    name: "Secret NPC",
    testUserPermission: (user: { id: string }) => user.id === "owner",
  };
  c = {
    id: "hidden",
    hidden: true,
    parent: { id: "combat" },
    actor: actor as unknown as FoundryActorDocument,
    getFlag: () => raw,
    update: (changes) => {
      updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const key = path.replace("flags.d6-system-2e.roundAction.", "");
        if (key.startsWith("-=")) Reflect.deleteProperty(raw, key.slice(2));
        else raw[key] = value;
      }
      raw = structuredClone(raw);
      return Promise.resolve();
    },
  };
  const users = [
    { id: "gm", isGM: true, active: true },
    { id: "player", isGM: false, active: true },
    { id: "owner", isGM: false, active: true },
    { id: "forged-player", isGM: false, active: true },
  ];
  vi.stubGlobal("game", {
    user: users[0],
    users: {
      contents: users,
      get: (id: string) => users.find((u) => u.id === id),
    },
    combat: { id: "combat", round: 1, combatants: { contents: [c] } },
    socket: {
      on: (_channel: string, fn: typeof receive) => {
        receive = fn;
      },
      emit,
    },
    i18n: { localize: (s: string) => s },
  });
  vi.stubGlobal("Hooks", {
    on: (name: string, fn: (...args: unknown[]) => unknown) =>
      hooks.set(name, fn),
    once: (name: string, fn: (...args: unknown[]) => unknown) =>
      hooks.set(name, fn),
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
describe("private combat flag authority", () => {
  it("seals before writing and removes every old plaintext field in the same update", async () => {
    await hydratePrivateCombat();
    expect(raw.privateRound).toBe(1);
    expect(JSON.stringify(raw)).not.toContain("SECRET");
    expect(raw.actions).toBeUndefined();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toHaveProperty(
      "flags.d6-system-2e.roundAction.-=actions",
      null,
    );
    expect(f.seal.mock.calls[0]?.[2]).toEqual(["gm"]);
    expect(readConfidentialRound(c, raw)).toEqual(plain());
    await hydratePrivateCombat();
    expect(updates).toHaveLength(1);
  });
  it("retains legacy/current state on encryption or missing-key failure", async () => {
    f.fail = true;
    await expect(hydratePrivateCombat()).rejects.toThrow("encryption failed");
    expect(raw).toEqual(plain());
    expect(updates).toHaveLength(0);
    f.fail = false;
    await hydratePrivateCombat();
    const saved = structuredClone(raw);
    f.fail = true;
    raw = structuredClone(raw);
    raw.envelope = {
      ...(raw.envelope as Record<string, unknown>),
      ciphertext: "new-unavailable-cipher",
    };
    const unavailable = structuredClone(raw);
    await expect(hydratePrivateCombat()).rejects.toThrow("missing key");
    expect(raw).toEqual(unavailable);
    expect(saved.privateRound).toBe(1);
    expect(() => readConfidentialRound(c, raw)).toThrow("authorityUnavailable");
  });
  it("rejects unsupported private versions and nonauthority writes without replacing the record", async () => {
    raw = { privateRound: 2, round: 1, envelope: {} };
    await expect(hydratePrivateCombat()).rejects.toThrow("unknownVersion");
    expect(updates).toHaveLength(0);
    raw = { ...plain(), contractVersion: 3 };
    await expect(hydratePrivateCombat()).rejects.toThrow("unknownVersion");
    expect(raw.contractVersion).toBe(3);
    expect(updates).toHaveLength(0);
    raw = plain();
    f.authority = false;
    await expect(persistConfidentialRound(c, plain())).rejects.toThrow(
      "authorityUnavailable",
    );
    expect(updates).toHaveLength(0);
  });
  it("uses authenticated sender ownership and recipient-targeted responses", async () => {
    await hydratePrivateCombat();
    const execute = vi.fn().mockResolvedValue({ changed: true, state: null });
    const projection = {
      grid: {
        version: 1,
        round: 1,
        currentSegment: 0,
        complete: false,
        waiting: true,
        rows: [],
        columns: [],
        declarationOrder: [],
      },
      owned: {},
    };
    registerPrivateCombat(execute, () => projection as never);
    hooks.get("ready")?.();
    await flush();
    receive(
      {
        kind: "combat-grid-command",
        id: "forged",
        combatId: "combat",
        requesterUserId: "gm",
        command: {
          kind: "spend",
          actorId: "npc",
          combatantId: "hidden",
          revision: 4,
        },
      },
      "player",
    );
    await flush();
    expect(execute).not.toHaveBeenCalled();
    expect(emit.mock.calls.at(-1)?.[1]).toMatchObject({
      error: "D6E2.Combat.RoundGrid.notAuthorized",
    });
    receive(
      { kind: "combat-grid-read", id: "read", combatId: "combat" },
      "player",
    );
    await flush();
    expect(emit.mock.calls.at(-1)?.[2]).toEqual({ recipients: ["player"] });
    expect(JSON.stringify(emit.mock.calls)).not.toContain("SECRET SPELL");
    receive(
      {
        kind: "combat-grid-command",
        id: "wrong-token",
        combatId: "combat",
        command: {
          kind: "spend",
          actorId: "npc",
          combatantId: "other-token-same-actor",
          revision: 4,
        },
      },
      "owner",
    );
    await flush();
    expect(execute).not.toHaveBeenCalled();
    receive({
      kind: "combat-grid-command",
      id: "missing-sender",
      combatId: "combat",
      command: {
        kind: "spend",
        actorId: "npc",
        combatantId: "hidden",
        revision: 4,
      },
    });
    await flush();
    expect(execute).not.toHaveBeenCalled();
  });
  it("serializes competing owner commands so an identical revision cannot spend twice", async () => {
    let revision = 4;
    let spent = 0;
    const execute = vi.fn(async (command: { revision: number }) => {
      if (command.revision !== revision)
        throw new Error("D6E2.Combat.RoundGrid.staleState");
      await Promise.resolve();
      spent += 1;
      revision += 1;
      return { changed: true, state: null };
    });
    registerPrivateCombat(execute, () => ({ grid: {} as never, owned: {} }));
    hooks.get("ready")?.();
    await flush();
    for (const id of ["first", "second"])
      receive(
        {
          kind: "combat-grid-command",
          id,
          combatId: "combat",
          command: {
            kind: "spend",
            actorId: "npc",
            combatantId: "hidden",
            revision: 4,
          },
        },
        "owner",
      );
    await flush();
    await flush();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(spent).toBe(1);
    expect(emit.mock.calls.at(-1)?.[1]).toMatchObject({
      id: "second",
      error: "D6E2.Combat.RoundGrid.staleState",
    });
  });
  it("returns success once when an unrelated visible update reconstructs the hidden encrypted flag", async () => {
    await hydratePrivateCombat();
    const sealed = structuredClone(raw);
    let revision = 1;
    let spent = 0;
    const visibleActor = {
      id: "visible-actor",
      testUserPermission: () => true,
    };
    const visible = {
      id: "visible",
      actor: visibleActor,
      getFlag: () => ({ revision }),
      update: () => Promise.resolve(),
    };
    (
      game as unknown as { combat: { combatants: { contents: unknown[] } } }
    ).combat.combatants.contents.push(visible);
    const readAfterWrite = () => {
      expect(readConfidentialRound(c, raw)).toEqual(plain());
      return {
        revision,
        spentActionCount: spent,
        firstEditionActiveDefense: { total: 13 },
      };
    };
    const execute = vi.fn(async (command: { revision: number }) => {
      if (command.revision !== revision)
        throw new Error("D6E2.Combat.RoundGrid.staleState");
      spent += 1;
      revision += 1;
      raw = structuredClone(raw); // Foundry preparation after the visible write.
      await Promise.resolve();
      return { changed: true, state: readAfterWrite() };
    });
    registerPrivateCombat(execute as never, () => ({
      grid: {} as never,
      owned: { visible: readAfterWrite() as never },
    }));
    hooks.get("ready")?.();
    await flush();
    const command = {
      kind: "defense",
      actorId: "visible-actor",
      combatantId: "visible",
      revision: 1,
    };
    receive(
      { kind: "combat-grid-command", id: "once", combatId: "combat", command },
      "gm",
    );
    await flush();
    expect(emit.mock.calls.at(-1)?.[1]).toMatchObject({
      id: "once",
      value: {
        result: {
          changed: true,
          state: {
            revision: 2,
            spentActionCount: 1,
            firstEditionActiveDefense: { total: 13 },
          },
        },
      },
    });
    expect(emit.mock.calls.at(-1)?.[1]).not.toHaveProperty("error");
    expect(emit.mock.calls.at(-1)?.[2]).toEqual({ recipients: ["gm"] });
    expect(raw).toEqual(sealed);
    receive(
      {
        kind: "combat-grid-command",
        id: "duplicate",
        combatId: "combat",
        command,
      },
      "gm",
    );
    await flush();
    expect(spent).toBe(1);
    expect(emit.mock.calls.at(-1)?.[1]).toMatchObject({
      id: "duplicate",
      error: "D6E2.Combat.RoundGrid.staleState",
    });
  });
  it("invalidates a changed envelope even when Foundry mutates the same object", async () => {
    await hydratePrivateCombat();
    (raw.envelope as Record<string, unknown>).ciphertext = "changed-cipher";
    expect(() => readConfidentialRound(c, raw)).toThrow("authorityUnavailable");
  });
  it("keeps replacement independent of unrelated combatant flags", () => {
    expect(
      Object.keys(
        replaceRoundFlag(c, { privateRound: 1, round: 1, envelope: {} }),
      ).every((k) => k.startsWith("flags.d6-system-2e.roundAction.")),
    ).toBe(true);
  });
});

it("preserves confidential Movement provenance and effect receipts across later round writes", async () => {
  await hydratePrivateCombat();
  await bindConfidentialMovementRoot(c, "root:movement", {
    authorId: "gm",
    witness: "private-witness",
  });
  expect(readConfidentialRound(c, raw)).toMatchObject({ revision: 4 });
  await persistConfidentialRound(
    c,
    { ...plain(), revision: 5 },
    { key: "movement:spend:effect", value: { receipt: "spent once" } },
  );
  await persistConfidentialRound(c, { ...plain(), round: 2, revision: 6 });
  expect(confidentialMovementReceipt(c, "root:movement")).toEqual({
    authorId: "gm",
    witness: "private-witness",
  });
  expect(confidentialMovementReceipt(c, "movement:spend:effect")).toEqual({
    receipt: "spent once",
  });
  expect(JSON.stringify(raw)).not.toContain("private-witness");
});
it("never discards a Movement receipt by falling through to plaintext persistence", async () => {
  const visible = { ...c, hidden: false };
  await expect(
    persistConfidentialRound(visible, plain(), { key: "movement", value: {} }),
  ).rejects.toThrow("authorityUnavailable");
  expect(updates).toHaveLength(0);
});
it("routes Movement only through the authenticated existing private queue", async () => {
  const executor = vi.fn(() => Promise.resolve({ version: 1 }));
  registerPrivateMovementRootExecutor(executor);
  registerPrivateCombat(vi.fn() as never, () => ({
    grid: {} as never,
    owned: {},
  }));
  hooks.get("ready")?.();
  await flush();
  const command = {
    kind: "relative-movement-root",
    actorId: "npc",
    combatantId: "hidden",
    revision: 4,
    data: { method: "load" },
  };
  receive(
    {
      kind: "combat-grid-movement-root",
      id: "root",
      combatId: "combat",
      command,
    },
    "owner",
  );
  await flush();
  expect(executor).toHaveBeenCalledWith(
    command,
    expect.objectContaining({ id: "owner" }),
  );
  expect(emit.mock.calls.at(-1)?.[1]).toMatchObject({
    value: { movement: { version: 1 } },
  });
  receive(
    {
      kind: "combat-grid-movement-root",
      id: "bad",
      combatId: "combat",
      command,
    },
    "player",
  );
  await flush();
  expect(executor).toHaveBeenCalledTimes(1);
});
