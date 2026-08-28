import type {
  D6RollMode,
  D6RollResultV1,
  D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  parseD6InitiatingActionResultLedger,
  type D6InitiatingActionResultLedgerV1,
  type D6InitiatingActionResultV1,
} from "./initiating-action-results";

export const D6_ORDINARY_ATTACK_THREAD_SCHEMA = 2 as const;

export interface D6OrdinaryAttackReactionV1 {
  readonly actorId: string;
  readonly actorName?: string;
  readonly attack: {
    readonly result?: D6RollResultV1;
    readonly stage: "pending" | "rolling" | "missed" | "hit";
  };
  readonly damage: {
    readonly plan?: D6WeaponDamageContinuationRollContext;
    readonly result?: D6RollResultV1;
    readonly stage: "no-damage" | "pending" | "rolling" | "rolled";
  };
  readonly id: string;
  readonly kind: "riposte";
  readonly reason: "failed-attack" | "wild-complication";
  readonly target: D6OrdinaryAttackThreadV1["target"];
  readonly visible: boolean;
  readonly weaponId: string;
  readonly weaponName: string;
}

export type D6OrdinaryAttackReactionPhase =
  | "applied"
  | "damage"
  | "failed"
  | "missed"
  | "opening"
  | "pending"
  | "resistance"
  | "rolling";

export function d6OrdinaryAttackReactionPhase(
  reaction: D6OrdinaryAttackReactionV1,
  interaction?: {
    readonly operation?: "cancel" | "reopen" | "takeOver";
    readonly status: "failed" | "opening" | "pending";
  },
): D6OrdinaryAttackReactionPhase {
  if (interaction?.status === "failed") return "failed";
  if (interaction?.status === "opening") return "opening";
  if (interaction?.status === "pending") return "pending";
  if (reaction.attack.stage === "pending") return "pending";
  if (reaction.attack.stage === "rolling") return "rolling";
  if (reaction.attack.stage === "missed") return "missed";
  if (
    reaction.damage.stage === "pending" ||
    reaction.damage.stage === "rolling"
  )
    return "damage";
  if (
    reaction.target.stage === "pending-resistance" ||
    reaction.target.stage === "resolving"
  )
    return "resistance";
  if (reaction.target.stage === "applied") return "applied";
  return "damage";
}

export interface D6OrdinaryAttackAuditV1 {
  readonly actorId: string;
  readonly kind: "wild-feint";
  readonly targetTokenId: string;
}

export interface D6OrdinaryAttackThreadV1 {
  readonly actorId: string;
  readonly actorName: string;
  readonly attackHit: boolean;
  readonly attackMessageId: string;
  readonly attackTotal: number;
  readonly damage: {
    readonly plan: D6WeaponDamageContinuationRollContext;
    readonly result?: D6RollResultV1;
    readonly stage: "no-damage" | "pending" | "rolling" | "rolled";
  };
  readonly defenseKind: "dodge" | "parry" | "range";
  readonly defenseLabel: string;
  readonly defenseTotal: number;
  readonly difficulty: {
    readonly calculatedValue: number;
    readonly source: "calculated" | "custom";
    readonly value: number;
  };
  readonly requestId: string;
  readonly audits: readonly D6OrdinaryAttackAuditV1[];
  readonly reactions: readonly D6OrdinaryAttackReactionV1[];
  readonly results: D6InitiatingActionResultLedgerV1;
  readonly revision: number;
  readonly rollMode: D6RollMode;
  readonly schema: typeof D6_ORDINARY_ATTACK_THREAD_SCHEMA;
  readonly target: {
    readonly actionsForfeited?: boolean;
    readonly bodyPointsCurrent?: number;
    readonly bodyPointsMaximum?: number;
    readonly conditionLabel?: string;
    readonly damageKind?: "physical" | "stun";
    readonly healthStateId?: string;
    readonly resistanceTotal?: number;
    readonly stunRoundsRemaining?: number;
    readonly unconsciousMinutes?: number;
    readonly stage:
      | "no-damage"
      | "awaiting-damage"
      | "pending-resistance"
      | "resolving"
      | "applied";
    readonly targetActorId: string;
    readonly targetName?: string;
    readonly visible: boolean;
  };
  readonly weaponId: string;
  readonly weaponName: string;
}

