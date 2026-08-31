import {
  accumulateD6MvTrauma,
  d6MvCombinedPenaltyScore,
  d6MvFatigueState,
  d6MvInjuryRecoveryRule,
  d6MvMortalityResolution,
  d6MvTraumaRecoveryRule,
  d6MvTraumaForAttack,
  healthTrackStorageKey,
  type D6MvInjuryLevel,
  type D6MvTraumaLevel,
} from "@d6-system-2e/core";
import { record } from "./sheets/values";
import { readActorHealth, setActorHealthTrack } from "./health-runtime";
import { readCombatantRound } from "./combat-service";
import { currentEffectivePipScore } from "../settings/pip-rules";

const D6MV_CONDITION_STATE_ID = "d6mv.conditions.v1";

export const D6MV_CONDITION_STATE_KEY = healthTrackStorageKey(
  D6MV_CONDITION_STATE_ID,
);

export interface D6MvActorConditionStateV1 {
  readonly fatigueLevel: number;
  readonly mortalityCheckId: string;
  readonly mortalityRounds: number;
  readonly naturalHealingDayId: string;
  readonly trauma: D6MvTraumaLevel;
  readonly version: 1;
}

const DEFAULT_STATE: D6MvActorConditionStateV1 = Object.freeze({
  fatigueLevel: 0,
  mortalityCheckId: "",
  mortalityRounds: 0,
  naturalHealingDayId: "",
  trauma: "none",
  version: 1,
});

const D6MV_TRAUMA_LEVELS = Object.freeze([
  "none",
  "stunned",
  "shaken",
  "traumatized",
  "severely-traumatized",
] satisfies readonly D6MvTraumaLevel[]);

export function d6MvTraumaOptions(
  selected: D6MvTraumaLevel,
): readonly Readonly<{ id: D6MvTraumaLevel; selected: boolean }>[] {
  return Object.freeze(
    D6MV_TRAUMA_LEVELS.map((id) =>
      Object.freeze({ id, selected: id === selected }),
    ),
  );
}

function nonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function trauma(value: unknown): D6MvTraumaLevel {
  return value === "stunned" ||
    value === "shaken" ||
    value === "traumatized" ||
    value === "severely-traumatized"
    ? value
    : "none";
}

function actorHealthTracks(
  actor: FoundryActorDocument,
): Record<string, unknown> {
  return record(record(actor.system.health).tracks);
}

export function readD6MvConditionState(
  actor: FoundryActorDocument,
): D6MvActorConditionStateV1 {
  const tracks = actorHealthTracks(actor);
  const nestedLegacy = record(record(record(tracks.d6mv).conditions).v1);
  const stored = record(
    tracks[D6MV_CONDITION_STATE_KEY] ??
      tracks[D6MV_CONDITION_STATE_ID] ??
      nestedLegacy,
  );
  return Object.freeze({
    fatigueLevel: nonNegativeInteger(stored.fatigueLevel),
    mortalityCheckId:
      typeof stored.mortalityCheckId === "string"
        ? stored.mortalityCheckId
        : "",
    mortalityRounds: nonNegativeInteger(stored.mortalityRounds),
    naturalHealingDayId:
      typeof stored.naturalHealingDayId === "string"
        ? stored.naturalHealingDayId
        : "",
    trauma: trauma(stored.trauma),
    version: 1,
  });
}

async function updateState(
  actor: FoundryActorDocument,
  next: D6MvActorConditionStateV1,
): Promise<void> {
  if (actor.isOwner !== true && game.user?.isGM !== true) {
    throw new Error("D6E2.Condition.OwnerRequired");
  }
  const tracks = structuredClone(actorHealthTracks(actor));
  tracks[D6MV_CONDITION_STATE_KEY] = next;
  await actor.update({ "system.health.tracks": tracks });
}

export function d6MvActorPenaltyScore(actor: FoundryActorDocument): number {
  const state = readD6MvConditionState(actor);
  const injury = (readActorHealth(actor).track?.currentStateId ??
    "healthy") as D6MvInjuryLevel;
  return d6MvCombinedPenaltyScore({
    fatigueLevel: state.fatigueLevel,
    injury,
    trauma: state.trauma,
  });
}

