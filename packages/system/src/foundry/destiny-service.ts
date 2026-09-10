import { requireDestinyValue } from "@d6-system-2e/core";
import {
  destinyActiveAuthority,
  destinyClientIsAuthority,
  grantDestinyLedgerKeys,
  heartbeatDestinyCrypto,
  initializeDestinyCrypto,
  openDestinyEnvelope,
  sealDestiny,
} from "./destiny-crypto";
import {
  DestinyLedger,
  DESTINY_ROOT_SETTING as ROOT_SETTING,
} from "./destiny-ledger";
import { registerExtraordinaryPowerMutationRouter } from "./extraordinary-power-transaction";
import {
  applyDestinyFrameworkEdit,
  destinyFrameworkPatches,
  validateDestinyFrameworkEdit,
} from "./destiny-framework-edits";
import { destinyOriginalWildGroups } from "../application/destiny-wild-evidence";
import {
  recoverDestinyEquipmentDelivery,
  destinyDeliverySource,
  deliverDestinyEquipment,
  cleanupDestinyEquipment,
} from "./destiny-equipment";
export {
  destinyDeliverySource,
  previewDestinyDelivery,
} from "./destiny-equipment";
import {
  initialDestinyState,
  normalizeDestinyConfiguration,
  transitionDestiny,
  type D6DestinyCommandV1,
  type D6DestinyOperation,
  type D6DestinyPrincipal,
  type D6DestinyStateV1,
} from "@d6-system-2e/core";
import { DestinyAuthority } from "../application/destiny-authority";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { foundryRandomId } from "./foundry-random-id";
import { record } from "./sheets/values";
import {
  applyDestinyConsequence,
  requireDestinyFramework,
} from "./destiny-consequence";

