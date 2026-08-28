import { describe, expect, it } from "vitest";
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
  setD6OrdinaryReactionTargetStage,
  setD6OrdinaryAttackTargetStage,
} from "./ordinary-attack-thread";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6WeaponDamageContinuationRollContext,
  type D6RollResultV1,
} from "@d6-system-2e/core";

const damagePlan = Object.freeze({
  bindingId: "attack-damage-binding",
  score: 15,
  scale: {
    application: "damage" as const,
    modifierScore: 0,
    sourceActorId: "attacker",
    sourceName: "Attacker",
    sourcePage: 83,
    sourceRank: 0,
    targetActorId: "target",
    targetName: "Target",
    targetRank: 0,
    targetTokenId: "target-token",
  },
  weaponDamage: {
    attributeId: "",
    baseKind: "fixed" as const,
    baseScore: 0,
    configuredSkillKey: "",
    listedDamageScore: 15,
  },
}) satisfies D6WeaponDamageContinuationRollContext;

const result = (total: number) =>
  ({
    baseFaces: [4, 3],
    characterPointFaces: [],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: [],
    pool: {
      baseDice: 2,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 3, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "damage",
      label: "damage",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 6,
      source: { actorId: "actor", actorName: "Actor", attributeId: "strength" },
    },
    requiresWildExplosion: false,
    total,
    wildFaces: [2],
    wildOutcome: "normal",
    wildPolicy: "second-edition-classic",
  }) as D6RollResultV1;

const evidence = (
  kind:
    | "ordinary-riposte-attack"
    | "ordinary-riposte-damage"
    | "ordinary-riposte-resistance"
    | "ordinary-target-resistance"
    | "ordinary-weapon-damage",
) => ({
  appendId: `attack:${kind}`,
  details: { targetKey: "target" },
  kind,
  rollMode: "publicroll" as const,
  rolls: [
    {
      faces: [4, 3, 2],
      fingerprint: "a".repeat(64),
      formula: "2d6+1d6",
      total: kind === "ordinary-weapon-damage" ? 9 : 8,
    },
  ],
});

function riposteResult(success: boolean): D6RollResultV1 {
  return {
    ...result(success ? 14 : 7),
    success,
    request: {
      ...result(0).request,
      context: {
        weaponAttack: {
          attackKind: "melee",
          baseDefense: 10,
          coverModifier: 0,
          coverSourcePage: 30,
          defense: 10,
          defenseKind: "parry",
          targetActorId: "attacker",
          targetName: "Attacker",
          targetTokenId: "attacker-token",
          weaponId: "riposte-weapon",
        },
        ...(success
          ? {
              weaponDamageContinuation: {
                ...damagePlan,
                bindingId: "riposte-damage",
                scale: {
                  ...damagePlan.scale,
                  sourceActorId: "target",
                  sourceName: "Defender",
                  targetActorId: "attacker",
                  targetName: "Attacker",
                  targetTokenId: "attacker-token",
                },
              },
            }
          : {}),
      },
      kind: "weapon-attack",
      source: {
        actorId: "target",
        actorName: "Defender",
        attributeId: "agility",
        itemId: "riposte-weapon",
      },
    },
  };
}

