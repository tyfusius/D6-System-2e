import type {
  D6CombatCommandResultV1,
  D6CombatGridProjectionV1,
  D6CombatantRoundReadModelV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  destinyActiveAuthority,
  destinyClientIsAuthority,
  destinyEnrolledGMIds,
  grantDestinyLedgerKeys,
  heartbeatDestinyCrypto,
  initializeDestinyCrypto,
  openDestinyEnvelope,
  sealDestiny,
  type DestinyEnvelopeV1,
} from "./destiny-crypto";

export interface GridCombatant {
  readonly id: string;
  readonly hidden?: boolean;
  readonly defeated?: boolean;
  readonly name?: string;
  readonly img?: string;
  readonly initiative?: number | null;
  readonly actor?: FoundryActorDocument | null;
  readonly token?: {
    readonly uuid: string;
    readonly parent?: { readonly id: string; readonly uuid: string };
  } | null;
  readonly parent?: { readonly id: string };
  getFlag(scope: string, key: string): unknown;
  update(changes: Record<string, unknown>): Promise<unknown>;
}
export interface GridCombat {
  readonly id: string;
  readonly name?: string;
  readonly round?: number;
  readonly combatants: {
    readonly contents: readonly GridCombatant[];
    get?(id: string): GridCombatant | undefined;
  };
  readonly turns?: readonly GridCombatant[];
}
interface PrivateRound {
  readonly privateRound: number;
  readonly round: number;
  readonly envelope: DestinyEnvelopeV1;
}
export interface PrivateCombatCommand {
  readonly kind:
    | "declare"
    | "spend"
    | "defense"
    | "movement"
    | "reset"
    | "hold"
    | "clear-hold"
    | "cancel";
  readonly actorId: string;
  readonly combatantId: string;
  readonly revision: number;
  readonly data?: unknown;
}
export interface PrivateMovementRootCommand {
  readonly kind: "relative-movement-root";
  readonly actorId: string;
  readonly combatantId: string;
  readonly revision: number;
  readonly data: unknown;
}
let movementRootExecutor:
  | ((
      command: PrivateMovementRootCommand,
      user: FoundryUser,
    ) => Promise<unknown>)
  | undefined;
