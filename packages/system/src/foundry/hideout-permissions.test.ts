import { describe, expect, it } from "vitest";
import { changesProtectedHideoutState } from "./mechanical-edit-guard";

describe("hideout permissions", () => {
  it("protects GM timing and campaign feature allowance", () => {
    expect(changesProtectedHideoutState({ "system.featureLimit": 6 })).toBe(
      true,
    );
    expect(
      changesProtectedHideoutState({
        system: { relocation: { state: "destroyed" } },
      }),
    ).toBe(true);
  });

  it("allows owner narrative, membership, and feature updates", () => {
    expect(
      changesProtectedHideoutState({ system: { biography: "Updated" } }),
    ).toBe(false);
    expect(changesProtectedHideoutState({ "system.features": [] })).toBe(false);
  });
});
