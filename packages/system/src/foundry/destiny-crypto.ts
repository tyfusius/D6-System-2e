import { requireDestinyValue } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { foundryRandomId } from "./foundry-random-id";
import { record } from "./sheets/values";

const FLAG = "destinyV1";
export interface DestinyEnvelopeV1 {
  readonly version: 1;
  readonly topic: string;
  readonly keyId: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly recipients: readonly {
    readonly userId: string;
    readonly keyId: string;
    readonly wrappedKey: string;
  }[];
}
interface PublicKey {
  userId: string;
  keyId: string;
  jwk: JsonWebKey;
}
interface LocalKey {
  keyId: string;
  privateKey: CryptoKey;
  publicKey: JsonWebKey;
}
let local: LocalKey | undefined;
let initialization: Promise<void> | undefined;
let presence: FoundryChatMessageDocument | undefined;
let originLock = false;
let acquiring = false;
const keys = new Map<string, CryptoKey>();
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const base64 = (buffer: ArrayBuffer | Uint8Array) => {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let result = "";
  for (const b of view) result += String.fromCharCode(b);
  return btoa(result);
};
function worldId(): string {
  return game.world?.id ?? "world";
}
export function destinyNativeAuthor(
  message: FoundryChatMessageDocument,
): string {
  const m = message as FoundryChatMessageDocument & {
    author?: FoundryUser;
    user?: FoundryUser | string;
  };
  return (
    m.author?.id ?? (typeof m.user === "string" ? m.user : m.user?.id) ?? ""
  );
}
function flag(message: FoundryChatMessageDocument) {
  return record(message.getFlag(SYSTEM_ID, FLAG));
}
export function destinyEnrolledGMIds(): string[] {
  return [
    ...new Set(
      publicKeys()
        .filter((k) => game.users?.get(k.userId)?.isGM)
        .map((k) => k.userId),
    ),
  ];
}
function publicKeys(): PublicKey[] {
  return (game.messages?.contents ?? []).flatMap((message) => {
    const f = flag(message);
    const userId = destinyNativeAuthor(message);
    const jwk = record(f.jwk);
    return f.type === "key" &&
      f.version === 1 &&
      typeof f.keyId === "string" &&
      game.users?.get(userId) &&
      jwk.kty === "RSA" &&
      typeof jwk.n === "string" &&
      jwk.n.length < 1500 &&
      jwk.e === "AQAB"
      ? [{ userId, keyId: f.keyId, jwk: jwk }]
      : [];
  });
}
interface KeyGrant {
  masterKeyId: string;
  userId: string;
  keyId: string;
  wrappedKey: string;
}
const grantSettings = new Set<string>();
function grantSetting(userId: string): string {
  const name = `destinyKeyGrantsV1-${userId}`;
  if (!grantSettings.has(name)) {
    game.settings.register(SYSTEM_ID, name, {
      name: "Destiny encrypted key grants",
      hint: "Durable RSA-wrapped GM ledger key enrollment",
      scope: "world",
      config: false,
      type: Object,
      default: {},
    });
    grantSettings.add(name);
  }
  return name;
}
function durableGrants(envelope: DestinyEnvelopeV1): KeyGrant[] {
  const grantors = new Set([
    ...(game.users?.contents ?? []).map((u) => u.id),
    ...envelope.recipients.map((r) => r.userId),
  ]);
  return [...grantors].flatMap((id) =>
    Object.values(record(game.settings.get(SYSTEM_ID, grantSetting(id)))),
  ) as KeyGrant[];
}
async function registerLocalPresence(): Promise<void> {
  if (!local || !game.user) return;
  if (
    !publicKeys().some(
      (k) =>
        k.userId === requireDestinyValue(game.user).id &&
        k.keyId === requireDestinyValue(local).keyId,
    )
  )
    await ChatMessage.create({
      content: "",
      flags: {
        [SYSTEM_ID]: {
          [FLAG]: {
            type: "key",
            version: 1,
            keyId: local.keyId,
            jwk: local.publicKey,
          },
        },
      },
    });
  if (game.user.isGM && !game.messages?.get(presence?.id ?? ""))
    presence = await ChatMessage.create({
      content: "",
      flags: {
        [SYSTEM_ID]: {
          [FLAG]: { type: "presence", keyId: local.keyId, heartbeat: 0 },
        },
      },
    });
}
export function destinyActiveAuthority():
  { userId: string; keyId: string } | undefined {
  const active = new Set(
    (game.users?.contents ?? [])
      .filter((u) => u.isGM && u.active)
      .map((u) => u.id),
  );
  const available = new Set(
    publicKeys()
      .filter((k) => active.has(k.userId))
      .map((k) => `${k.userId}:${k.keyId}`),
  );
  const candidates = (game.messages?.contents ?? []).flatMap((message) => {
    const f = flag(message);
    const userId = destinyNativeAuthor(message);
    const stats = (
      message as FoundryChatMessageDocument & {
        _stats?: { modifiedTime?: number; createdTime?: number };
      }
    )._stats;
    const touched = stats?.modifiedTime ?? stats?.createdTime ?? 0;
    return f.type === "presence" &&
      f.active !== false &&
      typeof f.keyId === "string" &&
      available.has(`${userId}:${f.keyId}`) &&
      Date.now() - touched < 35000
      ? [{ userId, keyId: f.keyId }]
      : [];
  });
  return candidates.sort(
    (a, b) =>
      a.userId.localeCompare(b.userId) || a.keyId.localeCompare(b.keyId),
  )[0];
}
export function destinyClientIsAuthority(): boolean {
  const active = destinyActiveAuthority();
  return Boolean(
    originLock &&
    local &&
    game.user?.isGM &&
    active?.userId === game.user.id &&
    active.keyId === local.keyId,
  );
}
function acquireOriginLock(): void {
  if (originLock || acquiring || !game.user?.isGM) return;
  if (!(navigator as { locks?: LockManager }).locks)
    throw new Error("D6E2.Destiny.Error.SecureStorageUnavailable");
  acquiring = true;
  void navigator.locks
    .request(
      `d6-destiny:${worldId()}:${game.user.id}`,
      { ifAvailable: true },
      async (lock) => {
        acquiring = false;
        if (!lock) return;
        originLock = true;
        await new Promise<void>(() => {
          return undefined;
        }); // Browser releases the lock when this tab closes.
      },
    )
    .catch(() => {
      acquiring = false;
      originLock = false;
    });
}
export async function initializeDestinyCrypto(): Promise<void> {
  initialization ??= (async () => {
    if (!(crypto as { subtle?: SubtleCrypto }).subtle || !game.user)
      throw new Error("D6E2.Destiny.Error.SecureStorageUnavailable");
    const storage = `d6-destiny-key-v1:${worldId()}:${game.user.id}`;
    let saved: Record<string, unknown>;
    try {
      const raw = localStorage.getItem(storage);
      saved = raw ? record(JSON.parse(raw)) : {};
    } catch {
      throw new Error("D6E2.Destiny.Error.SecureStorageUnavailable");
    }
    if (!saved.privateKey) {
      const pair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 3072,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );
      saved = {
        version: 1,
        keyId: foundryRandomId(),
        privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
        publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
      };
      try {
        localStorage.setItem(storage, JSON.stringify(saved));
      } catch {
        throw new Error("D6E2.Destiny.Error.SecureStorageUnavailable");
      }
    }
    if (saved.version !== 1 || typeof saved.keyId !== "string")
      throw new Error("D6E2.Destiny.Error.SecureStorageUnavailable");
    local = {
      keyId: saved.keyId,
      publicKey: saved.publicKey as JsonWebKey,
      privateKey: await crypto.subtle.importKey(
        "jwk",
        saved.privateKey as JsonWebKey,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"],
      ),
    };
    acquireOriginLock();
    await registerLocalPresence();
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
export async function heartbeatDestinyCrypto(): Promise<void> {
  await initializeDestinyCrypto();
  acquireOriginLock();
  await registerLocalPresence();
  if (presence && game.user?.isGM)
    await presence.update({
      [`flags.${SYSTEM_ID}.${FLAG}.heartbeat`]: Date.now(),
    });
}
async function wrap(key: CryptoKey, recipient: PublicKey): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    recipient.jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  return base64(
    await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      await crypto.subtle.exportKey("raw", key),
    ),
  );
}
async function unwrap(wrapped: string): Promise<CryptoKey> {
  if (!local) throw new Error("D6E2.Destiny.Error.KeyUnavailable");
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    local.privateKey,
    bytes(wrapped),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}
