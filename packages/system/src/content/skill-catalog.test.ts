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
