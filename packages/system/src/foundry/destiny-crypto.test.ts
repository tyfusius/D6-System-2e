import { requireDestinyValue } from "@d6-system-2e/core";
import { beforeEach, describe, it, expect, vi } from "vitest";
function storage() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
    removeItem: (key: string) => {
      Reflect.deleteProperty(values, key);
    },
  };
}
function fixture() {
  const users = [
    { id: "gm", name: "GM", isGM: true, active: true },
    { id: "backup", name: "Backup", isGM: true, active: true },
    { id: "player", name: "Player", isGM: false, active: true },
  ];
  const messages: FoundryChatMessageDocument[] = [];
  let sequence = 0;
  const locks = new Set<string>();
  const stores = new Map(users.map((u) => [u.id, storage()]));
  const settings = new Map<string, unknown>();
  const gameState = {
    settings: {
      register: (_s: string, k: string, o: { default: unknown }) => {
        if (!settings.has(k)) settings.set(k, o.default);
      },
      get: (_s: string, k: string) => settings.get(k),
      set: async (_s: string, k: string, v: unknown) => {
        await Promise.resolve();
        settings.set(k, structuredClone(v));
      },
    },
    world: { id: "world" },
    user: users[0],
    users: {
      contents: users,
      get: (id: string) => users.find((u) => u.id === id),
    },
    messages: {
      contents: messages,
      get: (id: string) => messages.find((m) => m.id === id),
    },
  };
  vi.stubGlobal("game", gameState);
  vi.stubGlobal("localStorage", stores.get("gm"));
  vi.stubGlobal("foundry", { utils: { randomID: () => `key-${++sequence}` } });
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        name: string,
        _options: unknown,
        callback: (lock: unknown) => Promise<void>,
      ) => {
        await Promise.resolve();
        if (locks.has(name)) return callback(null);
        locks.add(name);
        return callback({ name });
      },
    },
  });
  vi.stubGlobal("ChatMessage", {
    create: async (source: Record<string, unknown>) => {
      await Promise.resolve();
      const data = structuredClone(source);
      const author = requireDestinyValue(gameState.user);
      const message = {
        id: `message-${++sequence}`,
        author,
        _stats: { createdTime: Date.now(), modifiedTime: Date.now() },
        getFlag: (s: string, k: string) =>
          (data.flags as Record<string, Record<string, unknown>>)[s]?.[k],
        update: async (changes: Record<string, unknown>) => {
          await Promise.resolve();
          for (const [path, value] of Object.entries(changes)) {
            const parts = path.split(".");
            let target = data;
            for (const part of parts.slice(0, -1))
              target = target[part] as Record<string, unknown>;
            target[requireDestinyValue(parts.at(-1))] = value;
          }
          message._stats.modifiedTime = Date.now();
        },
      };
      messages.push(message as unknown as FoundryChatMessageDocument);
      return message;
    },
  });
  return {
    users,
    messages,
    settings,
    select: (id: string) => {
      gameState.user = users.find((u) => u.id === id);
      vi.stubGlobal("localStorage", stores.get(id));
    },
  };
}
async function client() {
  await Promise.resolve();
  vi.resetModules();
  return import("./destiny-crypto");
}
describe("Destiny confidential persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("keeps ledger plaintext off broadcast envelopes and rejects nonrecipients and tampering", async () => {
    const f = fixture();
    const gm = await client();
    await gm.initializeDestinyCrypto();
    const envelope = await gm.sealDestiny(
      "ledger",
      { privateStory: "unpublished preparation", privateRoll: 17 },
      ["gm"],
    );
    expect(JSON.stringify(envelope)).not.toContain("unpublished preparation");
    expect(JSON.stringify(envelope)).not.toContain("privateRoll");
    expect(await gm.openDestinyEnvelope("ledger", envelope)).toMatchObject({
      privateRoll: 17,
    });
    await expect(
      gm.openDestinyEnvelope("wrong-topic", envelope),
    ).rejects.toThrow("Version");
    await expect(
      gm.openDestinyEnvelope("ledger", {
        ...envelope,
        ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA",
      }),
    ).rejects.toThrow("EnvelopeInvalid");
    f.select("player");
    const player = await client();
    await player.initializeDestinyCrypto();
    await expect(
      player.openDestinyEnvelope("ledger", envelope),
    ).rejects.toThrow("KeyUnavailable");
  });
  it("grants a new GM device access without rewriting state and rotates after grant→demotion", async () => {
    const f = fixture();
    const gm = await client();
    await gm.initializeDestinyCrypto();
    const first = await gm.sealDestiny("ledger", { secret: "before" }, ["gm"]);
    f.select("backup");
    const backup = await client();
    await backup.initializeDestinyCrypto();
    f.select("gm");
    await gm.grantDestinyLedgerKeys(first);
    f.select("backup");
    expect(await backup.openDestinyEnvelope("ledger", first)).toEqual({
      secret: "before",
    });
    requireDestinyValue(f.users.find((u) => u.id === "backup")).isGM = false;
    f.select("gm");
    const next = await gm.sealDestiny(
      "ledger",
      { secret: "after" },
      ["gm"],
      first,
    );
    expect(next.keyId).not.toBe(first.keyId);
    f.select("backup");
    await expect(backup.openDestinyEnvelope("ledger", next)).rejects.toThrow(
      "KeyUnavailable",
    );
  });
  it("retains the local key across reload and makes password-protected recovery backups", async () => {
    fixture();
    const gm = await client();
    await gm.initializeDestinyCrypto();
    const envelope = await gm.sealDestiny("ledger", { value: "durable" }, [
      "gm",
    ]);
    const backup = await gm.exportDestinyRecoveryKey(
      "a sufficiently long test phrase",
    );
    expect(backup).not.toContain("privateKey");
    const reloaded = await client();
    await reloaded.initializeDestinyCrypto();
    expect(await reloaded.openDestinyEnvelope("ledger", envelope)).toEqual({
      value: "durable",
    });
    await expect(
      reloaded.importDestinyRecoveryKey(backup, "a different long test phrase"),
    ).rejects.toThrow("BackupInvalid");
    await reloaded.importDestinyRecoveryKey(
      backup,
      "a sufficiently long test phrase",
    );
    expect(await reloaded.openDestinyEnvelope("ledger", envelope)).toEqual({
      value: "durable",
    });
  });
  it("retains encrypted ledger, exact dice claims and receipts through clear-chat and a GM reload", async () => {
    const f = fixture();
    const gm = await client();
    await gm.initializeDestinyCrypto();
    const { DestinyLedger, DESTINY_ROOT_SETTING } =
      await import("./destiny-ledger");
    let revision = 0;
    const ledger = new DestinyLedger(
      () => {
        return undefined;
      },
      () => revision,
    );
    const initial = await ledger.read();
    const state = {
      ...initial,
      revision: 1,
      receipts: { request: { userId: "gm", command: "private exact command" } },
      temptations: {
        activation: {
          id: "activation",
          actorId: "actor",
          userId: "player",
          frameworkId: "force",
          resourceRoleId: "dark",
          ownerId: "companion",
          sessionId: "session",
          poolRevision: 1,
          faces: ["dark", "dark", "dark"] as const,
          status: "rolling" as const,
          diceClaimed: true,
          diceArtifact: "private original die",
        },
      },
    };
    await ledger.write(state, 0);
    revision = 1;
    const before = JSON.stringify(f.settings.get(DESTINY_ROOT_SETTING));
    expect(before).not.toContain("private");
    f.select("backup");
    const backup = await client();
    await backup.initializeDestinyCrypto();
    f.select("gm");
    await gm.grantDestinyLedgerKeys(f.settings.get(DESTINY_ROOT_SETTING));
    f.messages.splice(0); // Native delete-all ChatMessage equivalent.
    f.select("backup");
    const reloaded = await client();
    await reloaded.initializeDestinyCrypto();
    const { DestinyLedger: ReloadedLedger } = await import("./destiny-ledger");
    const recovered = new ReloadedLedger(
      () => {
        return undefined;
      },
      () => revision,
    );
    expect(await recovered.read()).toEqual(state);
    expect(JSON.stringify(f.settings.get(DESTINY_ROOT_SETTING))).toBe(before);
    await expect(recovered.write({ ...state, revision: 2 }, 0)).rejects.toThrow(
      "RevisionConflict",
    );
    f.settings.delete(DESTINY_ROOT_SETTING);
    await expect(recovered.read()).rejects.toThrow("AuthorityMissing");
  });
  it("re-registers deleted local key and presence records without changing the local key", async () => {
    const f = fixture();
    const gm = await client();
    await gm.heartbeatDestinyCrypto();
    const first = gm.destinyActiveAuthority();
    expect(first?.userId).toBe("gm");
    f.messages.splice(0);
    await gm.heartbeatDestinyCrypto();
    expect(gm.destinyActiveAuthority()).toEqual(first);
    const message = f.messages.find(
      (m) =>
        (m.getFlag("d6-system-2e", "destinyV1") as { type: string }).type ===
        "presence",
    ) as unknown as { _stats: { modifiedTime: number } };
    message._stats.modifiedTime = Date.now() - 40000;
    expect(gm.destinyActiveAuthority()).toBeUndefined();
  });
  it("keeps the current browser outbox readable when importing an older recovery key", async () => {
    const f = fixture();
    const first = await client();
    await first.initializeDestinyCrypto();
    const backup = await first.exportDestinyRecoveryKey(
      "a sufficiently long test phrase",
    );
    localStorage.removeItem("d6-destiny-key-v1:world:gm");
    const replacement = await client();
    await replacement.initializeDestinyCrypto();
    const outbox = await replacement.sealDestiny(
      "outbox:exact",
      { id: "exact", roll: "already rolled" },
      ["gm"],
    );
    await replacement.importDestinyRecoveryKey(
      backup,
      "a sufficiently long test phrase",
    );
    const reloaded = await client();
    expect(await reloaded.openDestinyEnvelope("outbox:exact", outbox)).toEqual({
      id: "exact",
      roll: "already rolled",
    });
    requireDestinyValue(f.users[0]).isGM = false;
    await expect(
      reloaded.exportDestinyRecoveryKey("a sufficiently long test phrase"),
    ).rejects.toThrow("GMRequired");
  });

  it("regains authority immediately after importing a recovery key without a reload", async () => {
    fixture();
    const gm = await client();
    await gm.heartbeatDestinyCrypto();
    expect(gm.destinyClientIsAuthority()).toBe(true);
    const backup = await gm.exportDestinyRecoveryKey(
      "a sufficiently long test phrase",
    );
    await gm.importDestinyRecoveryKey(
      backup,
      "a sufficiently long test phrase",
    );
    await gm.heartbeatDestinyCrypto();
    expect(gm.destinyClientIsAuthority()).toBe(true);
  });

  it("does not persist a private revision if a recipient is demoted during encryption", async () => {
    const f = fixture();
    const gm = await client();
    await gm.initializeDestinyCrypto();
    f.select("backup");
    const backup = await client();
    await backup.initializeDestinyCrypto();
    f.select("gm");
    const { DestinyLedger, DESTINY_ROOT_SETTING } =
      await import("./destiny-ledger");
    const ledger = new DestinyLedger(
      () => {
        return undefined;
      },
      () => 0,
    );
    const state = await ledger.read();
    const before = structuredClone(f.settings.get(DESTINY_ROOT_SETTING));
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let intercepted = false;
    vi.spyOn(crypto.subtle, "encrypt").mockImplementation(async (...args) => {
      await Promise.resolve();
      if (!intercepted) {
        intercepted = true;
        requireDestinyValue(f.users.find((u) => u.id === "backup")).isGM =
          false;
      }
      return encrypt(...args);
    });
    await expect(ledger.write({ ...state, revision: 1 }, 0)).rejects.toThrow(
      "KeyEnrollmentRequired",
    );
    expect(f.settings.get(DESTINY_ROOT_SETTING)).toEqual(before);
    await ledger.write({ ...state, revision: 1 }, 0);
    expect(
      (f.settings.get(DESTINY_ROOT_SETTING) as { keyId: string }).keyId,
    ).not.toBe((before as { keyId: string }).keyId);
  });
});