async function envelopeKey(envelope: DestinyEnvelopeV1): Promise<CryptoKey> {
  await initializeDestinyCrypto();
  const cached = keys.get(envelope.keyId);
  if (cached) return cached;
  const capsule = envelope.recipients.find(
    (r) => r.userId === game.user?.id && r.keyId === local?.keyId,
  );
  if (!capsule && envelope.topic.startsWith("outbox:")) {
    const raw = localStorage.getItem(
      `d6-destiny-retired-keys-v1:${worldId()}:${game.user?.id}`,
    );
    const retired = raw ? record(JSON.parse(raw)) : {};
    const older = envelope.recipients.find(
      (r) => r.userId === game.user?.id && retired[r.keyId],
    );
    if (older) {
      const previous = local;
      try {
        const saved = record(retired[older.keyId]);
        local = {
          keyId: older.keyId,
          publicKey: saved.publicKey as JsonWebKey,
          privateKey: await crypto.subtle.importKey(
            "jwk",
            saved.privateKey as JsonWebKey,
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["decrypt"],
          ),
        };
        const key = await unwrap(older.wrappedKey);
        keys.set(envelope.keyId, key);
        return key;
      } finally {
        local = previous;
      }
    }
  }
  let wrapped = capsule?.wrappedKey;
  if (!wrapped && game.user?.isGM) {
    const grant = durableGrants(envelope).find(
      (g) =>
        g.masterKeyId === envelope.keyId &&
        g.keyId === local?.keyId &&
        g.userId === game.user?.id,
    );
    if (grant) wrapped = grant.wrappedKey;
  }
  if (!wrapped) throw new Error("D6E2.Destiny.Error.KeyUnavailable");
  const key = await unwrap(wrapped);
  keys.set(envelope.keyId, key);
  return key;
}
/** Pure envelope bytes are safe to broadcast; private fields never enter document flags. */
export async function sealDestiny(
  topic: string,
  payload: unknown,
  userIds: readonly string[],
  previous?: DestinyEnvelopeV1,
  authorityOnly = false,
): Promise<DestinyEnvelopeV1> {
  await initializeDestinyCrypto();
  const eligible = publicKeys().filter(
    (k) =>
      userIds.includes(k.userId) &&
      (!authorityOnly ||
        k.userId === game.user?.id ||
        k.keyId === destinyActiveAuthority()?.keyId),
  );
  if (userIds.some((id) => !eligible.some((k) => k.userId === id)))
    throw new Error("D6E2.Destiny.Error.KeyEnrollmentRequired");
  // Rotate a ledger key when a former GM is no longer an authorized recipient.
  const priorGrantees = previous
    ? durableGrants(previous)
        .filter((g) => g.masterKeyId === previous.keyId)
        .map((g) => g.userId)
    : [];
  const rotate =
    previous &&
    (previous.recipients.some((r) => !userIds.includes(r.userId)) ||
      priorGrantees.some((id) => !userIds.includes(id)));
  const key =
    previous && !rotate
      ? await envelopeKey(previous)
      : await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
  const keyId = previous && !rotate ? previous.keyId : foundryRandomId();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`${topic}:${keyId}`),
    },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const recipients = await Promise.all(
    eligible.map(async (r) => ({
      userId: r.userId,
      keyId: r.keyId,
      wrappedKey: await wrap(key, r),
    })),
  );
  keys.set(keyId, key);
  return {
    version: 1,
    topic,
    keyId,
    iv: base64(iv),
    ciphertext: base64(ciphertext),
    recipients,
  };
}
export async function openDestinyEnvelope<T>(
  topic: string,
  value: unknown,
): Promise<T> {
  const envelope = value as DestinyEnvelopeV1;
  if (
    (value as { version?: unknown } | null)?.version !== 1 ||
    envelope.topic !== topic ||
    typeof envelope.ciphertext !== "string" ||
    !Array.isArray(envelope.recipients)
  )
    throw new Error("D6E2.Destiny.Error.Version");
  try {
    const key = await envelopeKey(envelope);
    const raw = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(envelope.iv),
        additionalData: new TextEncoder().encode(`${topic}:${envelope.keyId}`),
      },
      key,
      bytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(raw)) as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("D6E2."))
      throw error;
    throw new Error("D6E2.Destiny.Error.EnvelopeInvalid");
  }
}
/** Any already-enrolled GM may admit another authenticated GM device. This
 * grants the ledger key only; it cannot replace or roll back ledger state. */
