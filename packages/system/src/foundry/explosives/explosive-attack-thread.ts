import {
  claimD6ExplosiveZoneDamage,
  completeD6ExplosiveTarget,
  completeD6ExplosiveZoneDamage,
  createD6ExplosiveAttackThread,
  d6ExplosiveAttackThreadComplete,
  parseD6ExplosiveAttackThread,
  recoverD6ExplosiveAttackThread,
  releaseD6ExplosiveZoneDamage,
  setD6ExplosiveTargetStage,
  type D6ExplosiveAttackThreadV1,
  type D6ExplosiveThreadTargetV1,
} from "../../application/explosive-attack-thread";
import type { D6ExplosiveRegionStateV1 } from "../../application/explosive-workflow";
import {
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultV1,
} from "../../application/initiating-action-results";
import {
  activeD6PendingInteractions,
  resolveD6PendingInteraction,
  subscribeD6PendingInteractions,
} from "../../application/pending-interactions";
import { SYSTEM_ID } from "../../constants";
import { registerFoundryPendingInteraction } from "../pending-interactions";
import {
  appendD6InitiatingActionPresentation,
  D6_INITIATING_ACTION_RESULTS_FLAG,
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
} from "../initiating-action-message";
import { cancelRollRequest } from "../roll-requests";
import {
  resolveExplosiveThreadDamageTarget,
  type ExplosiveThreadDamageOutcome,
} from "../rolls/damage-resolution";
import {
  cancelRequestedRollDialog,
  explosiveWeaponDamageScore,
  rollExplosiveZoneDamage,
} from "../rolls/roll-service";
import { currentSceneExplosiveTargets } from "./explosive-canvas";
import {
  activeD6ExplosiveGm,
  d6ExplosiveRegionState,
  requestD6ExplosiveMutation,
} from "./explosive-region";
import { d6BlastDamageScore } from "@d6-system-2e/core";
import {
  d6HealthOutcomeTone,
  type D6HealthOutcomeTone,
} from "../health-outcome-tone";

export const D6_EXPLOSIVE_ATTACK_THREAD_FLAG = "explosiveAttackThread";

type ThreadMessage = FoundryChatMessageDocument & {
  readonly timestamp?: number;
};

