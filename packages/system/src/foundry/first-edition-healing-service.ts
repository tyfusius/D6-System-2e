import {
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionMortalityResolution,
  firstEditionMortalityElapsedMinutes,
  firstEditionNaturalHealingResolution,
  firstEditionNaturalHealingRule,
  isFirstEditionWoundLevel,
  type FirstEditionHealingResolution,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { setActorFirstEditionWound } from "./condition-service";
import { rollFirstEditionHealingCheck } from "./rolls/roll-service";
import { rollFirstEditionAutomatedMortalityCheck } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";

export interface FirstEditionRoundMortalityResult {
  readonly checkId: string;
  readonly completedRounds: number;
  readonly elapsedMinutes: number;
  readonly outcome: "survived" | "dead";
  readonly total: number;
}

function currentWound(actor: FoundryActorDocument): FirstEditionWoundLevel {
  const value = record(actor.system.health).firstEditionWound;
  return isFirstEditionWoundLevel(value) ? value : "healthy";
}

async function applyResolution(
  actor: FoundryActorDocument,
  resolution: FirstEditionHealingResolution,
): Promise<FirstEditionHealingResolution> {
  if (resolution.nextWound !== resolution.previousWound) {
    await setActorFirstEditionWound(actor, resolution.nextWound);
  }
  return resolution;
}

export async function resolveFirstEditionNaturalHealing(
  actor: FoundryActorDocument,
): Promise<FirstEditionHealingResolution | null> {
  const wound = currentWound(actor);
  const rule = firstEditionNaturalHealingRule(wound);
  if (!rule) return null;
  if (wound === "stunned") {
    return applyResolution(
      actor,
      firstEditionNaturalHealingResolution(wound, 0),
    );
  }
  const roll = await rollFirstEditionHealingCheck(
    actor,
    game.i18n.localize("D6E2.Combat.FirstEdition.Healing.NaturalCheck"),
  );
  if (!roll) return null;
  return applyResolution(
    actor,
    firstEditionNaturalHealingResolution(
      wound,
      roll.total,
      roll.wildOutcome === "complication",
    ),
  );
}

export async function resolveFirstEditionAssistedHealing(
  patient: FoundryActorDocument,
  healer: FoundryActorDocument,
  medicineItemId: string,
): Promise<FirstEditionHealingResolution | null> {
  const wound = currentWound(patient);
  const difficulty = firstEditionAssistedHealingDifficulty(wound);
  if (difficulty === null) return null;
  const roll = await rollFirstEditionHealingCheck(
    healer,
    game.i18n.format("D6E2.Combat.FirstEdition.Healing.MedicineCheck", {
      patient: patient.name,
    }),
    difficulty,
    medicineItemId,
  );
  if (!roll) return null;
  return applyResolution(
    patient,
    firstEditionAssistedHealingResolution(wound, roll.total),
  );
}

export async function resolveFirstEditionMortalityCheck(
  actor: FoundryActorDocument,
  minutesMortallyWounded: number,
): Promise<"survived" | "dead" | null> {
  if (currentWound(actor) !== "mortally-wounded") return null;
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
  if (outcome === "dead") await setActorFirstEditionWound(actor, "dead");
  return outcome;
}

export async function resolveFirstEditionEndOfRoundMortality(
  actor: FoundryActorDocument,
  checkId: string,
): Promise<FirstEditionRoundMortalityResult | null> {
  if (currentWound(actor) !== "mortally-wounded") return null;
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
    await setActorFirstEditionWound(actor, "dead");
  } else {
    await actor.update({
      "system.health.firstEditionWound": "mortally-wounded",
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