export async function grantDestinyLedgerKeys(value: unknown): Promise<void> {
  if (!game.user?.isGM) return;
  const envelope = value as DestinyEnvelopeV1;
  if ((value as { version?: unknown } | null)?.version !== 1) return;
  await initializeDestinyCrypto();
  if (!originLock) return;
  let key: CryptoKey;
  try {
    key = await envelopeKey(envelope);
  } catch {
    return;
  }
  const additions: Record<string, KeyGrant> = {};
  for (const recipient of publicKeys().filter(
    (k) => game.users?.get(k.userId)?.isGM,
  )) {
    if (
      envelope.recipients.some(
        (r) => r.keyId === recipient.keyId && r.userId === recipient.userId,
      )
    )
      continue;
    if (
      durableGrants(envelope).some(
        (g) =>
          g.masterKeyId === envelope.keyId &&
          g.keyId === recipient.keyId &&
          g.userId === recipient.userId,
      )
    )
      continue;
    const wrappedKey = await wrap(key, recipient);
    if (!game.users?.get(recipient.userId)?.isGM) continue;
    additions[`${envelope.keyId}:${recipient.userId}:${recipient.keyId}`] = {
      masterKeyId: envelope.keyId,
      userId: recipient.userId,
      keyId: recipient.keyId,
      wrappedKey,
    };
  }
  for (const [id, grant] of Object.entries(additions))
    if (!game.users?.get(grant.userId)?.isGM)
      Reflect.deleteProperty(additions, id);
  if (!game.users?.get(game.user.id)?.isGM) return;
  if (Object.keys(additions).length) {
    const setting = grantSetting(game.user.id);
    await game.settings.set(SYSTEM_ID, setting, {
      ...record(game.settings.get(SYSTEM_ID, setting)),
      ...additions,
    });
  }
}

