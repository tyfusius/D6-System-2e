import { requireDestinyValue as required } from "@d6-system-2e/core";
import { retryD6MatchingResultReward } from "./rolls/roll-service";
import {
  firstEditionBodyPointWound,
  firstEditionMortalityElapsedMinutes,
  type D6RollMode,
} from "@d6-system-2e/core";
import {
  advanceFirstEditionBodyPointRoot,
  createFirstEditionBodyPointRoot,
  parseFirstEditionBodyPointRoot,
  type FirstEditionBodyPointRoot,
} from "../application/first-edition-body-point-root";
import {
  cancelFirstEditionAction,
  claimFirstEditionActionStage,
  FirstEditionActionError,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type {
  FirstEditionActionRoot,
  FirstEditionStageReceipt,
} from "../application/first-edition-action-contract";
import {
  executeFirstEditionEffect,
  type FirstEditionActionStorePorts,
} from "../application/first-edition-action-ports";
import {
  canonical,
  object,
  text,
} from "../application/first-edition-action-validation";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
} from "../application/initiating-action-results";
import { SYSTEM_ID } from "../constants";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import { currentAttributeRole } from "../settings/attributes";
import { currentEffectivePipScore } from "../settings/pip-rules";
import { firstEditionBodyPointUpdate, readActorHealth } from "./health-runtime";
import {
  destinyActiveAuthority,
  destinyClientIsAuthority,
  destinyEnrolledGMIds,
  destinyNativeAuthor,
  heartbeatDestinyCrypto,
  openDestinyEnvelope,
  sealDestiny,
} from "./destiny-crypto";
import {
  appendD6InitiatingActionPresentation,
  hydrateD6FoundryRolls,
  initiatingActionVisibilityIntersection,
} from "./initiating-action-message";
import { chatVisibilityForMode } from "./rolls/chat-visibility";
import { foundryRandomId } from "./foundry-random-id";
import {
  woundBoundActor,
  woundRootRollRuntime,
} from "./first-edition-wound-authority";
import { integer, record } from "./sheets/values";
export {
  woundBoundActor as bodyPointBoundActor,
  woundRootRollRuntime as bodyPointRootRollRuntime,
};
export const BODY_POINT_ROOT_FLAG = "firstEditionBodyPointRoot";
const BINDINGS = "firstEditionBodyPointAuthority";
const PROOFS = "bodyPointRootReceipts";
interface SkillBinding {
  readonly id: string;
  readonly uuid: string;
  readonly type: string;
  readonly score: number;
  readonly witness: string;
}
interface Binding {
  readonly version: 1;
  readonly initiator: string;
  readonly patientUuid: string;
  readonly healerUuid: string;
  readonly before: string;
  readonly after?: string;
  readonly witness: string;
  readonly skills: readonly SkillBinding[];
  readonly source: string;
  readonly survivalSource: string;
}
function invalid(): never {
  throw new FirstEditionActionError("invalid");
}
function requireAuthority() {
  if (!destinyClientIsAuthority())
    throw new FirstEditionActionError("authority");
}
let renderer: (v: FirstEditionBodyPointRoot) => Promise<string> = () =>
  Promise.resolve("");
export function setBodyPointRootRenderer(value: typeof renderer) {
  renderer = value;
}
function allowed(user: FoundryUser, actor: FoundryActorDocument) {
  return user.active && (user.isGM || actor.testUserPermission(user, "OWNER"));
}
export function bodyPointRootModelAvailable(
  actor: FoundryActorDocument,
): boolean {
  const h = readActorHealth(actor);
  return (
    !!h.pool &&
    h.pool.maximum > 0 &&
    [
      "open-d6.damage.body-points",
      "open-d6.damage.body-points-with-wounds",
    ].includes(h.damageStrategyId)
  );
}
export function bodyPointTreatmentAvailable(
  actor: FoundryActorDocument,
): boolean {
  const h = readActorHealth(actor);
  return (
    bodyPointRootModelAvailable(actor) &&
    !!h.pool &&
    firstEditionBodyPointWound(h.pool.current, h.pool.maximum) !== "dead"
  );
}
/** Preserve the existing sheet offer: living mortal pure pools can rest;
 * hybrid mortal patients retain their existing assisted-treatment-only UI. */
