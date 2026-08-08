import { beforeEach, describe, expect, it } from "vitest";
import {
  campaignPackageRegistry,
  resetCampaignPackageRegistryForTests,
} from "./campaign-packages";

const SPACE = {
  apiCompatibility: { maximum: 2, minimum: 2 },
  contractVersion: 1,
  genreId: "space",
  id: "open-d6-space-d6-system-2e",
  kind: "genre",
  label: "Open D6 Space",
  rulesFamily: "open-d6-first-edition",
  version: "0.1.0-alpha.1",
} as const;

describe("campaign package registry", () => {
  beforeEach(resetCampaignPackageRegistryForTests);

  it("requires package identity to match the registering module", () => {
    expect(() =>
      campaignPackageRegistry.register("different-module", SPACE),
    ).toThrow(/must match/);
  });

  it("rejects an unsupported runtime contract version", () => {
    expect(() =>
      campaignPackageRegistry.register(SPACE.id, {
        ...SPACE,
        contractVersion: 2,
      } as unknown as typeof SPACE),
    ).toThrow(/contract version must be 1/);
  });

  it("keeps an unavailable world selection visible in diagnostics", () => {
    const result = campaignPackageRegistry.resolve({ genreId: SPACE.id });
    expect(result.requestedGenreId).toBe(SPACE.id);
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("unavailable");
  });

  it("resolves an installed genre and compatible companion deterministically", () => {
    campaignPackageRegistry.register(SPACE.id, SPACE);
    campaignPackageRegistry.register("example-space-companion", {
      apiCompatibility: { maximum: 2, minimum: 2 },
      compatibleGenreIds: ["space"],
      contractVersion: 1,
      id: "example-space-companion",
      kind: "companion",
      label: "Example Space Companion",
      rulesFamily: "open-d6-first-edition",
      version: "1.0.0",
    });
    const result = campaignPackageRegistry.resolve({
      companionId: "example-space-companion",
      genreId: SPACE.id,
    });
    expect(result.valid).toBe(true);
    expect(result.genre?.genreId).toBe("space");
    expect(result.companion?.id).toBe("example-space-companion");
  });

  it("rejects an incompatible companion without changing the selected genre", () => {
    campaignPackageRegistry.register(SPACE.id, SPACE);
    campaignPackageRegistry.register("fantasy-companion", {
      apiCompatibility: { maximum: 2, minimum: 2 },
      compatibleGenreIds: ["fantasy"],
      contractVersion: 1,
      id: "fantasy-companion",
      kind: "companion",
      label: "Fantasy Companion",
      rulesFamily: "open-d6-first-edition",
      version: "1.0.0",
    });
    const result = campaignPackageRegistry.resolve({
      companionId: "fantasy-companion",
      genreId: SPACE.id,
    });
    expect(result.valid).toBe(false);
    expect(result.genre?.id).toBe(SPACE.id);
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "incompatible-companion",
    );
  });
});
