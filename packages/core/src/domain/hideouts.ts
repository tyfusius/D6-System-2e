export const D6_HIDEOUT_LOCATION_TYPES = Object.freeze([
  "urban",
  "country",
  "wild",
  "custom",
] as const);

export type D6HideoutLocationType = (typeof D6_HIDEOUT_LOCATION_TYPES)[number];

export const D6_HIDEOUT_STATES = Object.freeze([
  "ready",
  "compromised",
  "destroyed",
  "relocating",
  "rebuilding",
] as const);

export type D6HideoutState = (typeof D6_HIDEOUT_STATES)[number];

export interface D6HideoutRelocationPlan {
  readonly complete: boolean;
  readonly featureCount: number;
  readonly monthsCompleted: number;
  readonly monthsRemaining: number;
  readonly monthsRequired: number;
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** D62e p. 234 normally requires one month per feature. */
export function hideoutRelocationPlan(
  featureCount: number,
  monthsCompleted = 0,
  monthsOverride?: number,
): D6HideoutRelocationPlan {
  const features = whole(featureCount);
  const required =
    monthsOverride === undefined ? features : whole(monthsOverride);
  const completed = Math.min(required, whole(monthsCompleted));
  return Object.freeze({
    complete: completed >= required,
    featureCount: features,
    monthsCompleted: completed,
    monthsRemaining: Math.max(0, required - completed),
    monthsRequired: required,
  });
}
