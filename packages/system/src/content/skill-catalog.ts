import skillCatalogSource from "../../../../content/skills.json" with { type: "json" };

export type SkillCatalogProfile = "open-d6" | "second-edition";

export interface SkillCatalogEntry {
  readonly attributeId: string;
  readonly key: string;
  readonly module: string;
  readonly name: string;
  readonly profiles: readonly SkillCatalogProfile[];
  readonly sourcePage: number;
}

const SKILL_CATALOG = Object.freeze(
  skillCatalogSource.map((entry) => Object.freeze(entry)),
) as readonly SkillCatalogEntry[];

export function allSkillCatalogEntries(): readonly SkillCatalogEntry[] {
  return SKILL_CATALOG;
}

export function activeSkillCatalog(
  profile: SkillCatalogProfile,
  optionalAttributes: ReadonlySet<string> = new Set(),
  activeModules: ReadonlySet<string> = new Set(),
): readonly SkillCatalogEntry[] {
  return Object.freeze(
    SKILL_CATALOG.filter((entry) => {
      if (!entry.profiles.includes(profile)) return false;
      if (profile === "open-d6" || entry.module === "core") return true;
      if (entry.key === "spell-school" && activeModules.has("magic-points")) {
        return false;
      }
      if (
        entry.module === "fantasy" ||
        entry.module === "freeform-magic" ||
        entry.module === "magic-points"
      ) {
        return activeModules.has(entry.module);
      }
      return optionalAttributes.has(entry.attributeId);
    }),
  );
}

export function missingSkillSources(
  existingKeys: ReadonlySet<string>,
  profile: SkillCatalogProfile,
  optionalAttributes: ReadonlySet<string> = new Set(),
  activeModules: ReadonlySet<string> = new Set(),
): readonly Record<string, unknown>[] {
  return Object.freeze(
    activeSkillCatalog(profile, optionalAttributes, activeModules)
      .filter((entry) => !existingKeys.has(entry.key))
      .map((entry) => ({
        img: "icons/svg/dice-target.svg",
        name: entry.name,
        system: {
          attributeId: entry.attributeId,
          description: "",
          key: entry.key,
          score: 0,
          source: {
            book:
              entry.module === "open-d6-space"
                ? "OpenD6 Space"
                : "D6 System: Second Edition",
            module: entry.module,
            page: entry.sourcePage,
          },
          training: "standard",
        },
        type: "skill",
      })),
  );
}