export function registerPrivateMovementRootExecutor(
  execute: NonNullable<typeof movementRootExecutor>,
): void {
  movementRootExecutor = execute;
}
interface ProjectionReply {
  readonly grid: D6CombatGridProjectionV1;
  readonly owned: Readonly<Record<string, D6CombatantRoundReadModelV1>>;
}
export const PRIVATE_COMBAT_AUTHORITY = Symbol("private-combat-authority");
const channel = `system.${SYSTEM_ID}`;
const cache = new Map<string, { signature: string; value: unknown }>();
const owned = new Map<string, D6CombatantRoundReadModelV1>();
let lastGrid: D6CombatGridProjectionV1 | undefined;
let lastCombatId: string | undefined;
type PrivateCombatExecutor = (
  command: PrivateCombatCommand,
  user: FoundryUser,
) => Promise<D6CombatCommandResultV1>;
let projector: ((user: FoundryUser) => ProjectionReply) | undefined;
let tail: Promise<unknown> = Promise.resolve();
const pending = new Map<
  string,
  {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
const subscribers = new Set<() => void>();
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function activeGridCombat(): GridCombat | undefined {
  return (game as FoundryGame & { combat?: GridCombat }).combat;
}
function privateRound(value: unknown): value is PrivateRound {
  return record(value).privateRound !== undefined;
}
// Foundry may reconstruct unchanged flag objects during document preparation.
// Cache immutable encrypted content, not object identity (or a mutable alias).
function roundSignature(value: unknown): string {
  return JSON.stringify(value);
}
function cacheKey(c: GridCombatant): string {
  return `${c.parent?.id ?? activeGridCombat()?.id}:${c.id}`;
}
export function combatHasPrivateQueues(): boolean {
  return Boolean(
    activeGridCombat()?.combatants.contents.some(
      (c) =>
        c.hidden === true || privateRound(c.getFlag(SYSTEM_ID, "roundAction")),
    ),
  );
}
export function onCombatGridChange(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
function notify(): void {
  for (const fn of subscribers) fn();
}
export function combatGridCachedProjection():
  D6CombatGridProjectionV1 | undefined {
  return lastCombatId === activeGridCombat()?.id &&
    lastGrid?.round === activeGridCombat()?.round
    ? lastGrid
    : undefined;
}
export function readConfidentialRound(c: GridCombatant, raw: unknown): unknown {
  if (!privateRound(raw)) return raw;
  if (raw.privateRound !== 1)
    throw new Error("D6E2.Combat.RoundGrid.unknownVersion");
  if (game.user?.isGM) {
    const entry = cache.get(cacheKey(c));
    if (entry?.signature !== roundSignature(raw))
      throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
    return entry.value;
  }
  const value = c.actor ? owned.get(c.id) : undefined;
  return lastCombatId === activeGridCombat()?.id &&
    value?.round === activeGridCombat()?.round
    ? value
    : undefined;
}
function topic(c: GridCombatant, round: number): string {
  return `combat-round:${c.parent?.id ?? activeGridCombat()?.id}:${c.id}:${round}`;
}
export function replaceRoundFlag(
  c: GridCombatant,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const prefix = `flags.${SYSTEM_ID}.roundAction`;
  const old = record(c.getFlag(SYSTEM_ID, "roundAction"));
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(old))
    if (!(key in value)) changes[`${prefix}.-=${key}`] = null;
  for (const [key, item] of Object.entries(value))
    changes[`${prefix}.${key}`] = item;
  return changes;
}
export function confidentialMovementReceipt(
  c: GridCombatant,
  key: string,
): unknown {
  const source = record(
    readConfidentialRound(c, c.getFlag(SYSTEM_ID, "roundAction")),
  );
  return record(source.relativeMovementReceipts)[key];
}
/** Retain authority-only root provenance without spending an action or changing
 * the round revision. Runs inside the existing private command queue. */
export async function bindConfidentialMovementRoot(
  c: GridCombatant,
  key: string,
  value: unknown,
): Promise<void> {
  if (confidentialMovementReceipt(c, key) !== undefined)
    throw new Error("D6E2.Combat.RoundGrid.staleState");
  const state = readConfidentialRound(c, c.getFlag(SYSTEM_ID, "roundAction"));
  if (
    !state ||
    !(await persistConfidentialRound(c, record(state), { key, value }))
  )
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
}
export async function persistConfidentialRound(
  c: GridCombatant,
  state: Record<string, unknown>,
  movementReceipt?: { readonly key: string; readonly value: unknown },
): Promise<boolean> {
  const previous = c.getFlag(SYSTEM_ID, "roundAction");
  const previousSignature = roundSignature(previous);
  if (!c.hidden && !privateRound(previous)) {
    if (movementReceipt)
      throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
    return false;
  }
  if (!destinyClientIsAuthority())
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
  const recipients = destinyEnrolledGMIds()
    .filter((id) => game.users?.get(id)?.isGM)
    .sort();
  const currentUserId = game.user?.id;
  if (!currentUserId || !recipients.includes(currentUserId))
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
  const priorReceipts = record(
    record(readConfidentialRound(c, previous)).relativeMovementReceipts,
  );
  if (
    movementReceipt &&
    Object.keys(priorReceipts).length >= 1024 &&
    !(movementReceipt.key in priorReceipts)
  )
    throw new Error("D6E2.Combat.RoundGrid.invalidState");
  const receipts = movementReceipt
    ? { ...priorReceipts, [movementReceipt.key]: movementReceipt.value }
    : priorReceipts;
  const snapshot: Record<string, unknown> = structuredClone({
    ...state,
    ...(Object.keys(receipts).length
      ? { relativeMovementReceipts: receipts }
      : {}),
  });
  const round = Number(snapshot.round);
  const envelope = await sealDestiny(
    topic(c, round),
    snapshot,
    recipients,
    privateRound(previous) && previous.round === round
      ? previous.envelope
      : undefined,
  );
  if (!destinyClientIsAuthority())
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
  if (roundSignature(c.getFlag(SYSTEM_ID, "roundAction")) !== previousSignature)
    throw new Error("D6E2.Combat.RoundGrid.staleState");
  await c.update(replaceRoundFlag(c, { privateRound: 1, round, envelope }));
  cache.set(cacheKey(c), {
    signature: roundSignature(c.getFlag(SYSTEM_ID, "roundAction")),
    value: snapshot,
  });
  return true;
}
/** Ordered V0 plaintext -> V1 sealed compatibility upgrade. Encryption finishes
 * before the old flag is replaced, and missing keys never erase the source. */
export async function hydratePrivateCombat(): Promise<void> {
  const active = activeGridCombat();
  const combats =
    (game as FoundryGame & { combats?: { contents: readonly GridCombat[] } })
      .combats?.contents ?? (active ? [active] : []);
  const combatants = combats.flatMap((c) => c.combatants.contents);
  if (
    !game.user?.isGM ||
    !combatants.some(
      (c) =>
        c.hidden === true || privateRound(c.getFlag(SYSTEM_ID, "roundAction")),
    )
  )
    return;
  await initializeDestinyCrypto();
  await heartbeatDestinyCrypto();
  for (const c of combatants) {
    const raw = c.getFlag(SYSTEM_ID, "roundAction");
    if (privateRound(raw)) {
      if (raw.privateRound !== 1)
        throw new Error("D6E2.Combat.RoundGrid.unknownVersion");
      await grantDestinyLedgerKeys(raw.envelope);
      const signature = roundSignature(raw);
      if (cache.get(cacheKey(c))?.signature !== signature) {
        const value = await openDestinyEnvelope(
          topic(c, raw.round),
          raw.envelope,
        );
        if (
          record(value).contractVersion !== 2 ||
          record(value).round !== raw.round
        )
          throw new Error("D6E2.Combat.RoundGrid.unknownVersion");
        if (roundSignature(c.getFlag(SYSTEM_ID, "roundAction")) !== signature)
          throw new Error("D6E2.Combat.RoundGrid.staleState");
        cache.set(cacheKey(c), { signature, value });
      }
    } else if (
      c.hidden &&
      Object.keys(record(raw)).length &&
      destinyClientIsAuthority()
    ) {
      if (
        record(raw).contractVersion !== 2 ||
        !Number.isSafeInteger(record(raw).round)
      )
        throw new Error("D6E2.Combat.RoundGrid.unknownVersion");
      await persistConfidentialRound(c, record(raw));
    }
  }
}
function applyProjection(reply: ProjectionReply): void {
  owned.clear();
  for (const [id, state] of Object.entries(reply.owned)) owned.set(id, state);
  lastGrid = reply.grid;
  lastCombatId = activeGridCombat()?.id;
}
async function request(
  kind:
    "combat-grid-read" | "combat-grid-command" | "combat-grid-movement-root",
  command?: PrivateCombatCommand | PrivateMovementRootCommand,
): Promise<unknown> {
  const authority = destinyActiveAuthority();
  if (!authority || !game.user)
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
  const id = crypto.randomUUID();
  const combatId = activeGridCombat()?.id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("D6E2.Combat.RoundGrid.authorityUnavailable"));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    game.socket?.emit(
      channel,
      { kind, id, combatId, ...(command ? { command } : {}) },
      { recipients: [authority.userId] },
    );
  });
}
export async function refreshCombatGridProjection(): Promise<
  D6CombatGridProjectionV1 | undefined
