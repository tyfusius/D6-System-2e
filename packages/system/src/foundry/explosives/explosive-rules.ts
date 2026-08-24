import {
  firstEditionExplosiveRangeForDistance,
  firstEditionGrenadeTargetingDifficulty,
  firstEditionStrengthAdjustedThrowRanges,
  secondEditionBrawnAdjustedThrowRanges,
  secondEditionExplosiveRangeForDistance,
  secondEditionNoDodgeDefensePlan,
  type D6ExplosiveRangeResolution,
  type D6ExplosiveThrowRanges,
} from "@d6-system-2e/core";
import { currentAttributeRole } from "../../settings/attributes";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";
import { currentEffectivePipScore } from "../../settings/pip-rules";
import { booleanSetting } from "../../settings/setting-values";
import { TYFUSIUS_HOMEBREW_SETTING_KEYS } from "../../settings/settings-catalog";
import { record } from "../sheets/values";

export function currentD6ExplosiveThrowRanges(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): D6ExplosiveThrowRanges {
  const range = record(item.system.range);
  const printed = {
    long: Number(range.long) || 0,
    medium: Number(range.medium) || 0,
    short: Number(range.short) || 0,
    shortMinimum: Number(range.shortMinimum) || 0,
  };
  const strength = record(
    record(actor.system.attributes)[currentAttributeRole("strength")],
  );
  const score = currentEffectivePipScore(Number(strength.score) || 0);
  const active = currentDefenseRuntimeStrategy().family === "active";
  if (
    active &&
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionStrengthGrenadeRanges,
      false,
    )
  )
    return firstEditionStrengthAdjustedThrowRanges(printed, score);
  if (
    !active &&
    booleanSetting(
      TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges,
      false,
    )
  )
    return secondEditionBrawnAdjustedThrowRanges(printed, score);
  return printed;
}

export function resolveD6ExplosivePlacement(
  distance: number,
  ranges: D6ExplosiveThrowRanges,
): { readonly difficulty: number; readonly range: D6ExplosiveRangeResolution } {
  const active = currentDefenseRuntimeStrategy().family === "active";
  const range = active
    ? firstEditionExplosiveRangeForDistance(distance, ranges)
    : secondEditionExplosiveRangeForDistance(distance, ranges);
  return Object.freeze({
    difficulty:
      range.band === null
        ? 0
        : active
          ? firstEditionGrenadeTargetingDifficulty(range.band)
          : secondEditionNoDodgeDefensePlan(range.band).defense,
    range,
  });
}
