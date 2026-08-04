import { beforeEach, describe, expect, it } from "vitest";
import {
  contentPackageRegistry,
  resetContentPackageRegistryForTests,
} from "./content-packages";

const CORE = {
  contractVersion: 1,
  family: "core",
  id: "d6-system-2e-core-content",
  label: "D6 System Second Edition — Core Content",
  mechanicIds: ["rules.pips", "core.skills"],
  recommendedPrimaryProfile: "second-edition",
  rulesFamily: "d6-system-second-edition",
  version: "0.1.0-alpha.25",
} as const;

describe("content package registry", () => {
  beforeEach(resetContentPackageRegistryForTests);

  it("supports multiple active official content modules without selecting rules", () => {
    contentPackageRegistry.register(CORE.id, CORE);
    contentPackageRegistry.register("d6-system-2e-fantasy", {
      ...CORE,
      family: "fantasy",
      id: "d6-system-2e-fantasy",
      label: "D6 System Second Edition — Fantasy",
    });
    contentPackageRegistry.register("d6-system-2e-science-fiction", {
      ...CORE,
      family: "science-fiction",
      id: "d6-system-2e-science-fiction",
      label: "D6 System Second Edition — Science Fiction",
      mechanicIds: ["science-fiction-skills"],
    });
    contentPackageRegistry.register("d6-system-2e-superhero", {
      ...CORE,
      family: "superhero",
      id: "d6-system-2e-superhero",
      label: "D6 System Second Edition — Superhero",
      mechanicIds: ["superheroes"],
    });
    expect(
      contentPackageRegistry.current().map(({ family }) => family),
    ).toEqual(["core", "fantasy", "science-fiction", "superhero"]);
  });

  it("requires the Foundry module to own its manifest identity", () => {
    expect(() => contentPackageRegistry.register("other-module", CORE)).toThrow(
      /must match/,
    );
  });

  it("aligns First Edition Core, Adventure, Fantasy, and Space as distinct content families", () => {
    for (const [family, id] of [
      ["first-edition-core", "open-d6-core-content-d6-system-2e"],
      ["first-edition-adventure", "open-d6-adventure-d6-system-2e"],
      ["first-edition-fantasy", "open-d6-fantasy-d6-system-2e"],
      ["first-edition-space", "open-d6-space-d6-system-2e"],
    ] as const) {
      contentPackageRegistry.register(id, {
        contractVersion: 1,
        family,
        id,
        label: id,
        mechanicIds: [],
        recommendedPrimaryProfile: "open-d6",
        rulesFamily: "open-d6-first-edition",
        version: "0.1.0-alpha.31",
      });
    }
    expect(
      contentPackageRegistry.current().map(({ family }) => family),
    ).toEqual([
      "first-edition-adventure",
      "first-edition-core",
      "first-edition-fantasy",
      "first-edition-space",
    ]);
  });

  it("rejects a content family assigned to the wrong edition", () => {
    expect(() =>
      contentPackageRegistry.register("open-d6-space-d6-system-2e", {
        ...CORE,
        family: "first-edition-space",
        id: "open-d6-space-d6-system-2e",
      }),
    ).toThrow(/does not belong/);
  });
});
