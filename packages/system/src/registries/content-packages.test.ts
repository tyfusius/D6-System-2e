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
    expect(
      contentPackageRegistry.current().map(({ family }) => family),
    ).toEqual(["core", "fantasy", "science-fiction"]);
  });

  it("requires the Foundry module to own its manifest identity", () => {
    expect(() => contentPackageRegistry.register("other-module", CORE)).toThrow(
      /must match/,
    );
  });
});
