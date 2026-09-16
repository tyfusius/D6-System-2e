import {
  requireDestinyValue,
  normalizeDestinyConfiguration,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FirstEditionBodyPointRoot } from "../application/first-edition-body-point-root";

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
    ["firstEditionBodyPoints", "body-points"],
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
        firstEditionBodyPoints: { current: 19, maximum: 20 },
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
  restModifierScore: 0,
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

describe("Body Point authority with Destiny disabled (real crypto)", () => {
  it("initializes GM authority on demand, seals bindings and creates a private pending root", async () => {
    const f = fixture();
    const crypto = await import("./destiny-crypto");
    const wound = await import("./first-edition-body-point-authority");
    wound.registerBodyPointRootAuthority();
    expect(crypto.destinyActiveAuthority()).toBeUndefined();
    expect(
      normalizeDestinyConfiguration(
        currentConfiguredRulesProfile().homebrew.destiny,
      ).enabled,
    ).toBe(false);
    const root = (await wound.requestBodyPointRoot(
      createRequest,
    )) as FirstEditionBodyPointRoot;
    expect(crypto.destinyClientIsAuthority()).toBe(true);
    expect(root.action.status).toBe("open");
    expect(root.action.stages[0]?.state).toBe("pending");
    const envelope = f.settings.get("firstEditionBodyPointAuthority");
    expect(JSON.stringify(envelope)).not.toContain("Actor.patient");
    expect(
      await crypto.openDestinyEnvelope(
        "firstEditionBodyPointAuthority",
        envelope,
      ),
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
    const reloaded = await wound.requestBodyPointRoot({
      method: "load",
      rootMessageId: createRequest.rootMessageId,
    });
    expect(reloaded).toEqual(root);
    expect(crypto.destinyClientIsAuthority()).toBe(true);
  });

  it("keeps the existing origin-lock requirement before local coordination", async () => {
    const f = fixture(false);
    const crypto = await import("./destiny-crypto");
    const wound = await import("./first-edition-body-point-authority");
    await crypto.heartbeatDestinyCrypto();
    expect(crypto.destinyActiveAuthority()?.userId).toBe("gm");
    expect(crypto.destinyClientIsAuthority()).toBe(false);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const result = wound.requestBodyPointRoot(createRequest);
    const rejection = expect(result).rejects.toThrow(
      "first-edition-action:uncertain",
    );
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
    expect(f.settings.has("firstEditionBodyPointAuthority")).toBe(false);
    expect(f.state.messages.get(createRequest.rootMessageId)).toBeUndefined();
    expect(f.actor.update).not.toHaveBeenCalled();
  });

  it("does not turn a player without a live GM authority into a coordinator", async () => {
    const f = fixture();
    f.state.user = { id: "player", active: true, isGM: false };
    const wound = await import("./first-edition-body-point-authority");
    await expect(wound.requestBodyPointRoot(createRequest)).rejects.toThrow(
      "first-edition-action:authority",
    );
    expect(f.state.socket.emit).not.toHaveBeenCalled();
    expect(f.settings.has("firstEditionBodyPointAuthority")).toBe(false);
    expect(f.actor.update).not.toHaveBeenCalled();
  });
});
