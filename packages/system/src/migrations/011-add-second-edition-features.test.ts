import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addSecondEditionFeatureFields } from "./011-add-second-edition-features";

function item(type: string, system: Record<string, unknown>): ItemSource {
  return { system, type };
}

describe("schema 11 Second Edition character features", () => {
  it("adds ranked feature facts and preserves imported data", () => {
    const perk = item("perk", {
      custom: { retained: true },
      rank: 3,
      source: { book: "Campaign source", page: 108 },
    });
    const talent = item("talent", {
      cost: 2,
      repeatable: true,
    });

    addSecondEditionFeatureFields(perk);
    addSecondEditionFeatureFields(talent);

    expect(perk.system).toMatchObject({
      custom: { retained: true },
      focus: "",
      rank: 3,
      source: {
        book: "Campaign source",
        module: "Perks, Flaws & Talents",
        page: 108,
      },
    });
    expect(talent.system).toMatchObject({
      cost: 2,
      focus: "",
      rank: 1,
      repeatable: true,
    });
  });

  it("adds narrative triggers without persistent session counters", () => {
    const trouble = item("trouble", {});
    addSecondEditionFeatureFields(trouble);
    expect(trouble.system).toEqual({
      source: {
        book: "D6 System: Second Edition",
        module: "Troubles and Assets",
        page: 130,
      },
      trigger: "",
    });
    expect(trouble.system).not.toHaveProperty("uses");
  });

  it("is idempotent and leaves unrelated Item families unchanged", () => {
    const asset = item("asset", {
      source: { module: "Custom narrative module" },
      trigger: "Brave and steadfast",
    });
    const advantage = item("advantage", { rank: 2 });
    addSecondEditionFeatureFields(asset);
    addSecondEditionFeatureFields(advantage);
    const snapshot = structuredClone({ advantage, asset });
    addSecondEditionFeatureFields(asset);
    addSecondEditionFeatureFields(advantage);
    expect({ advantage, asset }).toEqual(snapshot);
  });
});