export function d6MvMentalResistanceScore(actor: FoundryActorDocument): number {
  const attributes = record(actor.system.attributes);
  const base = currentEffectivePipScore(
    nonNegativeInteger(record(attributes.charm).score),
  );
  const round = readCombatantRound(actor);
  const defense = round?.secondEditionFullDefense;
  return (
    base +
    (defense?.sourcePage === 62 && round?.completedActionIds.length === 1
      ? (defense.mentalResistanceBonus ?? 0)
      : 0)
  );
}

export async function resolveD6MvMentalAttack(
  actor: FoundryActorDocument,
  attackTotal: number,
  resistanceTotal = d6MvMentalResistanceScore(actor),
): Promise<D6MvTraumaLevel> {
  const incoming = d6MvTraumaForAttack(attackTotal, resistanceTotal);
  await applyD6MvTrauma(actor, incoming);
  return incoming;
}

export async function applyD6MvTrauma(
  actor: FoundryActorDocument,
  incoming: D6MvTraumaLevel,
): Promise<D6MvActorConditionStateV1> {
  const current = readD6MvConditionState(actor);
  const next = Object.freeze({
    ...current,
    trauma: accumulateD6MvTrauma(current.trauma, incoming),
  });
  await updateState(actor, next);
  return next;
}

export async function applyD6MvFatigue(
  actor: FoundryActorDocument,
  strengthScore: number,
): Promise<D6MvActorConditionStateV1> {
  const current = readD6MvConditionState(actor);
  const fatigue = d6MvFatigueState(current.fatigueLevel + 1, strengthScore);
  const next = Object.freeze({ ...current, fatigueLevel: fatigue.level });
  await updateState(actor, next);
  if (fatigue.mortallyWounded) {
    await setActorHealthTrack(actor, "mortally-wounded");
  }
  return next;
}

export async function clearD6MvFatigue(
  actor: FoundryActorDocument,
): Promise<D6MvActorConditionStateV1> {
  const current = readD6MvConditionState(actor);
  const next = Object.freeze({ ...current, fatigueLevel: 0 });
  await updateState(actor, next);
  return next;
}

export async function recoverD6MvTrauma(
  actor: FoundryActorDocument,
  total: number,
): Promise<boolean> {
  const current = readD6MvConditionState(actor);
  const rule = d6MvTraumaRecoveryRule(current.trauma);
  if (rule.difficulty === null || total < rule.difficulty) return false;
  await updateState(actor, Object.freeze({ ...current, trauma: "none" }));
  return true;
}

export async function recoverD6MvInjury(
  actor: FoundryActorDocument,
  total: number,
  options: { readonly dayId?: string } = {},
): Promise<boolean> {
  const currentState = (readActorHealth(actor).track?.currentStateId ??
    "healthy") as D6MvInjuryLevel;
  const rule = d6MvInjuryRecoveryRule(currentState);
  if (rule.difficulty === null || total < rule.difficulty) return false;
  const state = readD6MvConditionState(actor);
  if (options.dayId && state.naturalHealingDayId === options.dayId)
    return false;
  await setActorHealthTrack(actor, rule.next);
  if (options.dayId) {
    await updateState(
      actor,
      Object.freeze({ ...state, naturalHealingDayId: options.dayId }),
    );
  }
  return true;
}

export async function resolveD6MvMortalityCheck(
  actor: FoundryActorDocument,
  checkId: string,
  total: number,
): Promise<"dead" | "survived" | null> {
  if (readActorHealth(actor).track?.currentStateId !== "mortally-wounded") {
    return null;
  }
  const state = readD6MvConditionState(actor);
  if (state.mortalityCheckId === checkId) return null;
  const rounds = state.mortalityRounds + 1;
  const resolution = d6MvMortalityResolution(total, rounds);
  if (resolution.died) {
    await setActorHealthTrack(actor, "dead");
    return "dead";
  }
  await updateState(
    actor,
    Object.freeze({
      ...state,
      mortalityCheckId: checkId,
      mortalityRounds: rounds,
    }),
  );
  return "survived";
}

export async function resetD6MvMortalityClock(
  actor: FoundryActorDocument,
): Promise<void> {
  const current = readD6MvConditionState(actor);
  if (!current.mortalityCheckId && current.mortalityRounds === 0) return;
  await updateState(
    actor,
    Object.freeze({
      ...current,
      mortalityCheckId: DEFAULT_STATE.mortalityCheckId,
      mortalityRounds: DEFAULT_STATE.mortalityRounds,
    }),
  );
}
