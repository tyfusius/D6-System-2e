import {
  environmentBreathRounds,
  environmentThreat,
  isSecondEditionCondition,
  recoverEnvironmentCondition,
  resolveEnvironmentFailure,
  type D6EnvironmentEffectV1,
  type D6EnvironmentHazard,
  type D6EnvironmentSeverity,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../settings/pip-rules";
import { setActorCondition } from "./condition-service";
import {
  CLEAR_ENVIRONMENT_EFFECT,
  readActorEnvironmentEffect,
} from "./environment-state";
import {
  rollSecondEditionEnvironmentAid,
  rollSecondEditionEnvironmentExposure,
} from "./rolls/roll-service";
import { integer, record } from "./sheets/values";

export interface D6EnvironmentExposureInput {
  readonly actorId: string;
  readonly hazard: D6EnvironmentHazard;
  readonly severity: D6EnvironmentSeverity;
}

function requireGm(): void {
  if (game.user?.isGM !== true)
    throw new Error("D6E2.Environment.Error.GmOnly");
}

export function d6EnvironmentsEnabled(): boolean {
  return currentEditionCapabilityProfile().environments.state === "active";
}

function requireEnvironmentActor(actorId: string): FoundryActorDocument {
  const actor = game.actors?.get(actorId);
  if (!actor || !["character", "creature", "npc"].includes(actor.type)) {
    throw new Error("D6E2.Environment.Error.ActorMissing");
  }
  return actor;
}

function currentCondition(actor: FoundryActorDocument) {
  const value = record(actor.system.health).condition;
  return isSecondEditionCondition(value) ? value : "healthy";
}

function effectUpdate(effect: D6EnvironmentEffectV1): Record<string, unknown> {
  return {
    "system.environment.active": true,
    "system.environment.appliedCondition": effect.appliedCondition,
    "system.environment.difficulty": effect.difficulty,
    "system.environment.halfMove": effect.halfMove,
    "system.environment.hazard": effect.hazard,
    "system.environment.penaltyScore": effect.penaltyScore,
    "system.environment.previousCondition": effect.previousCondition,
    "system.environment.severity": effect.severity,
    "system.environment.sourcePage": effect.sourcePage,
    "system.environment.version": effect.version,
  };
}

function conditionLabel(value: string): string {
  const suffix: Readonly<Record<string, string>> = Object.freeze({
    dead: "Dead",
    healthy: "Healthy",
    incapacitated: "Incapacitated",
    "mortally-wounded": "MortallyWounded",
    staggered: "Staggered",
    stunned: "Stunned",
    wounded: "Wounded",
  });
  return game.i18n.localize(`D6E2.Condition.${suffix[value] ?? "Healthy"}`);
}

export function environmentSafeBreathRounds(
  actor: FoundryActorDocument,
): number {
  const stamina = actor.items.contents.find(
    (item) => item.type === "skill" && item.system.key === "stamina",
  );
  const brawn = integer(record(record(actor.system.attributes).brawn).score);
  const score = stamina
    ? currentCombinedPipScore(brawn, integer(stamina.system.score))
    : currentEffectivePipScore(brawn);
  return environmentBreathRounds(score);
}

export async function exposeActorToEnvironment(
  input: D6EnvironmentExposureInput,
): Promise<boolean> {
  requireGm();
  if (!d6EnvironmentsEnabled()) {
    throw new Error("D6E2.Environment.Error.ModuleInactive");
  }
  const actor = requireEnvironmentActor(input.actorId);
  const threat = environmentThreat(input.hazard, input.severity);
  const resolution = resolveEnvironmentFailure(threat, currentCondition(actor));
  const roll = await rollSecondEditionEnvironmentExposure(
    actor,
    threat,
    resolution.effect.appliedCondition,
  );
  if (roll?.success !== false) return false;
  await actor.update(effectUpdate(resolution.effect));
  if (resolution.nextCondition !== resolution.effect.previousCondition) {
    await setActorCondition(actor, resolution.nextCondition);
  }
  Hooks.callAll?.("d6e2EnvironmentChanged", actor.id);
  return true;
}

async function recover(
  actor: FoundryActorDocument,
  method: "aid" | "safe-day",
): Promise<void> {
  const effect = readActorEnvironmentEffect(actor);
  if (!effect) throw new Error("D6E2.Environment.Error.NoActiveEffect");
  const condition = currentCondition(actor);
  const restored = recoverEnvironmentCondition(effect, condition);
  await actor.update({
    ...CLEAR_ENVIRONMENT_EFFECT,
    ...(restored === condition ? {} : { "system.health.condition": restored }),
  });
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/chat/environment-recovery.hbs`,
    {
      actor,
      conditionLabel: conditionLabel(restored),
      effect: {
        ...effect,
        hazardLabel: game.i18n.localize(
          `D6E2.Environment.Hazard.${effect.hazard}`,
        ),
        severityLabel: game.i18n.localize(
          `D6E2.Environment.Severity.${effect.severity}`,
        ),
      },
      methodLabel: game.i18n.localize(`D6E2.Environment.Recovery.${method}`),
    },
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
  Hooks.callAll?.("d6e2EnvironmentChanged", actor.id);
}

export async function recoverEnvironmentAfterSafeDay(
  actorId: string,
): Promise<void> {
  requireGm();
  await recover(requireEnvironmentActor(actorId), "safe-day");
}

export async function aidEnvironmentRecovery(
  targetActorId: string,
  helperActorId: string,
  skillItemId: string,
): Promise<boolean> {
  requireGm();
  const target = requireEnvironmentActor(targetActorId);
  const helper = requireEnvironmentActor(helperActorId);
  const effect = readActorEnvironmentEffect(target);
  if (!effect) throw new Error("D6E2.Environment.Error.NoActiveEffect");
  const roll = await rollSecondEditionEnvironmentAid(
    helper,
    skillItemId,
    target,
    effect,
  );
  if (roll?.success !== true) return false;
  await recover(target, "aid");
  return true;
}

export { readActorEnvironmentEffect };
