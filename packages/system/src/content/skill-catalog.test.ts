import { describe, expect, it } from "vitest";
import {
  activeSkillCatalog,
  allSkillCatalogEntries,
  missingSkillSources,
} from "./skill-catalog";

describe("skill catalog", () => {
  it("contains the sixteen verified core Second Edition skills", () => {
    expect(activeSkillCatalog("second-edition")).toHaveLength(16);
  });

  it("adds only skills belonging to enabled optional attributes", () => {
    const entries = activeSkillCatalog(
      "second-edition",
      new Set(["charm", "mysticism"]),
    );
    expect(entries.map((entry) => entry.key)).toContain("command");
    expect(entries.map((entry) => entry.key)).toContain("prayer");
    expect(entries.map((entry) => entry.key)).not.toContain("piloting");
  });

  it("has stable profile-and-key identities without duplicates", () => {
    const identities = allSkillCatalogEntries().flatMap((entry) =>
      entry.profiles.map((profile) => `${profile}:${entry.key}`),
    );
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("activates the bounded science-fiction package without fantasy-only skills", () => {
    const keys = activeSkillCatalog(
      "second-edition",
      new Set(),
      new Set(["science-fiction"]),
    ).map((entry) => entry.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "languages",
        "flying-zero-g",
        "barter",
        "gambling",
        "gunnery",
        "streetwise",
      ]),
    );
    expect(keys).not.toContain("fantasy-navigation");
    expect(keys).not.toContain("traps");
  });

  it("reuses the three printed superheroic Skills without duplicates", () => {
    const keys = activeSkillCatalog(
      "second-edition",
      new Set(),
      new Set(["superheroic"]),
    ).map((entry) => entry.key);
    expect(keys).toEqual(
      expect.arrayContaining(["flying-zero-g", "gambling", "streetwise"]),
    );
    expect(keys).not.toContain("gunnery");
  });

  it("creates only missing embedded Skill sources", () => {
    const sources = missingSkillSources(
      new Set(["acrobatics", "melee"]),
      "second-edition",
    );
    expect(sources).toHaveLength(14);
    expect(sources[0]).toMatchObject({
      system: { score: 0, training: "standard" },
      type: "skill",
    });
  });
});
