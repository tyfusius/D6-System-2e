export interface SecondEditionMachineWeaponAttackInput {
  readonly assignedCrewCount: number;
  readonly crewGunneryScore: number;
  readonly kind: "starship" | "vehicle";
  readonly minimumCrew: number;
  readonly weaponAttackBonusScore: number;
}

export interface SecondEditionMachineWeaponAttackPlan {
  readonly assignedCrewCount: number;
  readonly crewGunneryScore: number;
  readonly crewPenaltyScore: number;
  readonly minimumCrew: number;
  readonly missingCrewCount: number;
  readonly score: number;
  readonly sourcePage: 177 | 180 | 182;
  readonly weaponAttackBonusScore: number;
}

function natural(value: number): number {
  return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

/**
 * D62e pp. 177, 180, 182: mounted attacks use Gunnery plus the weapon attack
 * bonus. Starships lose 1D for each crewmember below their listed minimum.
 */
export function secondEditionMachineWeaponAttackPlan(
  input: SecondEditionMachineWeaponAttackInput,
): SecondEditionMachineWeaponAttackPlan {
  const assignedCrewCount = natural(input.assignedCrewCount);
  const minimumCrew =
    input.kind === "starship" ? Math.max(1, natural(input.minimumCrew)) : 0;
  const missingCrewCount =
    input.kind === "starship"
      ? Math.max(0, minimumCrew - assignedCrewCount)
      : 0;
  const crewPenaltyScore = missingCrewCount * 3;
  const crewGunneryScore = natural(input.crewGunneryScore);
  const weaponAttackBonusScore = natural(input.weaponAttackBonusScore);
  return Object.freeze({
    assignedCrewCount,
    crewGunneryScore,
    crewPenaltyScore,
    minimumCrew,
    missingCrewCount,
    score: crewGunneryScore + weaponAttackBonusScore - crewPenaltyScore,
    sourcePage:
      input.kind === "starship" ? (missingCrewCount > 0 ? 177 : 180) : 182,
    weaponAttackBonusScore,
  });
}
