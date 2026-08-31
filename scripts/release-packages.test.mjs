import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  COLLABORATOR_DISTRIBUTION,
  ECHO_PACKAGE_ID,
  PUBLIC_DISTRIBUTION,
  STAR_WARS_PRIVATE_PACKAGE_ID,
  publicReleasePackages,
  releasePackages,
  releasePackagesFor,
  root,
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

  it("keeps the private Star Wars companion out of every release channel", () => {
    expect(
      releasePackages.some(({ id }) => id === STAR_WARS_PRIVATE_PACKAGE_ID),
    ).toBe(false);
    expect(
      publicReleasePackages.some(
        ({ id }) => id === STAR_WARS_PRIVATE_PACKAGE_ID,
      ),
    ).toBe(false);
  });

  it("ships the OpenD6 designation and complete OGL with the system mark", () => {
    for (const distribution of [
      COLLABORATOR_DISTRIBUTION,
      PUBLIC_DISTRIBUTION,
    ]) {
      const system = releasePackagesFor(distribution).find(
        ({ id }) => id === "d6-system-2e",
      );
      expect(system?.extras).toEqual(
        expect.arrayContaining([
          "LICENSE-NOTICE.md",
          "OPEN-GAME-CONTENT.md",
          "OPEN-GAME-LICENSE.txt",
        ]),
      );
    }
  });

  it("retains the exact OpenD6 OGL notices and narrow content designation", async () => {
    const [license, declaration] = await Promise.all([
      readFile(path.join(root, "OPEN-GAME-LICENSE.txt"), "utf8"),
      readFile(path.join(root, "OPEN-GAME-CONTENT.md"), "utf8"),
    ]);
    expect(license).toContain(
      "Open Game License v 1.0 Copyright 2000, Wizards of the Coast, Inc.",
    );
    expect(license).toContain(
      "D6 Adventure (WEG51011), Copyright 2004, Purgatory Publishing Inc.",
    );
    expect(license).toContain(
      "West End Games, WEG, and D6 System are trademarks and properties of Purgatory Publishing Inc.",
    );
    expect(declaration).toContain("assets/ui/open-d6-profile-mark.svg");
    expect(declaration).toContain(
      "No other repository code, user interface, text, identifier, artwork, asset,",
    );
  });

  it("rejects an unknown distribution instead of falling back", () => {
    expect(() => releasePackagesFor("public-ish")).toThrow(
      "Unknown release distribution",
    );
  });
});
