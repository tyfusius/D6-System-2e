import {
  firstEditionMortalityElapsedMinutes,
  requireDestinyValue as required,
  isFirstEditionWoundLevel,
  type D6RollMode,
} from "@d6-system-2e/core";
import {
  advanceFirstEditionWoundRoot,
  createFirstEditionWoundRoot,
  parseFirstEditionWoundRoot,
  type FirstEditionWoundRoot,
  type WoundOperation,
} from "../application/first-edition-wound-root";
import {
  cancelFirstEditionAction,
  claimFirstEditionActionStage,
  FirstEditionActionError,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type {
  FirstEditionActionRoot,
  FirstEditionActorBinding,
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
import { booleanSetting, numberSetting } from "../settings/setting-values";
import {
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
} from "../settings/roll-outcome";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS as K } from "../settings/settings-catalog";
import {
  actorHealthResolutionStrategy,
  firstEditionWoundTrackUpdate,
  readActorHealth,
} from "./health-runtime";
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
import { retryD6MatchingResultReward } from "./rolls/roll-service";
import { chatVisibilityForMode } from "./rolls/chat-visibility";
import { foundryRandomId } from "./foundry-random-id";

export const WOUND_ROOT_FLAG = "firstEditionWoundRoot";
const BINDINGS = "firstEditionWoundAuthority";
const ACTOR_RECEIPTS = "woundRootReceipts";
const MAX_WOUND_PREIMAGE_LENGTH = 2_000_000;
function validWoundPreimage(value: unknown): value is string {
  // This canonical health snapshot is not an identifier (text caps IDs at512).
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_WOUND_PREIMAGE_LENGTH
  );
}
interface Binding {
  readonly version: 1;
  readonly retired?: true;
  readonly initiator: string;
  readonly patientUuid: string;
  readonly healerUuid?: string;
  readonly before: string;
  readonly witness: string;
  readonly checkId?: string;
  readonly combatUuid?: string;
}
type EffectReceipt = Extract<FirstEditionStageReceipt, { kind: "effect" }>;
let renderer: (value: FirstEditionWoundRoot) => Promise<string> = () =>
  Promise.resolve("");
export function setWoundRootRenderer(value: typeof renderer): void {
  renderer = value;
}
function invalid(): never {
  throw new FirstEditionActionError("invalid");
}
function requireAuthority(): void {
  if (!destinyClientIsAuthority())
    throw new FirstEditionActionError("authority");
}
export function woundRootRollRuntime() {
  return {
    profileId: currentConfiguredRulesProfile().id,
    successEvaluator: currentSuccessRuntimeStrategy().evaluator,
    wildPolicy: currentWildDieRuntimeStrategy().policy,
    wildTriumph: {
      automaticSuccess: booleanSetting(K.wildTriumphAutomaticSuccess, false),
      characterPointAward: numberSetting(K.wildTriumphCharacterPointAward, 0),
      enabled: booleanSetting(K.wildTriumphEnabled, false),
      metaCurrencyAward: numberSetting(K.wildTriumphMetaCurrencyAward, 0),
      threshold: numberSetting(K.wildTriumphThreshold, 3),
    },
  };
}
export async function woundBoundActor(
  uuid: string,
): Promise<FoundryActorDocument & { readonly uuid: string }> {
  const actor = (await fromUuid(uuid)) as FoundryActorDocument | null;
  if (
    actor?.uuid !== uuid ||
    !["character", "creature", "npc"].includes(actor.type)
  )
    throw new FirstEditionActionError("deleted");
  return actor as FoundryActorDocument & { readonly uuid: string };
}
function allowed(user: FoundryUser, actor: FoundryActorDocument): boolean {
  return user.active && (user.isGM || actor.testUserPermission(user, "OWNER"));
}
export function woundRootModelAvailable(actor: FoundryActorDocument): boolean {
  const h = readActorHealth(actor);
  return (
    h.kind === "track" &&
    h.damageStrategyId === "open-d6.damage.wounds" &&
    !!h.track &&
    h.track.states.length > 0 &&
    h.track.states.every((s) => isFirstEditionWoundLevel(s.id))
  );
}
function beforeState(actor: FoundryActorDocument): string {
  return canonical({
    health: actor.system.health,
    posture: object(actor.system.movement)?.posture ?? "standing",
  });
}
function actorBinding(
  actor: FoundryActorDocument & { readonly uuid: string },
): FirstEditionActorBinding {
  const m = /^Scene\.([^.]+)\.Token\.([^.]+)\.Actor\./.exec(actor.uuid);
  return {
    actorId: actor.id,
    actorUuid: actor.uuid,
    ...(m
      ? { sceneId: required(m[1]), tokenUuid: `Scene.${m[1]}.Token.${m[2]}` }
      : {}),
  };
}
/** Ordered v0 (absent) -> v1 initialization. Existing v1 data is unchanged;
 * unknown versions fail closed. Old standalone chat/Actor flags are never adopted. */
