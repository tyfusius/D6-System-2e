import { startBodyPointRoot } from "./first-edition-body-point-root";
import { bodyPointTreatmentAvailable } from "./first-edition-body-point-authority";
import {
  bodyPointTreatmentOutcome,
  type FirstEditionBodyPointRoot,
} from "../application/first-edition-body-point-root";
import {
  firstEditionNaturalHealingRule,
  firstEditionAssistedHealingDifficulty,
  firstEditionBodyPointWound,
  firstEditionMortalityResolution,
  firstEditionMortalityElapsedMinutes,
  isFirstEditionWoundLevel,
  type FirstEditionHealingResolution,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { rollFirstEditionHealingCheck } from "./rolls/roll-service";
import { rollFirstEditionAutomatedMortalityCheck } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";
import {
  actorHealthResolutionStrategy,
  readActorHealth,
  setActorHealthPool,
  setActorHealthTrack,
} from "./health-runtime";
import { startWoundRoot } from "./first-edition-wound-root";
import { woundRootModelAvailable } from "./first-edition-wound-authority";
import {
  woundRootOutcome,
  type FirstEditionWoundRoot,
} from "../application/first-edition-wound-root";

export interface FirstEditionBodyPointHealingResult {
  readonly current: number;
  readonly maximum: number;
  readonly recovered: number;
  readonly actualGain: number;
  readonly rescue: "dead" | "not-needed" | "rescued";
  readonly skillLossDice: 0 | 1 | 2;
  readonly wound: FirstEditionWoundLevel;
}

function activeBodyPoints(actor: FoundryActorDocument) {
  const pool = readActorHealth(actor).pool;
  if (!pool)
    throw new Error("D6E2.Combat.FirstEdition.BodyPoints.MaximumRequired");
  return pool;
}

function completedBodyPointTreatment(
  value: FirstEditionBodyPointRoot | null,
): FirstEditionBodyPointHealingResult | null {
  if (value?.action.status !== "complete") return null;
  const outcome = bodyPointTreatmentOutcome(value);
  return outcome
    ? {
        ...outcome,
        recovered: outcome.rescue === "dead" ? 0 : outcome.amount,
        actualGain: outcome.gain,
      }
    : null;
}
export async function resolveFirstEditionBodyPointNaturalHealing(
  actor: FoundryActorDocument,
  restModifierScore: -3 | 0 | 3,
): Promise<FirstEditionBodyPointHealingResult | null> {
  if (!bodyPointTreatmentAvailable(actor))
    throw new Error(
      "D6E2.Combat.FirstEdition.BodyPointRoot.PatientUnavailable",
    );
  return completedBodyPointTreatment(
    await startBodyPointRoot(actor, "natural", { restModifierScore }),
  );
}
export async function resolveFirstEditionBodyPointAssistedHealing(
  patient: FoundryActorDocument,
  healer: FoundryActorDocument,
  medicineItemId: string,
): Promise<FirstEditionBodyPointHealingResult | null> {
  if (!bodyPointTreatmentAvailable(patient))
    throw new Error(
      "D6E2.Combat.FirstEdition.BodyPointRoot.PatientUnavailable",
    );
  return completedBodyPointTreatment(
    await startBodyPointRoot(patient, "assisted", { healer, medicineItemId }),
  );
}

export interface FirstEditionRoundMortalityResult {
  readonly checkId: string;
  readonly completedRounds: number;
  readonly elapsedMinutes: number;
  readonly outcome: "survived" | "dead";
  readonly total: number;
}

function currentWound(actor: FoundryActorDocument): FirstEditionWoundLevel {
  const projection = readActorHealth(actor);
  const stateId = projection.track?.currentStateId;
  if (isFirstEditionWoundLevel(stateId)) return stateId;
  if (projection.pool)
    return firstEditionBodyPointWound(
      projection.pool.current,
      projection.pool.maximum,
    );
  return "healthy";
}

function usesBodyPointResolution(actor: FoundryActorDocument): boolean {
  return actorHealthResolutionStrategy(actor).family === "body-points";
}

function completedHealing(
  value: FirstEditionWoundRoot | null,
): FirstEditionHealingResolution | null {
  if (value?.action.status !== "complete") return null;
  const outcome = woundRootOutcome(value);
  return outcome && outcome.outcome !== "survived"
    ? {
        previousWound: outcome.previousWound,
        nextWound: outcome.nextWound,
        outcome: outcome.outcome,
      }
    : null;
}

export async function resolveFirstEditionNaturalHealing(
  actor: FoundryActorDocument,
): Promise<FirstEditionHealingResolution | null> {
  if (
    !woundRootModelAvailable(actor) ||
    !firstEditionNaturalHealingRule(currentWound(actor))
  )
    return null;
  return completedHealing(await startWoundRoot(actor, "natural"));
}

export async function resolveFirstEditionAssistedHealing(
  patient: FoundryActorDocument,
  healer: FoundryActorDocument,
  medicineItemId: string,
): Promise<FirstEditionHealingResolution | null> {
  if (
    !woundRootModelAvailable(patient) ||
    firstEditionAssistedHealingDifficulty(currentWound(patient)) === null
  )
    return null;
  return completedHealing(
    await startWoundRoot(patient, "assisted", { healer, medicineItemId }),
  );
}

export async function resolveFirstEditionMortalityCheck(
  actor: FoundryActorDocument,
  minutesMortallyWounded: number,
): Promise<"survived" | "dead" | null> {
  if (currentWound(actor) !== "mortally-wounded") return null;
  if (woundRootModelAvailable(actor)) {
    const root = await startWoundRoot(actor, "manual-mortality", {
      minutes: minutesMortallyWounded,
    });
    const outcome =
      root?.action.status === "complete"
        ? woundRootOutcome(root)?.outcome
        : null;
    return outcome === "survived" || outcome === "dead" ? outcome : null;
  }
  const roll = await rollFirstEditionHealingCheck(
    actor,
    game.i18n.localize("D6E2.Combat.FirstEdition.Healing.MortalityCheck"),
    minutesMortallyWounded,
  );
  if (!roll) return null;
  const outcome = firstEditionMortalityResolution(
    minutesMortallyWounded,
    roll.total,
  );
  if (outcome === "dead") {
    if (usesBodyPointResolution(actor)) {
      const bodyPoints = activeBodyPoints(actor);
      await setActorHealthPool(actor, {
        current: -bodyPoints.maximum,
        maximum: bodyPoints.maximum,
      });
    } else {
      await setActorHealthTrack(actor, "dead");
    }
  }
  return outcome;
}

export async function resolveFirstEditionEndOfRoundMortality(
  actor: FoundryActorDocument,
  checkId: string,
  combatUuid?: string,
): Promise<FirstEditionRoundMortalityResult | null> {
  if (currentWound(actor) !== "mortally-wounded") return null;
  if (woundRootModelAvailable(actor)) {
    const root = await startWoundRoot(actor, "round-mortality", {
      checkId,
      ...(combatUuid ? { combatUuid } : {}),
    });
    if (root?.action.status !== "complete" || !root.action.clock) return null;
    const receipt = root.action.stages[0]?.receipt,
      outcome = woundRootOutcome(root)?.outcome;
    if (
      receipt?.kind !== "d6-roll" ||
      (outcome !== "survived" && outcome !== "dead")
    )
      return null;
    return {
      checkId: root.action.clock.checkId,
      completedRounds: root.action.clock.completedRounds.value,
      elapsedMinutes: root.action.clock.elapsedMinutes.value,
      outcome,
      total: receipt.result.total,
    };
  }
  const state = record(record(actor.system.health).firstEditionState);
  if (stringValue(state.mortalityCheckId) === checkId) return null;
  const completedRounds = integer(state.mortalityRounds) + 1;
  const elapsedMinutes = firstEditionMortalityElapsedMinutes(completedRounds);
  const roll = await rollFirstEditionAutomatedMortalityCheck(
    actor,
    game.i18n.localize("D6E2.Combat.FirstEdition.Mortality.AutomaticCheck"),
    elapsedMinutes,
    { checkId, completedRounds, elapsedMinutes, sourcePage: 76 },
  );
  if (currentWound(actor) !== "mortally-wounded") return null;
  const outcome = firstEditionMortalityResolution(elapsedMinutes, roll.total);
  if (outcome === "dead") {
    if (usesBodyPointResolution(actor)) {
      const bodyPoints = activeBodyPoints(actor);
      await setActorHealthPool(actor, {
        current: -bodyPoints.maximum,
        maximum: bodyPoints.maximum,
      });
    } else {
      await setActorHealthTrack(actor, "dead");
    }
  } else {
    await actor.update({
      ...(!usesBodyPointResolution(actor)
        ? { "system.health.firstEditionWound": "mortally-wounded" }
        : {}),
      "system.health.firstEditionState.mortalityCheckId": checkId,
      "system.health.firstEditionState.mortalityRounds": completedRounds,
    });
  }
  return Object.freeze({
    checkId,
    completedRounds,
    elapsedMinutes,
    outcome,
    total: roll.total,
  });
}
