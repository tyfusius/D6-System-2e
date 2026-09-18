import { secondEditionMachineWeaponAttackPlan } from "./machine-combat";

export interface MachinePilotPlan {
  readonly family: "open-d6" | "second-edition";
  readonly kind: "starship" | "vehicle";
  readonly maneuverabilityScore: number;
  readonly crewPenaltyScore: number;
  readonly modifierScore: number;
}
/** Ordinary maneuver/pilot/drive checks only; this does not implement Evading.
 * D62e pp.177,182; OpenD6 installed maneuver flow documented in the parity ledger. */
export function machinePilotPlan(input: {
  readonly family: MachinePilotPlan["family"];
  readonly kind: MachinePilotPlan["kind"];
  readonly maneuverabilityScore: number;
  readonly assignedCrewCount: number;
  readonly minimumCrew: number;
}): MachinePilotPlan {
  const maneuverabilityScore =
    input.family === "open-d6" || input.kind === "starship"
      ? Math.max(0, Math.trunc(input.maneuverabilityScore))
      : 0;
  const crewPenaltyScore =
    input.family === "second-edition"
      ? secondEditionMachineWeaponAttackPlan({
          ...input,
          crewGunneryScore: 0,
          weaponAttackBonusScore: 0,
        }).crewPenaltyScore
      : 0;
  return Object.freeze({
    family: input.family,
    kind: input.kind,
    maneuverabilityScore,
    crewPenaltyScore,
    modifierScore: maneuverabilityScore - crewPenaltyScore,
  });
}