export function createD6OrdinaryAttackThread(input: {
  readonly actorId: string;
  readonly actorName: string;
  readonly attackHit: boolean;
  readonly attackMessageId: string;
  readonly attackTotal: number;
  readonly defenseKind: D6OrdinaryAttackThreadV1["defenseKind"];
  readonly defenseLabel: string;
  readonly defenseTotal: number;
  readonly difficulty?: D6OrdinaryAttackThreadV1["difficulty"];
  readonly damagePlan: D6WeaponDamageContinuationRollContext;
  readonly requestId: string;
  readonly rollMode: D6RollMode;
  readonly targetActorId: string;
  readonly targetName: string;
  readonly targetVisible?: boolean;
  readonly reaction?: {
    readonly actorId: string;
    readonly actorName: string;
    readonly reason: D6OrdinaryAttackReactionV1["reason"];
    readonly visible?: boolean;
    readonly weaponId: string;
    readonly weaponName: string;
  };
  readonly weaponId: string;
  readonly weaponName: string;
}): D6OrdinaryAttackThreadV1 {
  const stage = input.attackHit ? "pending" : "no-damage";
  const { damagePlan, ...threadInput } = input;
  const difficulty =
    input.difficulty ??
    Object.freeze({
      calculatedValue: input.defenseTotal,
      source: "calculated" as const,
      value: input.defenseTotal,
    });
  return freezeThread({
    ...threadInput,
    damage: { plan: damagePlan, stage },
    difficulty,
    audits: Object.freeze([]),
    reactions: Object.freeze(
      input.reaction
        ? [
            {
              actorId: input.reaction.actorId,
              ...(input.reaction.visible === false
                ? {}
                : { actorName: input.reaction.actorName }),
              attack: { stage: "pending" },
              damage: { stage: "no-damage" },
              id: `${input.requestId}:riposte`,
              kind: "riposte" as const,
              reason: input.reaction.reason,
              target: {
                stage: "no-damage" as const,
                targetActorId: input.actorId,
                targetName: input.actorName,
                visible: true,
              },
              visible: input.reaction.visible !== false,
              weaponId: input.reaction.weaponId,
              weaponName: input.reaction.weaponName,
            },
          ]
        : [],
    ),
    results: createD6InitiatingActionResultLedger(
      input.attackMessageId,
      input.requestId,
    ),
    revision: 0,
    schema: D6_ORDINARY_ATTACK_THREAD_SCHEMA,
    target: {
      stage: input.attackHit ? "awaiting-damage" : "no-damage",
      targetActorId: input.targetActorId,
      ...(input.targetVisible === false
        ? {}
        : { targetName: input.targetName }),
      visible: input.targetVisible !== false,
    },
  });
}

export function recordD6OrdinaryAttackWildFeint(
  thread: D6OrdinaryAttackThreadV1,
  targetTokenId: string,
): D6OrdinaryAttackThreadV1 {
  if (!required(targetTokenId))
    throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
  const audit: D6OrdinaryAttackAuditV1 = Object.freeze({
    actorId: thread.actorId,
    kind: "wild-feint",
    targetTokenId,
  });
  if (thread.audits.length > 0) return thread;
  return update(thread, { audits: Object.freeze([...thread.audits, audit]) });
}

export function claimD6OrdinaryAttackReaction(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
): D6OrdinaryAttackThreadV1 {
  return updateReaction(thread, reactionId, (reaction) => {
    if (reaction.attack.stage !== "pending")
      throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
    return { ...reaction, attack: { stage: "rolling" } };
  });
}

