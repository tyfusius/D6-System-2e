import { firstEditionStrengthDamageScore } from "@d6-system-2e/core";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { integer, record, stringValue } from "../sheets/values";

export type WeaponDamageBaseKind =
  "attribute" | "fixed" | "skill" | "stale-skill-fallback" | "strength-damage";

export interface WeaponDamageBaseResolution {
  readonly attributeId: string;
  readonly baseKind: WeaponDamageBaseKind;
  readonly baseScore: number;
  readonly configuredSkillKey: string;
  readonly listedDamageScore: number;
  readonly score: number;
  readonly skillItemId?: string;
  readonly skillName?: string;
}

interface DamageActorLike {
  readonly items?: {
    readonly contents?: readonly FoundryItemDocument[];
  };
  readonly system?: {
    readonly attributes?: unknown;
  };
}

/**
 * The legacy Star Wars actor writer preserved an OD6S `damage.str` default on
 * some ranged weapons even though the legacy editor only exposed Strength
 * Damage for melee weapons. The system Item sheet records later explicit basis
 * authoring separately; only the untouched import projection is normalized
 * back to fixed Damage.
 */
export function legacyRangedStrengthDamageFalsePositive(
  weapon: object,
): boolean {
  const flags = record((weapon as { readonly flags?: unknown }).flags);
  const systemFlags = record(flags["d6-system-2e"]);
  if (systemFlags.damageBasisAuthored === true) return false;
  const legacyImport = record(systemFlags.legacyImport);
  const preserved = record(legacyImport.preserved);
  const legacySystem = record(preserved.system);
  const legacyDamage = record(legacySystem.damage);
  return (
    stringValue(legacySystem.subtype).trim().toLocaleLowerCase("en") ===
      "ranged" &&
    legacyDamage.str === true &&
    legacyDamage.muscle !== true
  );
}

function attributeScore(actor: DamageActorLike, attributeId: string): number {
  return currentEffectivePipScore(
    integer(record(record(actor.system?.attributes)[attributeId]).score),
  );
}

function configuredDamageAttributeId(
  actor: DamageActorLike,
  weapon: FoundryItemDocument,
  strengthAttributeId: string,
): string {
  const configured = stringValue(weapon.system.damageAttributeId);
  const attributes = record(actor.system?.attributes);
  return configured.length > 0 && configured in attributes
    ? configured
    : strengthAttributeId;
}

export function resolveWeaponDamageBase(
  actor: DamageActorLike,
  weapon: FoundryItemDocument,
  strengthAttributeId: string,
  openD6: boolean,
): WeaponDamageBaseResolution {
  const listedDamageScore = currentEffectivePipScore(
    integer(weapon.system.damage),
  );
  const basis = stringValue(weapon.system.damageBasis, "fixed");
  if (
    basis === "strength-damage" &&
    openD6 &&
    !legacyRangedStrengthDamageFalsePositive(weapon)
  ) {
    const baseScore = firstEditionStrengthDamageScore(
      attributeScore(actor, strengthAttributeId),
    );
    return Object.freeze({
      attributeId: strengthAttributeId,
      baseKind: "strength-damage",
      baseScore,
      configuredSkillKey: "",
      listedDamageScore,
      score: baseScore + listedDamageScore,
    });
  }
  if (basis !== "attribute-skill" || weapon.type !== "weapon") {
    return Object.freeze({
      attributeId: "",
      baseKind: "fixed",
      baseScore: 0,
      configuredSkillKey: "",
      listedDamageScore,
      score: listedDamageScore,
    });
  }

  const fallbackAttributeId = configuredDamageAttributeId(
    actor,
    weapon,
    strengthAttributeId,
  );
  const configuredSkillKey = stringValue(weapon.system.damageSkillKey);
  const linkedSkill = actor.items?.contents?.find(
    (candidate) =>
      candidate.type === "skill" &&
      stringValue(candidate.system.key) === configuredSkillKey,
  );
  if (!linkedSkill) {
    const baseScore = attributeScore(actor, fallbackAttributeId);
    return Object.freeze({
      attributeId: fallbackAttributeId,
      baseKind:
        configuredSkillKey.length > 0 ? "stale-skill-fallback" : "attribute",
      baseScore,
      configuredSkillKey,
      listedDamageScore,
      score: baseScore + listedDamageScore,
    });
  }

  const skillAttributeId =
    stringValue(linkedSkill.system.attributeId) || fallbackAttributeId;
  const baseScore =
    linkedSkill.system.training === "advanced"
      ? currentEffectivePipScore(integer(linkedSkill.system.score))
      : currentCombinedPipScore(
          attributeScore(actor, skillAttributeId),
          integer(linkedSkill.system.score),
        );
  return Object.freeze({
    attributeId: skillAttributeId,
    baseKind: "skill",
    baseScore,
    configuredSkillKey,
    listedDamageScore,
    score: baseScore + listedDamageScore,
    skillItemId: linkedSkill.id,
    skillName: linkedSkill.name,
  });
}
