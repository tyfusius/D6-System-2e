import { validateAdvancedSkill } from "@d6-system-2e/core";
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

export function specializationKey(
  parent: FoundryItemDocument,
  name: string,
): string {
  return `specialization-${stringValue(parent.system.key, "skill")}-${
    skillKeySegment(name) || "new"
  }`;
}
