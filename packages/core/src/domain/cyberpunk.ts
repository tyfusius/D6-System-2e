import { PIPS_PER_DIE } from "./die-code";

export const D6_CYBERPUNK_SOURCE_PAGES = Object.freeze([191, 195] as const);

export type D6AugmentationKind = "bioware" | "cyberware";
export type D6HackConsequence = "identity-exposed" | "noticed" | "none";

function wholeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function personalFirewall(attributeScore: number): number {
  return Math.trunc(wholeNonNegative(attributeScore) / PIPS_PER_DIE) * 5;
}

export function augmentationFirewall(rank: number): number {
  return Math.max(1, wholeNonNegative(rank)) * 5;
}

export function augmentationCapacity(attributeScore: number): number {
  return Math.trunc(wholeNonNegative(attributeScore) / PIPS_PER_DIE);
}

export function augmentationInstallDifficulty(previousCount: number): number {
  return 10 + wholeNonNegative(previousCount) * 5;
}

export function augmentationInstallMinutes(previousCount: number): number {
  return 60 + wholeNonNegative(previousCount) * 30;
}

export function augmentationAcquisitionDifficulty(rank: number): number {
  return Math.max(1, wholeNonNegative(rank)) * 5 + 5;
}

export function cyberwareDisableTurns(computersScore: number): number {
  return Math.trunc(wholeNonNegative(computersScore) / PIPS_PER_DIE);
}

export function hackingConsequence(
  failureMargin: number,
  consequenceDie: number,
): D6HackConsequence {
  const margin = wholeNonNegative(failureMargin);
  if (margin < 5) return "none";
  const total =
    margin + Math.min(6, Math.max(1, wholeNonNegative(consequenceDie)));
  return total >= 20 ? "identity-exposed" : total >= 10 ? "noticed" : "none";
}
