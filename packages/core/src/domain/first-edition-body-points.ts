import type { FirstEditionWoundLevel } from "./combat";

export const FIRST_EDITION_DAMAGE_MODES = Object.freeze([
  "wounds",
  "body-points",
  "body-points-with-wounds",
] as const);

export type FirstEditionDamageMode =
  (typeof FIRST_EDITION_DAMAGE_MODES)[number];

export interface FirstEditionBodyPointState {
  readonly current: number;
  readonly maximum: number;
}

export interface FirstEditionBodyPointHealingPlan {
  readonly dice: number;
  readonly fixed: number;
}

function integer(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function firstEditionBodyPointMaximum(
  strengthRollTotal: number,
): number {
  return Math.max(0, integer(strengthRollTotal) + 20);
}

export function normalizeFirstEditionBodyPoints(
  state: FirstEditionBodyPointState,
): FirstEditionBodyPointState {
  const maximum = Math.max(0, integer(state.maximum));
  return Object.freeze({
    current: Math.min(maximum, integer(state.current)),
    maximum,
  });
}

/**
 * Derive the optional Space p. 76 wound band from remaining Body Points.
 * Positive fractional percentages round up so the printed bands never overlap.
 * Zero remains rescue-eligible; death requires another full maximum after zero.
 */
export function firstEditionBodyPointWound(
  currentValue: number,
  maximumValue: number,
): FirstEditionWoundLevel {
  const maximum = Math.max(0, integer(maximumValue));
  const current = integer(currentValue);
  if (maximum <= 0) return "healthy";
  if (current <= -maximum) return "dead";
  if (current <= 0) return "mortally-wounded";
  const percentage = Math.ceil((current / maximum) * 100);
  if (percentage >= 81) return "healthy";
  if (percentage >= 60) return "stunned";
  if (percentage >= 40) return "wounded";
  if (percentage >= 20) return "severely-wounded";
  if (percentage >= 10) return "incapacitated";
  return "mortally-wounded";
}

export function applyFirstEditionBodyPointDamage(
  state: FirstEditionBodyPointState,
  damageDifference: number,
): FirstEditionBodyPointState {
  const normalized = normalizeFirstEditionBodyPoints(state);
  return Object.freeze({
    current: normalized.current - Math.max(0, integer(damageDifference)),
    maximum: normalized.maximum,
  });
}

export function recoverFirstEditionBodyPoints(
  state: FirstEditionBodyPointState,
  recovered: number,
): FirstEditionBodyPointState {
  const normalized = normalizeFirstEditionBodyPoints(state);
  return Object.freeze({
    current: Math.min(
      normalized.maximum,
      normalized.current + Math.max(0, integer(recovered)),
    ),
    maximum: normalized.maximum,
  });
}

export function firstEditionBodyPointHealingPlan(
  medicineOrStrengthTotal: number,
): FirstEditionBodyPointHealingPlan {
  const total = integer(medicineOrStrengthTotal);
  if (total <= 0) return Object.freeze({ dice: 0, fixed: 0 });
  if (total <= 5) return Object.freeze({ dice: 0, fixed: 2 });
  if (total <= 10) return Object.freeze({ dice: 1, fixed: 0 });
  if (total <= 15) return Object.freeze({ dice: 2, fixed: 0 });
  if (total <= 20) return Object.freeze({ dice: 3, fixed: 0 });
  if (total <= 25) return Object.freeze({ dice: 4, fixed: 0 });
  if (total <= 30) return Object.freeze({ dice: 5, fixed: 0 });
  return Object.freeze({ dice: 6, fixed: 0 });
}

export function firstEditionBodyPointRescueMinimum(
  maximumValue: number,
): number {
  return Math.max(0, Math.ceil(Math.max(0, integer(maximumValue)) * 0.1));
}

export function firstEditionBodyPointSkillLossDice(
  minutesMortallyWounded: number,
): 0 | 1 | 2 | null {
  const minutes = Math.max(0, integer(minutesMortallyWounded));
  if (minutes <= 4) return 0;
  if (minutes <= 10) return 1;
  if (minutes <= 15) return 2;
  return null;
}
