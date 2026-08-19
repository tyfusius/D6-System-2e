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
  if (basis === "strength-damage" && openD6) {
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
