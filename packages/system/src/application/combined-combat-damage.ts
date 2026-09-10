import {
  combinedActionBonus,
  validateCombinedActionAllocation,
  type D6RollInvocationOptionsV1,
  type D6RollRequestV1,
  type D6RollResultV1,
  type D6WeaponDamageContinuationRollContext,
} from "@d6-system-2e/core";
import type {
  CombinedActionRoot,
  CombinedRootStep,
} from "./combined-action-root";

type CombinedOptions = NonNullable<D6RollInvocationOptionsV1["combinedAction"]>;

/** Prepared for the combat root's claim transaction. The ordinary continuation
 * keeps its captured base/scale/autofire plan; allocation is a separate modifier,
 * exactly as it is for every other Combined roll. This is not a second roll. */
export interface CombinedCombatDamageBindingV1 {
  readonly version: 1;
  readonly rootMessageId: string;
  readonly attackStepId: string;
  readonly attackRequest: D6RollRequestV1;
  readonly plan: D6WeaponDamageContinuationRollContext;
  readonly options: CombinedOptions;
}

export function bindCombinedCombatDamage(
  root: CombinedActionRoot,
  step: CombinedRootStep,
  attackRequest: D6RollRequestV1,
  damageBonusScore: number,
): CombinedCombatDamageBindingV1 {
  const command = root.steps[0];
  const context = step.options.context;
  const plan = attackRequest.context?.weaponDamageContinuation;
  const attack = attackRequest.context?.weaponAttack;
  if (
    root.application !== "combat" ||
    root.cancelled ||
    !command?.result ||
    command.status !== "recorded" ||
    command.options.context.stage !== "command" ||
    !root.steps.some((candidate) => candidate === step) ||
    step.subject.kind !== "weaponAttack" ||
    !["requested", "rolling", "recorded"].includes(step.status) ||
    context.stage !== "task" ||
    context.groupId !== root.groupId ||
    canonical(context) !==
      canonical({
        ...command.options.context,
        stage: "task",
        allocatedBonusScore: step.options.bonusScore,
      }) ||
    !Number.isSafeInteger(damageBonusScore) ||
    damageBonusScore < 0 ||
    !Number.isSafeInteger(step.options.bonusScore) ||
    step.options.bonusScore < 0 ||
    step.actorId !== context.primaryActorId ||
    attackRequest.kind !== "weapon-attack" ||
    attackRequest.source.actorId !== step.actorId ||
    attackRequest.source.itemId !== step.subject.itemId ||
    attackRequest.context?.requestedRoll?.requestId !== step.id ||
    canonical(attackRequest.context.combinedAction) !== canonical(context) ||
    !plan ||
    attack?.weaponId !== step.subject.itemId ||
    root.combatIntent?.weaponId !== step.subject.itemId ||
    root.combatIntent.targetActorId !== attack.targetActorId ||
    root.combatIntent.targetTokenId !== attack.targetTokenId ||
    plan.scale.application !== "damage" ||
    plan.scale.sourceActorId !== step.actorId ||
    plan.scale.targetActorId !== attack.targetActorId ||
    plan.scale.targetTokenId !== attack.targetTokenId ||
    !plan.bindingId ||
    !Number.isSafeInteger(plan.score) ||
    plan.score < 0 ||
    context.allocatedBonusScore !== step.options.bonusScore ||
    step.options.penaltyScore !== 0
  ) {
    throw new Error("D6E2.CombinedActions.Root.Invalid");
  }
  const bonus = combinedActionBonus(
    root.participantIds.length,
    command.result.total,
    command.options.context.commandDifficulty,
  );
  validateCombinedActionAllocation(bonus.finalBonusScore, [
    step.options.bonusScore,
    damageBonusScore,
  ]);
  return structuredClone({
    version: 1,
    rootMessageId: root.rootMessageId,
    attackStepId: step.id,
    attackRequest,
    plan,
    options: {
      bonusScore: damageBonusScore,
      penaltyScore: 0,
      context: { ...context, allocatedBonusScore: damageBonusScore },
    },
  });
}

/** The same successfully resolved attack must authorize the ordinary Damage
 * builder. A miss, a replacement attack, or a changed plan cannot spend this
 * allocation, and cannot redirect it to another weapon or target. */
export function combinedCombatDamageInvocation(
  binding: CombinedCombatDamageBindingV1,
  attackResult: D6RollResultV1,
): CombinedOptions {
  if (
    attackResult.success !== true ||
    attackResult.request.kind !== "weapon-attack" ||
    canonical(binding.attackRequest) !== canonical(attackResult.request) ||
    canonical(binding.plan) !==
      canonical(attackResult.request.context?.weaponDamageContinuation)
  ) {
    throw new Error("D6E2.Combat.Damage.SuccessfulHitRequired");
  }
  return structuredClone(binding.options);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
}
