import {
  validateAdvancedSkill,
  type D6SettingSkillV1,
} from "@d6-system-2e/core";
import { currentEffectivePipScore } from "../settings/pip-rules";
import { integer, stringValue } from "./sheets/values";

function uniquePrerequisiteKeys(item: FoundryItemDocument): readonly string[] {
  const keys = Array.isArray(item.system.prerequisiteSkillKeys)
    ? item.system.prerequisiteSkillKeys.filter(
        (key): key is string => typeof key === "string" && key.length > 0,
      )
    : [];
  return Object.freeze([...new Set(keys)]);
}

/**
 * Resolves Advanced Skill prerequisites using only each standard Skill's own
 * rating. The governing Attribute is deliberately excluded (D62e pp. 96-97).
 */
export function advancedSkillPrerequisiteScores(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): readonly number[] {
  const standardSkillByKey = new Map(
    actor.items.contents
      .filter(
        (candidate) =>
          candidate.type === "skill" &&
          candidate.system.training !== "advanced",
      )
      .map((candidate) => [stringValue(candidate.system.key), candidate]),
  );
  return Object.freeze(
    uniquePrerequisiteKeys(item).map((key) => {
      const prerequisite = standardSkillByKey.get(key);
      return prerequisite
        ? currentEffectivePipScore(integer(prerequisite.system.score))
        : 0;
    }),
  );
}

export function advancedSkillIssues(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  score = currentEffectivePipScore(integer(item.system.score)),
): readonly string[] {
  return validateAdvancedSkill({
    prerequisiteScores: advancedSkillPrerequisiteScores(actor, item),
    score,
  });
}

export function normalizedSkillName(value: string): string {
  return value.trim();
}

export function skillKeySegment(value: string): string {
  return normalizedSkillName(value)
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function advancedSkillKey(name: string): string {
  return `advanced-${skillKeySegment(name) || "new-skill"}`;
}

export interface SpecializationParentSkillChoice {
  readonly attributeId: string;
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/**
 * Embedded Specializations link to an Actor-local Skill id. Reusable world or
 * compendium Specializations instead link to a stable Setting Profile Skill
 * key so the drop workflow can resolve the receiving Actor's local document.
 */
export function specializationParentSkillChoices(
  ownedItems: readonly FoundryItemDocument[] | null,
  settingSkills: readonly D6SettingSkillV1[],
  storedParentKey = "",
): readonly SpecializationParentSkillChoice[] {
  const choices =
    ownedItems === null
      ? settingSkills
          .filter(({ training }) => training !== "advanced")
          .map(({ attributeId, key, name }) => ({
            attributeId,
            key,
            label: name,
            value: key,
          }))
      : ownedItems
          .filter(
            (item) =>
              item.type === "skill" && item.system.training !== "advanced",
          )
          .map((item) => ({
            attributeId: stringValue(item.system.attributeId, "agility"),
            key: stringValue(item.system.key),
            label: item.name,
            value: item.id,
          }));
  if (
    ownedItems === null &&
    storedParentKey &&
    !choices.some(({ key }) => key === storedParentKey)
  ) {
    choices.push({
      attributeId: "",
      key: storedParentKey,
      label: storedParentKey,
      value: storedParentKey,
    });
  }
  return Object.freeze(
    choices.sort((left, right) => left.label.localeCompare(right.label)),
  );
}

export function specializationKeyForParent(
  parentSkillKey: string,
  name: string,
): string {
  return `specialization-${parentSkillKey || "skill"}-${
    skillKeySegment(name) || "new"
  }`;
}

export function specializationKey(
  parent: FoundryItemDocument,
  name: string,
): string {
  return specializationKeyForParent(
    stringValue(parent.system.key, "skill"),
    name,
  );
}