export const DESTINY_PUBLIC_SETTING = "destinyPoolPublicV1";
const FLAG = "destinyV1";
interface Message extends FoundryChatMessageDocument {
  readonly author?: FoundryUser;
  readonly user?: FoundryUser | string;
}
export interface DestinyPublicState {
  readonly version: 1;
  readonly revision: number;
  readonly sessionId: string;
  readonly status: D6DestinyStateV1["status"];
  readonly nominatedUserId: string;
  readonly coins: D6DestinyStateV1["coins"];
  readonly lastSpend?: { readonly id: string; readonly coinId: string };
}
let privateView: D6DestinyStateV1 | undefined;
const listeners = new Set<() => void>();
const processing = new Set<string>();
const waits = new Map<
  string,
  {
    resolve: (state: D6DestinyStateV1) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

export function destinyConfiguration() {
  return normalizeDestinyConfiguration(
    currentConfiguredRulesProfile().homebrew.destiny,
  );
}
export function destinyEnabled(): boolean {
  return destinyConfiguration().enabled;
}
export function destinyPrimaryGM(): FoundryUser | undefined {
  const active = destinyActiveAuthority();
  return active ? game.users?.get(active.userId) : undefined;
}
function isAuthority(): boolean {
  return destinyClientIsAuthority();
}
function requireAuthority(): void {
  if (!isAuthority()) throw new Error("D6E2.Destiny.Error.GMUnavailable");
}
function principal(userId: string): D6DestinyPrincipal {
  const user = game.users?.get(userId);
  if (!user) throw new Error("D6E2.Destiny.Error.UserMissing");
  return {
    userId,
    isGM: user.isGM,
    actorIds: (game.actors?.contents ?? [])
      .filter((a) => a.testUserPermission(user, "OWNER"))
      .map((a) => a.id),
  };
}
function notify(): void {
  for (const callback of listeners) callback();
}
export function subscribeDestiny(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
export function destinyPublicState(): DestinyPublicState {
  const raw = game.settings.get(SYSTEM_ID, DESTINY_PUBLIC_SETTING) as
    DestinyPublicState | undefined;
  return raw?.version === 1 ? raw : initialDestinyState();
}
export function destinyPrivateView(): D6DestinyStateV1 | undefined {
  return privateView;
}

const ledger = new DestinyLedger(
  requireAuthority,
  () => destinyPublicState().revision,
);
async function read(): Promise<D6DestinyStateV1> {
  const state = await ledger.read();
  privateView = structuredClone(state);
  return state;
}
function withoutDiceArtifact(t: D6DestinyStateV1["temptations"][string]) {
  const safe = { ...t };
  delete safe.diceArtifact;
  return safe;
}
export function projectDestinyForUser(
  state: D6DestinyStateV1,
  user: D6DestinyPrincipal,
): D6DestinyStateV1 {
  if (user.isGM) return structuredClone(state);
  const visibleSpend = (
    spend: D6DestinyStateV1["spends"][number],
    proposals: D6DestinyStateV1["proposals"],
  ) =>
    spend.userId === user.userId ||
    (spend.kind === "flashback" &&
      proposals[spend.effectId]?.userId === user.userId);
  return {
    ...structuredClone(state),
    receipts: {},
    frameworkEdits: Object.fromEntries(
      Object.entries(state.frameworkEdits ?? {}).filter(
        ([, e]) => e.userId === user.userId,
      ),
    ),
    archives: Object.fromEntries(
      Object.entries(state.archives ?? {}).map(([id, a]) => [
        id,
        {
          proposals: Object.fromEntries(
            Object.entries(a.proposals).filter(
              ([, p]) => p.userId === user.userId,
            ),
          ),
          spends: a.spends.filter((s) => visibleSpend(s, a.proposals)),
        },
      ]),
    ),
    proposals: Object.fromEntries(
      Object.entries(state.proposals).filter(
        ([, p]) => p.userId === user.userId,
      ),
    ),
    effects: Object.fromEntries(
      Object.entries(state.effects).filter(
        ([, e]) =>
          e.userId === user.userId ||
          user.actorIds.includes(e.actorId) ||
          (e.kind === "difficulty" &&
            e.public === true &&
            e.lightDirection === "raise"),
      ),
    ),
    temptations: Object.fromEntries(
      Object.entries(state.temptations)
        .filter(([, t]) => t.userId === user.userId)
        .map(([id, t]) => [
          id,
          {
            ...withoutDiceArtifact(t),
            rollResults: Object.fromEntries(
              Object.entries(t.rollResults ?? {}).filter(
                ([, r]) => r.request.rollMode !== "blindroll",
              ),
            ),
          },
        ]),
    ),
    spends: state.spends.filter((s) => visibleSpend(s, state.proposals)),
  };
}
async function publish(state: D6DestinyStateV1): Promise<void> {
  requireAuthority();
  const last = state.spends.at(-1);
  const view: DestinyPublicState = {
    version: 1,
    revision: state.revision,
    sessionId: state.sessionId,
    status: state.status,
    nominatedUserId: state.nominatedUserId,
    coins: state.coins.map((c) => ({ ...c })),
    ...(last ? { lastSpend: { id: last.id, coinId: last.coinId } } : {}),
  };
  await game.settings.set(SYSTEM_ID, DESTINY_PUBLIC_SETTING, view);
}
async function write(
  state: D6DestinyStateV1,
  expectedRevision: number,
): Promise<void> {
  await ledger.write(state, expectedRevision);
  privateView = structuredClone(state);
  await publish(state);
}

const frameworkFor = requireDestinyFramework;

async function validate(
  command: D6DestinyCommandV1,
  user: D6DestinyPrincipal,
  state: D6DestinyStateV1,
): Promise<void> {
  if (!destinyEnabled()) throw new Error("D6E2.Destiny.Error.Disabled");
  if (JSON.stringify(command).length > 24000)
    throw new Error("D6E2.Destiny.Error.InvalidCommand");
  const op = command.operation;
  if (op.kind === "framework-edit") validateDestinyFrameworkEdit(op.edit);
  if (op.kind === "recover-temptation") {
    const t = state.temptations[op.activationId];
    if (!t?.diceClaimed || rollingTemptations.has(op.activationId))
      throw new Error("D6E2.Destiny.Error.RollClaimed");
    if (t.diceArtifact && Roll.fromJSON(t.diceArtifact).total !== op.die)
      throw new Error("D6E2.Destiny.Error.RollEvidence");
  }
  if (op.kind === "reset") {
    const nominee = game.users?.get(op.nominatedUserId);
    if (!nominee || nominee.isGM)
      throw new Error("D6E2.Destiny.Error.NominatedPlayerRequired");
    if (op.size !== destinyConfiguration().size)
      throw new Error("D6E2.Destiny.Error.PoolSize");
  }
  if (op.kind === "review" && op.decision === "approve" && op.delivery) {
    if (op.delivery.kind === "equipment" && !op.delivery.sourceDigest)
      throw new Error("D6E2.Destiny.Error.DeliveryPreviewRequired");
    await destinyDeliverySource(op.delivery);
  }
  if (op.kind === "sample") {
    const a = op.activation;
    const f = frameworkFor(a.frameworkId, a.ownerId, a.resourceRoleId);
    const actor = game.actors?.get(a.actorId);
    const encode = (v: string) =>
      v.replaceAll("%", "%25").replaceAll(".", "%2E");
    const frameworks = record(
      record(actor?.system.extraordinaryPowers).frameworks,
    );
    const bindings = record(
      record(frameworks[encode(a.frameworkId)] ?? frameworks[a.frameworkId])
        .skillBindings,
    );
    for (const [index, result] of Object.entries(a.rollResults ?? {})) {
      const check = a.checks?.[Number(index)];
      if (
        !check ||
        !Number.isInteger(Number(index)) ||
        Number(index) < 0 ||
        result.request.source.actorId !== a.actorId ||
        result.request.source.itemId !== check.itemId ||
        result.pool.wildDice !== 0 ||
        result.baseFaces.length ||
        result.wildFaces.length ||
        result.success !== false ||
        result.request.score >= 3
      )
        throw new Error("D6E2.Destiny.Error.RollEvidence");
    }
    if (
      !a.checks?.length ||
      a.checks.length > 12 ||
      a.checks.some(
        (c) =>
          !f.skillRoles.some((r) => r.id === c.roleId) ||
          bindings[encode(c.roleId)] !== c.itemId ||
          actor?.items.get(c.itemId)?.type !== "skill" ||
          !Number.isFinite(c.difficulty) ||
          c.difficulty < 0,
      )
    )
      throw new Error("D6E2.Destiny.Error.RollEvidence");
  }
  if (
    op.kind === "tempt" ||
    op.kind === "temptation-roll" ||
    op.kind === "consequence-applied" ||
    op.kind === "claim-power-roll" ||
    op.kind === "record-power-roll" ||
    op.kind === "complete-power" ||
    op.kind === "recover-temptation"
  ) {
    const t = state.temptations[op.activationId];
    if (t) frameworkFor(t.frameworkId, t.ownerId, t.resourceRoleId);
  }
  if (op.kind === "open-effect") {
    const e = op.effect;
    if (e.kind === "difficulty") {
      const actor = game.actors?.get(e.actorId);
      const pc = (game.users?.contents ?? []).some(
        (u) => !u.isGM && actor?.testUserPermission(u, "OWNER"),
      );
      if (
        !actor ||
        e.lightDirection !== (pc ? "lower" : "raise") ||
        (e.public === true && !user.isGM)
      )
        throw new Error("D6E2.Destiny.Error.EffectIdentity");
    }
    if (e.kind === "incoming-hit") {
      const actor = game.actors?.get(e.actorId);
      const pc = (game.users?.contents ?? []).some(
        (u) => !u.isGM && actor?.testUserPermission(u, "OWNER"),
      );
      if (
        !actor ||
        e.side !== (pc ? "light" : "dark") ||
        !e.key.startsWith("hit:")
      )
        throw new Error("D6E2.Destiny.Error.EffectIdentity");
    }
    if (e.kind === "complication" && !user.isGM)
      throw new Error("D6E2.Destiny.Error.GMRequired");
    if (e.kind === "talent") {
      const item = game.actors
        ?.get(e.actorId)
        ?.items.get(e.key.split(":").at(-1) ?? "");
      const cost = record(item?.getFlag?.(SYSTEM_ID, "destinyCost"));
      if (
        item?.type !== "talent" ||
        cost.version !== 1 ||
        cost.cost !== 1 ||
        cost.enabled !== true
      )
        throw new Error("D6E2.Destiny.Error.TalentUnavailable");
    }
  }
}
async function internal(
  operation: D6DestinyOperation,
  id: string,
): Promise<D6DestinyStateV1> {
  const state = await read();
  if (state.receipts[id]) return state;
  const next = transitionDestiny(
    state,
    {
      version: 1,
      id,
      sessionId: state.sessionId,
      expectedRevision: state.revision,
      operation,
    },
    principal(requireDestinyValue(game.user).id),
  );
  await write(next, state.revision);
  return next;
}
async function deliver(state: D6DestinyStateV1): Promise<void> {
  for (const edit of Object.values(state.frameworkEdits ?? {})) {
    if (edit.status !== "pending") continue;
    try {
      await applyDestinyFrameworkEdit(edit, requireAuthority);
      await internal(
        { kind: "framework-edited", editId: edit.id },
        `framework-${edit.id}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "D6E2.Destiny.Error.Failed";
      if (reason === "D6E2.Destiny.Error.FrameworkConflict")
        await internal(
          { kind: "framework-edited", editId: edit.id, error: reason },
          `framework-${edit.id}`,
        );
      else if (reason !== "D6E2.Destiny.Error.ProviderMissing") throw error;
    }
  }
  for (const proposal of Object.values(state.proposals)) {
    if (proposal.status !== "delivering" || !proposal.delivery) continue;
    requireAuthority();
    const recovered = recoverDestinyEquipmentDelivery(proposal);
    const fingerprint = await deliverDestinyEquipment(
      state.sessionId,
      recovered,
      requireAuthority,
    );
    await internal(
      {
        kind: "delivered",
        proposalId: proposal.id,
        ...(recovered.delivery?.kind === "equipment"
          ? { itemId: recovered.delivery.itemId }
          : {}),
        ...(fingerprint ? { itemFingerprint: fingerprint } : {}),
      },
      `delivered-${proposal.id}`,
    );
  }
  for (const [sessionId, archive] of Object.entries(state.archives ?? {}))
    for (const proposal of Object.values(archive.proposals)) {
      if (
        proposal.status !== "approved" ||
        proposal.delivery?.kind !== "equipment" ||
        proposal.delivery.permanence !== "session" ||
        proposal.cleanup
      )
        continue;
      const status = await cleanupDestinyEquipment(
        sessionId,
        proposal,
        requireAuthority,
      );
      await internal(
        {
          kind: "cleanup-delivery",
          sessionId,
          proposalId: proposal.id,
          status,
        },
        `cleanup-${proposal.id}`,
      );
    }
  for (const t of Object.values(state.temptations)) {
    if (t.status !== "applying") continue;
    requireAuthority();
    frameworkFor(t.frameworkId, t.ownerId, t.resourceRoleId);
    const actor = game.actors?.get(t.actorId);
    if (!actor) throw new Error("D6E2.Destiny.Error.ActorMissing");
    await applyDestinyConsequence(actor, t, requireAuthority);
    await internal(
      { kind: "consequence-applied", activationId: t.id },
      `consequence-${t.id}`,
    );
  }
}
const authority = new DestinyAuthority({
  isAuthority,
  read,
  write,
  validate,
  deliver,
  reconcile: publish,
});

function messageFlag(
  message: FoundryChatMessageDocument,
): Record<string, unknown> {
  return record(message.getFlag(SYSTEM_ID, FLAG));
}
const CHANNEL = `system.${SYSTEM_ID}`;
interface SocketRequest {
  kind: "destiny-request";
  id: string;
  command?: D6DestinyCommandV1;
  rolls?: readonly string[];
}
const outboxPrefix = () =>
  `d6-destiny-outbox:${game.world?.id ?? "world"}:${game.user?.id}:`;
function emitPrivate(value: unknown, recipients: readonly string[]): void {
  if (!game.socket || !recipients.length)
    throw new Error("D6E2.Destiny.Error.GMUnavailable");
  game.socket.emit(CHANNEL, value, { recipients });
}
function respond(
  request: SocketRequest,
  userId: string,
  state?: D6DestinyStateV1,
  error?: string,
): void {
  requireAuthority();
  emitPrivate(
    {
      kind: "destiny-response",
      id: request.id,
      ...(state
        ? { state: projectDestinyForUser(state, principal(userId)) }
        : {}),
      ...(error ? { error } : {}),
      committed: Boolean(state?.receipts[request.id]),
      retryable: Boolean(
        error &&
        [
          "GMUnavailable",
          "KeyUnavailable",
          "KeyEnrollmentRequired",
          "AuthorityMissing",
          "ProviderMissing",
          "PendingRecovery",
          "DeliveryConflict",
          "ConsequenceConflict",
          "EnvelopeInvalid",
        ].some((key) => error.endsWith(`.${key}`)),
      ),
    },
    [userId],
  );
}
async function processRequest(
  request: SocketRequest,
  userId: string,
): Promise<void> {
  if (!isAuthority() || processing.has(request.id)) return;
  if (
    typeof request.id !== "string" ||
    request.id.length > 128 ||
    JSON.stringify(request).length > 131072
  )
    return;
  processing.add(request.id);
  try {
    const user = principal(userId);
    const command = request.command;
    if (!command) {
      respond(request, userId, await read());
      return;
    }
    if (command.id !== request.id)
      throw new Error("D6E2.Destiny.Error.InvalidCommand");
    if (
      [
        "claim-temptation-dice",
        "save-temptation-dice",
        "framework-edited",
        "delivered",
        "cleanup-delivery",
        "consequence-applied",
        "temptation-roll",
        "tempt",
      ].includes(command.operation.kind)
    )
      throw new Error("D6E2.Destiny.Error.InvalidCommand");
    const rolls = (request.rolls ?? []).map((r) => Roll.fromJSON(r));
    if (command.operation.kind === "record-power-roll") {
      const result = command.operation.result;
      const batches = rolls
        .filter((r) => /^1dw(?:x6)?$/.test(r.formula))
        .map((r) =>
          r.dice.flatMap((d) =>
            d.results.filter((x) => x.active !== false).map((x) => x.result),
          ),
        );
      const groups = destinyOriginalWildGroups(result.pool.wildDice, batches);
      if (
        JSON.stringify(groups) !==
        JSON.stringify(
          result.wildFaceGroups ??
            (result.wildFaces.length ? [result.wildFaces] : []),
        )
      )
        throw new Error("D6E2.Destiny.Error.RollEvidence");
    }
    if (command.operation.kind === "session-roll") {
      const current = await read();
      if (current.sessionRollClaim !== request.id)
        throw new Error("D6E2.Destiny.Error.RollClaimed");
      const roll = rolls[0];
      if (
        roll?.formula !== "1d6" ||
        roll.dice.length !== 1 ||
        roll.dice[0]?.results.length !== 1 ||
        roll.total !== command.operation.die
      )
        throw new Error("D6E2.Destiny.Error.InvalidDie");
    }
    await authority.execute(command, user);
    if (command.operation.kind === "record-power-roll")
      await resolveDestinyTemptation(command.operation.activationId);
    respond(request, userId, await read());
  } catch (error) {
    if (isAuthority()) {
      let state: D6DestinyStateV1 | undefined;
      try {
        state = await read();
      } catch {
        /* No decryptable state must be disclosed. */
      }
      respond(
        request,
        userId,
        state,
        error instanceof Error ? error.message : "D6E2.Destiny.Error.Failed",
      );
    }
  } finally {
    processing.delete(request.id);
  }
}
function receiveSocket(value: unknown, senderId?: string): void {
  if (!senderId) return;
  const packet = record(value);
  if (packet.kind === "destiny-request") {
    void processRequest(packet as unknown as SocketRequest, senderId).catch(
      console.error,
    );
    return;
  }
  if (
    packet.kind !== "destiny-response" ||
    senderId !== destinyPrimaryGM()?.id ||
    typeof packet.id !== "string"
  )
    return;
  const wait = waits.get(packet.id);
  if (!wait) return;
  const state = packet.state as D6DestinyStateV1 | undefined;
  if (state?.version === 1) {
    privateView = state;
    notify();
  }
  clearTimeout(wait.timer);
  waits.delete(packet.id);
  // Uncertain delivery/provider errors keep the exact request for recovery.
  if (!packet.error || packet.committed === true || packet.retryable !== true)
    localStorage.removeItem(outboxPrefix() + packet.id);
  notify();
  if (packet.error)
    wait.reject(
      new Error(
        typeof packet.error === "string"
          ? packet.error
          : "D6E2.Destiny.Error.Failed",
      ),
    );
  else if (state) wait.resolve(state);
  else wait.reject(new Error("D6E2.Destiny.Error.Failed"));
}
async function dispatch(
  request: SocketRequest,
  persist = true,
): Promise<D6DestinyStateV1> {
  await initializeDestinyCrypto();
  const gm = destinyPrimaryGM();
  if (!gm) throw new Error("D6E2.Destiny.Error.GMUnavailable");
  if (persist && request.command) {
    const envelope = await sealDestiny(`outbox:${request.id}`, request, [
      requireDestinyValue(game.user).id,
    ]);
    localStorage.setItem(outboxPrefix() + request.id, JSON.stringify(envelope));
    notify();
  }
  const result = new Promise<D6DestinyStateV1>((resolve, reject) => {
    const timer = setTimeout(() => {
      waits.delete(request.id);
      reject(new Error("D6E2.Destiny.Error.PendingRecovery"));
    }, 15000);
    waits.set(request.id, { resolve, reject, timer });
  });
  emitPrivate(request, [gm.id]);
  return result;
}
async function send(
  operation?: D6DestinyOperation,
  rolls?: readonly FoundryRoll[],
  fixedId?: string,
): Promise<D6DestinyStateV1> {
  const id = fixedId ?? foundryRandomId();
  const publicView = destinyPublicState();
  const view =
    privateView && privateView.revision > publicView.revision
      ? privateView
      : publicView;
  const command: D6DestinyCommandV1 | undefined = operation
    ? {
        version: 1,
        id,
        expectedRevision: view.revision,
        sessionId: view.sessionId,
        operation,
      }
    : undefined;
  return dispatch({
    kind: "destiny-request",
    id,
    ...(command ? { command } : {}),
    ...(rolls ? { rolls: rolls.map((r) => JSON.stringify(r.toJSON())) } : {}),
  });
}
export function destinyOutboxCount(): number {
  return Object.keys(localStorage).filter((k) => k.startsWith(outboxPrefix()))
    .length;
}
export async function replayDestinyOutbox(): Promise<void> {
  await initializeDestinyCrypto();
  const prefix = outboxPrefix();
  for (const key of Object.keys(localStorage).filter((k) =>
    k.startsWith(prefix),
  )) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const id = key.slice(prefix.length);
    const request = await openDestinyEnvelope<SocketRequest>(
      `outbox:${id}`,
      JSON.parse(raw),
    );
    await dispatch(request, false);
  }
}
export const requestDestiny = (
  operation: D6DestinyOperation,
  rolls?: readonly FoundryRoll[],
) => send(operation, rolls);
export const refreshDestinyView = () => send();
let sessionRollWork: Promise<D6DestinyStateV1> | undefined;
export function rollDestinySession(): Promise<D6DestinyStateV1> {
  if (sessionRollWork) return sessionRollWork;
  sessionRollWork = (async () => {
    const view = await refreshDestinyView();
    if (
      view.status !== "awaiting-roll" ||
      view.nominatedUserId !== game.user?.id
    )
      throw new Error("D6E2.Destiny.Error.NominatedPlayerRequired");
    if (view.sessionRollClaim)
      throw new Error("D6E2.Destiny.Error.PendingRecovery");
    const id = foundryRandomId();
    await requestDestiny({ kind: "claim-session-roll", claimId: id });
    const roll = await new Roll("1d6").evaluate();
    return send({ kind: "session-roll", die: roll.total }, [roll], id);
  })().finally(() => {
    sessionRollWork = undefined;
  });
  return sessionRollWork;
}
/** Elected GM rolls only after the durable claim. A crash leaves explicit recovery, never a reroll. */
const rollingTemptations = new Set<string>();
export async function resolveDestinyTemptation(
  activationId: string,
): Promise<void> {
  if (!isAuthority() || rollingTemptations.has(activationId)) return;
  rollingTemptations.add(activationId);
  try {
    const state = await read();
    const t = state.temptations[activationId];
    if (t?.status !== "rolling") return;
    frameworkFor(t.frameworkId, t.ownerId, t.resourceRoleId);
    let roll = t.diceArtifact ? Roll.fromJSON(t.diceArtifact) : undefined;
    if (t.diceClaimed && !roll) return; // Interrupted claim: never silently reroll.
    if (!t.diceClaimed) {
      await authority.execute(
        {
          version: 1,
          id: `temptation-claim-${activationId}`,
          sessionId: state.sessionId,
          expectedRevision: state.revision,
          operation: { kind: "claim-temptation-dice", activationId },
        },
        principal(requireDestinyValue(game.user).id),
      );
      requireAuthority();
      roll = await new Roll("1d6").evaluate();
      requireAuthority();
      const latest = await read();
      await authority.execute(
        {
          version: 1,
          id: `temptation-artifact-${activationId}`,
          sessionId: latest.sessionId,
          expectedRevision: latest.revision,
          operation: {
            kind: "save-temptation-dice",
            activationId,
            artifact: JSON.stringify(roll.toJSON()),
          },
        },
        principal(requireDestinyValue(game.user).id),
      );
    }
    if (
      roll?.formula !== "1d6" ||
      roll.dice.length !== 1 ||
      roll.dice[0]?.results.length !== 1
    )
      throw new Error("D6E2.Destiny.Error.RollEvidence");
    const latest = await read();
    await authority.execute(
      {
        version: 1,
        id: `temptation-${activationId}`,
        sessionId: latest.sessionId,
        expectedRevision: latest.revision,
        operation: { kind: "temptation-roll", activationId, die: roll.total },
      },
      principal(requireDestinyValue(game.user).id),
    );
  } finally {
    rollingTemptations.delete(activationId);
  }
}
export function registerDestinyService(): void {
  registerExtraordinaryPowerMutationRouter(
    async (actor, frameworkId, before, after) => {
      if (!destinyEnabled() || isAuthority()) return false;
      const patches = destinyFrameworkPatches(before, after);
      if (!patches.length) return true;
      const id = foundryRandomId();
      const state = await requestDestiny({
        kind: "framework-edit",
        edit: { id, actorId: actor.id, frameworkId, patches },
      });
      const edit = state.frameworkEdits?.[id];
      if (edit?.status !== "applied")
        throw new Error(edit?.error ?? "D6E2.Destiny.Error.PendingRecovery");
      return true;
    },
  );
  game.settings.register(SYSTEM_ID, ROOT_SETTING, {
    name: "Destiny authority",
    hint: "Encrypted durable authority ledger",
    scope: "world",
    config: false,
    type: Object,
    default: null,
    onChange: (value: unknown) => {
      if (game.user?.isGM && value)
        void openDestinyEnvelope<D6DestinyStateV1>("ledger", value)
          .then((state) => {
            privateView = state;
            notify();
          })
          .catch(() => undefined);
    },
  });
  game.settings.register(SYSTEM_ID, DESTINY_PUBLIC_SETTING, {
    name: "Destiny pool",
    hint: "Redacted shared pool",
    scope: "world",
    config: false,
    type: Object,
    default: initialDestinyState(),
    onChange: () => {
      notify();
      if (destinyEnabled() && !game.user?.isGM && destinyPrimaryGM())
        void refreshDestinyView().catch(console.error);
    },
  });
  Hooks.on("renderChatMessageHTML", (value: unknown, element: unknown) => {
    const kind = messageFlag(value as Message).type;
    if (
      ["authority", "dice", "key", "presence", "key-grant"].includes(
        String(kind),
      ) &&
      element instanceof HTMLElement
    ) {
      element.hidden = true;
      element.style.display = "none";
    }
  });
  const recover = async () => {
    if (!destinyEnabled()) return;
    await initializeDestinyCrypto();
    await grantDestinyLedgerKeys(game.settings.get(SYSTEM_ID, ROOT_SETTING));
    if (!isAuthority()) return;
    await authority.recover();
    for (const t of Object.values((await read()).temptations))
      if (t.status === "rolling") await resolveDestinyTemptation(t.id);
  };
  const observe = async (value: unknown) => {
    const message = value as Message;
    const type = messageFlag(message).type;
    if (type === "key" || type === "key-grant") {
      await recover();
      return;
    }
    if (type === "authority" && game.user?.isGM) {
      try {
        privateView = await openDestinyEnvelope<D6DestinyStateV1>(
          "ledger",
          messageFlag(message).envelope,
        );
        notify();
      } catch {
        /* Enrollment/recovery remains explicit. */
      }
    }
  };
  Hooks.on("createChatMessage", (m: unknown) => {
    void observe(m).catch(console.error);
  });
  Hooks.on("updateChatMessage", (m: unknown) => {
    void observe(m).catch(console.error);
  });
  Hooks.on("updateUser", () => {
    void recover().catch(console.error);
  });
  Hooks.once("ready", () => {
    game.socket?.on(CHANNEL, receiveSocket);
    // Key storage and recurring maintenance belong to a browser client.
    if (typeof window === "undefined") return;
    const start = async () => {
      if (!destinyEnabled()) return;
      await heartbeatDestinyCrypto();
      await recover();
      await replayDestinyOutbox();
    };
    void start().catch(console.error);
    setInterval(() => {
      if (destinyEnabled())
        void heartbeatDestinyCrypto()
          .then(() => {
            notify();
            if (isAuthority()) return recover();
          })
          .catch(console.error);
    }, 10000);
  });
}
