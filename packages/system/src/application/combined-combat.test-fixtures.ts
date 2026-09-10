import {
  resolveD6Roll,
  type D6RollRequestV1,
  type D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import {
  createCombinedActionRootState,
  claimCombinedRootStep,
  recordCombinedRootStep,
  replaceCombinedRootStep,
  type CombinedRootStep,
} from "./combined-action-root";
import { appendD6InitiatingActionResult } from "./initiating-action-results";
import {
  createD6OrdinaryAttackThread,
  claimD6OrdinaryAttackDamage,
  completeD6OrdinaryAttackDamage,
} from "./ordinary-attack-thread";

export function fixture() {
  const context = {
    groupId: "group",
    stage: "command" as const,
    allocatedBonusScore: 0,
    commandDifficulty: 15,
    commandPenaltyScore: 0,
    participantCount: 6,
    leaderActorId: "leader",
    leaderName: "Leader",
    primaryActorId: "worker",
    primaryName: "Worker",
  };
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: "attribute",
    label: "Command",
    score: 18,
    resultModifier: 0,
    heroPointUse: "none",
    rollMode: "publicroll",
    difficulty: 15,
    source: {
      actorId: "leader",
      actorName: "Leader",
      attributeId: "perception",
    },
    context: { combinedAction: context },
  };
  const commandResult = resolveD6Roll({
    profileId: "second-edition",
    successEvaluator: "second-edition-strict",
    wildPolicy: "second-edition",
    request,
    baseFaces: [3, 3, 3, 3, 3],
    wildFaces: [3],
  });
  const step: CombinedRootStep = {
    id: "attack",
    actorId: "worker",
    label: "Attack",
    subject: { kind: "weaponAttack", itemId: "weapon" },
    status: "requested",
    controllerId: "owner",
    options: {
      bonusScore: 3,
      penaltyScore: 0,
      context: { ...context, stage: "task", allocatedBonusScore: 3 },
    },
  };
  const plan: D6WeaponDamageContinuationRollContext = {
    bindingId: "locked",
    score: 12,
    weaponDamage: {
      attributeId: "",
      baseKind: "fixed",
      baseScore: 0,
      configuredSkillKey: "",
      listedDamageScore: 12,
    },
    scale: {
      application: "damage",
      modifierScore: 0,
      sourceActorId: "worker",
      sourceName: "Worker",
      sourcePage: 196,
      sourceRank: 0,
      targetActorId: "target",
      targetTokenId: "target-token",
      targetName: "Target",
      targetRank: 0,
    },
    autofire: {
      attackModifier: -2,
      damageModifier: 4,
      maximum: 4,
      sourcePage: 163,
      spend: 2,
    },
  };
  const attack: D6RollRequestV1 = {
    ...request,
    kind: "weapon-attack",
    label: "Attack",
    score: 15,
    difficulty: 10,
    source: {
      actorId: "worker",
      actorName: "Worker",
      attributeId: "reflexes",
      itemId: "weapon",
    },
    context: {
      combinedAction: step.options.context,
      requestedRoll: {
        requestId: "attack",
        requesterUserId: "gm",
        requesterName: "GM",
        recipientUserId: "owner",
        rollMode: "publicroll",
        visibility: "public",
      },
      weaponDamageContinuation: plan,
      weaponAttack: {
        attackKind: "ranged",
        baseDefense: 10,
        coverModifier: 0,
        coverSourcePage: 30,
        defense: 10,
        defenseKind: "dodge",
        targetActorId: "target",
        targetTokenId: "target-token",
        targetName: "Target",
        weaponId: "weapon",
      },
    },
  };
  const initial = createCombinedActionRootState({
    rootMessageId: "root",
    groupId: "group",
    coordinatorId: "gm",
    createdAt: 1,
    label: "Combined attack",
    application: "combat",
    combatDamageBonusScore: 3,
    combatIntent: {
      weaponId: "weapon",
      targetActorId: "target",
      targetTokenId: "target-token",
    },
    participantIds: ["leader", "worker", "a", "b", "c", "d"],
    participantNames: "Six participants",
    primarySubject: { kind: "weaponAttack", itemId: "weapon" },
    steps: [
      {
        id: "command",
        actorId: "leader",
        label: "Command",
        subject: { kind: "attribute", attributeId: "perception" },
        status: "recorded",
        controllerId: "owner",
        request,
        runtime: {
          profileId: "second-edition",
          successEvaluator: "second-edition-strict",
          wildPolicy: "second-edition",
        },
        artifacts: [{}],
        result: commandResult,
        options: { bonusScore: 0, penaltyScore: 0, context },
      },
      step,
      {
        ...step,
        id: "ordinary:root:damage",
        label: "Damage",
        status: "pending",
        subject: { kind: "weaponDamage", itemId: "weapon" },
      },
    ],
  });
  const root = {
    ...initial,
    results: appendD6InitiatingActionResult(initial.results, {
      appendId: "command",
      details: { actorId: "leader", total: commandResult.total },
      kind: "combined-action-command",
      rollMode: "publicroll",
      rolls: [
        {
          formula: "6d6",
          total: 18,
          faces: [3, 3, 3, 3, 3, 3],
          fingerprint: "a".repeat(64),
        },
      ],
    }),
  };
  const result = resolveD6Roll({
    profileId: "second-edition",
    successEvaluator: "second-edition-strict",
    wildPolicy: "second-edition",
    request: attack,
    baseFaces: [3, 3, 3, 3],
    wildFaces: [3],
  });
  return { root, step, attack, plan, result };
}