export function canOfferBodyPointNaturalHealing(
  actor: FoundryActorDocument,
): boolean {
  const h = readActorHealth(actor);
  return (
    bodyPointTreatmentAvailable(actor) &&
    !!h.pool &&
    (h.damageStrategyId === "open-d6.damage.body-points" ||
      firstEditionBodyPointWound(h.pool.current, h.pool.maximum) !==
        "mortally-wounded")
  );
}
function beforeState(actor: FoundryActorDocument) {
  return canonical({
    health: actor.system.health,
    posture: object(actor.system.movement)?.posture ?? "standing",
  });
}
function projectedState(
  actor: FoundryActorDocument,
  changes: Record<string, unknown>,
) {
  const state = {
    system: {
      health: structuredClone(actor.system.health),
      movement: {
        posture: object(actor.system.movement)?.posture ?? "standing",
      },
    },
  } as Record<string, unknown>;
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let at = state;
    for (const key of parts.slice(0, -1)) {
      if (!object(at[key])) at[key] = {};
      at = at[key] as Record<string, unknown>;
    }
    at[parts.at(-1) ?? ""] = value;
  }
  const system = object(state.system);
  return canonical({
    health: system?.health,
    posture: object(system?.movement)?.posture,
  });
}
function skillBindings(
  actor: FoundryActorDocument,
): Omit<SkillBinding, "witness">[] {
  return actor.items.contents
    .filter((i) => ["skill", "specialization"].includes(i.type))
    .map((i) => ({
      id: i.id,
      uuid: i.uuid ?? `${actor.uuid}.Item.${i.id}`,
      type: i.type,
      score: integer(i.system.score),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function sourceState(
  actor: FoundryActorDocument,
  source: { attributeId: string; itemId?: string },
) {
  const item = source.itemId ? actor.items.get(source.itemId) : undefined;
  if (source.itemId && item?.type !== "skill")
    throw new FirstEditionActionError("deleted");
  return canonical({
    attribute: record(actor.system.attributes)[source.attributeId],
    item: item ? { uuid: item.uuid, system: item.system } : null,
  });
}
function actorBinding(actor: FoundryActorDocument & { uuid: string }) {
  const m = /^Scene\.([^.]+)\.Token\.([^.]+)\.Actor\./.exec(actor.uuid);
  return {
    actorId: actor.id,
    actorUuid: actor.uuid,
    ...(m
      ? { sceneId: required(m[1]), tokenUuid: `Scene.${m[1]}.Token.${m[2]}` }
      : {}),
  };
}
/** Ordered absent -> v1 initialization; reject unknown/corrupt data, never adopt old cards. */
export function migrateBodyPointAuthorityData(raw: unknown): {
  version: 1;
  roots: Record<string, Binding>;
} {
  if (raw === null || raw === undefined) return { version: 1, roots: {} };
  const v = object(raw),
    roots = object(v?.roots);
  if (
    v?.version !== 1 ||
    !roots ||
    Object.entries(roots).some(([id, b]) => {
      const x = object(b);
      return (
        !/^[A-Za-z0-9]{16}$/.test(id) ||
        x?.version !== 1 ||
        !text(x.initiator) ||
        !text(x.patientUuid) ||
        !text(x.healerUuid) ||
        !text(x.witness) ||
        [
          x.before,
          x.source,
          x.survivalSource,
          ...(x.after === undefined ? [] : [x.after]),
        ].some((s) => typeof s !== "string" || !s || s.length > 2_000_000) ||
        !Array.isArray(x.skills) ||
        x.skills.length > 4096 ||
        x.skills.some((s) => {
          const i = object(s);
          return (
            !i ||
            !text(i.id) ||
            !text(i.uuid) ||
            !["skill", "specialization"].includes(String(i.type)) ||
            !Number.isSafeInteger(i.score) ||
            !text(i.witness)
          );
        })
      );
    })
  )
    invalid();
  return {
    version: 1,
    roots: structuredClone(roots) as unknown as Record<string, Binding>,
  };
}
async function bindings() {
  requireAuthority();
  const raw = game.settings.get(SYSTEM_ID, BINDINGS);
  return migrateBodyPointAuthorityData(
    raw ? await openDestinyEnvelope(BINDINGS, raw) : null,
  ).roots;
}
async function saveBindings(roots: Record<string, Binding>) {
  requireAuthority();
  const checked = migrateBodyPointAuthorityData({ version: 1, roots });
  await game.settings.set(
    SYSTEM_ID,
    BINDINGS,
    await sealDestiny(BINDINGS, checked, destinyEnrolledGMIds()),
  );
}
function rootMessage(id: string) {
  const message = game.messages?.get(id);
  if (!message) throw new FirstEditionActionError("deleted");
  const value = parseFirstEditionBodyPointRoot(
    message.getFlag(SYSTEM_ID, BODY_POINT_ROOT_FLAG),
  );
  if (
    value?.action.rootMessageId !== id ||
    !game.users?.get(destinyNativeAuthor(message))?.isGM
  )
    invalid();
  return { message, value };
}
async function context(id: string, user: FoundryUser, live: boolean) {
  const { message, value } = rootMessage(id),
    binding = (await bindings())[id];
  if (!binding) invalid();
  const patient = await woundBoundActor(binding.patientUuid),
    healer = await woundBoundActor(binding.healerUuid);
  if (
    !allowed(user, patient) ||
    !allowed(user, healer) ||
    (!user.isGM && user.id !== binding.initiator)
  )
    throw new FirstEditionActionError("authority");
  if (
    value.initiatorUserId !== binding.initiator ||
    value.action.subjects.find((s) => s.role === "patient")?.actor.actorUuid !==
      patient.uuid ||
    (value.operation === "assisted" &&
      value.action.subjects.find((s) => s.role === "healer")?.actor
        .actorUuid !== healer.uuid)
  )
    invalid();
  if (live) {
    const h = readActorHealth(patient);
    const poolRecorded = value.action.stages.some(
      (s) => s.id === `${id}:pool` && s.state === "recorded",
    );
    if (
      !bodyPointTreatmentAvailable(patient) ||
      h.modelId !== value.action.runtime.healthModelId ||
      h.damageStrategyId !== value.action.runtime.damageStrategyId ||
      currentConfiguredRulesProfile().id !== value.action.runtime.profileId ||
      beforeState(patient) !== (poolRecorded ? binding.after : binding.before)
    )
      throw new FirstEditionActionError("conflict");
    const stage = value.action.stages.find((s) => s.state !== "recorded");
    if (stage?.spec.kind === "d6-roll") {
      const actor = stage.spec.purpose === "survival" ? patient : healer;
      if (
        sourceState(actor, stage.spec.source) !==
        (stage.spec.purpose === "survival"
          ? binding.survivalSource
          : binding.source)
      )
        throw new FirstEditionActionError("conflict");
    }
  }
  return { message, value, binding, patient, healer };
}
async function write(
  id: string,
  value: FirstEditionBodyPointRoot,
  extra: Record<string, unknown> = {},
) {
  requireAuthority();
  if (!parseFirstEditionBodyPointRoot(value)) invalid();
  const { message } = rootMessage(id);
  const content = await renderer(value);
  requireAuthority();
  if (game.messages?.get(id) !== message)
    throw new FirstEditionActionError("deleted");
  await message.update({
    ...extra,
    content,
    [`flags.${SYSTEM_ID}.${BODY_POINT_ROOT_FLAG}`]: value,
  });
}
function localStore(
  id: string,
  user: FoundryUser,
): FirstEditionActionStorePorts {
  return {
    load: () => Promise.resolve(rootMessage(id).value.action),
    authorize: async (_binding, _root, stage, phase) => {
      await context(id, user, phase === "claim");
      if (phase === "claim" && stage.spec.controllerUserId !== user.id)
        throw new FirstEditionActionError("authority");
    },
    compareAndSwap: async (_id, revision, next, scope) => {
      const { message, value } = rootMessage(id);
      if (value.action.revision !== revision) return false;
      const admitsAudience =
        scope !== "preserve" &&
        message.getFlag(SYSTEM_ID, "bodyPointRootScopePending") === true &&
        value.action.stages[0]?.state === "pending" &&
        next.stages[0]?.state === "claimed" &&
        next.stages[0].claim?.kind === "d6-roll";
      const requested =
        scope === "preserve"
          ? {}
          : chatVisibilityForMode(
              scope,
              game.users?.contents.filter((u) => u.isGM).map((u) => u.id) ?? [],
              user.id,
            );
      await write(
        id,
        { ...value, action: next },
        admitsAudience
          ? {
              whisper: requested.whisper ?? [],
              blind: requested.blind ?? false,
              [`flags.${SYSTEM_ID}.bodyPointRootScopePending`]: false,
              [`flags.${SYSTEM_ID}.bodyPointRootRollMode`]: scope,
            }
          : scope === "preserve"
            ? {}
            : initiatingActionVisibilityIntersection(message, scope, user.id),
      );
      return true;
    },
  };
}
async function present(id: string, user: FoundryUser) {
  const { message, value } = await context(id, user, false);
  let ledger = createD6InitiatingActionResultLedger(
    value.action.operationId,
    id,
  );
  for (const s of value.action.stages) {
    const r = s.receipt;
    if (!r || r.kind === "effect") continue;
    await hydrateD6FoundryRolls(r.artifacts);
    ledger = appendD6InitiatingActionResult(ledger, {
      appendId: s.id,
      kind:
        r.kind === "plain-d6"
          ? "first-edition-body-point-amount"
          : "first-edition-body-point-check",
      details: { operation: value.operation },
      rollMode:
        r.kind === "d6-roll"
          ? r.result.request.rollMode
          : s.claim?.kind === "plain-d6"
            ? s.claim.rollMode
            : "selfroll",
      rolls: r.artifacts.map((a) => a.evidence),
    });
  }
  for (const s of value.action.stages) {
    const r = s.receipt;
    if (!r || r.kind === "effect") continue;
    const entry = ledger.entries.find((e) => e.appendId === s.id);
    if (!entry) invalid();
    await appendD6InitiatingActionPresentation({
      message,
      ledger,
      entry,
      artifacts: await hydrateD6FoundryRolls(r.artifacts),
      rollUserId: s.spec.controllerUserId,
    });
  }
  await write(id, value);
}
function proof(
  actor: FoundryActorDocument | FoundryItemDocument,
  id: string,
  witness: string,
): boolean {
  const v = object(object(actor.getFlag?.(SYSTEM_ID, PROOFS))?.[id]);
  return v?.version === 1 && v.witness === witness;
}
async function effect(id: string, requester: FoundryUser) {
  await context(id, requester, false);
  const user = game.user;
  if (!user) throw new FirstEditionActionError("authority");
  let value = rootMessage(id).value;
  let stage = value.action.stages.find((s) => s.state !== "recorded");
  if (stage?.spec.kind !== "effect") invalid();
  if (stage.state === "pending" && stage.spec.controllerUserId !== user.id) {
    await write(id, {
      ...value,
      action: {
        ...value.action,
        coordinatorUserId: user.id,
        revision: value.action.revision + 1,
        stages: value.action.stages.map((s) =>
          s.spec.kind === "effect" && s.state === "pending"
            ? { ...s, spec: { ...s.spec, controllerUserId: user.id } }
            : s,
        ),
      },
    });
    value = rootMessage(id).value;
    stage = value.action.stages.find((s) => s.state !== "recorded");
    if (stage?.spec.kind !== "effect") invalid();
  }
  const plan = stage.spec.plan,
    stageId = stage.id;
  const receipt = (
    witness: string,
  ): Extract<FirstEditionStageReceipt, { kind: "effect" }> => ({
    kind: "effect",
    plan,
    receiptKey: `${stageId}:effect`,
    authorityReceiptId: witness,
    outcome: "applied",
  });
  const readReceipt = async () => {
    const c = await context(id, user, false);
    if (plan.kind === "health-change")
      return proof(c.patient, id, c.binding.witness)
        ? receipt(c.binding.witness)
        : null;
    if (plan.kind !== "body-point-skill-loss") invalid();
    if (c.binding.skills.length === 0)
      return proof(c.patient, `${id}-skills`, c.binding.witness)
        ? receipt(c.binding.witness)
        : null;
    return c.binding.skills.every((s) => {
      const i = c.patient.items.get(s.id);
      return i?.uuid === s.uuid && proof(i, id, s.witness);
    })
      ? receipt(c.binding.witness)
      : null;
  };
  const apply = async (key: string) => {
    const saved = await readReceipt();
    if (saved) return saved;
    const c = await context(id, user, true);
    if (plan.kind === "health-change" && plan.after.kind === "body-points") {
      if (
        canonical(skillBindings(c.patient)) !==
        canonical(
          c.binding.skills.map((s) => ({
            id: s.id,
            uuid: s.uuid,
            type: s.type,
            score: s.score,
          })),
        )
      )
        throw new FirstEditionActionError("conflict");
      const changes = firstEditionBodyPointUpdate(c.patient, {
        current: plan.after.current.value,
        maximum: plan.after.maximum.value,
      });
      const all = await bindings();
      all[id] = { ...c.binding, after: projectedState(c.patient, changes) };
      await saveBindings(all);
      requireAuthority();
      await c.patient.update({
        ...changes,
        [`flags.${SYSTEM_ID}.${PROOFS}.${id}`]: {
          version: 1,
          witness: c.binding.witness,
        },
      });
    } else if (plan.kind === "body-point-skill-loss") {
      const actual = skillBindings(c.patient);
      if (
        canonical(
          actual.map((s) => ({ id: s.id, uuid: s.uuid, type: s.type })),
        ) !==
        canonical(
          c.binding.skills.map((s) => ({
            id: s.id,
            uuid: s.uuid,
            type: s.type,
          })),
        )
      )
        throw new FirstEditionActionError("conflict");
      const updates = [];
      for (const s of c.binding.skills) {
        const item = c.patient.items.get(s.id);
        if (!item) throw new FirstEditionActionError("deleted");
        const after = Math.max(0, s.score - plan.lossScore);
        if (proof(item, id, s.witness)) {
          if (integer(item.system.score) !== after)
            throw new FirstEditionActionError("conflict");
          continue;
        }
        if (integer(item.system.score) !== s.score)
          throw new FirstEditionActionError("conflict");
        updates.push({
          _id: s.id,
          "system.score": after,
          [`flags.${SYSTEM_ID}.${PROOFS}.${id}`]: {
            version: 1,
            witness: s.witness,
          },
        });
      }
      requireAuthority();
      if (updates.length)
        await c.patient.updateEmbeddedDocuments("Item", updates);
      if (c.binding.skills.length === 0)
        await c.patient.update({
          [`flags.${SYSTEM_ID}.${PROOFS}.${id}-skills`]: {
            version: 1,
            witness: c.binding.witness,
          },
        });
    } else invalid();
    const recorded = await readReceipt();
    if (!recorded) throw new FirstEditionActionError("uncertain");
    return { ...recorded, receiptKey: key };
  };
  // Only this explicit Skill-batch continuation may fill missing per-item proofs.
  // Absolute before/after scores and UUIDs are checked; recorded items are skipped.
  if (stage.state === "claimed" && plan.kind === "body-point-skill-loss")
    await apply(`${stageId}:effect`);
  await executeFirstEditionEffect(
    {
      rootMessageId: id,
      operationId: value.action.operationId,
      stageId,
      authenticatedSenderId: user.id,
    },
    {
      ...localStore(id, user),
      readReceipt,
      compareAndApply: (_plan, key) => apply(key),
    },
  );
}

async function create(data: Record<string, unknown>, user: FoundryUser) {
  const id = data.rootMessageId;
  if (
    !text(id) ||
    !/^[A-Za-z0-9]{16}$/.test(id) ||
    !text(data.patientUuid) ||
    !["natural", "assisted"].includes(String(data.operation))
  )
    invalid();
  const mode = data.rollMode as D6RollMode;
  if (!["publicroll", "gmroll", "selfroll", "blindroll"].includes(mode))
    invalid();
  const operation = data.operation as "natural" | "assisted",
    patient = await woundBoundActor(data.patientUuid),
    healer =
      operation === "assisted" && text(data.healerUuid)
        ? await woundBoundActor(data.healerUuid)
        : patient;
  if (!allowed(user, patient) || !allowed(user, healer))
    throw new FirstEditionActionError("authority");
  const all = await bindings();
  if (all[id]) {
    if (
      all[id].patientUuid !== patient.uuid ||
      all[id].healerUuid !== healer.uuid ||
      all[id].initiator !== user.id
    )
      invalid();
    return (await context(id, user, false)).value;
  }
  if (!bodyPointTreatmentAvailable(patient))
    throw new FirstEditionActionError("conflict");
  const h = readActorHealth(patient);
  if (!h.pool) invalid();
  const medicine =
    operation === "assisted" && text(data.medicineItemId)
      ? healer.items.get(data.medicineItemId)
      : undefined;
  if (
    operation === "assisted" &&
    (medicine?.type !== "skill" ||
      (medicine.system.key !== "medicine" &&
        medicine.name.trim().toLocaleLowerCase() !== "medicine"))
  )
    invalid();
  const source = {
    attributeId: text(medicine?.system.attributeId)
      ? medicine.system.attributeId
      : currentAttributeRole("strength"),
    ...(medicine ? { itemId: medicine.id } : {}),
  };
  const stamina = patient.items.contents.find(
    (i) => i.type === "skill" && i.system.key === "stamina",
  );
  const survivalSource = {
    attributeId: text(stamina?.system.attributeId)
      ? stamina.system.attributeId
      : currentAttributeRole("strength"),
    ...(stamina ? { itemId: stamina.id } : {}),
  };
  const rest = operation === "natural" ? Number(data.restModifierScore) : 0;
  if (![-3, 0, 3].includes(rest)) invalid();
  const value = createFirstEditionBodyPointRoot({
    rootMessageId: id,
    initiatorUserId: user.id,
    patientControllerUserId: user.id,
    coordinatorUserId: game.user?.id ?? "",
    patient: actorBinding(patient),
    ...(operation === "assisted" ? { healer: actorBinding(healer) } : {}),
    operation,
    before: { ...h.pool },
    minutes: firstEditionMortalityElapsedMinutes(
      integer(
        record(record(patient.system.health).firstEditionState).mortalityRounds,
      ),
    ),
    restModifierScore: rest as -3 | 0 | 3,
    source,
    survivalSource,
    ...(operation === "natural"
      ? {
          fixedScore: Math.max(
            3,
            currentEffectivePipScore(
              integer(
                record(record(patient.system.attributes)[source.attributeId])
                  .score,
              ),
            ) + rest,
          ),
        }
      : {}),
    runtime: {
      profileId: currentConfiguredRulesProfile().id,
      healthModelId: h.modelId,
      damageStrategyId: h.damageStrategyId,
    },
  });
  if (Object.keys(all).length >= 4096)
    throw new FirstEditionActionError("uncertain");
  all[id] = {
    version: 1,
    initiator: user.id,
    patientUuid: patient.uuid,
    healerUuid: healer.uuid,
    before: beforeState(patient),
    witness: foundryRandomId(),
    skills: skillBindings(patient).map((s) => ({
      ...s,
      witness: foundryRandomId(),
    })),
    source: sourceState(healer, source),
    survivalSource: sourceState(patient, survivalSource),
  };
  await saveBindings(all);
  const recipients =
    game.users?.contents.filter((u) => u.isGM).map((u) => u.id) ?? [];
  requireAuthority();
  await ChatMessage.create(
    {
      _id: id,
      content: await renderer(value),
      speaker: ChatMessage.getSpeaker({ actor: patient }),
      ...chatVisibilityForMode("selfroll", recipients, user.id),
      flags: {
        [SYSTEM_ID]: {
          [BODY_POINT_ROOT_FLAG]: value,
          bodyPointRootRollMode: "selfroll",
          bodyPointRootScopePending: true,
        },
      },
    },
    { keepId: true },
  );
  return rootMessage(id).value;
}
let tail: Promise<unknown> = Promise.resolve();
export function processBodyPointRootOperation(
  data: Record<string, unknown>,
  user: FoundryUser,
): Promise<unknown> {
  const run = async () => {
    requireAuthority();
    if (canonical(data).length > 2_000_000) invalid();
    if (data.method === "create") return create(data, user);
    if (!text(data.rootMessageId)) invalid();
    const id = data.rootMessageId,
      c = await context(id, user, false);
    if (data.method === "load") return c.value;
    if (data.method === "cas") {
      const candidate = object(data.next);
      if (!candidate || !Array.isArray(candidate.stages)) invalid();
      const next = candidate as unknown as FirstEditionActionRoot;
      const stage = next.stages.find(
        (s) =>
          s.state !== "pending" &&
          c.value.action.stages.find((o) => o.id === s.id)?.state !== s.state,
      );
      if (!stage || data.revision !== c.value.action.revision) return false;
      let expected;
      let mode: D6RollMode | "preserve" = "preserve";
      if (
        stage.state === "claimed" &&
        (stage.claim?.kind === "d6-roll" || stage.claim?.kind === "plain-d6")
      ) {
        await context(id, user, true);
        if (
          stage.claim.kind === "d6-roll" &&
          canonical(stage.claim.runtime) !== canonical(woundRootRollRuntime())
        )
          invalid();
        expected = claimFirstEditionActionStage(
          c.value.action,
          stage.id,
          user.id,
          stage.claim,
        );
        mode =
          stage.claim.kind === "d6-roll"
            ? stage.claim.request.rollMode
            : stage.claim.rollMode;
      } else if (
        stage.state === "recorded" &&
        stage.receipt &&
        stage.receipt.kind !== "effect"
      ) {
        if (stage.spec.controllerUserId !== user.id)
          throw new FirstEditionActionError("authority");
        await hydrateD6FoundryRolls(stage.receipt.artifacts);
        expected = recordFirstEditionActionStage(
          c.value.action,
          stage.id,
          stage.receipt,
        );
        mode =
          stage.receipt.kind === "d6-roll"
            ? stage.receipt.result.request.rollMode
            : stage.claim?.kind === "plain-d6"
              ? stage.claim.rollMode
              : "preserve";
      } else invalid();
      if (canonical(expected) !== canonical(next)) invalid();
      return localStore(id, user).compareAndSwap(
        id,
        data.revision,
        expected,
        mode,
      );
    }
    if (
      ["matching-reward", "follow-up-claim", "follow-up-release"].includes(
        String(data.method),
      )
    ) {
      const stage = c.value.action.stages.find((s) => s.id === data.stageId);
      if (stage?.receipt?.kind !== "d6-roll") invalid();
      if (stage.spec.controllerUserId !== user.id)
        throw new FirstEditionActionError("authority");
      if (data.method === "matching-reward") {
        const actor = await woundBoundActor(stage.spec.subject.actorUuid);
        const result = await retryD6MatchingResultReward(
          actor,
          c.value.matchingResults?.[stage.id] ?? stage.receipt.result,
        );
        await write(id, {
          ...c.value,
          matchingResults: { ...c.value.matchingResults, [stage.id]: result },
        });
        return rootMessage(id).value;
      }
      const follows = { ...c.value.followUps };
      if (data.method === "follow-up-claim") {
        if (follows[stage.id]) return false;
        follows[stage.id] = user.id;
      } else {
        if (follows[stage.id] !== user.id) return false;
        Reflect.deleteProperty(follows, stage.id);
      }
      await write(id, { ...c.value, followUps: follows });
      return true;
    }
    if (data.method === "effect") await effect(id, user);
    else if (data.method === "advance")
      await write(id, advanceFirstEditionBodyPointRoot(c.value));
    else if (data.method === "present") await present(id, user);
    else if (data.method === "cancel") {
      if (
        user.id !== c.binding.initiator ||
        c.value.action.stages.some((s) => s.state !== "pending")
      )
        throw new FirstEditionActionError("authority");
      await write(id, {
        ...c.value,
        action: cancelFirstEditionAction(c.value.action),
      });
    } else invalid();
    return rootMessage(id).value;
  };
  const promise = tail.catch(() => undefined).then(run);
  tail = promise;
  return promise;
}
const pending = new Map<
  string,
  {
    authorityId: string;
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export async function requestBodyPointRoot(
  data: Record<string, unknown>,
): Promise<unknown> {
  await heartbeatDestinyCrypto();
  const authority = destinyActiveAuthority();
  if (!authority || !game.user) throw new FirstEditionActionError("authority");
  if (destinyClientIsAuthority())
    return processBodyPointRootOperation(data, game.user);
  const packetId = foundryRandomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(packetId);
      reject(new FirstEditionActionError("uncertain"));
    }, 15000);
    pending.set(packetId, {
      authorityId: authority.userId,
      resolve,
      reject,
      timer,
    });
    game.socket?.emit(
      `system.${SYSTEM_ID}`,
      { type: "body-point-root-operation", packetId, data },
      { recipients: [authority.userId] },
    );
  });
}
export function registerBodyPointRootAuthority(): void {
  game.settings.register(SYSTEM_ID, BINDINGS, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
    name: BINDINGS,
    hint: "",
  });
}
/** Wound lifecycle already maintains shared crypto presence when Destiny is off. */
export function registerBodyPointRootSocket(): void {
  game.socket?.on(`system.${SYSTEM_ID}`, (raw: unknown, senderId?: string) => {
    const p = object(raw);
    if (!p || !senderId || !text(p.packetId)) return;
    if (p.type === "body-point-root-reply") {
      const wait = pending.get(p.packetId);
      if (wait?.authorityId !== senderId) return;
      pending.delete(p.packetId);
      clearTimeout(wait.timer);
      if (p.error) wait.reject(new FirstEditionActionError("uncertain"));
      else wait.resolve(p.value);
    } else if (
      p.type === "body-point-root-operation" &&
      destinyClientIsAuthority()
    ) {
      const user = game.users?.get(senderId),
        data = object(p.data);
      if (!user || !data) return;
      void processBodyPointRootOperation(data, user).then(
        (value) =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            { type: "body-point-root-reply", packetId: p.packetId, value },
            { recipients: [senderId] },
          ),
        () =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            {
              type: "body-point-root-reply",
              packetId: p.packetId,
              error: true,
            },
            { recipients: [senderId] },
          ),
      );
    }
  });
}