export function releaseD6OrdinaryAttackReaction(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
): D6OrdinaryAttackThreadV1 {
  return updateReaction(thread, reactionId, (reaction) =>
    reaction.attack.stage === "rolling"
      ? { ...reaction, attack: { stage: "pending" } }
      : reaction,
  );
}

export function completeD6OrdinaryAttackReaction(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
  result: D6RollResultV1,
  presentation: D6InitiatingActionResultV1,
): D6OrdinaryAttackThreadV1 {
  const plan = result.request.context?.weaponDamageContinuation;
  const hit = result.success === true && plan !== undefined;
  const updated = updateReaction(thread, reactionId, (reaction) => {
    if (
      reaction.attack.stage !== "rolling" ||
      result.request.kind !== "weapon-attack" ||
      result.request.source.actorId !== reaction.actorId ||
      result.request.source.itemId !== reaction.weaponId ||
      result.request.context?.weaponAttack?.targetActorId !== thread.actorId
    )
      throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
    return {
      ...reaction,
      attack: { result, stage: hit ? "hit" : "missed" },
      damage: hit ? { plan, stage: "pending" } : { stage: "no-damage" },
      target: {
        ...reaction.target,
        stage: hit ? "awaiting-damage" : "no-damage",
      },
    };
  });
  return update(updated, {
    results: appendD6InitiatingActionResult(updated.results, presentation),
  });
}

export function claimD6OrdinaryReactionDamage(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
): D6OrdinaryAttackThreadV1 {
  return updateReaction(thread, reactionId, (reaction) => {
    if (reaction.damage.stage !== "pending" || !reaction.damage.plan)
      throw new RangeError("D6E2.ActionThread.DamageUnavailable");
    return { ...reaction, damage: { ...reaction.damage, stage: "rolling" } };
  });
}

export function releaseD6OrdinaryReactionDamage(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
): D6OrdinaryAttackThreadV1 {
  return updateReaction(thread, reactionId, (reaction) =>
    reaction.damage.stage === "rolling"
      ? { ...reaction, damage: { ...reaction.damage, stage: "pending" } }
      : reaction,
  );
}

export function completeD6OrdinaryReactionDamage(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
  result: D6RollResultV1,
  presentation: D6InitiatingActionResultV1,
): D6OrdinaryAttackThreadV1 {
  const updated = updateReaction(thread, reactionId, (reaction) => {
    if (reaction.damage.stage !== "rolling" || result.request.kind !== "damage")
      throw new RangeError("D6E2.ActionThread.DamageUnavailable");
    return {
      ...reaction,
      damage: { ...reaction.damage, result, stage: "rolled" },
      target: { ...reaction.target, stage: "pending-resistance" },
    };
  });
  return update(updated, {
    results: appendD6InitiatingActionResult(updated.results, presentation),
  });
}

export function setD6OrdinaryReactionTargetStage(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
  stage: "pending-resistance" | "resolving",
): D6OrdinaryAttackThreadV1 {
  return updateReaction(thread, reactionId, (reaction) => {
    if (!["pending-resistance", "resolving"].includes(reaction.target.stage))
      throw new RangeError("D6E2.ActionThread.ResistanceUnavailable");
    return { ...reaction, target: { ...reaction.target, stage } };
  });
}

