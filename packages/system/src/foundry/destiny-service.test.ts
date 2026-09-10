import { requireDestinyValue } from "@d6-system-2e/core";
import type * as DestinyEquipment from "./destiny-equipment";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { initialDestinyState, type D6DestinyStateV1 } from "@d6-system-2e/core";
const fixture = vi.hoisted(() => ({
  state: {} as D6DestinyStateV1,
  enabled: false,
  sequence: 0,
}));
vi.mock("./destiny-crypto", () => ({
  destinyActiveAuthority: () => ({ userId: "gm", keyId: "key" }),
  destinyClientIsAuthority: () => game.user?.id === "gm",
  grantDestinyLedgerKeys: () => Promise.resolve(),
  heartbeatDestinyCrypto: () => Promise.resolve(),
  initializeDestinyCrypto: () => Promise.resolve(),
  openDestinyEnvelope: (_topic: string, value: unknown) =>
    Promise.resolve(value),
  sealDestiny: (_topic: string, value: unknown) => Promise.resolve(value),
}));
vi.mock("./destiny-ledger", () => ({
  DESTINY_ROOT_SETTING: "root",
  DestinyLedger: class {
    read() {
      return Promise.resolve(structuredClone(fixture.state));
    }
    write(state: D6DestinyStateV1) {
      fixture.state = structuredClone(state);
      return Promise.resolve();
    }
  },
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    homebrew: { destiny: { version: 1, enabled: fixture.enabled, size: 3 } },
  }),
}));
vi.mock("./destiny-equipment", async (importOriginal) => ({
  recoverDestinyEquipmentDelivery: (
    await importOriginal<typeof DestinyEquipment>()
  ).recoverDestinyEquipmentDelivery,
  destinyDeliverySource: () => Promise.resolve(),
  previewDestinyDelivery: () => Promise.resolve(),
  deliverDestinyEquipment: vi.fn(
    (_session: string, p: { delivery?: { itemId?: string } }) => {
      if (!/^[A-Za-z0-9]{16}$/.test(p.delivery?.itemId ?? ""))
        return Promise.reject(new Error("Invalid native Item ID"));
      return Promise.resolve("native-fingerprint");
    },
  ),
  cleanupDestinyEquipment: vi.fn(() => Promise.resolve("missing")),
}));
vi.mock("./destiny-consequence", () => ({
  applyDestinyConsequence: () => Promise.resolve(),
  requireDestinyFramework: () => ({}),
}));
vi.mock("./destiny-framework-edits", () => ({
  applyDestinyFrameworkEdit: () => Promise.resolve(),
  destinyFrameworkPatches: () => [],
  validateDestinyFrameworkEdit: () => undefined,
}));
function setup() {
  const users = [
    { id: "gm", isGM: true, active: true },
    { id: "player", isGM: false, active: true },
    { id: "observer", isGM: false, active: true },
  ];
  const callbacks = new Map<string, ((...args: unknown[]) => void)[]>();
  let receive: ((value: unknown, sender?: string) => void) | undefined;
  const values: Record<string, unknown> = {};
  const storage: Record<string, unknown> = {};
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        storage[key] = value;
      },
    },
    removeItem: {
      value: (key: string) => {
        Reflect.deleteProperty(storage, key);
      },
    },
  });
  const emit =
    vi.fn<
      (
        channel: string,
        packet: Record<string, unknown>,
        options: { recipients: string[] },
      ) => void
    >();
  const state = {
    world: { id: "world" },
    user: users[1],
    users: {
      contents: users,
      get: (id: string) => users.find((u) => u.id === id),
    },
    actors: { contents: [], get: () => undefined },
    messages: { contents: [], get: () => undefined },
    settings: {
      register: (_s: string, k: string, o: { default: unknown }) => {
        values[k] = o.default;
      },
      get: (_s: string, k: string) => values[k],
      set: async (_s: string, k: string, v: unknown) => {
        await Promise.resolve();
        values[k] = v;
      },
    },
    socket: {
      emit,
      on: (_channel: string, fn: typeof receive) => {
        receive = fn;
      },
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("game", state);
  vi.stubGlobal("Hooks", {
    on: (key: string, fn: (...args: unknown[]) => void) => {
      callbacks.set(key, [...(callbacks.get(key) ?? []), fn]);
    },
    once: (key: string, fn: (...args: unknown[]) => void) => {
      callbacks.set(key, [...(callbacks.get(key) ?? []), fn]);
    },
  });
  vi.stubGlobal("foundry", {
    utils: { randomID: () => `request-${++fixture.sequence}` },
  });
  return {
    state,
    emit,
    storage,
    ready: () => callbacks.get("ready")?.forEach((fn) => fn()),
    receive: (v: unknown, s?: string) => receive?.(v, s),
  };
}
describe("Destiny native targeted transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    fixture.state = initialDestinyState();
    fixture.enabled = false;
    fixture.sequence = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("drains the persisted invalid-ID delivery on GM startup and accepts subsequent commands without another spend", async () => {
    const f = setup();
    f.state.user = f.state.users.get("gm");
    fixture.enabled = true;
    fixture.state = {
      ...initialDestinyState(),
      status: "active",
      sessionId: "session",
      revision: 7,
      coins: [
        { id: "coin-1", face: "dark" },
        { id: "coin-2", face: "light" },
        { id: "coin-3", face: "light" },
      ],
      receipts: { approved: { userId: "gm", command: "original-approval" } },
      proposals: {
        proposal: {
          id: "proposal",
          userId: "player",
          actorId: "hero",
          coinId: "coin-1",
          story: "Packed respirator",
          situation: "Underwater",
          request: "Respirator",
          review: "Approved",
          status: "delivering",
          delivery: {
            kind: "equipment",
            actorId: "hero",
            itemId: "Jx0DbKSKQFjWW2bfp3Ch4XNj",
            name: "Respirator",
            description: "Packed",
            quantity: 1,
            charges: 1,
            permanence: "session",
          },
        },
      },
    };
    const before = structuredClone(fixture.state);
    const service = await import("./destiny-service");
    service.registerDestinyService();
    vi.stubGlobal("window", {});
    f.ready();
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.state.proposals.proposal).toMatchObject({
      status: "approved",
      delivery: { itemId: "Jx0DbKSKQFjWW2bf" },
      itemFingerprint: "native-fingerprint",
    });
    expect(fixture.state.coins).toEqual(before.coins);
    expect(fixture.state.spends).toEqual(before.spends);
    expect(fixture.state.receipts.approved).toEqual(before.receipts.approved);
    expect(fixture.state.revision).toBe(8);
    f.emit.mockImplementation((_channel, packet) => f.receive(packet, "gm"));
    const following = service.requestDestiny({
      kind: "correct",
      faces: ["dark", "light", "light"],
      reason: "Check commands after recovery",
    });
    await vi.advanceTimersByTimeAsync(0);
    await expect(following).resolves.toMatchObject({ status: "active" });
  });
  it("does not retry cleanup or delete Items already retained in an archived session", async () => {
    const f = setup();
    f.state.user = f.state.users.get("gm");
    fixture.enabled = true;
    const archived = {
      proposals: {
        prior: {
          id: "prior",
          userId: "player",
          actorId: "hero",
          coinId: "coin-1",
          story: "Packed",
          situation: "",
          request: "Respirator",
          review: "Approved",
          status: "approved" as const,
          cleanup: "retained" as const,
          itemFingerprint: "original-precreation-fingerprint",
          delivery: {
            kind: "equipment" as const,
            actorId: "hero",
            itemId: "DestinyItem00001",
            name: "Respirator",
            description: "Packed",
            quantity: 1,
            charges: 1,
            permanence: "session" as const,
          },
        },
      },
      spends: [],
    };
    fixture.state = {
      ...initialDestinyState(),
      archives: { priorSession: archived },
    };
    const before = structuredClone(fixture.state);
    const service = await import("./destiny-service");
    const equipment = await import("./destiny-equipment");
    service.registerDestinyService();
    vi.stubGlobal("window", {});
    f.ready();
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.state).toEqual(before);
    expect(equipment.cleanupDestinyEquipment).not.toHaveBeenCalled();
  });
  it("sets native recipients, ignores forged response senders, and resolves only the matching GM reply", async () => {
    const f = setup();
    const service = await import("./destiny-service");
    service.registerDestinyService();
    f.ready();
    const request = service.refreshDestinyView();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      { kind: "destiny-request", id: "request-1" },
      { recipients: ["gm"] },
    );
    let resolved = false;
    void request.then(() => {
      resolved = true;
    });
    f.receive(
      { kind: "destiny-response", id: "request-1", state: fixture.state },
      "observer",
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
    f.receive(
      { kind: "destiny-response", id: "wrong", state: fixture.state },
      "gm",
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);
    f.receive(
      { kind: "destiny-response", id: "request-1", state: fixture.state },
      "gm",
    );
    expect(await request).toEqual(fixture.state);
  });
  it("shows the player's GM-approved flashback spends in current and archived history without exposing unrelated GM uses", async () => {
    setup();
    const { projectDestinyForUser } = await import("./destiny-service");
    const proposal = (userId: string) => ({
      id: "proposal",
      userId,
      actorId: "hero",
      coinId: "coin-1",
      story: "Private story",
      situation: "",
      request: "Equipment",
      review: "Approved",
      status: "approved" as const,
    });
    const spend = {
      id: "approval",
      key: "flashback:proposal",
      coinId: "coin-1",
      userId: "gm",
      side: "light" as const,
      kind: "flashback" as const,
      effectId: "proposal",
    };
    const unrelated = {
      ...spend,
      id: "private-gm-use",
      kind: "complication" as const,
    };
    const state = {
      ...initialDestinyState(),
      proposals: { proposal: proposal("player") },
      spends: [spend, unrelated],
      archives: {
        mine: {
          proposals: { proposal: proposal("player") },
          spends: [spend, unrelated],
        },
        other: {
          proposals: { proposal: proposal("observer") },
          spends: [spend, unrelated],
        },
      },
    };
    const view = projectDestinyForUser(state, {
      userId: "player",
      isGM: false,
      actorIds: ["hero"],
    });
    expect(view.spends).toEqual([spend]);
    expect(view.spends[0]?.userId).toBe("gm");
    expect(view.archives?.mine?.spends).toEqual([spend]);
    expect(view.archives?.other?.spends).toEqual([]);
    expect(view.archives?.other?.proposals).toEqual({});
    expect(
      projectDestinyForUser(state, {
        userId: "outsider",
        isGM: false,
        actorIds: ["hero"],
      }).spends,
    ).toEqual([]);
    expect(
      projectDestinyForUser(state, { userId: "gm", isGM: true, actorIds: [] }),
    ).toEqual(state);
  });
  it("uses authenticated sender identity and returns only that player's projection", async () => {
    const f = setup();
    f.state.user = f.state.users.get("gm");
    const service = await import("./destiny-service");
    service.registerDestinyService();
    f.ready();
    fixture.state = {
      ...fixture.state,
      proposals: {
        mine: {
          id: "mine",
          userId: "player",
          actorId: "a",
          coinId: "c",
          story: "my story",
          situation: "mine",
          request: "mine",
          status: "rejected",
          review: "",
        },
        other: {
          id: "other",
          userId: "observer",
          actorId: "b",
          coinId: "d",
          story: "other private story",
          situation: "other",
          request: "other",
          status: "rejected",
          review: "",
        },
      },
      receipts: { private: { userId: "gm", command: "private receipt" } },
    };
    f.receive({ kind: "destiny-request", id: "read", userId: "gm" }, "player");
    await vi.advanceTimersByTimeAsync(0);
    const [, reply, options] = requireDestinyValue(f.emit.mock.calls.at(-1));
    expect(options).toEqual({ recipients: ["player"] });
    expect(JSON.stringify(reply)).toContain("my story");
    expect(JSON.stringify(reply)).not.toContain("other private story");
    expect(JSON.stringify(reply)).not.toContain("private receipt");
    const calls = f.emit.mock.calls.length;
    f.receive({ kind: "destiny-request", id: "unsigned" });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.emit.mock.calls).toHaveLength(calls);
  });
  it("rejects externally submitted internal dice operations and retains exact uncertain outbox commands", async () => {
    const f = setup();
    const service = await import("./destiny-service");
    service.registerDestinyService();
    f.ready();
    const operation = {
      kind: "correct" as const,
      faces: [] as const,
      reason: "exact correction",
    };
    const pending = service.requestDestiny(operation);
    const failure = expect(pending).rejects.toThrow("PendingRecovery");
    await vi.advanceTimersByTimeAsync(15001);
    await failure;
    const entry = requireDestinyValue(
      Object.keys(f.storage).find((k) => k.startsWith("d6-destiny-outbox:")),
    );
    expect(
      (
        JSON.parse(String(f.storage[entry])) as {
          command: { operation: unknown };
        }
      ).command.operation,
    ).toEqual(operation);
    f.state.user = f.state.users.get("gm");
    f.receive(
      {
        kind: "destiny-request",
        id: "forged",
        command: {
          version: 1,
          id: "forged",
          sessionId: "",
          expectedRevision: 0,
          operation: {
            kind: "save-temptation-dice",
            activationId: "x",
            artifact: "forged",
          },
        },
      },
      "gm",
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(f.emit.mock.calls.at(-1)?.[1]).toMatchObject({
      id: "forged",
      error: "D6E2.Destiny.Error.InvalidCommand",
    });
  });
});
