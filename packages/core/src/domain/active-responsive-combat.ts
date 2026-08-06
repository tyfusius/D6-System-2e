export const D6_ACTIVE_RESPONSIVE_COMBAT_CONTRACT_VERSION = 1 as const;

function wholeDice(score: number): number {
  return Number.isFinite(score) ? Math.max(0, Math.floor(score / 3)) : 0;
}

export interface SecondEditionFullDefensePlan {
  readonly acrobaticsBonus: number;
  readonly contractVersion: typeof D6_ACTIVE_RESPONSIVE_COMBAT_CONTRACT_VERSION;
  readonly dodge: number;
  readonly meleeBonus: number;
  readonly parry: number;
  readonly sourcePage: 163;
}

export function secondEditionFullDefensePlan(
  dodge: number,
  parry: number,
  acrobaticsScore: number,
  meleeScore: number,
): SecondEditionFullDefensePlan {
  const acrobaticsBonus = wholeDice(acrobaticsScore);
  const meleeBonus = wholeDice(meleeScore);
  return Object.freeze({
    acrobaticsBonus,
    contractVersion: D6_ACTIVE_RESPONSIVE_COMBAT_CONTRACT_VERSION,
    dodge: Math.max(0, Math.trunc(dodge)) + acrobaticsBonus,
    meleeBonus,
    parry: Math.max(0, Math.trunc(parry)) + meleeBonus,
    sourcePage: 163,
  });
}

export interface SecondEditionAutofirePlan {
  readonly attackModifier: number;
  readonly damageModifier: number;
  readonly maximum: number;
  readonly sourcePage: 163;
  readonly spend: number;
}

export function secondEditionAutofirePlan(
  rating: number,
  shootingScore: number,
  spend: number,
): SecondEditionAutofirePlan {
  const maximum = Math.max(
    Number.isFinite(rating) ? Math.max(0, Math.trunc(rating)) : 0,
    wholeDice(shootingScore),
  );
  if (!Number.isSafeInteger(spend) || spend < 0 || spend > maximum) {
    throw new RangeError("Autofire spend exceeds the weapon/Skill limit.");
  }
  return Object.freeze({
    attackModifier: -spend,
    damageModifier: spend * 2,
    maximum,
    sourcePage: 163,
    spend,
  });
}

export function secondEditionFeintDefensePenalty(meleeScore: number): number {
  return wholeDice(meleeScore);
}

export function canSecondEditionActionRiposte(meleeScore: number): boolean {
  return wholeDice(meleeScore) >= 4;
}

export function canSecondEditionActionFeint(meleeScore: number): boolean {
  return wholeDice(meleeScore) >= 4;
}