export function completeD6OrdinaryReactionTarget(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
  outcome: Parameters<typeof completeD6OrdinaryAttackTarget>[1],
): D6OrdinaryAttackThreadV1 {
  const updated = updateReaction(thread, reactionId, (reaction) => {
    if (reaction.target.stage !== "resolving")
      throw new RangeError("D6E2.ActionThread.ResistanceUnavailable");
    const visible = reaction.target.visible;
    return {
      ...reaction,
      target: {
        ...reaction.target,
        ...(visible && outcome.actionsForfeited !== undefined
          ? { actionsForfeited: outcome.actionsForfeited }
          : {}),
        ...(visible && outcome.bodyPointsCurrent !== undefined
          ? { bodyPointsCurrent: outcome.bodyPointsCurrent }
          : {}),
        ...(visible && outcome.bodyPointsMaximum !== undefined
          ? { bodyPointsMaximum: outcome.bodyPointsMaximum }
          : {}),
        ...(visible
          ? {
              conditionLabel: outcome.conditionLabel,
              damageKind: outcome.damageKind,
              healthStateId: outcome.healthStateId,
              resistanceTotal: outcome.resistanceTotal,
            }
          : {}),
        ...(visible && outcome.stunRoundsRemaining !== undefined
          ? { stunRoundsRemaining: outcome.stunRoundsRemaining }
          : {}),
        ...(visible && outcome.unconsciousMinutes !== undefined
          ? { unconsciousMinutes: outcome.unconsciousMinutes }
          : {}),
        stage: "applied",
      },
    };
  });
  return outcome.presentation
    ? update(updated, {
        results: appendD6InitiatingActionResult(
          updated.results,
          outcome.presentation,
        ),
      })
    : updated;
}

export function claimD6OrdinaryAttackDamage(
  thread: D6OrdinaryAttackThreadV1,
): D6OrdinaryAttackThreadV1 {
  if (thread.damage.stage !== "pending")
    throw new RangeError("D6E2.ActionThread.DamageUnavailable");
  return update(thread, { damage: { ...thread.damage, stage: "rolling" } });
}

export function releaseD6OrdinaryAttackDamage(
  thread: D6OrdinaryAttackThreadV1,
): D6OrdinaryAttackThreadV1 {
  return thread.damage.stage === "rolling"
    ? update(thread, { damage: { ...thread.damage, stage: "pending" } })
    : thread;
}

export function completeD6OrdinaryAttackDamage(
  thread: D6OrdinaryAttackThreadV1,
  result: D6RollResultV1,
  presentation: D6InitiatingActionResultV1,
): D6OrdinaryAttackThreadV1 {
  if (thread.damage.stage !== "rolling" || result.request.kind !== "damage") {
    throw new RangeError("D6E2.ActionThread.DamageUnavailable");
  }
  return update(thread, {
    damage: { ...thread.damage, result, stage: "rolled" },
    results: appendD6InitiatingActionResult(thread.results, presentation),
    target: { ...thread.target, stage: "pending-resistance" },
  });
}

export function setD6OrdinaryAttackTargetStage(
  thread: D6OrdinaryAttackThreadV1,
  stage: "pending-resistance" | "resolving",
): D6OrdinaryAttackThreadV1 {
  if (!["pending-resistance", "resolving"].includes(thread.target.stage)) {
    throw new RangeError("D6E2.ActionThread.ResistanceUnavailable");
  }
  return update(thread, { target: { ...thread.target, stage } });
}

export function completeD6OrdinaryAttackTarget(
  thread: D6OrdinaryAttackThreadV1,
  outcome: {
    readonly conditionLabel: string;
    readonly actionsForfeited?: boolean;
    readonly bodyPointsCurrent?: number;
    readonly bodyPointsMaximum?: number;
    readonly damageKind: "physical" | "stun";
    readonly healthStateId: string;
    readonly resistanceTotal: number;
    readonly stunRoundsRemaining?: number;
    readonly unconsciousMinutes?: number;
    readonly presentation?: D6InitiatingActionResultV1;
  },
): D6OrdinaryAttackThreadV1 {
  if (thread.target.stage !== "resolving")
    throw new RangeError("D6E2.ActionThread.ResistanceUnavailable");
  return update(thread, {
    results: outcome.presentation
      ? appendD6InitiatingActionResult(thread.results, outcome.presentation)
      : thread.results,
    target: {
      ...thread.target,
      ...(thread.target.visible && outcome.actionsForfeited !== undefined
        ? { actionsForfeited: outcome.actionsForfeited }
        : {}),
      ...(thread.target.visible && outcome.bodyPointsCurrent !== undefined
        ? { bodyPointsCurrent: outcome.bodyPointsCurrent }
        : {}),
      ...(thread.target.visible && outcome.bodyPointsMaximum !== undefined
        ? { bodyPointsMaximum: outcome.bodyPointsMaximum }
        : {}),
      ...(thread.target.visible
        ? {
            conditionLabel: outcome.conditionLabel,
            damageKind: outcome.damageKind,
            healthStateId: outcome.healthStateId,
            resistanceTotal: outcome.resistanceTotal,
          }
        : {}),
      ...(thread.target.visible && outcome.stunRoundsRemaining !== undefined
        ? { stunRoundsRemaining: outcome.stunRoundsRemaining }
        : {}),
      ...(thread.target.visible && outcome.unconsciousMinutes !== undefined
        ? { unconsciousMinutes: outcome.unconsciousMinutes }
        : {}),
      stage: "applied",
    },
  });
}

