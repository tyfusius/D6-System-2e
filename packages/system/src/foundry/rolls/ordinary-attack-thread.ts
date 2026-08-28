import { formatPipScore, type D6RollResultV1 } from "@d6-system-2e/core";
import {
  claimD6OrdinaryAttackDamage,
  claimD6OrdinaryAttackReaction,
  claimD6OrdinaryReactionDamage,
  completeD6OrdinaryAttackDamage,
  completeD6OrdinaryAttackTarget,
  completeD6OrdinaryAttackReaction,
  completeD6OrdinaryReactionDamage,
  completeD6OrdinaryReactionTarget,
  createD6OrdinaryAttackThread,
  d6OrdinaryAttackReactionPhase,
  parseD6OrdinaryAttackThread,
  recoverD6OrdinaryAttackThread,
  recordD6OrdinaryAttackWildFeint,
  releaseD6OrdinaryAttackDamage,
  releaseD6OrdinaryAttackReaction,
  releaseD6OrdinaryReactionDamage,
  setD6OrdinaryAttackTargetStage,
  setD6OrdinaryReactionTargetStage,
  type D6OrdinaryAttackReactionV1,
  type D6OrdinaryAttackThreadV1,
} from "../../application/ordinary-attack-thread";
import {
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultV1,
} from "../../application/initiating-action-results";
import {
  activeD6PendingInteractions,
  reopenD6PendingInteraction,
  resolveD6PendingInteraction,
  subscribeD6PendingInteractions,
} from "../../application/pending-interactions";
import { SYSTEM_ID } from "../../constants";
import {
  appendD6InitiatingActionPresentation,
  D6_INITIATING_ACTION_RESULTS_FLAG,
  hydrateD6FoundryRolls,
  serializeD6FoundryRolls,
} from "../initiating-action-message";
import { registerFoundryPendingInteraction } from "../pending-interactions";
import {
  cancelRollRequest,
  requestActorRiposteRoll,
  validateRequestedWeaponAttackRollArtifacts,
} from "../roll-requests";
import {
  initiatingActionDamageKind,
  resolveInitiatingActionDamageTarget,
} from "./damage-resolution";
import { rollSuccessfulWeaponAttackDamage } from "./roll-service";
import { d6HealthOutcomeTone } from "../health-outcome-tone";
import { actorHeroPointBalance } from "../hero-point-service";
import { recordSecondEditionWildDieFeint } from "../combat-service";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";

export const D6_ORDINARY_ATTACK_THREAD_FLAG = "ordinaryAttackThread";

type ThreadMessage = FoundryChatMessageDocument & {
  readonly timestamp?: number;
};

const mutations = new Map<string, Promise<void>>();
const activeDamage = new Set<string>();
const activeResistance = new Map<string, Promise<void>>();
const activeReactionAttacks = new Map<string, Promise<void>>();
const activeReactionDamage = new Set<string>();
const activeReactionResistance = new Map<string, Promise<void>>();
const deletedThreadIds = new Set<string>();
let boundPendingInteractionCards = new WeakSet<HTMLElement>();
let registered = false;
let unsubscribePending: (() => void) | undefined;

