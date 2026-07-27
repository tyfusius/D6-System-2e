import {
  addEffectivePipScores,
  effectivePipScore,
  usesPips,
} from "@d6-system-2e/core";
import { currentEditionCapabilityProfile } from "./edition-capabilities";

export function currentPipsEnabled(): boolean {
  return usesPips(currentEditionCapabilityProfile().pips);
}

export function currentEffectivePipScore(storedScore: number): number {
  return effectivePipScore(storedScore, currentEditionCapabilityProfile().pips);
}

export function currentCombinedPipScore(
  ...storedScores: readonly number[]
): number {
  return addEffectivePipScores(
    currentEditionCapabilityProfile().pips,
    ...storedScores,
  );
}
