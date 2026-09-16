import {
  requireDestinyValue,
  normalizeDestinyConfiguration,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FirstEditionWoundRoot } from "../application/first-edition-wound-root";

vi.mock("./rolls/roll-service", () => ({
  retryD6MatchingResultReward: vi.fn(),
}));

function fixture(lockAvailable = true) {
  const gm = { id: "gm", active: true, isGM: true };
  const player = { id: "player", active: true, isGM: false };
  const settings = new Map<string, unknown>([
    [
      "worldRulesProfiles",
      { version: 1, activeProfileId: "open-d6", profiles: {} },
    ],
    ["gameMode", "open-d6"],
  ]);
  const storage = new Map<string, string>();
  const messages: FoundryChatMessageDocument[] = [];
  let sequence = 0;
  let lockHeld = !lockAvailable;
  const actor = {
    id: "patient",
    uuid: "Actor.patient",
    name: "Patient",
    type: "character",
    isOwner: true,
    system: {
      attributes: { brawn: { score: 9 } },
      health: {
        firstEditionWound: "wounded",
        tracks: {},
        firstEditionState: {},
      },
    },
    items: { contents: [], get: () => undefined },
    getFlag: () => undefined,
    testUserPermission: () => true,
    update: vi.fn(),
  };
  const state = {
    user: gm,
    world: { id: "wound-crypto-test" },
    users: {
      contents: [gm, player],
      get: (id: string) => [gm, player].find((u) => u.id === id),
    },
    messages: {
      contents: messages,
      get: (id: string) => messages.find((m) => m.id === id),
    },
    settings: {
      register: (
        _scope: string,
        key: string,
        options: { default: unknown },
      ) => {
        if (!settings.has(key)) settings.set(key, options.default);
      },
      get: (_scope: string, key: string) => settings.get(key),
      set: async (_scope: string, key: string, value: unknown) => {
        await Promise.resolve();
        settings.set(key, structuredClone(value));
      },
    },
    socket: { on: vi.fn(), emit: vi.fn() },
    i18n: { localize: (key: string) => key },
  };
  vi.stubGlobal("game", state);
  vi.stubGlobal("foundry", {
    utils: { randomID: () => `opaque${String(++sequence).padStart(10, "0")}` },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object | null) => Promise<void>,
      ) => {
        await Promise.resolve();
        if (lockHeld) return callback(null);
        lockHeld = true;
        return callback({});
      },
    },
  });
  vi.stubGlobal("fromUuid", (uuid: string) =>
    Promise.resolve(uuid === actor.uuid ? actor : undefined),
  );
  vi.stubGlobal("ChatMessage", {
    getSpeaker: () => ({ actor: actor.id }),
    create: async (source: Record<string, unknown>) => {
      await Promise.resolve();
      const data = structuredClone(source);
      const message = {
        ...data,
        id: typeof data._id === "string" ? data._id : `message${++sequence}`,
        author: state.user,
        _stats: { createdTime: Date.now(), modifiedTime: Date.now() },
        flags: (data.flags ?? {}) as Record<string, Record<string, unknown>>,
        getFlag(scope: string, key: string): unknown {
          return this.flags[scope]?.[key];
        },
        async update(changes: Record<string, unknown>) {
          await Promise.resolve();
          for (const [path, value] of Object.entries(changes)) {
            const parts = path.split(".");
            let target = this as unknown as Record<string, unknown>;
            for (const part of parts.slice(0, -1)) {
              target[part] ??= {};
              target = target[part] as Record<string, unknown>;
            }
            target[requireDestinyValue(parts.at(-1))] = structuredClone(value);
          }
          this._stats.modifiedTime = Date.now();
        },
      };
      messages.push(message as unknown as FoundryChatMessageDocument);
      return message;
    },
  });
  return { state, settings, actor, messages };
}