function activeGm(): FoundryUser | null {
  const users = game.users;
  if (!users) return null;
  const direct = (
    users as unknown as { readonly activeGM?: FoundryUser | null }
  ).activeGM;
  if (direct?.active && direct.isGM) return direct;
  return (
    users.contents
      .filter((user) => user.active && user.isGM)
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

function resultFromMessage(message: ThreadMessage): D6RollResultV1 | null {
  const value = message.getFlag(SYSTEM_ID, "roll");
  if (!value || typeof value !== "object") return null;
  const result = value as Partial<D6RollResultV1>;
  return result.request?.kind === "weapon-attack"
    ? (value as D6RollResultV1)
    : null;
}

function successfulPersonalWeaponHit(result: D6RollResultV1): boolean {
  const attack = result.request.context?.weaponAttack;
  return Boolean(
    attack &&
    result.success === true &&
    result.request.kind === "weapon-attack" &&
    result.request.source.itemId === attack.weaponId &&
    attack.targetActorId.length > 0 &&
    attack.targetName.trim().length > 0 &&
    attack.weaponId.length > 0,
  );
}

function threadWithCanonicalResults(
  thread: D6OrdinaryAttackThreadV1,
  raw: unknown,
): D6OrdinaryAttackThreadV1 | null {
  if (raw === undefined) return thread;
  const results = parseD6InitiatingActionResultLedger(raw);
  if (
    results?.rootMessageId !== thread.attackMessageId ||
    results.requestId !== thread.requestId ||
    results.revision < thread.results.revision
  )
    return null;
  return results.revision === thread.results.revision &&
    JSON.stringify(results) !== JSON.stringify(thread.results)
    ? null
    : Object.freeze({ ...thread, results });
}

export function d6OrdinaryAttackThreadFromMessage(
  message: ThreadMessage,
): D6OrdinaryAttackThreadV1 | null {
  const thread = parseD6OrdinaryAttackThread(
    message.getFlag(SYSTEM_ID, D6_ORDINARY_ATTACK_THREAD_FLAG),
  );
  return thread
    ? threadWithCanonicalResults(
        thread,
        message.getFlag(SYSTEM_ID, D6_INITIATING_ACTION_RESULTS_FLAG),
      )
    : null;
}

async function persistThread(
  message: ThreadMessage,
  thread: D6OrdinaryAttackThreadV1,
): Promise<void> {
  if (message.id !== thread.attackMessageId) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  await message.update({
    [`flags.${SYSTEM_ID}.${D6_ORDINARY_ATTACK_THREAD_FLAG}`]:
      structuredClone(thread),
    [`flags.${SYSTEM_ID}.${D6_INITIATING_ACTION_RESULTS_FLAG}`]:
      structuredClone(thread.results),
  });
}

async function mutateThread(
  message: ThreadMessage,
  operation: (thread: D6OrdinaryAttackThreadV1) => D6OrdinaryAttackThreadV1,
): Promise<D6OrdinaryAttackThreadV1> {
  let result: D6OrdinaryAttackThreadV1 | undefined;
  const previous = mutations.get(message.id) ?? Promise.resolve();
  const pending = previous.then(async () => {
    const current = d6OrdinaryAttackThreadFromMessage(message);
    if (!current) throw new Error("D6E2.ActionThread.Invalid");
    result = operation(current);
    if (result !== current) await persistThread(message, result);
  });
  mutations.set(message.id, pending);
  try {
    await pending;
  } finally {
    if (mutations.get(message.id) === pending) mutations.delete(message.id);
  }
  if (!result) throw new Error("D6E2.ActionThread.Invalid");
  return result;
}

function sourceActor(
  thread: D6OrdinaryAttackThreadV1,
): FoundryActorDocument | null {
  return game.actors?.get(thread.actorId) ?? null;
}

export function d6OrdinaryAttackTargetAuthorized(
  thread: D6OrdinaryAttackThreadV1,
  user: FoundryUser | undefined,
  actor: FoundryActorDocument | null,
  target: FoundryActorDocument | null,
): boolean {
  if (!thread.target.visible || !user) return false;
  return (
    user.isGM ||
    actor?.testUserPermission(user, "OWNER") === true ||
    target?.testUserPermission(user, "OWNER") === true
  );
}

function damagePromptId(thread: D6OrdinaryAttackThreadV1): string {
  return `ordinary-damage:${thread.requestId}`;
}

function resistancePromptId(thread: D6OrdinaryAttackThreadV1): string {
  return `ordinary-resistance:${thread.requestId}:${thread.target.targetActorId}`;
}

function reactionDamagePromptId(reaction: D6OrdinaryAttackReactionV1): string {
  return `${reaction.id}:damage`;
}

function reactionResistancePromptId(
  reaction: D6OrdinaryAttackReactionV1,
): string {
  return `${reaction.id}:resistance:${reaction.target.targetActorId}`;
}

function hasActiveDamageOperation(thread: D6OrdinaryAttackThreadV1): boolean {
  return (
    thread.damage.stage === "rolling" &&
    activeDamage.has(damagePromptId(thread))
  );
}

function hasActiveResistanceOperation(
  thread: D6OrdinaryAttackThreadV1,
): boolean {
  return (
    thread.target.stage === "resolving" &&
    activeResistance.has(resistancePromptId(thread))
  );
}

function hasActiveReactionOperation(thread: D6OrdinaryAttackThreadV1): boolean {
  return thread.reactions.some(
    (reaction) =>
      (reaction.attack.stage === "rolling" &&
        activeReactionAttacks.has(reaction.id)) ||
      (reaction.damage.stage === "rolling" &&
        activeReactionDamage.has(reactionDamagePromptId(reaction))) ||
      (reaction.target.stage === "resolving" &&
        activeReactionResistance.has(reactionResistancePromptId(reaction))),
  );
}

function createdAt(message: ThreadMessage): number {
  if (!Number.isFinite(message.timestamp) || Number(message.timestamp) <= 0) {
    throw new Error("D6E2.ActionThread.Invalid");
  }
  return Number(message.timestamp);
}

function riposteCandidate(
  result: D6RollResultV1,
):
  | NonNullable<Parameters<typeof createD6OrdinaryAttackThread>[0]["reaction"]>
  | undefined {
  const attack = result.request.context?.weaponAttack;
  if (
    attack?.attackKind !== "melee" ||
    !currentSecondEditionCampaignProfile().activeResponsiveCombat ||
    currentDefenseRuntimeStrategy().feint !== "second-edition-penalty"
  )
    return undefined;
  const defender = game.actors?.get(attack.targetActorId);
  if (!defender || actorHeroPointBalance(defender) < 1) return undefined;
  const melee = defender.items.contents.find(
    (item) => item.type === "skill" && item.system.key === "melee",
  );
  const attributeId =
    typeof melee?.system.attributeId === "string"
      ? melee.system.attributeId
      : "agility";
  const attribute = (
    defender.system.attributes as
      Record<string, { readonly score?: number }> | undefined
  )?.[attributeId];
  const meleeScore =
    (Number.isFinite(attribute?.score) ? Number(attribute?.score) : 0) +
    (Number.isFinite(melee?.system.score) ? Number(melee?.system.score) : 0);
  const reason =
    result.wildFaces[0] === 1
      ? ("wild-complication" as const)
      : result.success === false && meleeScore >= 12
        ? ("failed-attack" as const)
        : undefined;
  if (!reason) return undefined;
  const weapon = defender.items.contents.find(
    (item) =>
      item.type === "weapon" &&
      item.system.equipped === true &&
      item.system.attackSkillKey === "melee",
  );
  return weapon
    ? {
        actorId: defender.id,
        actorName: defender.name,
        reason,
        visible: attack.targetHidden !== true,
        weaponId: weapon.id,
        weaponName: weapon.name,
      }
    : undefined;
}

async function ensureThread(
  message: ThreadMessage,
): Promise<D6OrdinaryAttackThreadV1 | null> {
  const existing = d6OrdinaryAttackThreadFromMessage(message);
  if (existing) return existing;
  if (game.user?.isGM !== true || activeGm()?.id !== game.user.id) return null;
  const result = resultFromMessage(message);
  const attack = result?.request.context?.weaponAttack;
  const damagePlan = result?.request.context?.weaponDamageContinuation;
  if (
    !result ||
    !attack ||
    !damagePlan ||
    result.request.kind !== "weapon-attack"
  )
    return null;
  const actor = game.actors?.get(result.request.source.actorId);
  const weapon = actor?.items.get(attack.weaponId);
  if (
    !actor ||
    weapon?.type !== "weapon" ||
    weapon.system.weaponKind === "thrown-explosive"
  ) {
    return null;
  }
  if (!attack.targetActorId || !attack.targetName.trim()) return null;
  const reaction = riposteCandidate(result);
  const thread = createD6OrdinaryAttackThread({
    actorId: actor.id,
    actorName: actor.name,
    attackHit: successfulPersonalWeaponHit(result),
    attackMessageId: message.id,
    attackTotal: result.total,
    defenseKind: attack.defenseKind,
    defenseLabel: game.i18n.localize(
      attack.defenseKind === "dodge"
        ? "D6E2.Combat.Dodge"
        : attack.defenseKind === "parry"
          ? "D6E2.Combat.Parry"
          : "D6E2.Combat.RangeDifficulty",
    ),
    defenseTotal: attack.defense,
    difficulty:
      attack.difficultySelection ??
      Object.freeze({
        calculatedValue: attack.defense,
        source: "calculated" as const,
        value:
          typeof result.request.difficulty === "number"
            ? result.request.difficulty
            : attack.defense,
      }),
    damagePlan,
    requestId: `ordinary:${message.id}`,
    ...(reaction ? { reaction } : {}),
    rollMode: result.request.rollMode,
    targetActorId: attack.targetActorId,
    targetName: attack.targetName,
    targetVisible: attack.targetHidden !== true,
    weaponId: attack.weaponId,
    weaponName: weapon.name,
  });
  await persistThread(message, thread);
  return thread;
}

export async function executeD6OrdinaryAttackDamage(
  message: ThreadMessage,
): Promise<"dismissed" | "resolved"> {
  if (game.user?.isGM !== true || activeGm()?.id !== game.user.id) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  const attack = resultFromMessage(message);
  const actor = thread ? sourceActor(thread) : null;
  if (!thread || !attack || !actor)
    throw new Error("D6E2.ActionThread.Invalid");
  if (deletedThreadIds.has(message.id))
    throw new Error("D6E2.ActionThread.Invalid");
  const promptId = damagePromptId(thread);
  if (activeDamage.has(promptId))
    throw new RangeError("D6E2.ActionThread.DamageUnavailable");
  activeDamage.add(promptId);
  try {
    await mutateThread(message, claimD6OrdinaryAttackDamage);
    const rolled = await rollSuccessfulWeaponAttackDamage(
      actor,
      attack,
      thread.damage.plan,
      {
        fixedRollMode: thread.rollMode,
        suppressChatMessage: true,
        captureRollExecution: async (result, artifacts) => {
          if (deletedThreadIds.has(message.id)) {
            throw new Error("D6E2.ActionThread.Invalid");
          }
          const serialized = await serializeD6FoundryRolls(artifacts);
          const presentation: D6InitiatingActionResultV1 = {
            appendId: `${thread.requestId}:damage`,
            details: { targetActorId: thread.target.targetActorId },
            kind: "ordinary-weapon-damage",
            rollMode: result.request.rollMode,
            rolls: serialized.map(({ evidence }) => evidence),
          };
          const completed = await mutateThread(message, (current) =>
            completeD6OrdinaryAttackDamage(current, result, presentation),
          );
          const entry = completed.results.entries.find(
            ({ appendId }) => appendId === presentation.appendId,
          );
          if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
          await appendD6InitiatingActionPresentation({
            artifacts,
            entry,
            ledger: completed.results,
            message,
          });
        },
      },
    );
    if (!rolled) {
      await mutateThread(message, releaseD6OrdinaryAttackDamage);
      return "dismissed";
    }
    const completed = d6OrdinaryAttackThreadFromMessage(message);
    if (!completed) throw new Error("D6E2.ActionThread.Invalid");
    resolveD6PendingInteraction(damagePromptId(completed));
    void ensureResistance(message);
    return "resolved";
  } catch (error) {
    const latest = d6OrdinaryAttackThreadFromMessage(message);
    if (latest?.damage.stage === "rolling") {
      await mutateThread(message, releaseD6OrdinaryAttackDamage);
    }
    throw error;
  } finally {
    activeDamage.delete(promptId);
  }
}

export async function executeD6OrdinaryWildFeint(
  message: ThreadMessage,
): Promise<void> {
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  const result = resultFromMessage(message);
  const attack = result?.request.context?.weaponAttack;
  const actor = thread ? sourceActor(thread) : null;
  if (
    !thread ||
    !result ||
    !attack ||
    actor?.isOwner !== true ||
    result.wildFaces[0] !== 6 ||
    attack.attackKind !== "melee" ||
    !attack.targetTokenId
  )
    throw new Error("D6E2.ActionThread.ReactionUnavailable");
  await recordSecondEditionWildDieFeint(actor, attack.targetTokenId);
  await mutateThread(message, (current) =>
    recordD6OrdinaryAttackWildFeint(current, attack.targetTokenId ?? ""),
  );
}

async function ensureReactionAttack(
  message: ThreadMessage,
  reactionId: string,
): Promise<void> {
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  const reaction = thread?.reactions.find(({ id }) => id === reactionId);
  if (!thread || reaction?.attack.stage !== "pending") return;
  if (activeReactionAttacks.has(reactionId))
    return activeReactionAttacks.get(reactionId);
  const operation = (async () => {
    const actor = game.actors?.get(reaction.actorId);
    const attack = resultFromMessage(message)?.request.context?.weaponAttack;
    const originalSourceTokenId =
      resultFromMessage(message)?.request.context?.scale?.sourceTokenId;
    if (!actor || !attack) throw new Error("D6E2.ActionThread.Invalid");
    await mutateThread(message, (current) =>
      claimD6OrdinaryAttackReaction(current, reactionId),
    );
    const outcome = await requestActorRiposteRoll(actor, {
      createdAt: createdAt(message),
      id: reactionId,
      itemId: reaction.weaponId,
      rollMode: thread.rollMode,
      rootMessageId: message.id,
      targetActorId: thread.actorId,
      ...(originalSourceTokenId
        ? { targetTokenId: originalSourceTokenId }
        : {}),
    });
    if (deletedThreadIds.has(message.id)) return;
    const roll = outcome.weaponAttackRoll;
    if (outcome.status !== "rolled" || !roll) {
      await mutateThread(message, (current) =>
        releaseD6OrdinaryAttackReaction(current, reactionId),
      );
      return;
    }
    const artifacts = await validateRequestedWeaponAttackRollArtifacts(roll, {
      actorId: reaction.actorId,
      itemId: reaction.weaponId,
      requestId: reactionId,
      rootMessageId: message.id,
      targetActorId: thread.actorId,
      ...(originalSourceTokenId
        ? { targetTokenId: originalSourceTokenId }
        : {}),
    });
    const serialized = await serializeD6FoundryRolls(artifacts);
    const presentation: D6InitiatingActionResultV1 = {
      appendId: `${reactionId}:attack`,
      details: {
        actorId: reaction.actorId,
        targetActorId: thread.actorId,
      },
      kind: "ordinary-riposte-attack",
      rollMode: roll.result.request.rollMode,
      rolls: serialized.map(({ evidence }) => evidence),
    };
    const completed = await mutateThread(message, (current) =>
      completeD6OrdinaryAttackReaction(
        current,
        reactionId,
        roll.result,
        presentation,
      ),
    );
    const entry = completed.results.entries.find(
      ({ appendId }) => appendId === presentation.appendId,
    );
    if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
    await appendD6InitiatingActionPresentation({
      artifacts,
      entry,
      ledger: completed.results,
      message,
    });
    void synchronizeD6OrdinaryAttackThread(message);
  })()
    .catch(async (error: unknown) => {
      const latest = d6OrdinaryAttackThreadFromMessage(message)?.reactions.find(
        ({ id }) => id === reactionId,
      );
      if (latest?.attack.stage === "rolling")
        await mutateThread(message, (current) =>
          releaseD6OrdinaryAttackReaction(current, reactionId),
        );
      throw error;
    })
    .finally(() => activeReactionAttacks.delete(reactionId));
  activeReactionAttacks.set(reactionId, operation);
  return operation;
}

export async function executeD6OrdinaryReactionDamage(
  message: ThreadMessage,
  reactionId: string,
): Promise<"dismissed" | "resolved"> {
  if (game.user?.isGM !== true || activeGm()?.id !== game.user.id)
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  const reaction = thread?.reactions.find(({ id }) => id === reactionId);
  const actor = reaction ? game.actors?.get(reaction.actorId) : null;
  const attack = reaction?.attack.result;
  const plan = reaction?.damage.plan;
  const promptId = reaction ? reactionDamagePromptId(reaction) : "";
  if (!thread || !reaction || !actor || !attack || !plan)
    throw new Error("D6E2.ActionThread.Invalid");
  if (activeReactionDamage.has(promptId))
    throw new RangeError("D6E2.ActionThread.DamageUnavailable");
  activeReactionDamage.add(promptId);
  try {
    await mutateThread(message, (current) =>
      claimD6OrdinaryReactionDamage(current, reactionId),
    );
    const rolled = await rollSuccessfulWeaponAttackDamage(actor, attack, plan, {
      fixedRollMode: thread.rollMode,
      suppressChatMessage: true,
      captureRollExecution: async (result, artifacts) => {
        const serialized = await serializeD6FoundryRolls(artifacts);
        const presentation: D6InitiatingActionResultV1 = {
          appendId: `${reactionId}:damage`,
          details: { targetActorId: thread.actorId },
          kind: "ordinary-riposte-damage",
          rollMode: result.request.rollMode,
          rolls: serialized.map(({ evidence }) => evidence),
        };
        const completed = await mutateThread(message, (current) =>
          completeD6OrdinaryReactionDamage(
            current,
            reactionId,
            result,
            presentation,
          ),
        );
        const entry = completed.results.entries.find(
          ({ appendId }) => appendId === presentation.appendId,
        );
        if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
        await appendD6InitiatingActionPresentation({
          artifacts,
          entry,
          ledger: completed.results,
          message,
        });
      },
    });
    if (!rolled) {
      await mutateThread(message, (current) =>
        releaseD6OrdinaryReactionDamage(current, reactionId),
      );
      return "dismissed";
    }
    resolveD6PendingInteraction(promptId);
    void ensureReactionResistance(message, reactionId);
    return "resolved";
  } catch (error) {
    const latest = d6OrdinaryAttackThreadFromMessage(message)?.reactions.find(
      ({ id }) => id === reactionId,
    );
    if (latest?.damage.stage === "rolling")
      await mutateThread(message, (current) =>
        releaseD6OrdinaryReactionDamage(current, reactionId),
      );
    throw error;
  } finally {
    activeReactionDamage.delete(promptId);
  }
}

async function ensureReactionResistance(
  message: ThreadMessage,
  reactionId: string,
): Promise<void> {
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  const reaction = thread?.reactions.find(({ id }) => id === reactionId);
  if (!thread || reaction?.target.stage !== "pending-resistance") return;
  const id = reactionResistancePromptId(reaction);
  if (activeReactionResistance.has(id)) return activeReactionResistance.get(id);
  const operation = (async () => {
    const result = reaction.damage.result;
    const scale = result?.request.context?.scale;
    if (!result || !scale) throw new Error("D6E2.ActionThread.Invalid");
    await mutateThread(message, (current) =>
      setD6OrdinaryReactionTargetStage(current, reactionId, "resolving"),
    );
    const outcome = await resolveInitiatingActionDamageTarget(
      result,
      scale,
      initiatingActionDamageKind(result),
      {
        createdAt: Date.now(),
        id,
        visibility:
          thread.rollMode === "blindroll"
            ? "hidden"
            : thread.rollMode === "publicroll"
              ? "public"
              : "private",
      },
    );
    if (deletedThreadIds.has(message.id)) return;
    if (!outcome) {
      await mutateThread(message, (current) =>
        setD6OrdinaryReactionTargetStage(
          current,
          reactionId,
          "pending-resistance",
        ),
      );
      return;
    }
    const resistance = outcome.flag.resistanceRoll;
    let presentation: D6InitiatingActionResultV1 | undefined;
    let artifacts: readonly FoundryRoll[] = [];
    if (resistance) {
      if (
        resistance.requestId !== id ||
        resistance.actorId !== reaction.target.targetActorId ||
        resistance.difficulty !== Math.max(0, Math.trunc(result.total))
      )
        throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
      artifacts = await hydrateD6FoundryRolls(resistance.rollArtifacts);
      presentation = {
        appendId: `${reactionId}:resistance:${reaction.target.targetActorId}`,
        details: { targetActorId: reaction.target.targetActorId },
        kind: "ordinary-riposte-resistance",
        rollMode: resistance.rollMode,
        rolls: resistance.rollArtifacts.map(({ evidence }) => evidence),
      };
    }
    const completed = await mutateThread(message, (current) =>
      completeD6OrdinaryReactionTarget(current, reactionId, {
        ...(outcome.flag.actionsForfeited === undefined
          ? {}
          : { actionsForfeited: outcome.flag.actionsForfeited }),
        ...(outcome.flag.bodyPointsCurrent === undefined
          ? {}
          : { bodyPointsCurrent: outcome.flag.bodyPointsCurrent }),
        ...(outcome.flag.bodyPointsMaximum === undefined
          ? {}
          : { bodyPointsMaximum: outcome.flag.bodyPointsMaximum }),
        conditionLabel: outcome.conditionLabel,
        damageKind: outcome.flag.damageKind,
        healthStateId: outcome.flag.nextCondition,
        resistanceTotal: outcome.resistanceTotal,
        ...(outcome.flag.stunRoundsRemaining === undefined
          ? {}
          : { stunRoundsRemaining: outcome.flag.stunRoundsRemaining }),
        ...(outcome.flag.unconsciousMinutes === undefined
          ? {}
          : { unconsciousMinutes: outcome.flag.unconsciousMinutes }),
        ...(presentation ? { presentation } : {}),
      }),
    );
    if (presentation) {
      const entry = completed.results.entries.find(
        ({ appendId }) => appendId === presentation.appendId,
      );
      if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
      await appendD6InitiatingActionPresentation({
        artifacts,
        entry,
        ledger: completed.results,
        message,
      });
    }
    resolveD6PendingInteraction(id);
  })().finally(() => activeReactionResistance.delete(id));
  activeReactionResistance.set(id, operation);
  return operation;
}

async function ensureResistance(message: ThreadMessage): Promise<void> {
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  if (thread?.target.stage !== "pending-resistance") return;
  const id = resistancePromptId(thread);
  if (activeResistance.has(id)) return activeResistance.get(id);
  const operation = (async () => {
    const result = thread.damage.result;
    const scale = result?.request.context?.scale;
    if (!result || !scale) throw new Error("D6E2.ActionThread.Invalid");
    await mutateThread(message, (current) =>
      setD6OrdinaryAttackTargetStage(current, "resolving"),
    );
    const outcome = await resolveInitiatingActionDamageTarget(
      result,
      scale,
      initiatingActionDamageKind(result),
      {
        createdAt: Date.now(),
        id,
        visibility:
          thread.rollMode === "blindroll"
            ? "hidden"
            : thread.rollMode === "publicroll"
              ? "public"
              : "private",
      },
    );
    if (deletedThreadIds.has(message.id)) return;
    if (!outcome) {
      await mutateThread(message, (current) =>
        setD6OrdinaryAttackTargetStage(current, "pending-resistance"),
      );
      return;
    }
    const resistance = outcome.flag.resistanceRoll;
    let presentation: D6InitiatingActionResultV1 | undefined;
    let artifacts: readonly FoundryRoll[] = [];
    if (resistance) {
      if (
        resistance.requestId !== id ||
        resistance.actorId !== thread.target.targetActorId ||
        resistance.difficulty !== Math.max(0, Math.trunc(result.total))
      )
        throw new Error("D6E2.Combat.Damage.ResistanceEvidenceMissing");
      artifacts = await hydrateD6FoundryRolls(resistance.rollArtifacts);
      presentation = {
        appendId: `${thread.requestId}:resistance:${thread.target.targetActorId}`,
        details: { targetActorId: thread.target.targetActorId },
        kind: "ordinary-target-resistance",
        rollMode: resistance.rollMode,
        rolls: resistance.rollArtifacts.map(({ evidence }) => evidence),
      };
    }
    const completed = await mutateThread(message, (current) =>
      completeD6OrdinaryAttackTarget(current, {
        ...(outcome.flag.actionsForfeited === undefined
          ? {}
          : { actionsForfeited: outcome.flag.actionsForfeited }),
        ...(outcome.flag.bodyPointsCurrent === undefined
          ? {}
          : { bodyPointsCurrent: outcome.flag.bodyPointsCurrent }),
        ...(outcome.flag.bodyPointsMaximum === undefined
          ? {}
          : { bodyPointsMaximum: outcome.flag.bodyPointsMaximum }),
        conditionLabel: outcome.conditionLabel,
        damageKind: outcome.flag.damageKind,
        healthStateId: outcome.flag.nextCondition,
        resistanceTotal: outcome.resistanceTotal,
        ...(outcome.flag.stunRoundsRemaining === undefined
          ? {}
          : { stunRoundsRemaining: outcome.flag.stunRoundsRemaining }),
        ...(outcome.flag.unconsciousMinutes === undefined
          ? {}
          : { unconsciousMinutes: outcome.flag.unconsciousMinutes }),
        ...(presentation ? { presentation } : {}),
      }),
    );
    if (presentation) {
      const entry = completed.results.entries.find(
        ({ appendId }) => appendId === presentation.appendId,
      );
      if (!entry) throw new Error("D6E2.ActionThread.AuthorityMismatch");
      await appendD6InitiatingActionPresentation({
        artifacts,
        entry,
        ledger: completed.results,
        message,
      });
    }
    resolveD6PendingInteraction(id);
  })().finally(() => activeResistance.delete(id));
  activeResistance.set(id, operation);
  return operation;
}

export async function synchronizeD6OrdinaryAttackThread(
  message: ThreadMessage,
): Promise<void> {
  let thread = await ensureThread(message);
  if (!thread || game.user?.isGM !== true || activeGm()?.id !== game.user.id)
    return;
  const recovered =
    hasActiveDamageOperation(thread) ||
    hasActiveResistanceOperation(thread) ||
    hasActiveReactionOperation(thread)
      ? thread
      : recoverD6OrdinaryAttackThread(thread);
  if (recovered !== thread) {
    await persistThread(message, recovered);
    thread = recovered;
  }
  const actor = sourceActor(thread);
  if (thread.damage.stage === "pending" && actor) {
    await registerFoundryPendingInteraction(
      {
        actorId: actor.id,
        actorImg: actor.img,
        actorName: actor.name,
        controllerName: game.user.name ?? game.user.id,
        controllerUserId: game.user.id,
        createdAt: createdAt(message),
        id: damagePromptId(thread),
        kind: "damage-resolution",
        label: game.i18n.localize("D6E2.Combat.Damage.Resolve"),
        reopen: () => executeD6OrdinaryAttackDamage(message),
        subjectLabel:
          thread.target.visible && thread.target.targetName
            ? thread.target.targetName
            : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
      },
      { automaticEligible: true },
    );
  }
  if (thread.target.stage === "pending-resistance")
    void ensureResistance(message);
  for (const reaction of thread.reactions) {
    if (reaction.attack.stage === "pending")
      void ensureReactionAttack(message, reaction.id);
    if (reaction.damage.stage === "pending") {
      const id = reactionDamagePromptId(reaction);
      const source = game.actors?.get(reaction.actorId);
      if (source)
        await registerFoundryPendingInteraction(
          {
            actorId: source.id,
            actorImg: source.img,
            actorName: source.name,
            controllerName: game.user.name ?? game.user.id,
            controllerUserId: game.user.id,
            createdAt: createdAt(message),
            id,
            kind: "damage-resolution",
            label: game.i18n.localize("D6E2.Combat.Damage.Resolve"),
            reopen: () => executeD6OrdinaryReactionDamage(message, reaction.id),
            subjectLabel: reaction.target.targetName ?? thread.actorName,
          },
          { automaticEligible: true },
        );
    }
    if (reaction.target.stage === "pending-resistance")
      void ensureReactionResistance(message, reaction.id);
  }
}

function messageElement(value: unknown): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  if (Array.isArray(value) && value[0] instanceof HTMLElement) return value[0];
  return null;
}

function bindPendingInteractionActions(root: HTMLElement): void {
  if (boundPendingInteractionCards.has(root)) return;
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>("[data-prompt-id]");
    const promptId = control?.dataset.promptId;
    if (!promptId) return;
    void reopenD6PendingInteraction(promptId);
  });
  boundPendingInteractionCards.add(root);
}