interface ThreadRegion {
  readonly id: string;
  getFlag(scope: string, key: string): unknown;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

interface ResolvedTarget {
  readonly actor: FoundryActorDocument;
  readonly hidden: boolean;
  readonly label: string;
  readonly targetKey: string;
  readonly tokenId: string;
  readonly visible: boolean;
  readonly zone: 1 | 2 | 3 | 4;
}

const activeResistance = new Map<string, Promise<void>>();
const threadMutations = new Map<string, Promise<void>>();
const deletedThreadIds = new Set<string>();
const boundThreadActionCards = new WeakSet<HTMLElement>();
let registered = false;
let unsubscribePendingInteractions: (() => void) | undefined;

/** Map stable health-model ids to the system's existing semantic condition
 * palette. Custom states retain their authored label and use the established
 * accent fallback rather than inventing a parallel color scale. */
export function explosiveHealthTone(
  stateId: string | undefined,
): D6HealthOutcomeTone {
  return d6HealthOutcomeTone(stateId);
}

function messageById(id: string): ThreadMessage | null {
  return (
    (
      game as FoundryGame & {
        readonly messages?: { get(id: string): ThreadMessage | undefined };
      }
    ).messages?.get(id) ?? null
  );
}

function messageCreatedAt(message: ThreadMessage): number {
  if (!Number.isFinite(message.timestamp) || Number(message.timestamp) <= 0) {
    throw new Error("D6E2.Explosive.Thread.AttackMessageMismatch");
  }
  return Number(message.timestamp);
}

function threadWithCanonicalResults(
  thread: D6ExplosiveAttackThreadV1,
  rawResults: unknown,
): D6ExplosiveAttackThreadV1 | null {
  if (rawResults === undefined) return thread;
  const results = parseD6InitiatingActionResultLedger(rawResults);
  if (
    results?.rootMessageId !== thread.attackMessageId ||
    results.requestId !== thread.requestId
  ) {
    return null;
  }
  if (results.revision < thread.results.revision) return thread;
  if (
    results.revision === thread.results.revision &&
    JSON.stringify(results) !== JSON.stringify(thread.results)
  ) {
    return null;
  }
  return results === thread.results
    ? thread
    : Object.freeze({ ...thread, results });
}

export function d6ExplosiveAttackThreadFromMessage(
  message: ThreadMessage,
): D6ExplosiveAttackThreadV1 | null {
  const thread = parseD6ExplosiveAttackThread(
    message.getFlag(SYSTEM_ID, D6_EXPLOSIVE_ATTACK_THREAD_FLAG),
  );
  if (!thread) return null;
  return threadWithCanonicalResults(
    thread,
    message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
  );
}

function regionDocument(
  sceneId: string,
  regionId: string,
): ThreadRegion | null {
  const scene = game.scenes?.get(sceneId) as
    | (FoundrySceneDocument & {
        readonly regions?: { get(id: string): ThreadRegion | undefined };
      })
    | undefined;
  return scene?.regions?.get(regionId) ?? null;
}

function authoritativeThread(
  message: ThreadMessage,
): D6ExplosiveAttackThreadV1 | null {
  const presentation = d6ExplosiveAttackThreadFromMessage(message);
  if (presentation) {
    const region = regionDocument(presentation.sceneId, presentation.regionId);
    const state = region ? d6ExplosiveRegionState(region) : null;
    const parsedThread = region
      ? parseD6ExplosiveAttackThread(
          region.getFlag(SYSTEM_ID, D6_EXPLOSIVE_ATTACK_THREAD_FLAG),
        )
      : null;
    const thread = parsedThread
      ? threadWithCanonicalResults(
          parsedThread,
          region?.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
        )
      : null;
    if (
      state?.attackMessageId === message.id &&
      state.requestId === presentation.requestId &&
      thread?.attackMessageId === message.id &&
      thread.requestId === state.requestId
    ) {
      return thread;
    }
  }
  const matches = (game.scenes?.contents ?? []).flatMap((scene) =>
    (
      (
        scene as FoundrySceneDocument & {
          readonly regions?: { readonly contents?: readonly ThreadRegion[] };
        }
      ).regions?.contents ?? []
    ).flatMap((region) => {
      const state = d6ExplosiveRegionState(region);
      if (state?.attackMessageId !== message.id) return [];
      const parsedThread = parseD6ExplosiveAttackThread(
        region.getFlag(SYSTEM_ID, D6_EXPLOSIVE_ATTACK_THREAD_FLAG),
      );
      const thread = parsedThread
        ? threadWithCanonicalResults(
            parsedThread,
            region.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
          )
        : null;
      return thread?.requestId === state.requestId ? [thread] : [];
    }),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

async function persistThread(
  message: ThreadMessage,
  thread: D6ExplosiveAttackThreadV1,
): Promise<void> {
  if (message.id !== thread.attackMessageId) {
    throw new Error("D6E2.Explosive.Thread.AttackMessageMismatch");
  }
  const region = regionDocument(thread.sceneId, thread.regionId);
  const state = region ? d6ExplosiveRegionState(region) : null;
  if (
    !region ||
    state?.requestId !== thread.requestId ||
    state.attackMessageId !== message.id
  ) {
    throw new Error("D6E2.Explosive.Thread.RegionMismatch");
  }
  await region.update({
    [`flags.${SYSTEM_ID}.${D6_EXPLOSIVE_ATTACK_THREAD_FLAG}`]:
      structuredClone(thread),
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(thread.results),
  });
  await message.update({
    [`flags.${SYSTEM_ID}.${D6_EXPLOSIVE_ATTACK_THREAD_FLAG}`]:
      structuredClone(thread),
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(thread.results),
  });
}

async function mutateThread(
  message: ThreadMessage,
  mutation: (thread: D6ExplosiveAttackThreadV1) => D6ExplosiveAttackThreadV1,
): Promise<D6ExplosiveAttackThreadV1> {
  let result: D6ExplosiveAttackThreadV1 | undefined;
  const previous = threadMutations.get(message.id) ?? Promise.resolve();
  const pending = previous.then(async () => {
    const current = authoritativeThread(message);
    if (!current) throw new Error("D6E2.Explosive.Thread.Invalid");
    result = mutation(current);
    if (result !== current) await persistThread(message, result);
  });
  threadMutations.set(message.id, pending);
  try {
    await pending;
  } finally {
    if (threadMutations.get(message.id) === pending) {
      threadMutations.delete(message.id);
    }
  }
  if (!result) throw new Error("D6E2.Explosive.Thread.Invalid");
  return result;
}

export async function d6ExplosiveTargetKey(
  requestId: string,
  tokenId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${requestId}\u0000${tokenId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function resolvedTargets(
  state: D6ExplosiveRegionStateV1,
): Promise<readonly ResolvedTarget[]> {
  const targets = currentSceneExplosiveTargets(
    state.resolvedPoint,
    state.blastProfile,
  );
  const resolved = await Promise.all(
    targets.map(async (target): Promise<ResolvedTarget | null> => {
      const token = canvas.tokens?.placeables.find(
        (candidate) => candidate.id === target.tokenId,
      );
      if (!token?.actor) return null;
      return Object.freeze({
        actor: token.actor,
        hidden: !target.visible,
        label: target.visible
          ? target.label
          : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
        targetKey: await d6ExplosiveTargetKey(state.requestId, target.tokenId),
        tokenId: target.tokenId,
        visible: target.visible,
        zone: target.zone,
      });
    }),
  );
  return Object.freeze(
    resolved
      .filter((target): target is ResolvedTarget => target !== null)
      .sort(
        (left, right) =>
          left.zone - right.zone ||
          left.targetKey.localeCompare(right.targetKey),
      ),
  );
}

async function resolvedThreadTargets(
  state: D6ExplosiveRegionStateV1,
  thread: D6ExplosiveAttackThreadV1,
): Promise<readonly ResolvedTarget[]> {
  const placeables = canvas.tokens?.placeables ?? [];
  const keyed = await Promise.all(
    placeables.map(async (token) => ({
      key: await d6ExplosiveTargetKey(state.requestId, token.id),
      token,
    })),
  );
  return Object.freeze(
    thread.targets.map((target) => {
      const matches = keyed.filter(({ key }) => key === target.targetKey);
      const token = matches.length === 1 ? matches[0]?.token : undefined;
      if (
        !token?.actor ||
        (target.visible &&
          (target.tokenId !== token.id || target.actorId !== token.actor.id))
      ) {
        throw new Error("D6E2.Explosive.Thread.TargetUnavailable");
      }
      return Object.freeze({
        actor: token.actor,
        hidden: !target.visible,
        label: target.visible
          ? (target.actorName ?? token.actor.name)
          : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
        targetKey: target.targetKey,
        tokenId: token.id,
        visible: target.visible,
        zone: target.zone,
      });
    }),
  );
}

export async function createD6ExplosiveAttackThreadForDetonation(
  state: D6ExplosiveRegionStateV1,
  sourceActor: FoundryActorDocument,
  item: FoundryItemDocument,
): Promise<D6ExplosiveAttackThreadV1> {
  if (game.user?.isGM !== true || activeD6ExplosiveGm()?.id !== game.user.id) {
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  }
  if (!state.attackMessageId) {
    throw new Error("D6E2.Explosive.Thread.AttackMessageMissing");
  }
  const message = messageById(state.attackMessageId);
  if (!message) throw new Error("D6E2.Explosive.Thread.AttackMessageMissing");
  const region = regionDocument(state.sceneId, state.regionId);
  const regionState = region ? d6ExplosiveRegionState(region) : null;
  if (
    !region ||
    regionState?.requestId !== state.requestId ||
    regionState.attackMessageId !== message.id
  ) {
    throw new Error("D6E2.Explosive.Thread.RegionMismatch");
  }
  const parsedExisting = parseD6ExplosiveAttackThread(
    region.getFlag(SYSTEM_ID, D6_EXPLOSIVE_ATTACK_THREAD_FLAG),
  );
  const existing = parsedExisting
    ? threadWithCanonicalResults(
        parsedExisting,
        region.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
      )
    : null;
  if (existing) {
    if (
      existing.requestId !== state.requestId ||
      existing.regionId !== state.regionId
    ) {
      throw new Error("D6E2.Explosive.Thread.AttackMessageMismatch");
    }
    await synchronizeD6ExplosiveAttackThread(message, state, true);
    return existing;
  }
  const targets = await resolvedTargets(state);
  const attackRoll = message.getFlag(SYSTEM_ID, "roll") as
    { readonly request?: { readonly rollMode?: unknown } } | undefined;
  const rollMode = attackRoll?.request?.rollMode;
  if (
    rollMode !== "blindroll" &&
    rollMode !== "gmroll" &&
    rollMode !== "publicroll" &&
    rollMode !== "selfroll"
  ) {
    throw new Error("D6E2.Explosive.Thread.AttackMessageMismatch");
  }
  const baseDamageScore = explosiveWeaponDamageScore(sourceActor, item.id);
  const zoneDamageScores = Object.fromEntries(
    ([1, 2, 3, 4] as const).map((zone) => [
      zone,
      d6BlastDamageScore(baseDamageScore, zone, state.blastProfile),
    ]),
  );
  const existingResults = parseD6InitiatingActionResultLedger(
    region.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
  );
  const thread = createD6ExplosiveAttackThread({
    aimedPoint: state.aimedPoint,
    attackHit: state.attackHit === true,
    attackMessageId: message.id,
    damageKind: state.blastProfile.damageKind,
    regionId: state.regionId,
    requestId: state.requestId,
    ...(existingResults ? { results: existingResults } : {}),
    resolvedPoint: state.resolvedPoint,
    rollMode,
    sceneId: state.sceneId,
    targets: targets.map((target) => ({
      ...(target.visible
        ? {
            actorId: target.actor.id,
            actorImg: target.actor.img,
            actorName: target.actor.name,
            tokenId: target.tokenId,
          }
        : {}),
      targetKey: target.targetKey,
      visible: target.visible,
      zone: target.zone,
    })),
    zoneDamageScores,
  });
  await persistThread(message, thread);
  await synchronizeD6ExplosiveAttackThread(message, state);
  if (d6ExplosiveAttackThreadComplete(thread)) {
    await requestD6ExplosiveMutation({
      operation: "delete",
      regionId: thread.regionId,
      requestId: thread.requestId,
      sceneId: thread.sceneId,
    });
  }
  return thread;
}

function damagePromptId(
  thread: D6ExplosiveAttackThreadV1,
  zone: number,
): string {
  return `explosive:${thread.requestId}:damage:${zone}`;
}

function resistancePromptId(
  thread: D6ExplosiveAttackThreadV1,
  targetKey: string,
): string {
  return `explosive:${thread.requestId}:resistance:${targetKey}`;
}

async function executeZoneDamage(
  message: ThreadMessage,
  state: D6ExplosiveRegionStateV1,
  zone: 1 | 2 | 3 | 4,
): Promise<"dismissed" | "resolved"> {
  const current = authoritativeThread(message);
  if (!current) throw new Error("D6E2.Explosive.Thread.Invalid");
  const zoneStage = current.zones.find((entry) => entry.zone === zone);
  if (zoneStage?.stage === "rolled") return "resolved";
  if (game.user?.isGM !== true || activeD6ExplosiveGm()?.id !== game.user.id) {
    throw new Error("D6E2.Explosive.Error.NotAuthorized");
  }
  await mutateThread(message, (thread) =>
    claimD6ExplosiveZoneDamage(thread, zone),
  );
  try {
    const actor = (await fromUuid(
      state.actorUuid,
    )) as FoundryActorDocument | null;
    const item = (await fromUuid(state.itemUuid)) as FoundryItemDocument | null;
    if (!actor || !item || item.parent?.uuid !== actor.uuid) {
      throw new Error("D6E2.Explosive.Error.WeaponUnavailable");
    }
    const targets = (await resolvedThreadTargets(state, current)).filter(
      (target) => target.zone === zone,
    );
    if (targets.length === 0) {
      throw new Error("D6E2.Explosive.Thread.TargetUnavailable");
    }
    const hidden = targets.some((target) => target.hidden);
    const effectiveRollMode = hidden ? "blindroll" : current.rollMode;
    const result = await rollExplosiveZoneDamage(
      actor,
      item.id,
      zoneStage?.damageScore ?? 0,
      state.blastProfile.damageKind,
      state.requestId,
      zone,
      {
        actor,
        hidden,
        name: game.i18n.format("D6E2.Explosive.Thread.ZoneLabel", { zone }),
        tokenId: "",
      },
      effectiveRollMode,
      async (rolled, artifacts) => {
        const serialized = await serializeD6FoundryRolls(artifacts);
        const presentation: D6InitiatingActionResultV1 = {
          appendId: `${state.requestId}:damage:${zone}`,
          details: { zone },
          kind: "explosive-zone-damage",
          rollMode: effectiveRollMode,
          rolls: serialized.map(({ evidence }) => evidence),
        };
        const completed = await mutateThread(message, (thread) =>
          completeD6ExplosiveZoneDamage(thread, zone, rolled, presentation),
        );
        const authoritativeEntry = completed.results.entries.find(
          ({ appendId }) => appendId === presentation.appendId,
        );
        if (!authoritativeEntry)
          throw new Error("D6E2.ActionThread.AuthorityMismatch");
        await appendD6InitiatingActionPresentation({
          artifacts,
          entry: authoritativeEntry,
          ledger: completed.results,
          message,
        }).catch((error: unknown) =>
          console.warn(
            `${SYSTEM_ID} | Could not append explosive Damage presentation`,
            error,
          ),
        );
      },
    );
    if (!result) {
      await mutateThread(message, (thread) =>
        releaseD6ExplosiveZoneDamage(thread, zone),
      );
      return "dismissed";
    }
    const completed = authoritativeThread(message);
    if (!completed) throw new Error("D6E2.Explosive.Thread.Invalid");
    resolveD6PendingInteraction(damagePromptId(completed, zone));
    for (const target of completed.targets.filter(
      (candidate) =>
        candidate.zone === zone && candidate.stage === "pending-resistance",
    )) {
      void ensureResistance(message, state, target);
    }
    return "resolved";
  } catch (error) {
    const latest = authoritativeThread(message);
    if (
      latest?.zones.find((entry) => entry.zone === zone)?.stage === "rolling"
    ) {
      await mutateThread(message, (thread) =>
        releaseD6ExplosiveZoneDamage(thread, zone),
      );
    }
    throw error;
  }
}

function targetScaleResult(
  result: NonNullable<D6ExplosiveAttackThreadV1["zones"][number]["result"]>,
  target: ResolvedTarget,
) {
  const scale = result.request.context?.scale;
  if (!scale) throw new Error("D6E2.Combat.Damage.TargetUnavailable");
  const projectedScale = Object.freeze({
    ...scale,
    targetActorId: target.actor.id,
    targetName: target.label,
    targetTokenId: target.tokenId,
  });
  return Object.freeze({
    ...result,
    request: Object.freeze({
      ...result.request,
      context: Object.freeze({
        ...result.request.context,
        scale: projectedScale,
      }),
    }),
  });
}

async function ensureResistance(
  message: ThreadMessage,
  state: D6ExplosiveRegionStateV1,
  targetStage: D6ExplosiveThreadTargetV1,
): Promise<void> {
  const operationId = resistancePromptId(
    authoritativeThread(message) ??
      (() => {
        throw new Error("D6E2.Explosive.Thread.Invalid");
      })(),
    targetStage.targetKey,
  );
  if (activeResistance.has(operationId))
    return activeResistance.get(operationId);
  const task = (async () => {
    const latest = authoritativeThread(message);
    const zone = latest?.zones.find((entry) => entry.zone === targetStage.zone);
    if (!latest || zone?.stage !== "rolled" || !zone.result) return;
    const target = (await resolvedThreadTargets(state, latest)).find(
      (candidate) => candidate.targetKey === targetStage.targetKey,
    );
    if (!target) throw new Error("D6E2.Explosive.Thread.TargetUnavailable");
    const projected = targetScaleResult(zone.result, target);
    await mutateThread(message, (thread) =>
      setD6ExplosiveTargetStage(thread, targetStage.targetKey, "resolving"),
    );
    const outcome = await resolveExplosiveThreadDamageTarget(
      projected,
      projected.request.context.scale,
      zone.damageKind,
      {
        // A Resistance stage begins only after its shared zone Damage roll.
        // Anchoring its lifetime to the older attack card can make a newly
        // delivered prompt expire before it can be answered.
        createdAt: Date.now(),
        id: operationId,
        visibility:
          target.hidden || projected.request.rollMode === "blindroll"
            ? "hidden"
            : projected.request.rollMode === "publicroll"
              ? "public"
              : "private",
      },
    );
    if (deletedThreadIds.has(message.id)) return;
    if (!outcome) {
      await mutateThread(message, (thread) =>
        setD6ExplosiveTargetStage(
          thread,
          targetStage.targetKey,
          "pending-resistance",
        ),
      );
      return;
    }
    await finishResistance(
      message,
      latest,
      targetStage,
      target.actor.id,
      outcome,
    );
  })().finally(() => activeResistance.delete(operationId));
  activeResistance.set(operationId, task);
  return task;
}

async function finishResistance(
  message: ThreadMessage,
  expected: D6ExplosiveAttackThreadV1,
  target: D6ExplosiveThreadTargetV1,
  expectedActorId: string,
  outcome: ExplosiveThreadDamageOutcome,
): Promise<void> {
  const latest = authoritativeThread(message);
  if (!latest || latest.revision < expected.revision) return;
  const resistance = outcome.flag.resistanceRoll;
  let artifacts: readonly FoundryRoll[] = [];
  let presentation: D6InitiatingActionResultV1 | undefined;
  if (resistance) {
    const promptId = resistancePromptId(latest, target.targetKey);
    if (
      resistance.requestId !== promptId ||
      resistance.actorId !== expectedActorId ||
      resistance.difficulty !==
        Math.max(0, Math.trunc(target.damageTotal ?? 0)) ||
      JSON.stringify(
        resistance.rollArtifacts.flatMap(({ evidence }) => evidence.faces),
      ) !==
        JSON.stringify([
          ...resistance.baseFaces,
          ...resistance.characterPointFaces,
          ...resistance.wildFaces,
        ])
    ) {
      throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
    }
    artifacts = await hydrateD6FoundryRolls(resistance.rollArtifacts);
    presentation = {
      appendId: `${latest.requestId}:resistance:${target.targetKey}`,
      details: { targetKey: target.targetKey },
      kind: "explosive-target-resistance",
      rollMode: resistance.rollMode,
      rolls: resistance.rollArtifacts.map(({ evidence }) => evidence),
    };
  }
  const completed = await mutateThread(message, (thread) =>
    completeD6ExplosiveTarget(thread, target.targetKey, {
      ...(outcome.flag.bodyPointsCurrent === undefined
        ? {}
        : { bodyPointsCurrent: outcome.flag.bodyPointsCurrent }),
      ...(outcome.flag.bodyPointsMaximum === undefined
        ? {}
        : { bodyPointsMaximum: outcome.flag.bodyPointsMaximum }),
      conditionLabel: outcome.conditionLabel,
      healthStateId: outcome.flag.nextCondition,
      ...(presentation ? { presentation } : {}),
      ...(outcome.flag.resistanceRoll
        ? {
            resistanceRoll: {
              baseFaces: outcome.flag.resistanceRoll.baseFaces,
              pool: outcome.flag.resistanceRoll.pool,
              resultModifier: outcome.flag.resistanceRoll.resultModifier,
              wildFaces: outcome.flag.resistanceRoll.wildFaces,
              wildOutcome: outcome.flag.resistanceRoll.wildOutcome,
            },
          }
        : {}),
      resistanceTotal: outcome.resistanceTotal,
    }),
  );
  if (presentation) {
    const authoritativeEntry = completed.results.entries.find(
      ({ appendId }) => appendId === presentation.appendId,
    );
    if (!authoritativeEntry)
      throw new Error("D6E2.ActionThread.AuthorityMismatch");
    await appendD6InitiatingActionPresentation({
      artifacts,
      entry: authoritativeEntry,
      ledger: completed.results,
      message,
    }).catch((error: unknown) =>
      console.warn(
        `${SYSTEM_ID} | Could not append explosive Resistance presentation`,
        error,
      ),
    );
  }
  resolveD6PendingInteraction(resistancePromptId(completed, target.targetKey));
  if (d6ExplosiveAttackThreadComplete(completed)) {
    await requestD6ExplosiveMutation({
      operation: "delete",
      regionId: completed.regionId,
      requestId: completed.requestId,
      sceneId: completed.sceneId,
    });
  }
}

export async function synchronizeD6ExplosiveAttackThread(
  message: ThreadMessage,
  state?: D6ExplosiveRegionStateV1,
  recoverInFlight = false,
): Promise<void> {
  let thread = authoritativeThread(message);
  const currentUser = game.user;
  if (
    !thread ||
    !currentUser?.isGM ||
    activeD6ExplosiveGm()?.id !== currentUser.id
  ) {
    return;
  }
  const presentation = d6ExplosiveAttackThreadFromMessage(message);
  if (JSON.stringify(presentation) !== JSON.stringify(thread)) {
    await message.update({
      [`flags.${SYSTEM_ID}.${D6_EXPLOSIVE_ATTACK_THREAD_FLAG}`]:
        structuredClone(thread),
    });
  }
  if (recoverInFlight) {
    const recovered = recoverD6ExplosiveAttackThread(thread);
    if (recovered !== thread) {
      await persistThread(message, recovered);
      thread = recovered;
    }
  }
  const authoritativeState = state ?? regionStateForThread(thread);
  if (!authoritativeState) return;
  const actor = (await fromUuid(
    authoritativeState.actorUuid,
  )) as FoundryActorDocument | null;
  for (const zone of thread.zones.filter(({ stage }) => stage === "pending")) {
    void registerFoundryPendingInteraction(
      {
        ...(actor
          ? { actorId: actor.id, actorImg: actor.img, actorName: actor.name }
          : {}),
        controllerName: currentUser.name ?? currentUser.id,
        controllerUserId: currentUser.id,
        createdAt: messageCreatedAt(message),
        id: damagePromptId(thread, zone.zone),
        kind: "explosive-zone-damage",
        label: game.i18n.format("D6E2.Explosive.Thread.DamagePrompt", {
          zone: zone.zone,
        }),
        reopen: () => executeZoneDamage(message, authoritativeState, zone.zone),
        subjectLabel: game.i18n.format("D6E2.Explosive.Thread.ZoneLabel", {
          zone: zone.zone,
        }),
      },
      { automaticEligible: true },
    ).catch((error: unknown) =>
      console.error("D6 System | Explosive Damage prompt failed", error),
    );
  }
  for (const target of thread.targets.filter(
    ({ stage }) => stage === "pending-resistance",
  )) {
    void ensureResistance(message, authoritativeState, target);
  }
}

function regionStateForThread(
  thread: D6ExplosiveAttackThreadV1,
): D6ExplosiveRegionStateV1 | null {
  const scenes = game.scenes;
  if (!scenes) return null;
  const scene = scenes.get(thread.sceneId) as
    | (FoundrySceneDocument & {
        readonly regions?: {
          get(id: string):
            | {
                readonly id: string;
                getFlag(scope: string, key: string): unknown;
              }
            | undefined;
        };
      })
    | undefined;
  const region = scene?.regions?.get(thread.regionId);
  if (region?.id !== thread.regionId) return null;
  const state = d6ExplosiveRegionState(region);
  return state?.requestId === thread.requestId ? state : null;
}

function messageElement(value: unknown): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  if (Array.isArray(value) && value[0] instanceof HTMLElement) return value[0];
  return null;
}

async function renderThread(
  message: ThreadMessage,
  html: HTMLElement,
): Promise<void> {
  const thread = d6ExplosiveAttackThreadFromMessage(message);
  if (!thread) return;
  const card = html.matches(".od6chat-roll")
    ? html
    : html.querySelector<HTMLElement>(".od6chat-roll");
  if (!card) return;
  const existing = card.querySelector<HTMLElement>(
    "[data-explosive-attack-thread]",
  );
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/explosive-attack-thread.hbs`,
    (() => {
      const deviation = thread.results.entries.find(
        ({ kind }) => kind === "explosive-deviation",
      );
      return {
        aimedPoint: `${Math.round(thread.aimedPoint.x)}, ${Math.round(thread.aimedPoint.y)}`,
        deviation:
          deviation === undefined
            ? undefined
            : {
                aimed: deviation.details.aimedPoint,
                direction: game.i18n.localize(
                  `D6E2.Explosive.Direction.${deviation.details.direction}`,
                ),
                directionFormula: deviation.rolls[0]?.formula,
                directionResult: deviation.rolls[0]?.total,
                distanceFormula: deviation.rolls[1]?.formula,
                distanceResult: deviation.rolls[1]?.total,
                final: deviation.details.finalPoint,
              },
        finalPoint: `${Math.round(thread.resolvedPoint.x)}, ${Math.round(thread.resolvedPoint.y)}`,
        hasTargets: thread.targets.length > 0,
        targets: thread.targets.map((target) => ({
          ...target,
          actorImg:
            target.visible && target.actorImg
              ? target.actorImg
              : "icons/svg/mystery-man.svg",
          actorName:
            target.visible && target.actorName
              ? target.actorName
              : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
          stageLabel: game.i18n.localize(
            `D6E2.Explosive.Thread.Stage.${target.stage}`,
          ),
          healthLabel: target.visible
            ? target.bodyPointsCurrent === undefined ||
              target.bodyPointsMaximum === undefined
              ? target.conditionLabel
              : `${target.bodyPointsCurrent}/${target.bodyPointsMaximum}`
            : undefined,
          healthStateId: target.visible ? target.healthStateId : undefined,
          healthTone: target.visible
            ? explosiveHealthTone(target.healthStateId)
            : undefined,
          promptId: resistancePromptId(thread, target.targetKey),
          showAction:
            game.user !== undefined &&
            activeD6PendingInteractions(game.user.id).some(
              ({ id }) => id === resistancePromptId(thread, target.targetKey),
            ),
          resistanceLabel: target.resistanceRoll
            ? `${target.resistanceRoll.pool.dice}D${
                target.resistanceRoll.pool.pips
                  ? `+${target.resistanceRoll.pool.pips}`
                  : ""
              } = ${target.resistanceTotal ?? 0}`
            : undefined,
          resistanceWildLabel: target.resistanceRoll
            ? game.i18n.localize(
                `D6E2.Roll.Outcome.${target.resistanceRoll.wildOutcome}`,
              )
            : undefined,
        })),
        zones: thread.zones.map((zone) => ({
          ...zone,
          damageLabel: `${Math.floor(zone.damageScore / 3)}D${
            zone.damageScore % 3 ? `+${zone.damageScore % 3}` : ""
          }`,
          resultTotal: zone.result?.total,
          promptId: damagePromptId(thread, zone.zone),
          showAction:
            game.user !== undefined &&
            activeD6PendingInteractions(game.user.id).some(
              ({ id }) => id === damagePromptId(thread, zone.zone),
            ),
          stageLabel: game.i18n.localize(
            `D6E2.Explosive.Thread.ZoneStage.${zone.stage}`,
          ),
        })),
      };
    })(),
  );
  const container = document.createElement("div");
  container.innerHTML = content;
  const threadElement = container.firstElementChild;
  if (!(threadElement instanceof HTMLElement)) return;
  if (!boundThreadActionCards.has(card)) {
    card.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const control = target.closest<HTMLElement>("[data-prompt-id]");
      if (!control?.dataset.promptId) return;
      void import("../../application/pending-interactions").then(
        ({ reopenD6PendingInteraction }) =>
          void reopenD6PendingInteraction(control.dataset.promptId ?? ""),
        (error: unknown) =>
          console.error("D6 System | Could not reopen explosive prompt", error),
      );
    });
    boundThreadActionCards.add(card);
  }
  if (existing) existing.replaceWith(threadElement);
  else card.append(threadElement);
}

function refreshRenderedThreadActions(): void {
  const renderedMessages = Array.from(
    globalThis.document.querySelectorAll(".chat-message[data-message-id]"),
  );
  for (const html of renderedMessages) {
    if (!(html instanceof HTMLElement)) continue;
    const messageId = html.getAttribute("data-message-id");
    const message = messageId ? messageById(messageId) : null;
    if (!message || !d6ExplosiveAttackThreadFromMessage(message)) continue;
    void renderThread(message, html).catch((error: unknown) =>
      console.error(
        "D6 System | Could not refresh explosive root actions",
        error,
      ),
    );
  }
}

export function registerD6ExplosiveAttackThreadLifecycle(): void {
  if (registered) return;
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as ThreadMessage | undefined;
    const html = messageElement(args[1]);
    if (!message || !html) return;
    void renderThread(message, html);
    void synchronizeD6ExplosiveAttackThread(message);
  });
  Hooks.on("deleteChatMessage", (value: unknown) => {
    const message = value as ThreadMessage;
    const thread =
      authoritativeThread(message) ??
      d6ExplosiveAttackThreadFromMessage(message);
    if (!thread) return;
    deletedThreadIds.add(message.id);
    for (const zone of thread.zones) {
      resolveD6PendingInteraction(damagePromptId(thread, zone.zone));
      void cancelRequestedRollDialog(damagePromptId(thread, zone.zone));
    }
    for (const target of thread.targets) {
      const promptId = resistancePromptId(thread, target.targetKey);
      resolveD6PendingInteraction(promptId);
      if (game.user?.isGM === true) void cancelRollRequest(promptId);
    }
    const region = regionDocument(thread.sceneId, thread.regionId);
    const state = region ? d6ExplosiveRegionState(region) : null;
    if (
      state?.attackMessageId === message.id &&
      state.requestId === thread.requestId &&
      game.user?.isGM === true &&
      activeD6ExplosiveGm()?.id === game.user.id
    ) {
      void requestD6ExplosiveMutation({
        operation: "delete",
        regionId: thread.regionId,
        requestId: thread.requestId,
        sceneId: thread.sceneId,
      });
    }
  });
  unsubscribePendingInteractions = subscribeD6PendingInteractions(() => {
    refreshRenderedThreadActions();
  });
  registered = true;
}

export function resetD6ExplosiveAttackThreadsForTests(): void {
  activeResistance.clear();
  deletedThreadIds.clear();
  threadMutations.clear();
  unsubscribePendingInteractions?.();
  unsubscribePendingInteractions = undefined;
  registered = false;
}