export function compositionFixture() {
  const { root, attack, result, plan } = fixture();
  const claimed = claimCombinedRootStep(root, "attack", "owner", attack, {
    profileId: "second-edition",
    successEvaluator: "second-edition-strict",
    wildPolicy: "second-edition",
  });
  const recorded = recordCombinedRootStep(claimed, "attack", result, [{}]);
  const completed = {
    ...recorded,
    results: appendD6InitiatingActionResult(recorded.results, {
      appendId: "attack",
      kind: "combined-action-task",
      details: { actorId: "worker", total: result.total },
      rollMode: "publicroll",
      rolls: [
        {
          formula: "5d6",
          total: 15,
          faces: [3, 3, 3, 3, 3],
          fingerprint: "b".repeat(64),
        },
      ],
    }),
  };
  const initialThread = createD6OrdinaryAttackThread({
    actorId: "worker",
    actorName: "Worker",
    attackHit: true,
    attackMessageId: "root",
    attackTotal: result.total,
    defenseKind: "dodge",
    defenseLabel: "Dodge",
    defenseTotal: 10,
    damagePlan: plan,
    requestId: "ordinary:root",
    rollMode: "publicroll",
    targetActorId: "target",
    targetName: "Target",
    weaponId: "weapon",
    weaponName: "Weapon",
  });
  const damageStep = required(completed.steps[2]);
  const requested = replaceCombinedRootStep(completed, {
    ...damageStep,
    status: "requested",
    controllerId: "gm",
  });
  const { difficulty: _difficulty, ...damageBase } = attack;
  void _difficulty;
  const damageRequest: D6RollRequestV1 = {
    ...damageBase,
    kind: "damage",
    label: "Damage",
    context: {
      combinedAction: damageStep.options.context,
      requestedRoll: {
        requestId: damageStep.id,
        requesterUserId: "gm",
        requesterName: "GM",
        recipientUserId: "gm",
        rollMode: "publicroll",
        visibility: "public",
      },
      weaponDamage: plan.weaponDamage,
      scale: plan.scale,
      ...(plan.autofire ? { autofire: plan.autofire } : {}),
    },
  };
  const runtime = {
    profileId: "second-edition" as const,
    successEvaluator: "second-edition-strict" as const,
    wildPolicy: "second-edition" as const,
  };
  const damageResult = resolveD6Roll({
    ...runtime,
    request: damageRequest,
    baseFaces: [3, 3, 3, 3],
    wildFaces: [3],
  });
  const claimedDamage = claimCombinedRootStep(
    requested,
    damageStep.id,
    "gm",
    damageRequest,
    runtime,
  );
  const recordedDamage = recordCombinedRootStep(
    claimedDamage,
    damageStep.id,
    damageResult,
    [{}],
  );
  const entry = {
    appendId: damageStep.id,
    kind: "ordinary-weapon-damage" as const,
    details: {
      actorId: "worker",
      targetActorId: "target",
      total: damageResult.total,
    },
    rollMode: "publicroll" as const,
    rolls: [
      {
        formula: "5d6",
        total: 15,
        faces: [3, 3, 3, 3, 3],
        fingerprint: "c".repeat(64),
      },
    ],
  };
  const parent = {
    ...recordedDamage,
    results: appendD6InitiatingActionResult(recordedDamage.results, entry),
  };
  const thread = completeD6OrdinaryAttackDamage(
    claimD6OrdinaryAttackDamage(initialThread),
    damageResult,
    entry,
  );
  return {
    root: parent,
    thread,
    initialThread,
    attackRoot: completed,
    claimedDamage,
    damageResult,
  };
}

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}
