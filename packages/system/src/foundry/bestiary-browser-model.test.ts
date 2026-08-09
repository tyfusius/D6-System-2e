import type { D6BestiaryPreviewV1 } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { bestiaryProfileFacets } from "./bestiary-browser-model";

function preview(
  active: { readonly id: string; readonly label: string },
  options: readonly { readonly id: string; readonly label: string }[],
): D6BestiaryPreviewV1 {
  return {
    attributeScores: [],
    canCreate: true,
    catalogId: "catalog",
    catalogLabel: "Catalog",
    defenseOverrides: { dodge: 0, parry: 0 },
    entryId: "entry",
    entryLabel: "Entry",
    itemAdditions: [],
    issues: [],
    magicPoints: 0,
    ownerId: "owner",
    rulesFamily: "d6-system-second-edition",
    rulesProfile: { active, compatible: true, options },
    scale: 0,
    settingProfile: {
      active: { id: "setting", label: "Setting" },
      compatible: true,
    },
    source: { book: "Book", page: 1 },
    version: 1,
  };
}

describe("Creature Catalog profile facets", () => {
  it("discovers dynamic profiles and counts compatible entries", () => {
    const active = { id: "second-edition", label: "Second Edition" };
    const facets = bestiaryProfileFacets([
      preview(active, [active, { id: "custom", label: "Custom Rules" }]),
      preview(active, [active]),
    ]);

    expect(facets).toEqual([
      { ...active, count: 2, isActive: true },
      { id: "custom", label: "Custom Rules", count: 1, isActive: false },
    ]);
  });

  it("keeps the active profile visible when no creature supports it", () => {
    const active = { id: "active", label: "Active Rules" };
    expect(
      bestiaryProfileFacets([
        preview(active, [{ id: "other", label: "Other Rules" }]),
      ]),
    ).toEqual([
      { ...active, count: 0, isActive: true },
      { id: "other", label: "Other Rules", count: 1, isActive: false },
    ]);
  });

  it("does not double-count duplicate options on one entry", () => {
    const active = { id: "active", label: "Active Rules" };
    expect(
      bestiaryProfileFacets([preview(active, [active, active])])[0]?.count,
    ).toBe(1);
  });
});
