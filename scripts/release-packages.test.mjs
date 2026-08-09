import { describe, expect, it } from "vitest";
import {
  COLLABORATOR_DISTRIBUTION,
  ECHO_PACKAGE_ID,
  PUBLIC_DISTRIBUTION,
  publicReleasePackages,
  releasePackages,
  releasePackagesFor,
} from "./release-packages.mjs";

describe("release distribution package sets", () => {
  it("keeps Echo in the explicit private collaborator distribution", () => {
    expect(releasePackagesFor(COLLABORATOR_DISTRIBUTION)).toBe(releasePackages);
    expect(releasePackages.some(({ id }) => id === ECHO_PACKAGE_ID)).toBe(true);
  });

  it("uses an explicit Echo-free general-public allowlist", () => {
    expect(releasePackagesFor(PUBLIC_DISTRIBUTION)).toBe(publicReleasePackages);
    expect(publicReleasePackages).toHaveLength(releasePackages.length - 1);
    expect(publicReleasePackages.some(({ id }) => id === ECHO_PACKAGE_ID)).toBe(
      false,
    );
    expect(
      publicReleasePackages.find(({ kind }) => kind === "system")?.extras,
    ).not.toContain("CHANGELOG.md");
  });

  it("rejects an unknown distribution instead of falling back", () => {
    expect(() => releasePackagesFor("public-ish")).toThrow(
      "Unknown release distribution",
    );
  });
});
