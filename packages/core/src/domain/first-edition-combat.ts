import { PIPS_PER_DIE } from "./die-code";

export type FirstEditionActiveDefenseKind = "block" | "dodge" | "parry";
export type FirstEditionActiveDefenseMode = "full" | "partial";

export interface FirstEditionActiveDefensePlan {
  readonly baseScore: number;
  readonly effectiveScore: number;
  readonly kind: FirstEditionActiveDefenseKind;
  readonly legal: boolean;
  readonly mapPenaltyScore: number;
  readonly mode: FirstEditionActiveDefenseMode;
  readonly resultModifier: number;
}

export type FirstEditionRangedCombatBand =
  "point-blank" | "short" | "medium" | "long";

export interface FirstEditionRangedCombatDifficultyPlan {
  readonly activeDefense: boolean;
  readonly baseDefense: number;
  readonly defense: number;
  readonly rangeBand: FirstEditionRangedCombatBand;
  readonly rangeModifier: -5 | 0 | 5 | 10;
  readonly sourcePage: 73;
}

export function firstEditionActiveDefensePlan(
  kind: FirstEditionActiveDefenseKind,
  mode: FirstEditionActiveDefenseMode,
  baseScore: number,
  mapPenaltyScore = 0,
): FirstEditionActiveDefensePlan {
  if (!Number.isSafeInteger(baseScore) || baseScore < 0) {
    throw new RangeError("An active-defense score must be non-negative.");
  }
  if (!Number.isSafeInteger(mapPenaltyScore) || mapPenaltyScore < 0) {
    throw new RangeError("An active-defense MAP must be non-negative.");
  }
  const appliedMap = mode === "full" ? 0 : mapPenaltyScore;
  const effectiveScore = baseScore - appliedMap;
  return Object.freeze({
    baseScore,
    effectiveScore,
    kind,
    legal: effectiveScore >= PIPS_PER_DIE,
    mapPenaltyScore: appliedMap,
    mode,
    resultModifier: mode === "full" ? 10 : 0,
  });
}

/** Resolve D6 Space p. 72–73 passive/active defense plus range. */
export function firstEditionRangedCombatDifficultyPlan(
  rangeBand: FirstEditionRangedCombatBand,
  activeDefense?: number,
): FirstEditionRangedCombatDifficultyPlan {
  if (
    activeDefense !== undefined &&
    (!Number.isSafeInteger(activeDefense) || activeDefense < 0)
  ) {
    throw new RangeError("An active-defense total must be non-negative.");
  }
  const rangeModifier =
    rangeBand === "point-blank"
      ? -5
      : rangeBand === "short"
        ? 0
        : rangeBand === "medium"
          ? 5
          : 10;
  const baseDefense = activeDefense ?? 10;
  return Object.freeze({
    activeDefense: activeDefense !== undefined,
    baseDefense,
    defense: Math.max(3, baseDefense + rangeModifier),
    rangeBand,
    rangeModifier,
    sourcePage: 73,
  });
}

export type FirstEditionMovementType = "climb" | "fly" | "land" | "swim";

export interface FirstEditionMovementPlanInput {
  readonly baseMove: number;
  readonly distance: number;
  readonly hasMovementSkill?: boolean;
  readonly terrainModifier?: number;
  readonly type: FirstEditionMovementType;
}

export interface FirstEditionMovementPlan {
  readonly actionRequired: boolean;
  readonly difficulty: number;
  readonly distance: number;
  readonly freeDistance: number;
  readonly maximumDistance: number;
  readonly movementRate: number;
  readonly rollRequired: boolean;
  readonly type: FirstEditionMovementType;
}

function finiteDistance(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number.`);
  }
  return value;
}

export function firstEditionMovementPlan(
  input: FirstEditionMovementPlanInput,
): FirstEditionMovementPlan {
  const baseMove = finiteDistance(input.baseMove, "Base Move");
  if (baseMove < 1) throw new RangeError("Base Move must be at least one.");
  const distance = finiteDistance(input.distance, "Movement distance");
  const terrainModifier = Math.trunc(
    finiteDistance(input.terrainModifier ?? 0, "Terrain modifier"),
  );
  const movementRate =
    input.type === "swim"
      ? Math.ceil(baseMove / 2)
      : input.type === "climb" && input.hasMovementSkill !== true
        ? Math.ceil(baseMove / 2)
        : baseMove;
  const freeDistance = movementRate / 2;
  const maximumDistance = movementRate * 4;
  if (distance > maximumDistance) {
    throw new RangeError("D6E2.Combat.Error.FirstEditionMovementTooFar");
  }
  const actionRequired = distance > freeDistance;
  let baseDifficulty = 0;
  if (actionRequired) {
    if (input.type === "climb") {
      baseDifficulty =
        5 +
        Math.max(0, Math.ceil((distance - movementRate) / (movementRate / 2))) *
          10;
    } else {
      const movements = Math.max(1, Math.ceil(distance / movementRate));
      baseDifficulty = (input.type === "swim" ? 5 : 0) + (movements - 1) * 5;
    }
  }
  const difficulty = actionRequired ? baseDifficulty + terrainModifier : 0;
  return Object.freeze({
    actionRequired,
    difficulty,
    distance,
    freeDistance,
    maximumDistance,
    movementRate,
    rollRequired: actionRequired && difficulty > 0,
    type: input.type,
  });
}
