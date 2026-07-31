import {
  isSecondEditionCondition,
  secondEditionMachineRepairPlan,
  type D6RollResultV1,
  type SecondEditionCondition,
} from "@d6-system-2e/core";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { setActorCondition } from "./condition-service";
import { rollFirstEditionRecoveryCheck } from "./rolls/roll-service";
import { record, stringValue } from "./sheets/values";

export interface MachineRepairResult {
  readonly condition: SecondEditionCondition;
  readonly difficulty: 10 | 15 | 20;
  readonly repaired: boolean;
  readonly roll: D6RollResultV1 | null;
  readonly sourcePage: 180 | 183;
}

function repairSkill(repairer: FoundryActorDocument) {
  return repairer.items.contents.find(
    (item) =>
      item.type === "skill" &&
      (stringValue(item.system.key).toLocaleLowerCase() === "repair" ||
        item.name.trim().toLocaleLowerCase() === "repair"),
  );
}

/** Resolve the explicitly printed Repair Mechanical check for a machine. */
export async function resolveMachineRepair(
  machine: FoundryActorDocument,
  repairer: FoundryActorDocument,
): Promise<MachineRepairResult> {
  if (!["starship", "vehicle"].includes(machine.type)) {
    throw new TypeError("D6E2.Machine.RepairTargetRequired");
  }
  if (machine.isOwner !== true || repairer.isOwner !== true) {
    throw new Error("D6E2.Condition.OwnerRequired");
  }
  if (
    currentEditionCapabilityProfile().damage.strategy !==
    "second-edition-condition-track"
  ) {
    throw new Error("D6E2.Machine.SecondEditionRepairRequired");
  }
  const health = record(machine.system.health);
  const condition = isSecondEditionCondition(health.condition)
    ? health.condition
    : "healthy";
  const kind = machine.type === "starship" ? "starship" : "vehicle";
  const plan = secondEditionMachineRepairPlan(kind, condition);
  if (!plan) throw new Error("D6E2.Machine.NoAutomatedRepair");
  const skill = repairSkill(repairer);
  const roll = await rollFirstEditionRecoveryCheck(
    repairer,
    game.i18n.format("D6E2.Machine.RepairCheck", { machine: machine.name }),
    "mechanical",
    plan.difficulty,
    skill?.id,
  );
  const repaired = roll !== null && roll.total >= plan.difficulty;
  if (repaired) await setActorCondition(machine, "healthy");
  return Object.freeze({
    condition,
    difficulty: plan.difficulty,
    repaired,
    roll,
    sourcePage: plan.sourcePage,
  });
}
