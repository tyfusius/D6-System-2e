import skillCatalogSource from "../../../../content/skills.json" with { type: "json" };
import { currentFirstEditionGenreProfile } from "../settings/first-edition-genre-profile";

export type SkillCatalogProfile = "open-d6" | "second-edition";

export interface SkillCatalogEntry {
  readonly activationModules?: readonly string[];
  readonly attributeId: string;
  readonly key: string;
  readonly module: string;
  readonly name: string;
  readonly profiles: readonly SkillCatalogProfile[];
  readonly sourcePage: number;
  readonly training?: "psionic" | "standard";
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
  const active = SKILL_CATALOG.filter((entry) => {
    if (!entry.profiles.includes(profile)) return false;
    if (profile === "open-d6" || entry.module === "core") return true;
    if (entry.key === "spell-school" && activeModules.has("magic-points")) {
      return false;
    }
    if (
      entry.module === "fantasy" ||
      entry.module === "science-fiction" ||
      entry.module === "superheroic" ||
      entry.module === "psionics" ||
      entry.module === "freeform-magic" ||
      entry.module === "magic-points"
    ) {
      return (entry.activationModules ?? [entry.module]).some((module) =>
        activeModules.has(module),
      );
    }
    return optionalAttributes.has(entry.attributeId);
  });
  const unique = new Map<string, SkillCatalogEntry>();
  for (const entry of active) {
    if (!unique.has(entry.key)) unique.set(entry.key, entry);
  }
  return Object.freeze([...unique.values()]);
}

export function missingSkillSources(
  existingKeys: ReadonlySet<string>,
  profile: SkillCatalogProfile,
  optionalAttributes: ReadonlySet<string> = new Set(),
  activeModules: ReadonlySet<string> = new Set(),
): readonly Record<string, unknown>[] {
  const genreProfile =
    profile === "open-d6" ? currentFirstEditionGenreProfile() : undefined;
  if (genreProfile && genreProfile.skills.length > 0) {
    return Object.freeze(
      genreProfile.skills
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
              book: entry.source.book,
              module: genreProfile.genreId,
              page: entry.source.page,
            },
            training: "standard",
          },
          type: "skill",
        })),
    );
  }
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
          training: entry.training ?? "standard",
        },
        type: "skill",
      })),
  );
}
