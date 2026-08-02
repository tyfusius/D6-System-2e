import { PIPS_PER_DIE } from "./die-code";

export const SUPERHEROIC_DIE_CODE_CAPS = Object.freeze({
  young: 10,
  street: 12,
  standard: 15,
  national: 18,
  worldwide: 24,
  cosmic: 30,
} as const);

export type SuperheroicDieCodeCap = keyof typeof SUPERHEROIC_DIE_CODE_CAPS;

export interface SuperheroicDieCodeCapPlan {
  readonly applied: boolean;
  readonly bypassed: boolean;
  readonly capDice: number;
  readonly cappedScore: number;
  readonly originalScore: number;
  readonly sourcePage: 208;
}

export function superheroicDieCodeCapPlan(
  score: number,
  cap: SuperheroicDieCodeCap,
  bypassed = false,
): SuperheroicDieCodeCapPlan {
  const originalScore = Math.max(0, Math.trunc(score));
  const capDice = SUPERHEROIC_DIE_CODE_CAPS[cap];
  const dice = Math.trunc(originalScore / PIPS_PER_DIE);
  const pips = originalScore % PIPS_PER_DIE;
  const cappedScore = bypassed
    ? originalScore
    : Math.min(dice, capDice) * PIPS_PER_DIE + pips;
  return Object.freeze({
    applied: cappedScore < originalScore,
    bypassed: bypassed && dice > capDice,
    capDice,
    cappedScore,
    originalScore,
    sourcePage: 208,
  });
}

export type SecretIdentityStatus = "active" | "exposed" | "public";

export interface SecretIdentityState {
  readonly heroicIdentity: string;
  readonly heroPoints: number;
  readonly secretIdentity: string;
  readonly status: SecretIdentityStatus;
  readonly suspicion: number;
}

export function initialSecretIdentityState(): SecretIdentityState {
  return Object.freeze({
    heroicIdentity: "",
    heroPoints: 1,
    secretIdentity: "",
    status: "active",
    suspicion: 0,
  });
}

function identityAvailable(state: SecretIdentityState): void {
  if (state.status !== "active") {
    throw new Error("D6E2.Superheroic.SecretIdentityUnavailable");
  }
}

export function spendSecretIdentityHeroPoint(
  state: SecretIdentityState,
): SecretIdentityState {
  identityAvailable(state);
  if (state.heroPoints < 1) {
    throw new Error("D6E2.Superheroic.SecretIdentityPointRequired");
  }
  return Object.freeze({ ...state, heroPoints: state.heroPoints - 1 });
}

export function reinforceSecretIdentity(
  state: SecretIdentityState,
): SecretIdentityState {
  identityAvailable(state);
  if (state.heroPoints >= 3) {
    throw new Error("D6E2.Superheroic.SecretIdentityPointMaximum");
  }
  return Object.freeze({ ...state, heroPoints: state.heroPoints + 1 });
}

export interface SecretIdentitySuspicionResult {
  readonly exposed: boolean;
  readonly roll: number;
  readonly state: SecretIdentityState;
}

export function gainSecretIdentitySuspicion(
  state: SecretIdentityState,
  roll: number,
  gainHeroPoint = false,
): SecretIdentitySuspicionResult {
  identityAvailable(state);
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError("A Suspicion roll must be between 1 and 6.");
  }
  if (gainHeroPoint && state.heroPoints >= 3) {
    throw new Error("D6E2.Superheroic.SecretIdentityPointMaximum");
  }
  const suspicion = state.suspicion + 1;
  const exposed = roll <= suspicion;
  return Object.freeze({
    exposed,
    roll,
    state: Object.freeze({
      ...state,
      heroPoints: state.heroPoints + (gainHeroPoint ? 1 : 0),
      status: exposed ? "exposed" : "active",
      suspicion,
    }),
  });
}

export function clearSecretIdentityName(
  state: SecretIdentityState,
): SecretIdentityState {
  if (state.status !== "exposed") {
    throw new Error("D6E2.Superheroic.SecretIdentityNotExposed");
  }
  return Object.freeze({ ...state, status: "active", suspicion: 0 });
}

export function makeSecretIdentityPublic(
  state: SecretIdentityState,
): SecretIdentityState {
  if (state.status === "public") return state;
  return Object.freeze({
    ...state,
    heroPoints: 0,
    status: "public",
  });
}
