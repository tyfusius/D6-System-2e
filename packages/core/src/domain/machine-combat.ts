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

export interface SecondEditionMachineResistancePlan {
  readonly hullScore: number;
  readonly kind: "starship" | "vehicle";
  readonly protectionScore: number;
  readonly score: number;
  readonly sourcePage: 180 | 183;
}

export interface SecondEditionMachineRepairPlan {
  readonly condition:
    "incapacitated" | "mortally-wounded" | "stunned" | "wounded";
  readonly difficulty: 10 | 15 | 20;
  readonly sourcePage: 180 | 183;
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

/** D62e pp. 180 and 183: machine resistance is Hull plus Shields or Armor. */
export function secondEditionMachineResistancePlan(
  kind: "starship" | "vehicle",
  hullScore: number,
  protectionScore: number,
): SecondEditionMachineResistancePlan {
  const hull = natural(hullScore);
  const protection = natural(protectionScore);
  return Object.freeze({
    hullScore: hull,
    kind,
    protectionScore: protection,
    score: hull + protection,
    sourcePage: kind === "starship" ? 180 : 183,
  });
}

/**
 * D62e pp. 180 and 183: Repair Mechanical removes the listed machine
 * condition at difficulty 10, 15, or 20. Other conditions have no printed
 * automated repair difficulty and remain manual.
 */
export function secondEditionMachineRepairPlan(
  kind: "starship" | "vehicle",
  condition: string,
): SecondEditionMachineRepairPlan | null {
  const difficulty =
    condition === "stunned"
      ? 10
      : condition === "wounded" || condition === "incapacitated"
        ? 15
        : condition === "mortally-wounded"
          ? 20
          : null;
  if (difficulty === null) return null;
  const repairableCondition =
    condition as SecondEditionMachineRepairPlan["condition"];
  return Object.freeze({
    condition: repairableCondition,
    difficulty,
    sourcePage: kind === "starship" ? 180 : 183,
  });
}
