import type { D6ResolvedFirstEditionGenreProfileV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { registeredFirstEditionGenreProfile } from "../registries/first-edition-genre-profiles";

const FIRST_EDITION_GENRE_PACKAGE_SETTING = "firstEditionGenrePackage";

export const SPACE_COMPATIBLE_FIRST_EDITION_PROFILE: D6ResolvedFirstEditionGenreProfileV1 =
  Object.freeze({
    attributeBudgetScore: 54,
    attributes: Object.freeze([
      { id: "agility", label: "D6E2.Attribute.Agility" },
      { id: "brawn", label: "D6E2.Attribute.Brawn" },
      { id: "mechanical", label: "D6E2.Attribute.Mechanical" },
      { id: "knowledge", label: "D6E2.Attribute.Knowledge" },
      { id: "perception", label: "D6E2.Attribute.Perception" },
      { id: "technical", label: "D6E2.Attribute.Technical" },
    ]),
    genreId: "open-d6-space-d6-system-2e",
    id: "open-d6-space-d6-system-2e",
    label: "Open D6 Space",
    ownerId: "d6-system-2e",
    roles: Object.freeze({
      initiative: "perception",
      knowledge: "knowledge",
      strength: "brawn",
    }),
    skillBudgetScore: 21,
    skills: Object.freeze([]),
    version: 1,
  });

export function currentFirstEditionGenreProfile(): D6ResolvedFirstEditionGenreProfileV1 {
  let selected = "";
  try {
    const value = game.settings.get(
      SYSTEM_ID,
      FIRST_EDITION_GENRE_PACKAGE_SETTING,
    );
    selected = typeof value === "string" ? value : "";
  } catch {
    // Settings are unavailable in isolated domain tests and before Foundry init.
  }
  return (
    registeredFirstEditionGenreProfile(selected) ??
    SPACE_COMPATIBLE_FIRST_EDITION_PROFILE
  );
}

export function firstEditionAttributeRole(
  role: keyof D6ResolvedFirstEditionGenreProfileV1["roles"],
): string {
  return currentFirstEditionGenreProfile().roles[role];
}