const createRequest = {
  method: "create",
  rootMessageId: "abcdefghijklmnop",
  operation: "natural",
  patientUuid: "Actor.patient",
  rollMode: "publicroll",
};
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Wound authority with optional Destiny disabled (real crypto)", () => {
  it("initializes GM authority on demand, seals bindings and creates a private pending root", async () => {
    const f = fixture();
    const crypto = await import("./destiny-crypto");
    const wound = await import("./first-edition-wound-authority");
    wound.registerWoundRootAuthority();
    expect(crypto.destinyActiveAuthority()).toBeUndefined();
    expect(
      normalizeDestinyConfiguration(
        currentConfiguredRulesProfile().homebrew.destiny,
      ).enabled,
    ).toBe(false);
    const root = (await wound.requestWoundRoot(
      createRequest,
    )) as FirstEditionWoundRoot;
    expect(crypto.destinyClientIsAuthority()).toBe(true);
    expect(root.action.status).toBe("open");
    expect(root.action.stages[0]?.state).toBe("pending");
    const envelope = f.settings.get("firstEditionWoundAuthority");
    expect(JSON.stringify(envelope)).not.toContain("Actor.patient");
    expect(
      await crypto.openDestinyEnvelope("firstEditionWoundAuthority", envelope),
    ).toMatchObject({
      version: 1,
      roots: { abcdefghijklmnop: { patientUuid: "Actor.patient" } },
    });
    expect(f.state.messages.get(createRequest.rootMessageId)).toMatchObject({
      author: { id: "gm" },
      whisper: ["gm"],
    });
    expect(
      normalizeDestinyConfiguration(
        currentConfiguredRulesProfile().homebrew.destiny,
      ).enabled,
    ).toBe(false);
    expect(f.actor.update).not.toHaveBeenCalled();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 40000);
    expect(crypto.destinyActiveAuthority()).toBeUndefined();
    const reloaded = await wound.requestWoundRoot({
      method: "load",
      rootMessageId: createRequest.rootMessageId,
    });
    expect(reloaded).toEqual(root);
    expect(crypto.destinyClientIsAuthority()).toBe(true);
  });

  it("creates and loads the player's manual mortality root with zero stored minutes and a stale natural card", async () => {
    const f = fixture();
    const wound = await import("./first-edition-wound-authority");
    wound.registerWoundRootAuthority();
    await wound.requestWoundRoot(createRequest);
    // Preserve the old pending natural root, then change the patient's state/profile.
    const profile = currentConfiguredRulesProfile();
    f.settings.set("worldRulesProfiles", {
      version: 3,
      activeProfileId: "starwars-test",
      profiles: {
        "starwars-test": {
          ...profile,
          id: "starwars-test",
          label: "Star Wars test",
          source: { kind: "world" },
          strategies: {
            ...profile.strategies,
            health: "open-d6.health.wound-track",
          },
        },
      },
    });
    Object.assign(f.actor.system.health, {
      firstEditionWound: "mortally-wounded",
      firstEditionState: {
        consciousness: "unconscious",
        source: "mortally-wounded",
        mortalityRounds: 0,
        mortalityMinutes: 0,
      },
    });
    const player = f.state.users.get("player") as FoundryUser;
    const manual = (await wound.processWoundRootOperation(
      {
        ...createRequest,
        rootMessageId: "X4QNUm6DABBdrloy",
        operation: "manual-mortality",
        minutes: 1,
      },
      player,
    )) as FirstEditionWoundRoot;
    expect(manual.minutes).toBe(1);
    expect(manual.action.initiation).toBe("manual-mortality");
    expect(manual.action.clock).toBeUndefined();
    expect(manual.action.runtime.profileId).toBe("starwars-test");
    expect(manual.action.runtime.damageStrategyId).toBe(
      "open-d6.damage.wounds",
    );
    expect(manual.action.stages[0]).toMatchObject({
      state: "pending",
      spec: { kind: "d6-roll", controllerUserId: "player", fixedDifficulty: 1 },
    });
    await expect(
      wound.processWoundRootOperation(
        { method: "load", rootMessageId: manual.action.rootMessageId },
        player,
      ),
    ).resolves.toEqual(manual);
    expect(f.actor.update).not.toHaveBeenCalled();
    expect(f.state.messages.get(createRequest.rootMessageId)).toBeDefined();
  });

  it("loads manual and earlier pending roots when a valid health snapshot exceeds the identifier limit", async () => {
    const f = fixture();
    const wound = await import("./first-edition-wound-authority");
    wound.registerWoundRootAuthority();
    await wound.requestWoundRoot(createRequest);
    Object.assign(f.actor.system.health, {
      firstEditionWound: "mortally-wounded",
      firstEditionState: { consciousness: "unconscious", mortalityRounds: 0 },
      tracks: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => [
          `inactive-model-${index}`,
          { stateId: "healthy" },
        ]),
      ),
    });
    expect(JSON.stringify(f.actor.system.health).length).toBeGreaterThan(512);
    const player = f.state.users.get("player") as FoundryUser;
    const manual = (await wound.processWoundRootOperation(
      {
        ...createRequest,
        rootMessageId: "X4QNUm6DABBdrloy",
        operation: "manual-mortality",
        minutes: 1,
      },
      player,
    )) as FirstEditionWoundRoot;
    expect(manual.action.stages[0]?.state).toBe("pending");
    await expect(
      wound.processWoundRootOperation(
        { method: "load", rootMessageId: manual.action.rootMessageId },
        player,
      ),
    ).resolves.toEqual(manual);
    const envelope = structuredClone(
      f.settings.get("firstEditionWoundAuthority"),
    );
    await expect(
      wound.processWoundRootOperation(
        { method: "load", rootMessageId: createRequest.rootMessageId },
        f.state.user as FoundryUser,
      ),
    ).resolves.toBeDefined();
    expect(f.settings.get("firstEditionWoundAuthority")).toEqual(envelope);
    await expect(
      wound.processWoundRootOperation(
        { method: "cancel", rootMessageId: createRequest.rootMessageId },
        f.state.user as FoundryUser,
      ),
    ).resolves.toMatchObject({ action: { status: "cancelled" } });
    await expect(
      wound.processWoundRootOperation(
        { method: "load", rootMessageId: manual.action.rootMessageId },
        player,
      ),
    ).resolves.toEqual(manual);
    expect(f.actor.update).not.toHaveBeenCalled();
  });

  it("rejects an oversized new preimage before poisoning the existing encrypted journal", async () => {
    const f = fixture();
    const wound = await import("./first-edition-wound-authority");
    wound.registerWoundRootAuthority();
    const original = await wound.requestWoundRoot(createRequest);
    const envelope = structuredClone(
      f.settings.get("firstEditionWoundAuthority"),
    );
    Object.assign(f.actor.system.health, {
      oversizedSnapshotForTest: "x".repeat(2_000_001),
    });
    await expect(
      wound.requestWoundRoot({
        ...createRequest,
        rootMessageId: "qrstuvwxyzABCDEF",
      }),
    ).rejects.toThrow("invalid");
    expect(f.settings.get("firstEditionWoundAuthority")).toEqual(envelope);
    expect(f.state.messages.get("qrstuvwxyzABCDEF")).toBeUndefined();
    await expect(
      wound.requestWoundRoot({
        method: "load",
        rootMessageId: createRequest.rootMessageId,
      }),
    ).resolves.toEqual(original);
    expect(f.actor.update).not.toHaveBeenCalled();
  });

  it("keeps GM presence alive from the ready socket hook without Destiny gameplay", async () => {
    const f = fixture();
    vi.stubGlobal("window", {});
    const wound = await import("./first-edition-wound-authority");
    const crypto = await import("./destiny-crypto");
    const intervals: (() => void)[] = [];
    vi.spyOn(globalThis, "setInterval").mockImplementation(((
      callback: () => void,
      ms: number,
    ) => {
      expect(ms).toBe(10000);
      intervals.push(callback);
      return 1;
    }) as typeof setInterval);
    wound.registerWoundRootSocket();
    await vi.waitFor(
      () => expect(crypto.destinyClientIsAuthority()).toBe(true),
      { timeout: 10000 },
    );
    wound.registerWoundRootSocket();
    expect(intervals).toHaveLength(1);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 40000);
    expect(crypto.destinyActiveAuthority()).toBeUndefined();
    intervals[0]?.();
    await vi.waitFor(() =>
      expect(crypto.destinyClientIsAuthority()).toBe(true),
    );
    expect(
      normalizeDestinyConfiguration(
        currentConfiguredRulesProfile().homebrew.destiny,
      ).enabled,
    ).toBe(false);
    expect(f.settings.has("firstEditionWoundAuthority")).toBe(false);
    expect(f.actor.update).not.toHaveBeenCalled();
  });

  it("keeps the existing origin-lock requirement before local coordination", async () => {
    const f = fixture(false);
    const crypto = await import("./destiny-crypto");
    const wound = await import("./first-edition-wound-authority");
    await crypto.heartbeatDestinyCrypto();
    expect(crypto.destinyActiveAuthority()?.userId).toBe("gm");
    expect(crypto.destinyClientIsAuthority()).toBe(false);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const result = wound.requestWoundRoot(createRequest);
    const rejection = expect(result).rejects.toThrow(
      "first-edition-action:uncertain",
    );
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
    expect(f.settings.has("firstEditionWoundAuthority")).toBe(false);
    expect(f.state.messages.get(createRequest.rootMessageId)).toBeUndefined();
    expect(f.actor.update).not.toHaveBeenCalled();
  });

  it("does not turn a player without a live GM authority into a coordinator", async () => {
    const f = fixture();
    f.state.user = { id: "player", active: true, isGM: false };
    const wound = await import("./first-edition-wound-authority");
    await expect(wound.requestWoundRoot(createRequest)).rejects.toThrow(
      "first-edition-action:authority",
    );
    expect(f.state.socket.emit).not.toHaveBeenCalled();
    expect(f.settings.has("firstEditionWoundAuthority")).toBe(false);
    expect(f.actor.update).not.toHaveBeenCalled();
  });
});
