export interface CharacterSkillHierarchyMember {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly parentSkillId: string;
  readonly parentSkillKey: string;
  readonly specializations: readonly CharacterSkillHierarchyMember[];
  readonly training: "advanced" | "psionic" | "specialization" | "standard";
}

/** Group linked Specializations immediately beneath their Actor-local Skill. */
export function groupCharacterSkillViews<
  T extends CharacterSkillHierarchyMember,
>(members: readonly T[]): readonly T[] {
  const parents = members.filter(({ training }) => training === "standard");
  const parentFor = (specialization: T): T | undefined => {
    if (specialization.training !== "specialization") return undefined;
    const linkedById = specialization.parentSkillId
      ? parents.find(({ id }) => id === specialization.parentSkillId)
      : undefined;
    if (linkedById) return linkedById;
    return specialization.parentSkillKey
      ? parents.find(({ key }) => key === specialization.parentSkillKey)
      : undefined;
  };

  return Object.freeze(
    members
      .filter(
        (member) =>
          member.training !== "specialization" ||
          parentFor(member) === undefined,
      )
      .map((member) => {
        if (member.training !== "standard") return member;
        const specializations = members
          .filter((candidate) => parentFor(candidate)?.id === member.id)
          .sort((left, right) => left.name.localeCompare(right.name));
        return Object.freeze({
          ...member,
          specializations: Object.freeze(specializations),
        });
      }),
  );
}
