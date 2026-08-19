import { describe, expect, it } from "vitest";
import {
  groupCharacterSkillViews,
  type CharacterSkillHierarchyMember,
} from "./character-skill-hierarchy";

function member(
  id: string,
  training: CharacterSkillHierarchyMember["training"],
  options: Partial<CharacterSkillHierarchyMember> = {},
): CharacterSkillHierarchyMember {
  return {
    id,
    key: id,
    name: id,
    parentSkillId: "",
    parentSkillKey: "",
    specializations: [],
    training,
    ...options,
  };
}

describe("Character Skill hierarchy", () => {
  it("groups multiple Specializations beneath their actual parent Skill", () => {
    const acrobatics = member("acrobatics-id", "standard", {
      key: "acrobatics",
      name: "Acrobatics",
    });
    const shooting = member("shooting-id", "standard", {
      key: "shooting",
      name: "Shooting",
    });
    const grouped = groupCharacterSkillViews([
      acrobatics,
      member("parkour", "specialization", {
        name: "Parkour",
        parentSkillId: acrobatics.id,
      }),
      shooting,
      member("gymnastics", "specialization", {
        name: "Gymnastics",
        parentSkillKey: acrobatics.key,
      }),
      member("rifles", "specialization", {
        name: "Rifles",
        parentSkillId: shooting.id,
      }),
    ]);

    expect(grouped.map(({ id }) => id)).toEqual([
      "acrobatics-id",
      "shooting-id",
    ]);
    expect(grouped[0]?.specializations.map(({ name }) => name)).toEqual([
      "Gymnastics",
      "Parkour",
    ]);
    expect(grouped[1]?.specializations.map(({ name }) => name)).toEqual([
      "Rifles",
    ]);
  });

  it("keeps an orphaned legacy Specialization visible as a standalone fallback", () => {
    const orphan = member("orphan", "specialization", {
      parentSkillId: "missing",
      parentSkillKey: "also-missing",
    });
    expect(groupCharacterSkillViews([orphan])).toEqual([orphan]);
  });
});