export function recoverD6OrdinaryAttackThread(
  thread: D6OrdinaryAttackThreadV1,
): D6OrdinaryAttackThreadV1 {
  let recovered = releaseD6OrdinaryAttackDamage(thread);
  if (recovered.target.stage === "resolving") {
    recovered = update(recovered, {
      target: { ...recovered.target, stage: "pending-resistance" },
    });
  }
  for (const reaction of recovered.reactions) {
    if (reaction.attack.stage === "rolling")
      recovered = releaseD6OrdinaryAttackReaction(recovered, reaction.id);
    const current = recovered.reactions.find(({ id }) => id === reaction.id);
    if (current?.damage.stage === "rolling")
      recovered = releaseD6OrdinaryReactionDamage(recovered, reaction.id);
    const latest = recovered.reactions.find(({ id }) => id === reaction.id);
    if (latest?.target.stage === "resolving")
      recovered = setD6OrdinaryReactionTargetStage(
        recovered,
        reaction.id,
        "pending-resistance",
      );
  }
  return recovered;
}

export function parseD6OrdinaryAttackThread(
  value: unknown,
): D6OrdinaryAttackThreadV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<D6OrdinaryAttackThreadV1>;
  const ledger = parseD6InitiatingActionResultLedger(candidate.results);
  const damagePlan = parseDamagePlan(candidate.damage?.plan);
  const damageStage = candidate.damage?.stage;
  const targetStage = candidate.target?.stage;
  if (
    ![1, D6_ORDINARY_ATTACK_THREAD_SCHEMA].includes(Number(candidate.schema)) ||
    !required(candidate.actorId) ||
    !required(candidate.actorName) ||
    !required(candidate.attackMessageId) ||
    !required(candidate.requestId) ||
    !required(candidate.weaponId) ||
    !required(candidate.weaponName) ||
    !Number.isFinite(candidate.attackTotal) ||
    !Number.isFinite(candidate.defenseTotal) ||
    !Number.isInteger(candidate.revision) ||
    Number(candidate.revision) < 0 ||
    !candidate.damage ||
    !damagePlan ||
    !candidate.target ||
    !new Set<unknown>(["blindroll", "gmroll", "publicroll", "selfroll"]).has(
      candidate.rollMode,
    ) ||
    !new Set<unknown>(["dodge", "parry", "range"]).has(candidate.defenseKind) ||
    !new Set<unknown>(["no-damage", "pending", "rolling", "rolled"]).has(
      damageStage,
    ) ||
    ![
      "no-damage",
      "awaiting-damage",
      "pending-resistance",
      "resolving",
      "applied",
    ].includes(targetStage ?? "") ||
    !required(candidate.target.targetActorId) ||
    typeof candidate.target.visible !== "boolean" ||
    (candidate.target.visible && !required(candidate.target.targetName)) ||
    (!candidate.target.visible && candidate.target.targetName !== undefined)
  )
    return null;
  const difficulty = parseDifficulty(
    candidate.difficulty,
    candidate.defenseTotal,
  );
  if (!difficulty) return null;
  if (
    damagePlan.scale.sourceActorId !== candidate.actorId ||
    damagePlan.scale.targetActorId !== candidate.target.targetActorId
  )
    return null;
  const audits = parseAudits(candidate.audits);
  const reactions = parseReactions(candidate.reactions, candidate.actorId);
  if (!audits || !reactions) return null;
  if (
    ledger?.rootMessageId !== candidate.attackMessageId ||
    ledger.requestId !== candidate.requestId
  )
    return null;
  return freezeThread({
    ...candidate,
    audits,
    difficulty,
    damage: { ...candidate.damage, plan: damagePlan },
    reactions,
    results: ledger,
    schema: D6_ORDINARY_ATTACK_THREAD_SCHEMA,
  } as D6OrdinaryAttackThreadV1);
}