> {
  if (!combatHasPrivateQueues()) return undefined;
  await hydratePrivateCombat();
  if (destinyClientIsAuthority()) {
    if (!projector || !game.user)
      throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
    const reply = projector(game.user);
    applyProjection(reply);
    return reply.grid;
  }
  const reply = (await request("combat-grid-read")) as ProjectionReply;
  applyProjection(reply);
  return reply.grid;
}
export async function routePrivateCombatCommand(
  command: PrivateCombatCommand,
  authorityToken?: symbol,
): Promise<D6CombatCommandResultV1 | null> {
  if (!combatHasPrivateQueues()) return null;
  await hydratePrivateCombat();
  if (authorityToken === PRIVATE_COMBAT_AUTHORITY && destinyClientIsAuthority())
    return null;
  const reply = (await request("combat-grid-command", command)) as {
    result: D6CombatCommandResultV1;
    projection: ProjectionReply;
  };
  applyProjection(reply.projection);
  return reply.result;
}
/** Uses only the existing confidential Combat authority and its serialized tail. */
export async function requestPrivateMovementRoot(
  command: PrivateMovementRootCommand,
): Promise<unknown> {
  if (!combatHasPrivateQueues())
    throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
  const reply = (await request("combat-grid-movement-root", command)) as {
    movement: unknown;
    projection: ProjectionReply;
  };
  applyProjection(reply.projection);
  return reply.movement;
}
function allowed(user: FoundryUser, actor: FoundryActorDocument): boolean {
  return user.isGM || actor.testUserPermission(user, "OWNER");
}
export function registerPrivateCombat(
  execute: PrivateCombatExecutor,
  project: NonNullable<typeof projector>,
): void {
  projector = project;
  const receive = (value: unknown, senderId?: string) => {
    const packet = record(value);
    if (!senderId || typeof packet.id !== "string") return;
    if (packet.kind === "combat-grid-response") {
      if (
        senderId !== destinyActiveAuthority()?.userId ||
        packet.combatId !== activeGridCombat()?.id
      )
        return;
      const wait = pending.get(packet.id);
      if (!wait) return;
      pending.delete(packet.id);
      clearTimeout(wait.timer);
      if (typeof packet.error === "string")
        wait.reject(new Error(packet.error));
      else wait.resolve(packet.value);
      return;
    }
    if (
      ![
        "combat-grid-read",
        "combat-grid-command",
        "combat-grid-movement-root",
      ].includes(String(packet.kind)) ||
      !destinyClientIsAuthority()
    )
      return;
    const task = async () => {
      const user = game.users?.get(senderId);
      if (!user?.active || packet.combatId !== activeGridCombat()?.id) return;
      let result: unknown;
      let error: string | undefined;
      try {
        if (
          JSON.stringify(packet).length >
            (packet.kind === "combat-grid-movement-root" ? 2_100_000 : 65536) ||
          String(packet.id).length > 128
        )
          throw new Error("D6E2.Combat.RoundGrid.invalidState");
        await hydratePrivateCombat();
        if (
          !destinyClientIsAuthority() ||
          packet.combatId !== activeGridCombat()?.id
        )
          throw new Error("D6E2.Combat.RoundGrid.authorityUnavailable");
        if (packet.kind === "combat-grid-movement-root") {
          const command = record(packet.command);
          const combatant = activeGridCombat()?.combatants.contents.find(
            (c) =>
              c.id === command.combatantId && c.actor?.id === command.actorId,
          );
          if (
            !movementRootExecutor ||
            command.kind !== "relative-movement-root" ||
            !combatant?.actor ||
            !allowed(user, combatant.actor) ||
            !Number.isSafeInteger(command.revision) ||
            !(
              combatant.hidden ||
              privateRound(combatant.getFlag(SYSTEM_ID, "roundAction"))
            )
          )
            throw new Error("D6E2.Combat.RoundGrid.notAuthorized");
          result = {
            movement: await movementRootExecutor(
              command as unknown as PrivateMovementRootCommand,
              user,
            ),
            projection: project(user),
          };
        } else if (packet.kind === "combat-grid-command") {
          const command = packet.command as PrivateCombatCommand;
          const actor = activeGridCombat()?.combatants.contents.find(
            (c) =>
              c.id === command.combatantId && c.actor?.id === command.actorId,
          )?.actor;
          if (
            !actor ||
            !allowed(user, actor) ||
            !Number.isSafeInteger(command.revision) ||
            ![
              "declare",
              "spend",
              "defense",
              "movement",
              "reset",
              "hold",
              "clear-hold",
              "cancel",
            ].includes(command.kind)
          )
            throw new Error("D6E2.Combat.RoundGrid.notAuthorized");
          const outcome = await execute(command, user);
          const projection = project(user);
          result = {
            result: {
              changed: outcome.changed,
              state: projection.owned[command.combatantId] ?? null,
            },
            projection,
          };
        } else result = project(user);
      } catch (caught) {
        error =
          caught instanceof Error && caught.message.startsWith("D6E2.")
            ? caught.message
            : "D6E2.Combat.RoundGrid.invalidState";
      }
      if (!destinyClientIsAuthority()) return;
      game.socket?.emit(
        channel,
        {
          kind: "combat-grid-response",
          id: packet.id,
          combatId: packet.combatId,
          ...(error ? { error } : { value: result }),
        },
        { recipients: [senderId] },
      );
    };
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
  };
  const recover = () => {
    void hydratePrivateCombat()
      .then(() => {
        notify();
        if (!game.user?.isGM && combatHasPrivateQueues())
          return refreshCombatGridProjection();
      })
      .catch(() => {
        lastGrid = undefined;
        owned.clear();
        notify();
      });
  };
  for (const hook of [
    "updateCombat",
    "createCombat",
    "createCombatant",
    "updateCombatant",
    "deleteCombatant",
    "deleteCombat",
    "updateUser",
  ])
    Hooks.on(hook, recover);
  Hooks.on("preUpdateCombatant", (value: unknown, changes: unknown) => {
    const c = value as GridCombatant;
    const update = record(changes);
    if (
      update.hidden !== true ||
      c.hidden ||
      privateRound(c.getFlag(SYSTEM_ID, "roundAction")) ||
      !Object.keys(record(c.getFlag(SYSTEM_ID, "roundAction"))).length
    )
      return;
    if (!game.user?.isGM) return false;
    void (async () => {
      await initializeDestinyCrypto();
      await heartbeatDestinyCrypto();
      const hidden: GridCombatant = {
        id: c.id,
        hidden: true,
        ...(c.parent ? { parent: c.parent } : {}),
        getFlag: (scope, key) => c.getFlag(scope, key),
        update: (changes) => c.update(changes),
      };
      await persistConfidentialRound(
        hidden,
        record(c.getFlag(SYSTEM_ID, "roundAction")),
      );
      await c.update(update);
    })().catch((error: unknown) =>
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error
            ? error.message
            : "D6E2.Combat.RoundGrid.authorityUnavailable",
        ),
      ),
    );
    return false;
  });
  Hooks.once("ready", () => {
    game.socket?.on(channel, receive);
    recover();
    setInterval(() => {
      if (combatHasPrivateQueues()) recover();
    }, 15000);
  });
}