export function migrateWoundAuthorityData(raw: unknown): {
  version: 1;
  roots: Record<string, Binding>;
} {
  if (raw === null || raw === undefined) return { version: 1, roots: {} };
  const value = object(raw),
    roots = object(value?.roots);
  if (
    value?.version !== 1 ||
    !roots ||
    Object.entries(roots).some(([id, rawBinding]) => {
      const binding = object(rawBinding);
      return (
        !/^[A-Za-z0-9]{16}$/.test(id) ||
        binding?.version !== 1 ||
        (binding.retired !== undefined && binding.retired !== true) ||
        !text(binding.initiator) ||
        !text(binding.patientUuid) ||
        !validWoundPreimage(binding.before) ||
        !text(binding.witness)
      );
    })
  )
    invalid();
  return {
    version: 1,
    roots: structuredClone(roots) as unknown as Record<string, Binding>,
  };
}
async function bindings(): Promise<Record<string, Binding>> {
  requireAuthority();
  const raw = game.settings.get(SYSTEM_ID, BINDINGS);
  return migrateWoundAuthorityData(
    raw ? await openDestinyEnvelope<unknown>(BINDINGS, raw) : null,
  ).roots;
}
async function saveBindings(value: Record<string, Binding>): Promise<void> {
  requireAuthority();
  const checked = migrateWoundAuthorityData({ version: 1, roots: value });
  const envelope = await sealDestiny(BINDINGS, checked, destinyEnrolledGMIds());
  await game.settings.set(SYSTEM_ID, BINDINGS, envelope);
}
function rootMessage(id: string) {
  const message = game.messages?.get(id);
  if (!message) throw new FirstEditionActionError("deleted");
  const value = parseFirstEditionWoundRoot(
    message.getFlag(SYSTEM_ID, WOUND_ROOT_FLAG),
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
  const patient = await woundBoundActor(binding.patientUuid);
  const healer = binding.healerUuid
    ? await woundBoundActor(binding.healerUuid)
    : patient;
  if (
    !allowed(user, patient) ||
    !allowed(user, healer) ||
    (!user.isGM && user.id !== binding.initiator)
  )
    throw new FirstEditionActionError("authority");
  if (value.initiatorUserId !== binding.initiator) invalid();
  if (
    value.action.subjects.find((s) => s.role === "patient")?.actor.actorUuid !==
      patient.uuid ||
    (binding.healerUuid &&
      value.action.subjects.find((s) => s.role === "healer")?.actor
        .actorUuid !== healer.uuid)
  )
    invalid();
  if (live) {
    if (binding.retired) throw new FirstEditionActionError("cancelled");
    const h = readActorHealth(patient);
    if (
      !woundRootModelAvailable(patient) ||
      h.modelId !== value.action.runtime.healthModelId ||
      h.damageStrategyId !== value.action.runtime.damageStrategyId ||
      currentConfiguredRulesProfile().id !== value.action.runtime.profileId ||
      beforeState(patient) !== binding.before
    )
      throw new FirstEditionActionError("conflict");
    const source = value.action.stages[0]?.spec;
    if (
      source?.kind === "d6-roll" &&
      source.source.itemId &&
      healer.items.get(source.source.itemId)?.type !== "skill"
    )
      throw new FirstEditionActionError("deleted");
    if (binding.combatUuid && !(await fromUuid(binding.combatUuid)))
      throw new FirstEditionActionError("deleted");
    if (
      value.operation === "round-mortality" &&
      actorHealthResolutionStrategy(patient).lifecycle.mortality !==
        value.action.runtime.roundLifecycleId
    )
      throw new FirstEditionActionError("conflict");
  }
  return { message, value, binding, patient, healer };
}
async function write(
  id: string,
  value: FirstEditionWoundRoot,
  extra: Record<string, unknown> = {},
) {
  requireAuthority();
  if (!parseFirstEditionWoundRoot(value)) invalid();
  const { message } = rootMessage(id);
  const content = await renderer(value);
  requireAuthority();
  if (game.messages?.get(id) !== message)
    throw new FirstEditionActionError("deleted");
  await message.update({
    ...extra,
    content,
    [`flags.${SYSTEM_ID}.${WOUND_ROOT_FLAG}`]: value,
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
        message.getFlag(SYSTEM_ID, "woundRootScopePending") === true &&
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
              [`flags.${SYSTEM_ID}.woundRootScopePending`]: false,
              [`flags.${SYSTEM_ID}.woundRootRollMode`]: scope,
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
    if (s.receipt?.kind !== "d6-roll") continue;
    await hydrateD6FoundryRolls(s.receipt.artifacts);
    ledger = appendD6InitiatingActionResult(ledger, {
      appendId: s.id,
      kind: "first-edition-wound-check",
      details: { operation: value.operation },
      rollMode: s.receipt.result.request.rollMode,
      rolls: s.receipt.artifacts.map((a) => a.evidence),
    });
  }
  for (const s of value.action.stages) {
    if (s.receipt?.kind !== "d6-roll") continue;
    const entry = ledger.entries.find((e) => e.appendId === s.id);
    if (!entry) invalid();
    await appendD6InitiatingActionPresentation({
      message,
      ledger,
      entry,
      artifacts: await hydrateD6FoundryRolls(s.receipt.artifacts),
      rollUserId: s.spec.controllerUserId,
    });
  }
  await write(id, value);
}
async function adoptEffectAuthority(id: string): Promise<void> {
  requireAuthority();
  const { value } = rootMessage(id);
  const current = value.action.stages.find((s) => s.state !== "recorded");
  if (
    value.action.stages.some(
      (s) => s.spec.kind === "effect" && s.state === "recorded",
    ) ||
    value.action.coordinatorUserId === game.user?.id ||
    (current && (current.state !== "pending" || current.spec.kind !== "effect"))
  )
    return;
  const coordinatorUserId = game.user?.id ?? "";
  await write(id, {
    ...value,
    action: {
      ...value.action,
      coordinatorUserId,
      revision: value.action.revision + 1,
      stages: value.action.stages.map((s) =>
        s.state === "pending" && s.spec.kind === "effect"
          ? { ...s, spec: { ...s.spec, controllerUserId: coordinatorUserId } }
          : s,
      ),
    },
  });
}
async function effect(id: string, requester: FoundryUser) {
  await context(id, requester, false);
  await adoptEffectAuthority(id);
  const user = game.user;
  if (!user) throw new FirstEditionActionError("authority");
  const { value } = rootMessage(id),
    stage = value.action.stages.find((s) => s.state !== "recorded");
  if (stage?.spec.kind !== "effect") invalid();
  const readReceipt = async (): Promise<EffectReceipt | null> => {
    const c = await context(id, user, false),
      saved = object(
        object(c.patient.getFlag(SYSTEM_ID, ACTOR_RECEIPTS))?.[id],
      );
    if (saved?.version !== 1 || saved.witness !== c.binding.witness)
      return null;
    // Actor flags contain an opaque proof only, never dice, healer or controller identity.
    return {
      kind: "effect",
      plan: stage.spec.kind === "effect" ? stage.spec.plan : invalid(),
      receiptKey: `${stage.id}:effect`,
      authorityReceiptId: c.binding.witness,
      outcome: "applied",
    };
  };
  await executeFirstEditionEffect(
    {
      rootMessageId: id,
      operationId: value.action.operationId,
      stageId: stage.id,
      authenticatedSenderId: user.id,
    },
    {
      ...localStore(id, user),
      readReceipt,
      compareAndApply: async (plan, receiptKey) => {
        const existing = await readReceipt();
        if (existing) return existing;
        const c = await context(id, user, true);
        if (plan.kind !== "health-change" || plan.after.kind !== "wounds")
          invalid();
        const changes = firstEditionWoundTrackUpdate(
          c.patient,
          plan.after.stateId,
        );
        if (
          value.operation === "round-mortality" &&
          plan.after.stateId === "mortally-wounded"
        ) {
          changes["system.health.firstEditionState.mortalityCheckId"] =
            value.action.clock?.checkId;
          changes["system.health.firstEditionState.mortalityRounds"] =
            value.action.clock?.completedRounds.value;
          if (
            value.action.runtime.healthModelId === "open-d6.health.wound-track"
          )
            changes["system.health.firstEditionWound"] = "mortally-wounded";
        }
        if (
          Object.keys(
            object(c.patient.getFlag(SYSTEM_ID, ACTOR_RECEIPTS)) ?? {},
          ).length >= 4096
        )
          throw new FirstEditionActionError("uncertain");
        requireAuthority();
        await c.patient.update({
          ...changes,
          [`flags.${SYSTEM_ID}.${ACTOR_RECEIPTS}.${id}`]: {
            version: 1,
            witness: c.binding.witness,
          },
        });
        return {
          kind: "effect",
          plan,
          receiptKey,
          authorityReceiptId: c.binding.witness,
          outcome: "applied",
        };
      },
    },
  );
}
async function create(data: Record<string, unknown>, user: FoundryUser) {
  const id = data.rootMessageId;
  if (
    !text(id) ||
    !/^[A-Za-z0-9]{16}$/.test(id) ||
    !text(data.patientUuid) ||
    !["natural", "assisted", "manual-mortality", "round-mortality"].includes(
      String(data.operation),
    )
  )
    invalid();
  const mode = data.rollMode as D6RollMode;
  if (!["publicroll", "gmroll", "selfroll", "blindroll"].includes(mode))
    invalid();
  const patient = await woundBoundActor(data.patientUuid),
    operation = data.operation as WoundOperation;
  const healer =
    operation === "assisted" && text(data.healerUuid)
      ? await woundBoundActor(data.healerUuid)
      : patient;
  if (
    !allowed(user, patient) ||
    !allowed(user, healer) ||
    (operation === "round-mortality" && !user.isGM)
  )
    throw new FirstEditionActionError("authority");
  if (!woundRootModelAvailable(patient))
    throw new FirstEditionActionError("invalid");
  const h = readActorHealth(patient),
    wound = h.track?.currentStateId;
  if (!isFirstEditionWoundLevel(wound)) invalid();
  const all = await bindings();
  if (all[id]) {
    if (all[id].initiator !== user.id || all[id].patientUuid !== patient.uuid)
      invalid();
    return (await context(id, user, false)).value;
  }
  let clock;
  if (operation === "round-mortality") {
    if (
      !text(data.combatUuid) ||
      !text(data.checkId) ||
      !(await fromUuid(data.combatUuid)) ||
      wound !== "mortally-wounded"
    )
      invalid();
    const combat = (await fromUuid(data.combatUuid)) as {
      id?: string;
      round?: number;
      combatants?: { contents: { actor?: FoundryActorDocument }[] };
    };
    if (
      !combat.id ||
      !Number.isSafeInteger(combat.round) ||
      Number(combat.round) <= 1 ||
      data.checkId !== `${combat.id}:round:${Number(combat.round) - 1}` ||
      !combat.combatants?.contents.some((c) => c.actor?.uuid === patient.uuid)
    )
      invalid();
    if (
      actorHealthResolutionStrategy(patient).lifecycle.mortality !==
      "open-d6.elapsed-rounds"
    )
      invalid();
    const prior = Object.entries(all).find(
      ([, b]) =>
        b.patientUuid === patient.uuid &&
        b.checkId === data.checkId &&
        b.combatUuid === data.combatUuid,
    );
    if (prior) {
      const existing = (await context(prior[0], user, false)).value;
      return existing.action.status === "complete" ? null : existing;
    }
    // A later hook cannot bypass an unresolved earlier check, including a deleted root.
    for (const [rootId, binding] of Object.entries(all)) {
      if (binding.patientUuid !== patient.uuid || !binding.checkId) continue;
      const proof = object(
        object(patient.getFlag(SYSTEM_ID, ACTOR_RECEIPTS))?.[rootId],
      );
      if (
        binding.retired ||
        (proof?.version === 1 && proof.witness === binding.witness)
      )
        continue;
      const saved = game.messages?.get(rootId);
      const root =
        saved &&
        parseFirstEditionWoundRoot(saved.getFlag(SYSTEM_ID, WOUND_ROOT_FLAG));
      if (!root || root.action.status === "open")
        throw new FirstEditionActionError("uncertain");
    }
    const state = object(object(patient.system.health)?.firstEditionState);
    if (state?.mortalityCheckId === data.checkId) return null;
    const rounds = Number(state?.mortalityRounds ?? 0) + 1;
    clock = {
      checkId: data.checkId,
      combatUuid: data.combatUuid,
      completedRounds: { value: rounds, unit: "rounds" as const },
      elapsedMinutes: {
        value: firstEditionMortalityElapsedMinutes(rounds),
        unit: "minutes" as const,
      },
    };
  }
  if (
    operation === "assisted" &&
    (!text(data.medicineItemId) ||
      healer.items.get(data.medicineItemId)?.type !== "skill")
  )
    invalid();
  const skill =
    operation === "assisted"
      ? healer.items.get(String(data.medicineItemId))
      : undefined;
  const value = createFirstEditionWoundRoot({
    rootMessageId: id,
    controllerUserId: user.id,
    coordinatorUserId: game.user?.id ?? "",
    patient: actorBinding(patient),
    ...(operation === "assisted" ? { healer: actorBinding(healer) } : {}),
    operation,
    wound,
    ...(operation === "assisted" &&
    currentConfiguredRulesProfile().homebrew.tyfusiusMedicalConsumables &&
    healer.uuid === patient.uuid
      ? {
          difficultyLadder: currentConfiguredRulesProfile().difficultyLadder,
          selfTreatment: true,
        }
      : {}),
    source: {
      attributeId: text(skill?.system.attributeId)
        ? skill.system.attributeId
        : currentAttributeRole("strength"),
      ...(skill ? { itemId: skill.id } : {}),
    },
    runtime: {
      profileId: currentConfiguredRulesProfile().id,
      healthModelId: h.modelId,
      damageStrategyId: h.damageStrategyId,
      ...(clock ? { roundLifecycleId: "open-d6.elapsed-rounds" } : {}),
    },
    ...(clock
      ? { clock, minutes: clock.elapsedMinutes.value }
      : operation === "manual-mortality"
        ? { minutes: Number(data.minutes) }
        : {}),
  });
  if (Object.keys(all).length >= 4096)
    throw new FirstEditionActionError("uncertain");
  all[id] = {
    version: 1,
    initiator: user.id,
    patientUuid: patient.uuid,
    ...(operation === "assisted" ? { healerUuid: healer.uuid } : {}),
    before: beforeState(patient),
    witness: foundryRandomId(),
    ...(clock ? { checkId: clock.checkId, combatUuid: clock.combatUuid } : {}),
  };
  await saveBindings(all); // reservation before creation: deletion/lost reply cannot create another root
  const recipients =
    game.users?.contents.filter((u) => u.isGM).map((u) => u.id) ?? [];
  // The editable builder has not selected its final audience yet. Keep all
  // identifying content private until the validated pre-dice claim publishes
  // the selected scope atomically. A no-dice rest already has its final mode.
  const scopePending = value.action.stages[0]?.spec.kind === "d6-roll";
  const initialMode = scopePending ? "selfroll" : mode;
  const scope = chatVisibilityForMode(initialMode, recipients, user.id);
  requireAuthority();
  await ChatMessage.create(
    {
      _id: id,
      content: await renderer(value),
      speaker: ChatMessage.getSpeaker({ actor: patient }),
      ...scope,
      flags: {
        [SYSTEM_ID]: {
          [WOUND_ROOT_FLAG]: value,
          woundRootRollMode: initialMode,
          woundRootScopePending: scopePending,
        },
      },
    },
    { keepId: true },
  );
  return rootMessage(id).value;
}
let tail: Promise<unknown> = Promise.resolve();
export function processWoundRootOperation(
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
      if (stage.state === "claimed" && stage.claim?.kind === "d6-roll") {
        await context(id, user, true);
        if (
          canonical(stage.claim.runtime) !== canonical(woundRootRollRuntime())
        )
          invalid();
        expected = claimFirstEditionActionStage(
          c.value.action,
          stage.id,
          user.id,
          stage.claim,
        );
      } else if (
        stage.state === "recorded" &&
        stage.receipt?.kind === "d6-roll"
      ) {
        if (stage.spec.controllerUserId !== user.id)
          throw new FirstEditionActionError("authority");
        await hydrateD6FoundryRolls(stage.receipt.artifacts);
        expected = recordFirstEditionActionStage(
          c.value.action,
          stage.id,
          stage.receipt,
        );
      } else invalid();
      if (canonical(expected) !== canonical(next)) invalid();
      const mode =
        stage.claim?.kind === "d6-roll"
          ? stage.claim.request.rollMode
          : stage.receipt?.kind === "d6-roll"
            ? stage.receipt.result.request.rollMode
            : "preserve";
      return localStore(id, user).compareAndSwap(
        id,
        data.revision,
        expected,
        mode,
      );
    }
    if (data.method === "adopt-roll") {
      const first = c.value.action.stages[0];
      if (
        !user.isGM ||
        c.value.operation !== "round-mortality" ||
        c.value.action.status !== "open" ||
        !first ||
        c.value.action.stages.some((s) => s.state !== "pending") ||
        game.users?.get(first.spec.controllerUserId)?.active
      )
        throw new FirstEditionActionError("authority");
      await write(id, {
        ...c.value,
        action: {
          ...c.value.action,
          revision: c.value.action.revision + 1,
          stages: c.value.action.stages.map((s) => ({
            ...s,
            spec: { ...s.spec, controllerUserId: user.id },
          })),
        },
      });
    } else if (data.method === "effect") await effect(id, user);
    else if (data.method === "advance") {
      if (c.value.initiatorUserId !== user.id && !user.isGM)
        throw new FirstEditionActionError("authority");
      await adoptEffectAuthority(id);
      await write(id, advanceFirstEditionWoundRoot(rootMessage(id).value));
    } else if (data.method === "cancel") {
      if (c.value.operation === "round-mortality") {
        // Explicit GM reconciliation, never an automatic consequence of rendering.
        // A missing unresolved card still requires review; it is never recreated.
        if (
          !user.isGM ||
          beforeState(c.patient) === c.binding.before ||
          c.value.action.status !== "open"
        )
          throw new FirstEditionActionError("authority");
        const proof = object(
          object(c.patient.getFlag(SYSTEM_ID, ACTOR_RECEIPTS))?.[id],
        );
        if (proof?.version === 1 && proof.witness === c.binding.witness)
          throw new FirstEditionActionError("uncertain");
        const all = await bindings();
        all[id] = { ...c.binding, retired: true };
        await saveBindings(all);
      } else if (
        user.id !== c.binding.initiator ||
        c.value.action.stages.some((s) => s.state !== "pending")
      )
        throw new FirstEditionActionError("authority");
      await write(id, {
        ...c.value,
        action: cancelFirstEditionAction(c.value.action),
      });
    } else if (data.method === "matching-reward") {
      const receipt = c.value.action.stages[0]?.receipt;
      if (receipt?.kind !== "d6-roll") invalid();
      const matchingResult = await retryD6MatchingResultReward(
        c.healer,
        c.value.matchingResult ?? receipt.result,
      );
      await write(id, { ...c.value, matchingResult });
    } else if (
      data.method === "follow-up-claim" ||
      data.method === "follow-up-release"
    ) {
      const stage = c.value.action.stages[0];
      if (
        stage?.receipt?.kind !== "d6-roll" ||
        stage.spec.controllerUserId !== user.id
      )
        throw new FirstEditionActionError("authority");
      const followUps = { ...c.value.followUps };
      if (data.method === "follow-up-claim") {
        if (followUps[stage.id]) return false;
        followUps[stage.id] = user.id;
      } else {
        if (followUps[stage.id] !== user.id) return false;
        Reflect.deleteProperty(followUps, stage.id);
      }
      await write(id, { ...c.value, followUps });
      return true;
    } else if (data.method === "present") await present(id, user);
    else invalid();
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
export async function requestWoundRoot(
  data: Record<string, unknown>,
): Promise<unknown> {
  await heartbeatDestinyCrypto();
  const authority = destinyActiveAuthority();
  if (!authority || !game.user) throw new FirstEditionActionError("authority");
  if (destinyClientIsAuthority())
    return processWoundRootOperation(data, game.user);
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
      { type: "wound-root-operation", packetId, data },
      { recipients: [authority.userId] },
    );
  });
}
export function registerWoundRootAuthority(): void {
  game.settings.register(SYSTEM_ID, BINDINGS, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
    name: BINDINGS,
    hint: "",
  });
}
let heartbeatStarted = false;
/** Attach after Foundry has established the native socket connection. */
export function registerWoundRootSocket(): void {
  // Wound authority is required even when the optional Destiny pool is off.
  // This maintains only crypto presence, never Destiny gameplay or root effects.
  if (!heartbeatStarted && typeof window !== "undefined") {
    heartbeatStarted = true;
    const maintain = () => {
      if (game.user?.isGM) void heartbeatDestinyCrypto().catch(console.error);
    };
    maintain();
    setInterval(maintain, 10000);
  }
  game.socket?.on(`system.${SYSTEM_ID}`, (raw: unknown, senderId?: string) => {
    const p = object(raw);
    if (!p || !senderId || !text(p.packetId)) return;
    if (p.type === "wound-root-reply") {
      const wait = pending.get(p.packetId);
      if (wait?.authorityId !== senderId) return;
      pending.delete(p.packetId);
      clearTimeout(wait.timer);
      if (p.error) wait.reject(new FirstEditionActionError("uncertain"));
      else wait.resolve(p.value);
    } else if (
      p.type === "wound-root-operation" &&
      destinyClientIsAuthority()
    ) {
      const user = game.users?.get(senderId),
        data = object(p.data);
      if (!user || !data) return;
      void processWoundRootOperation(data, user).then(
        (value) =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            { type: "wound-root-reply", packetId: p.packetId, value },
            { recipients: [senderId] },
          ),
        () =>
          game.socket?.emit(
            `system.${SYSTEM_ID}`,
            { type: "wound-root-reply", packetId: p.packetId, error: true },
            { recipients: [senderId] },
          ),
      );
    }
  });
}