function parseDifficulty(
  value: unknown,
  legacyCalculatedValue: unknown,
): D6OrdinaryAttackThreadV1["difficulty"] | null {
  if (value === undefined && Number.isFinite(legacyCalculatedValue)) {
    const calculatedValue = Math.trunc(Number(legacyCalculatedValue));
    return Object.freeze({
      calculatedValue,
      source: "calculated",
      value: calculatedValue,
    });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<D6OrdinaryAttackThreadV1["difficulty"]>;
  const source = candidate.source;
  if (
    !Number.isFinite(candidate.calculatedValue) ||
    !Number.isFinite(candidate.value) ||
    (source !== "calculated" && source !== "custom") ||
    (source === "calculated" &&
      Math.trunc(Number(candidate.value)) !==
        Math.trunc(Number(candidate.calculatedValue)))
  )
    return null;
  return Object.freeze({
    calculatedValue: Math.trunc(Number(candidate.calculatedValue)),
    source,
    value: Math.trunc(Number(candidate.value)),
  });
}

function update(
  thread: D6OrdinaryAttackThreadV1,
  changes: Partial<
    Pick<
      D6OrdinaryAttackThreadV1,
      "audits" | "damage" | "reactions" | "results" | "target"
    >
  >,
): D6OrdinaryAttackThreadV1 {
  return freezeThread({ ...thread, ...changes, revision: thread.revision + 1 });
}

function freezeThread(
  thread: D6OrdinaryAttackThreadV1,
): D6OrdinaryAttackThreadV1 {
  return Object.freeze({
    ...thread,
    audits: Object.freeze([...thread.audits]),
    damage: Object.freeze({ ...thread.damage }),
    reactions: Object.freeze(
      thread.reactions.map((reaction) =>
        Object.freeze({
          ...reaction,
          attack: Object.freeze({ ...reaction.attack }),
          damage: Object.freeze({ ...reaction.damage }),
          target: Object.freeze({ ...reaction.target }),
        }),
      ),
    ),
    target: Object.freeze({ ...thread.target }),
  });
}

function updateReaction(
  thread: D6OrdinaryAttackThreadV1,
  reactionId: string,
  operation: (
    reaction: D6OrdinaryAttackReactionV1,
  ) => D6OrdinaryAttackReactionV1,
): D6OrdinaryAttackThreadV1 {
  const index = thread.reactions.findIndex(({ id }) => id === reactionId);
  const current = thread.reactions[index];
  if (!current) throw new RangeError("D6E2.ActionThread.ReactionUnavailable");
  const reaction = operation(current);
  if (reaction === current) return thread;
  const reactions = [...thread.reactions];
  reactions[index] = reaction;
  return update(thread, { reactions: Object.freeze(reactions) });
}

function parseAudits(
  value: unknown,
): readonly D6OrdinaryAttackAuditV1[] | null {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 4) return null;
  const audits: D6OrdinaryAttackAuditV1[] = [];
  for (const entry of value) {
    const audit = entry as Partial<D6OrdinaryAttackAuditV1> | undefined;
    if (
      audit?.kind !== "wild-feint" ||
      !required(audit.actorId) ||
      !required(audit.targetTokenId)
    )
      return null;
    audits.push(
      Object.freeze({
        actorId: audit.actorId,
        kind: audit.kind,
        targetTokenId: audit.targetTokenId,
      }),
    );
  }
  return Object.freeze(audits);
}

