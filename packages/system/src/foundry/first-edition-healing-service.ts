import {
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionMortalityResolution,
  firstEditionNaturalHealingResolution,
  firstEditionNaturalHealingRule,
  isFirstEditionWoundLevel,
  type FirstEditionHealingResolution,
  type FirstEditionWoundLevel,
} from "@d6-system-2e/core";
import { setActorFirstEditionWound } from "./condition-service";
import { rollFirstEditionHealingCheck } from "./rolls/roll-service";
import { record } from "./sheets/values";

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