async function renderThread(
  message: ThreadMessage,
  html: HTMLElement,
): Promise<void> {
  const thread = d6OrdinaryAttackThreadFromMessage(message);
  if (!thread) return;
  const card = html.matches(".od6chat-roll")
    ? html
    : html.querySelector<HTMLElement>(".od6chat-roll");
  if (!card) return;
  bindPendingInteractionActions(card);
  const damageId = damagePromptId(thread);
  const resistanceId = resistancePromptId(thread);
  const local = game.user ? activeD6PendingInteractions(game.user.id) : [];
  const targetActor = game.actors?.get(thread.target.targetActorId);
  const targetRedacted = !d6OrdinaryAttackTargetAuthorized(
    thread,
    game.user,
    sourceActor(thread),
    targetActor ?? null,
  );
  const reactionViews = thread.reactions.map((reaction) => {
    const actor = game.actors?.get(reaction.actorId);
    const redacted =
      !reaction.visible ||
      !game.user ||
      (!game.user.isGM &&
        actor?.testUserPermission(game.user, "OWNER") !== true &&
        sourceActor(thread)?.testUserPermission(game.user, "OWNER") !== true);
    const damageId = reactionDamagePromptId(reaction);
    const resistanceId = reactionResistancePromptId(reaction);
    const interaction = local.find(({ id }) => id === reaction.id);
    const phase = d6OrdinaryAttackReactionPhase(reaction, interaction);
    return {
      ...reaction,
      actorDisplayName:
        !redacted && reaction.actorName
          ? reaction.actorName
          : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
      actorImg: !redacted && actor ? actor.img : "icons/svg/mystery-man.svg",
      damageKindLabel:
        reaction.target.damageKind === undefined
          ? undefined
          : game.i18n.localize(
              reaction.target.damageKind === "stun"
                ? "D6E2.Explosive.Stun"
                : "D6E2.Explosive.Physical",
            ),
      damagePromptId: damageId,
      hasResistance: !redacted && reaction.target.resistanceTotal !== undefined,
      healthLabel: redacted
        ? undefined
        : reaction.target.bodyPointsCurrent !== undefined &&
            reaction.target.bodyPointsMaximum !== undefined
          ? `${reaction.target.bodyPointsCurrent}/${reaction.target.bodyPointsMaximum}`
          : reaction.target.conditionLabel,
      healthTone: redacted
        ? undefined
        : d6HealthOutcomeTone(reaction.target.healthStateId),
      opening: interaction?.status === "opening",
      phase: redacted ? "redacted" : phase,
      phaseLabel: game.i18n.localize(
        redacted
          ? "D6E2.ActionThread.RedactedReactionStatus"
          : `D6E2.ActionThread.ReactionPhase.${phase}`,
      ),
      redacted,
      resistancePromptId: resistanceId,
      showDamageAction: local.some(({ id }) => id === damageId),
      showReactionAction: interaction !== undefined,
      showResistanceAction: local.some(({ id }) => id === resistanceId),
    };
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/ordinary-attack-thread.hbs`,
    {
      ...thread,
      hasWildFeint: thread.audits.length > 0,
      reactions: reactionViews,
      difficultyLabel: game.i18n.localize(
        thread.difficulty.source === "custom"
          ? "D6E2.ActionThread.CustomDifficulty"
          : thread.defenseKind === "dodge"
            ? "D6E2.Combat.Dodge"
            : thread.defenseKind === "parry"
              ? "D6E2.Combat.Parry"
              : "D6E2.Combat.RangeDifficulty",
      ),
      autofireDamageModifierLabel:
        thread.damage.plan.autofire === undefined
          ? undefined
          : formatPipScore(thread.damage.plan.autofire.damageModifier),
      damagePromptId: damageId,
      damageStageLabel: game.i18n.localize(
        `D6E2.ActionThread.DamageStage.${thread.damage.stage}`,
      ),
      resistancePromptId: resistanceId,
      resistanceStageLabel: game.i18n.localize(
        `D6E2.ActionThread.TargetStage.${thread.target.stage}`,
      ),
      hasResistance:
        !targetRedacted && thread.target.resistanceTotal !== undefined,
      damageKindLabel:
        thread.target.damageKind === undefined
          ? undefined
          : game.i18n.localize(
              thread.target.damageKind === "stun"
                ? "D6E2.Explosive.Stun"
                : "D6E2.Explosive.Physical",
            ),
      healthLabel: targetRedacted
        ? undefined
        : thread.target.bodyPointsCurrent !== undefined &&
            thread.target.bodyPointsMaximum !== undefined
          ? `${thread.target.bodyPointsCurrent}/${thread.target.bodyPointsMaximum}`
          : thread.target.conditionLabel,
      healthTone: targetRedacted
        ? undefined
        : d6HealthOutcomeTone(thread.target.healthStateId),
      targetDisplayName:
        !targetRedacted && thread.target.targetName
          ? thread.target.targetName
          : game.i18n.localize("D6E2.Explosive.HiddenTarget"),
      targetImg:
        !targetRedacted &&
        targetActor &&
        game.user &&
        (game.user.isGM || targetActor.testUserPermission(game.user, "OWNER"))
          ? targetActor.img
          : "icons/svg/mystery-man.svg",
      targetRedacted,
      restrictionLabel:
        !targetRedacted && thread.target.actionsForfeited === true
          ? game.i18n.localize("D6E2.ActionThread.ActionsForfeited")
          : undefined,
      durationLabel: targetRedacted
        ? undefined
        : thread.target.unconsciousMinutes !== undefined
          ? game.i18n.format("D6E2.ActionThread.UnconsciousMinutes", {
              duration: thread.target.unconsciousMinutes,
            })
          : thread.target.stunRoundsRemaining !== undefined
            ? game.i18n.format("D6E2.ActionThread.StunRounds", {
                duration: thread.target.stunRoundsRemaining,
              })
            : undefined,
      showDamageAction: local.some(({ id }) => id === damageId),
      showResistanceAction: local.some(({ id }) => id === resistanceId),
    },
  );
  const holder = document.createElement("div");
  holder.innerHTML = content;
  const projected = holder.firstElementChild;
  if (!(projected instanceof HTMLElement)) return;
  const existing = card.querySelector("[data-ordinary-attack-thread]");
  if (existing) existing.replaceWith(projected);
  else card.append(projected);
}

function refreshRendered(): void {
  for (const html of Array.from(
    document.querySelectorAll(".chat-message[data-message-id]"),
  )) {
    if (!(html instanceof HTMLElement)) continue;
    const id = html.getAttribute("data-message-id");
    const message = id
      ? (
          game as FoundryGame & {
            readonly messages?: { get(id: string): ThreadMessage | undefined };
          }
        ).messages?.get(id)
      : undefined;
    if (message && d6OrdinaryAttackThreadFromMessage(message))
      void renderThread(message, html);
  }
}

export function registerD6OrdinaryAttackThreadLifecycle(): void {
  if (registered) return;
  Hooks.on("renderChatMessageHTML", (...args: unknown[]) => {
    const message = args[0] as ThreadMessage | undefined;
    const html = messageElement(args[1]);
    if (!message || !html) return;
    void synchronizeD6OrdinaryAttackThread(message).then(() =>
      renderThread(message, html),
    );
  });
  Hooks.on("deleteChatMessage", (value: unknown) => {
    const message = value as ThreadMessage;
    const thread = d6OrdinaryAttackThreadFromMessage(message);
    if (!thread) return;
    deletedThreadIds.add(message.id);
    resolveD6PendingInteraction(damagePromptId(thread));
    resolveD6PendingInteraction(resistancePromptId(thread));
    for (const reaction of thread.reactions) {
      resolveD6PendingInteraction(reaction.id);
      resolveD6PendingInteraction(reactionDamagePromptId(reaction));
      resolveD6PendingInteraction(reactionResistancePromptId(reaction));
    }
    if (game.user?.isGM === true) {
      void cancelRollRequest(resistancePromptId(thread));
      for (const reaction of thread.reactions) {
        void cancelRollRequest(reaction.id);
        void cancelRollRequest(reactionResistancePromptId(reaction));
      }
    }
  });
  unsubscribePending = subscribeD6PendingInteractions(refreshRendered);
  registered = true;
}

export function resetD6OrdinaryAttackThreadForTests(): void {
  activeDamage.clear();
  activeReactionAttacks.clear();
  activeReactionDamage.clear();
  activeReactionResistance.clear();
  activeResistance.clear();
  boundPendingInteractionCards = new WeakSet<HTMLElement>();
  deletedThreadIds.clear();
  mutations.clear();
  unsubscribePending?.();
  unsubscribePending = undefined;
  registered = false;
}
