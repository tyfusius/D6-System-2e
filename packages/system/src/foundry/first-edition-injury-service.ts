import {
  firstEditionIncapacitationCheck,
  type FirstEditionStunDamageResolution,
  type FirstEditionStunOutcome,
} from "@d6-system-2e/core";
import {
  rollFirstEditionRecoveryCheck,
  rollFirstEditionUnconsciousDuration,
} from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";
import { currentAttributeRole } from "../settings/attributes";

export type FirstEditionConsciousness =
  "conscious" | "unconscious" | "unresolved";
export type FirstEditionUnconsciousSource =
  "none" | "stun" | "incapacitated" | "mortally-wounded";

export interface FirstEditionInjuryState {
  readonly consciousness: FirstEditionConsciousness;
  readonly source: FirstEditionUnconsciousSource;
  readonly stunWound: FirstEditionStunOutcome;
  readonly unconsciousMinutes: number;
}

const CONSCIOUSNESS = new Set<FirstEditionConsciousness>([
  "conscious",
  "unconscious",
  "unresolved",
]);
const SOURCES = new Set<FirstEditionUnconsciousSource>([
  "none",
  "stun",
  "incapacitated",
  "mortally-wounded",
]);
const STUN_WOUNDS = new Set<FirstEditionStunOutcome>([
  "none",
  "stunned",
  "wounded",
  "severely-wounded",
  "incapacitated",
]);

export function readFirstEditionInjuryState(
  actor: FoundryActorDocument,
): FirstEditionInjuryState {
  const state = record(record(actor.system.health).firstEditionState);
  const consciousness = stringValue(state.consciousness);
  const source = stringValue(state.source);
  const stunWound = stringValue(state.stunWound);
  return Object.freeze({
    consciousness: CONSCIOUSNESS.has(consciousness as FirstEditionConsciousness)
      ? (consciousness as FirstEditionConsciousness)
      : "conscious",
    source: SOURCES.has(source as FirstEditionUnconsciousSource)
      ? (source as FirstEditionUnconsciousSource)
      : "none",
    stunWound: STUN_WOUNDS.has(stunWound as FirstEditionStunOutcome)
      ? (stunWound as FirstEditionStunOutcome)
      : "none",
    unconsciousMinutes: Math.max(0, integer(state.unconsciousMinutes)),
  });
}

export async function applyFirstEditionStunDamage(
  actor: FoundryActorDocument,
  resolution: FirstEditionStunDamageResolution,
): Promise<FirstEditionInjuryState> {
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  if (resolution.reducedWound === "none") {
    return readFirstEditionInjuryState(actor);
  }
  const current = readFirstEditionInjuryState(actor);
  const stunOrder: readonly FirstEditionStunOutcome[] = [
    "none",
    "stunned",
    "wounded",
    "severely-wounded",
    "incapacitated",
  ];
  const stunWound =
    stunOrder.indexOf(resolution.reducedWound) >
    stunOrder.indexOf(current.stunWound)
      ? resolution.reducedWound
      : current.stunWound;
  const next: FirstEditionInjuryState = Object.freeze({
    consciousness: "unconscious",
    source: "stun",
    stunWound,
    unconsciousMinutes: Math.max(
      current.unconsciousMinutes,
      resolution.unconsciousMinutes,
    ),
  });
  await actor.update({
    "system.health.firstEditionState": next,
    "system.movement.posture": "prone",
  });
  return next;
}

export async function resolveFirstEditionIncapacitation(
  actor: FoundryActorDocument,
  skillKey: "stamina" | "willpower",
): Promise<FirstEditionInjuryState | null> {
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const skill = actor.items.contents.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === skillKey,
  );
  const attributeId = currentAttributeRole(
    skillKey === "stamina" ? "strength" : "knowledge",
  );
  const result = await rollFirstEditionRecoveryCheck(
    actor,
    game.i18n.localize(
      "D6E2.Combat.FirstEdition.Consciousness.IncapacitationCheck",
    ),
    attributeId,
    15,
    skill?.id,
  );
  if (!result) return null;
  const consciousness = firstEditionIncapacitationCheck(result.total);
  let unconsciousMinutes = 0;
  if (consciousness === "unconscious") {
    const duration = await rollFirstEditionUnconsciousDuration(actor);
    unconsciousMinutes = Math.max(0, Math.trunc(duration?.total ?? 0));
  }
  const next: FirstEditionInjuryState = Object.freeze({
    consciousness,
    source: "incapacitated",
    stunWound: "none",
    unconsciousMinutes,
  });
  await actor.update({
    "system.health.firstEditionState": next,
    ...(consciousness === "unconscious"
      ? { "system.movement.posture": "prone" }
      : {}),
  });
  return next;
}

export async function clearFirstEditionUnconsciousness(
  actor: FoundryActorDocument,
): Promise<FirstEditionInjuryState> {
  if (actor.isOwner !== true) throw new Error("D6E2.Condition.OwnerRequired");
  const next: FirstEditionInjuryState = Object.freeze({
    consciousness: "conscious",
    source: "none",
    stunWound: "none",
    unconsciousMinutes: 0,
  });
  await actor.update({ "system.health.firstEditionState": next });
  return next;
}