async function backupKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (passphrase.length < 12)
    throw new Error("D6E2.Destiny.Error.BackupPassphrase");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 210000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function exportDestinyRecoveryKey(
  passphrase: string,
): Promise<string> {
  await initializeDestinyCrypto();
  if (!game.user?.isGM) throw new Error("D6E2.Destiny.Error.GMRequired");
  const saved = localStorage.getItem(
    `d6-destiny-key-v1:${worldId()}:${game.user.id}`,
  );
  if (!saved) throw new Error("D6E2.Destiny.Error.KeyUnavailable");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await backupKey(passphrase, salt);
  const binding = `${worldId()}:${game.user.id}`;
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(binding) },
    key,
    new TextEncoder().encode(saved),
  );
  return JSON.stringify({
    version: 1,
    worldId: worldId(),
    userId: game.user.id,
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(encrypted),
  });
}
export async function importDestinyRecoveryKey(
  source: string,
  passphrase: string,
): Promise<void> {
  if (!game.user?.isGM) throw new Error("D6E2.Destiny.Error.GMRequired");
  if (source.length > 20000)
    throw new Error("D6E2.Destiny.Error.BackupInvalid");
  try {
    const value = record(JSON.parse(source));
    if (
      value.version !== 1 ||
      value.worldId !== worldId() ||
      value.userId !== game.user.id
    )
      throw new Error("binding");
    const key = await backupKey(passphrase, bytes(String(value.salt)));
    const binding = `${worldId()}:${game.user.id}`;
    const decoded = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(String(value.iv)),
        additionalData: new TextEncoder().encode(binding),
      },
      key,
      bytes(String(value.ciphertext)),
    );
    const saved = record(JSON.parse(new TextDecoder().decode(decoded)));
    if (saved.version !== 1 || typeof saved.keyId !== "string")
      throw new Error("version");
    await crypto.subtle.importKey(
      "jwk",
      saved.privateKey as JsonWebKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
    if (presence)
      await presence.update({ [`flags.${SYSTEM_ID}.${FLAG}.active`]: false });
    presence = undefined;
    const storage = `d6-destiny-key-v1:${worldId()}:${game.user.id}`;
    const existing = localStorage.getItem(storage);
    if (existing) {
      const old = record(JSON.parse(existing));
      if (old.keyId !== saved.keyId && typeof old.keyId === "string") {
        const retiredKey = `d6-destiny-retired-keys-v1:${worldId()}:${game.user.id}`;
        const retired = record(
          JSON.parse(localStorage.getItem(retiredKey) ?? "{}"),
        );
        localStorage.setItem(
          retiredKey,
          JSON.stringify({ ...retired, [old.keyId]: old }),
        );
      }
    }
    localStorage.setItem(storage, JSON.stringify(saved));
    local = undefined;
    initialization = undefined;
    keys.clear();
    await initializeDestinyCrypto();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "D6E2.Destiny.Error.BackupPassphrase"
    )
      throw error;
    throw new Error("D6E2.Destiny.Error.BackupInvalid");
  }
}