describe("ordinary initiating attack thread", () => {
  it("projects one authoritative Riposte phase through every continuation", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: false,
      attackMessageId: "message",
      attackTotal: 7,
      damagePlan,
      defenseKind: "parry",
      defenseLabel: "Parry",
      defenseTotal: 10,
      reaction: {
        actorId: "target",
        actorName: "Defender",
        reason: "failed-attack",
        weaponId: "riposte-weapon",
        weaponName: "Vibroblade",
      },
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "Defender",
      weaponId: "weapon",
      weaponName: "Sword",
    });
    const reactionId = initial.reactions[0]?.id ?? "";
    const claimed = claimD6OrdinaryAttackReaction(initial, reactionId);
    const missed = completeD6OrdinaryAttackReaction(
      claimed,
      reactionId,
      riposteResult(false),
      evidence("ordinary-riposte-attack"),
    );
    const hit = completeD6OrdinaryAttackReaction(
      claimed,
      reactionId,
      riposteResult(true),
      evidence("ordinary-riposte-attack"),
    );
    const damaged = completeD6OrdinaryReactionDamage(
      claimD6OrdinaryReactionDamage(hit, reactionId),
      reactionId,
      result(11),
      evidence("ordinary-riposte-damage"),
    );
    const resolving = setD6OrdinaryReactionTargetStage(
      damaged,
      reactionId,
      "resolving",
    );
    const applied = completeD6OrdinaryReactionTarget(resolving, reactionId, {
      conditionLabel: "Wounded",
      damageKind: "physical",
      healthStateId: "wounded",
      presentation: evidence("ordinary-riposte-resistance"),
      resistanceTotal: 8,
    });
    const phase = (
      thread: ReturnType<typeof createD6OrdinaryAttackThread>,
      interaction?: {
        readonly operation?: "cancel" | "reopen" | "takeOver";
        readonly status: "failed" | "opening" | "pending";
      },
    ) => {
      const reaction = thread.reactions[0];
      if (!reaction) throw new Error("Expected a Riposte reaction.");
      return d6OrdinaryAttackReactionPhase(reaction, interaction);
    };

    expect(phase(initial)).toBe("pending");
    expect(phase(claimed, { status: "pending" })).toBe("pending");
    expect(phase(claimed)).toBe("rolling");
    expect(phase(claimed, { status: "opening" })).toBe("opening");
    expect(
      phase(claimed, {
        operation: "reopen",
        status: "failed",
      }),
    ).toBe("failed");
    expect(phase(missed)).toBe("missed");
    expect(phase(hit)).toBe("damage");
    expect(phase(damaged)).toBe("resistance");
    expect(phase(resolving)).toBe("resistance");
    expect(phase(applied)).toBe("applied");
  });

  it("keeps Wild-Die Feint and the full Riposte branch on the initiating root", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: false,
      attackMessageId: "message",
      attackTotal: 7,
      damagePlan,
      defenseKind: "parry",
      defenseLabel: "Parry",
      defenseTotal: 10,
      reaction: {
        actorId: "target",
        actorName: "Defender",
        reason: "wild-complication",
        weaponId: "riposte-weapon",
        weaponName: "Vibroblade",
      },
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "Defender",
      weaponId: "weapon",
      weaponName: "Sword",
    });
    const audited = recordD6OrdinaryAttackWildFeint(initial, "defender-token");
    const reactionId = audited.reactions[0]?.id ?? "";
    const attacked = completeD6OrdinaryAttackReaction(
      claimD6OrdinaryAttackReaction(audited, reactionId),
      reactionId,
      riposteResult(true),
      evidence("ordinary-riposte-attack"),
    );
    const damaged = completeD6OrdinaryReactionDamage(
      claimD6OrdinaryReactionDamage(attacked, reactionId),
      reactionId,
      result(11),
      evidence("ordinary-riposte-damage"),
    );
    const applied = completeD6OrdinaryReactionTarget(
      setD6OrdinaryReactionTargetStage(damaged, reactionId, "resolving"),
      reactionId,
      {
        conditionLabel: "Wounded",
        damageKind: "physical",
        healthStateId: "wounded",
        presentation: evidence("ordinary-riposte-resistance"),
        resistanceTotal: 8,
      },
    );

    expect(applied.schema).toBe(2);
    expect(applied.audits).toEqual([
      {
        actorId: "attacker",
        kind: "wild-feint",
        targetTokenId: "defender-token",
      },
    ]);
    expect(applied.reactions[0]?.target.stage).toBe("applied");
    expect(applied.results.entries.map(({ kind }) => kind)).toEqual([
      "ordinary-riposte-attack",
      "ordinary-riposte-damage",
      "ordinary-riposte-resistance",
    ]);
    expect(parseD6OrdinaryAttackThread(structuredClone(applied))).toEqual(
      applied,
    );
  });

  it("keeps a dismissed or recovered Riposte pending without spending its branch", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: false,
      attackMessageId: "message",
      attackTotal: 7,
      damagePlan,
      defenseKind: "parry",
      defenseLabel: "Parry",
      defenseTotal: 10,
      reaction: {
        actorId: "target",
        actorName: "Defender",
        reason: "failed-attack",
        weaponId: "riposte-weapon",
        weaponName: "Vibroblade",
      },
      requestId: "attack",
      rollMode: "gmroll",
      targetActorId: "target",
      targetName: "Defender",
      weaponId: "weapon",
      weaponName: "Sword",
    });
    const id = initial.reactions[0]?.id ?? "";
    expect(
      releaseD6OrdinaryAttackReaction(
        claimD6OrdinaryAttackReaction(initial, id),
        id,
      ).reactions[0]?.attack.stage,
    ).toBe("pending");
    expect(
      recoverD6OrdinaryAttackThread(claimD6OrdinaryAttackReaction(initial, id))
        .reactions[0]?.attack.stage,
    ).toBe("pending");
  });
  it("terminates a miss without creating Damage or Resistance stages", () => {
    const thread = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: false,
      attackMessageId: "message",
      attackTotal: 8,
      defenseKind: "dodge",
      defenseLabel: "Dodge",
      defenseTotal: 12,
      damagePlan,
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "Target",
      weaponId: "weapon",
      weaponName: "Blaster",
    });

    expect(thread.damage.stage).toBe("no-damage");
    expect(thread.target.stage).toBe("no-damage");
    expect(parseD6OrdinaryAttackThread(thread)).toEqual(thread);
  });

  it("records Damage then Resistance exactly once on the initiating ledger", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: true,
      attackMessageId: "message",
      attackTotal: 17,
      defenseKind: "dodge",
      defenseLabel: "Dodge",
      defenseTotal: 12,
      damagePlan,
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "Target",
      weaponId: "weapon",
      weaponName: "Blaster",
    });
    const claimed = claimD6OrdinaryAttackDamage(initial);
    const damaged = completeD6OrdinaryAttackDamage(
      claimed,
      result(9),
      evidence("ordinary-weapon-damage"),
    );
    const resolving = setD6OrdinaryAttackTargetStage(damaged, "resolving");
    const applied = completeD6OrdinaryAttackTarget(resolving, {
      conditionLabel: "Wounded",
      damageKind: "physical",
      healthStateId: "wounded",
      resistanceTotal: 8,
      presentation: evidence("ordinary-target-resistance"),
    });

    expect(applied.damage.stage).toBe("rolled");
    expect(applied.target.stage).toBe("applied");
    expect(applied.results.entries.map(({ kind }) => kind)).toEqual([
      "ordinary-weapon-damage",
      "ordinary-target-resistance",
    ]);
    expect(() => claimD6OrdinaryAttackDamage(applied)).toThrow();
  });

  it("releases dismissed Damage and recovers only in-flight stages", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: true,
      attackMessageId: "message",
      attackTotal: 17,
      defenseKind: "range",
      defenseLabel: "Range",
      defenseTotal: 10,
      damagePlan,
      requestId: "attack",
      rollMode: "gmroll",
      targetActorId: "target",
      targetName: "Target",
      weaponId: "weapon",
      weaponName: "Blaster",
    });
    const released = releaseD6OrdinaryAttackDamage(
      claimD6OrdinaryAttackDamage(initial),
    );
    expect(released.damage.stage).toBe("pending");
    expect(released.target).toEqual(initial.target);
    const damaged = completeD6OrdinaryAttackDamage(
      claimD6OrdinaryAttackDamage(initial),
      result(9),
      evidence("ordinary-weapon-damage"),
    );
    expect(
      recoverD6OrdinaryAttackThread(
        setD6OrdinaryAttackTargetStage(damaged, "resolving"),
      ).target.stage,
    ).toBe("pending-resistance");
  });

  it("keeps a hidden target redacted through completion and reload", () => {
    const initial = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: true,
      attackMessageId: "message",
      attackTotal: 17,
      defenseKind: "dodge",
      defenseLabel: "Dodge",
      defenseTotal: 12,
      damagePlan: {
        ...damagePlan,
        scale: {
          ...damagePlan.scale,
          targetActorId: "hidden-target",
          targetName: "Secret Target",
        },
      },
      requestId: "attack",
      rollMode: "gmroll",
      targetActorId: "hidden-target",
      targetName: "Secret Target",
      targetVisible: false,
      weaponId: "weapon",
      weaponName: "Blaster",
    });
    const damaged = completeD6OrdinaryAttackDamage(
      claimD6OrdinaryAttackDamage(initial),
      result(9),
      evidence("ordinary-weapon-damage"),
    );
    const applied = completeD6OrdinaryAttackTarget(
      setD6OrdinaryAttackTargetStage(damaged, "resolving"),
      {
        actionsForfeited: true,
        bodyPointsCurrent: 3,
        bodyPointsMaximum: 12,
        conditionLabel: "Mortally Wounded",
        damageKind: "physical",
        healthStateId: "mortally-wounded",
        resistanceTotal: 4,
        stunRoundsRemaining: 2,
        unconsciousMinutes: 5,
      },
    );
    const reloaded = parseD6OrdinaryAttackThread(structuredClone(applied));

    expect(reloaded?.target).toEqual({
      stage: "applied",
      targetActorId: "hidden-target",
      visible: false,
    });
    expect(JSON.stringify(reloaded?.target)).not.toContain("Secret Target");
    expect(reloaded?.target).not.toHaveProperty("damageKind");
    expect(reloaded?.target).not.toHaveProperty("resistanceTotal");
    expect(reloaded?.target).not.toHaveProperty("healthStateId");
  });

  it("persists the exact 5D Damage plan independently from a 7D attack and mutable reload state", () => {
    const thread = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: true,
      attackMessageId: "message",
      attackTotal: 24,
      damagePlan,
      defenseKind: "range",
      defenseLabel: "Range",
      defenseTotal: 15,
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "Target",
      weaponId: "weapon",
      weaponName: "Blaster",
    });

    expect(thread.damage.plan.score).toBe(15);
    expect(thread.damage.plan.weaponDamage.listedDamageScore).toBe(15);
    expect(thread).not.toHaveProperty("damagePlan");
    expect(
      parseD6OrdinaryAttackThread(structuredClone(thread))?.damage.plan,
    ).toEqual(damagePlan);
    expect(
      parseD6OrdinaryAttackThread({
        ...structuredClone(thread),
        damage: { stage: "pending" },
      }),
    ).toBeNull();
  });

  it("persists a custom NPC difficulty source and value across reload", () => {
    const thread = createD6OrdinaryAttackThread({
      actorId: "attacker",
      actorName: "Attacker",
      attackHit: true,
      attackMessageId: "message",
      attackTotal: 17,
      damagePlan,
      defenseKind: "range",
      defenseLabel: "Range",
      defenseTotal: 15,
      difficulty: {
        calculatedValue: 15,
        source: "custom",
        value: 12,
      },
      requestId: "attack",
      rollMode: "publicroll",
      targetActorId: "target",
      targetName: "NPC Target",
      weaponId: "weapon",
      weaponName: "Blaster",
    });

    expect(thread.difficulty).toEqual({
      calculatedValue: 15,
      source: "custom",
      value: 12,
    });
    expect(
      parseD6OrdinaryAttackThread(structuredClone(thread))?.difficulty,
    ).toEqual(thread.difficulty);
  });
});