function parseReactions(
  value: unknown,
  sourceActorId: unknown,
): readonly D6OrdinaryAttackReactionV1[] | null {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 4) return null;
  const reactions: D6OrdinaryAttackReactionV1[] = [];
  for (const entry of value) {
    const reaction = entry as Partial<D6OrdinaryAttackReactionV1> | undefined;
    const attackStage = reaction?.attack?.stage;
    const damageStage = reaction?.damage?.stage;
    const targetStage = reaction?.target?.stage;
    const plan = reaction?.damage?.plan;
    if (
      reaction?.kind !== "riposte" ||
      !required(reaction.id) ||
      !required(reaction.actorId) ||
      !required(reaction.weaponId) ||
      !required(reaction.weaponName) ||
      typeof reaction.visible !== "boolean" ||
      (reaction.visible && !required(reaction.actorName)) ||
      (!reaction.visible && reaction.actorName !== undefined) ||
      !["failed-attack", "wild-complication"].includes(reaction.reason ?? "") ||
      !["pending", "rolling", "missed", "hit"].includes(attackStage ?? "") ||
      !["no-damage", "pending", "rolling", "rolled"].includes(
        damageStage ?? "",
      ) ||
      !reaction.target ||
      reaction.target.targetActorId !== sourceActorId ||
      ![
        "no-damage",
        "awaiting-damage",
        "pending-resistance",
        "resolving",
        "applied",
      ].includes(targetStage ?? "") ||
      ((damageStage === "pending" ||
        damageStage === "rolling" ||
        damageStage === "rolled") &&
        !parseDamagePlan(plan))
    )
      return null;
    reactions.push(
      Object.freeze({
        ...reaction,
        attack: Object.freeze({ ...reaction.attack }),
        damage: Object.freeze({
          ...reaction.damage,
          ...(plan ? { plan: parseDamagePlan(plan) ?? undefined } : {}),
        }),
        target: Object.freeze({ ...reaction.target }),
      }) as D6OrdinaryAttackReactionV1,
    );
  }
  return Object.freeze(reactions);
}

function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDamagePlan(
  value: unknown,
): D6WeaponDamageContinuationRollContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const plan = value as Partial<D6WeaponDamageContinuationRollContext>;
  const scale = plan.scale;
  const damage = plan.weaponDamage;
  const autofire = plan.autofire;
  if (
    !required(plan.bindingId) ||
    !Number.isInteger(plan.score) ||
    (plan.score ?? -1) < 0 ||
    scale?.application !== "damage" ||
    !required(scale.sourceActorId) ||
    !required(scale.sourceName) ||
    !required(scale.targetActorId) ||
    !required(scale.targetName) ||
    !Number.isFinite(scale.modifierScore) ||
    !Number.isFinite(scale.sourcePage) ||
    !Number.isFinite(scale.sourceRank) ||
    !Number.isFinite(scale.targetRank) ||
    !damage ||
    !new Set<unknown>([
      "attribute",
      "fixed",
      "skill",
      "stale-skill-fallback",
      "strength-damage",
    ]).has(damage.baseKind) ||
    typeof damage.attributeId !== "string" ||
    typeof damage.configuredSkillKey !== "string" ||
    !Number.isFinite(damage.baseScore) ||
    !Number.isFinite(damage.listedDamageScore) ||
    (autofire !== undefined &&
      (!Number.isInteger(autofire.spend) ||
        autofire.spend <= 0 ||
        !Number.isFinite(autofire.attackModifier) ||
        !Number.isFinite(autofire.damageModifier) ||
        autofire.damageModifier <= 0 ||
        !Number.isFinite(autofire.maximum)))
  )
    return null;
  return Object.freeze({
    ...plan,
    ...(autofire === undefined ? {} : { autofire: Object.freeze(autofire) }),
    scale: Object.freeze(scale),
    weaponDamage: Object.freeze(damage),
  }) as D6WeaponDamageContinuationRollContext;
}
