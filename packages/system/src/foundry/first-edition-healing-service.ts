import {
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionBodyPointWound,
  firstEditionBodyPointHealingPlan,
  firstEditionBodyPointRescueMinimum,
  firstEditionBodyPointSkillLossDice,
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
import { rollFirstEditionRecoveryCheck } from "./rolls/roll-service";
import { rollFirstEditionAutomatedMortalityCheck } from "./rolls/roll-service";
import { integer, record, stringValue } from "./sheets/values";
import { currentFirstEditionDamageMode } from "../settings/setting-values";
import {
  healActorFirstEditionBodyPoints,
  readActorFirstEditionBodyPoints,
  setActorFirstEditionBodyPoints,
} from "./first-edition-body-point-service";
import { currentEffectivePipScore } from "../settings/pip-rules";
import { firstEditionAttributeRole } from "../settings/first-edition-genre-profile";

export interface FirstEditionBodyPointHealingResult {
  readonly current: number;
  readonly maximum: number;
  readonly recovered: number;
  readonly rescue: "dead" | "not-needed" | "rescued";
  readonly skillLossDice: 0 | 1 | 2;
  readonly wound: FirstEditionWoundLevel;
}

async function rollBodyPointRecoveryAmount(total: number): Promise<number> {
  const plan = firstEditionBodyPointHealingPlan(total);
  if (plan.dice <= 0) return plan.fixed;
  const roll = await new Roll(`${plan.dice}d6`).evaluate();
  await ChatMessage.create({
    content: `<div class="od6chat-roll"><strong>${game.i18n.localize(
      "D6E2.Combat.FirstEdition.BodyPoints.RecoveryRoll",
    )}</strong><span>${roll.total} · OpenD6 Space p. 78</span></div>`,
    flags: {
      "d6-system-2e": {
        kind: "firstEditionBodyPointRecovery",
        recovered: roll.total,
        sourcePage: 78,
        version: 1,
      },
    },
    rolls: [roll],
  });
  return Math.max(0, Math.trunc(roll.total));
}

export async function resolveFirstEditionBodyPointNaturalHealing(
  actor: FoundryActorDocument,
  restModifierScore: -3 | 0 | 3,
): Promise<FirstEditionBodyPointHealingResult | null> {
  const strengthId = firstEditionAttributeRole("strength");
  const brawn = record(record(actor.system.attributes)[strengthId]);
  const score = Math.max(
    3,
    currentEffectivePipScore(integer(brawn.score)) + restModifierScore,
  );
  const check = await rollFirstEditionRecoveryCheck(
    actor,
    game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.NaturalCheck"),
    strengthId,
    undefined,
    undefined,
    score,
  );
  if (!check) return null;
  const recovered = await rollBodyPointRecoveryAmount(check.total);
  const result = await healActorFirstEditionBodyPoints(actor, recovered);
  return Object.freeze({
    ...result,
    recovered,
    rescue: "not-needed" as const,
    skillLossDice: 0 as const,
  });
}

export async function resolveFirstEditionBodyPointAssistedHealing(
  patient: FoundryActorDocument,
  healer: FoundryActorDocument,
  medicineItemId: string,
): Promise<FirstEditionBodyPointHealingResult | null> {
  const check = await rollFirstEditionHealingCheck(
    healer,
    game.i18n.format("D6E2.Combat.FirstEdition.Healing.MedicineCheck", {
      patient: patient.name,
    }),
    undefined,
    medicineItemId,
  );
  if (!check) return null;
  const recovered = await rollBodyPointRecoveryAmount(check.total);
  const before = readActorFirstEditionBodyPoints(patient);
  const mortal =
    firstEditionBodyPointWound(before.current, before.maximum) ===
    "mortally-wounded";
  const projectedCurrent = Math.min(before.maximum, before.current + recovered);
  const reachesRescueMinimum =
    projectedCurrent >= firstEditionBodyPointRescueMinimum(before.maximum);
  let skillLossDice: 0 | 1 | 2 = 0;
  if (mortal && reachesRescueMinimum) {
    const rounds = Math.max(
      0,
      integer(
        record(record(patient.system.health).firstEditionState).mortalityRounds,
      ),
    );
    const minutes = firstEditionMortalityElapsedMinutes(rounds);
    const loss = firstEditionBodyPointSkillLossDice(minutes);
    if (loss === null) {
      await setActorFirstEditionBodyPoints(patient, {
        current: -before.maximum,
        maximum: before.maximum,
      });
      return Object.freeze({
        current: -before.maximum,
        maximum: before.maximum,
        recovered: 0,
        rescue: "dead" as const,
        skillLossDice: 0 as const,
        wound: "dead" as const,
      });
    }
    skillLossDice = loss;
    if (minutes > 4) {
      const stamina = patient.items.contents.find(
        (item) => item.type === "skill" && item.system.key === "stamina",
      );
      const survival = await rollFirstEditionRecoveryCheck(
        patient,
        game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.RescueCheck"),
        firstEditionAttributeRole("strength"),
        minutes,
        stamina?.id,
        undefined,
        true,
      );
      if (!survival || survival.total < minutes) {
        await setActorFirstEditionBodyPoints(patient, {
          current: -before.maximum,
          maximum: before.maximum,
        });
        return Object.freeze({
          current: -before.maximum,
          maximum: before.maximum,
          recovered: 0,
          rescue: "dead" as const,
          skillLossDice: 0 as const,
          wound: "dead" as const,
        });
      }
    }
  }
  const result = await healActorFirstEditionBodyPoints(patient, recovered);
  if (mortal && reachesRescueMinimum && skillLossDice > 0) {
    const lossScore = skillLossDice * 3;
    const updates = patient.items.contents
      .filter((item) => ["skill", "specialization"].includes(item.type))
      .map((item) => ({
        _id: item.id,
        "system.score": Math.max(0, integer(item.system.score) - lossScore),
      }));
    if (updates.length > 0) {
      await patient.updateEmbeddedDocuments("Item", updates);
    }
    await ChatMessage.create({
      content: `<div class="od6chat-roll"><strong>${game.i18n.localize(
        "D6E2.Combat.FirstEdition.BodyPoints.SkillLoss",
      )}</strong><span>${skillLossDice}D · OpenD6 Space p. 76</span></div>`,
      flags: {
        "d6-system-2e": {
          actorId: patient.id,
          kind: "firstEditionBodyPointSkillLoss",
          skillLossDice,
          sourcePage: 76,
          version: 1,
        },
      },
    });
  }
  return Object.freeze({
    ...result,
    recovered,
    rescue: mortal && reachesRescueMinimum ? "rescued" : "not-needed",
    skillLossDice,
  });
}

export interface FirstEditionRoundMortalityResult {
  readonly checkId: string;
  readonly completedRounds: number;
  readonly elapsedMinutes: number;
  readonly outcome: "survived" | "dead";
  readonly total: number;
}

function currentWound(actor: FoundryActorDocument): FirstEditionWoundLevel {
  if (currentFirstEditionDamageMode() !== "wounds") {
    const bodyPoints = readActorFirstEditionBodyPoints(actor);
    return firstEditionBodyPointWound(bodyPoints.current, bodyPoints.maximum);
  }
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
  if (outcome === "dead") {
    if (currentFirstEditionDamageMode() === "wounds") {
      await setActorFirstEditionWound(actor, "dead");
    } else {
      const bodyPoints = readActorFirstEditionBodyPoints(actor);
      await setActorFirstEditionBodyPoints(actor, {
        current: -bodyPoints.maximum,
        maximum: bodyPoints.maximum,
      });
    }
  }
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
    if (currentFirstEditionDamageMode() === "wounds") {
      await setActorFirstEditionWound(actor, "dead");
    } else {
      const bodyPoints = readActorFirstEditionBodyPoints(actor);
      await setActorFirstEditionBodyPoints(actor, {
        current: -bodyPoints.maximum,
        maximum: bodyPoints.maximum,
      });
    }
  } else {
    await actor.update({
      ...(currentFirstEditionDamageMode() === "wounds"
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
