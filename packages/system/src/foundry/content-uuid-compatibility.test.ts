import { describe, expect, it } from "vitest";
import { resolveContentPackUuid } from "./content-uuid-compatibility";

describe("extracted content UUID compatibility", () => {
  it("aliases legacy core pack UUIDs while preserving document IDs", () => {
    expect(
      resolveContentPackUuid(
        "Compendium.d6-system-2e.second-edition-skills.Item.0123456789abcdef",
      ),
    ).toBe(
      "Compendium.d6-system-2e-core-content.second-edition-skills.Item.0123456789abcdef",
    );
  });

  it("aliases extracted Fantasy packs to their module owner", () => {
    expect(
      resolveContentPackUuid(
        "Compendium.d6-system-2e.second-edition-fantasy-templates.Item.0123456789abcdef",
      ),
    ).toBe(
      "Compendium.d6-system-2e-fantasy.second-edition-fantasy-templates.Item.0123456789abcdef",
    );
    expect(
      resolveContentPackUuid(
        "Compendium.d6-system-2e.second-edition-fantasy-creatures.Actor.abcdef0123456789",
      ),
    ).toBe(
      "Compendium.d6-system-2e-fantasy.second-edition-fantasy-creatures.Actor.abcdef0123456789",
    );
  });

  it("aliases the extracted First Edition Core Skills pack", () => {
    const uuid = "Compendium.d6-system-2e.open-d6-skills.Item.0123456789abcdef";
    expect(resolveContentPackUuid(uuid)).toBe(
      "Compendium.open-d6-core-content-d6-system-2e.open-d6-skills.Item.0123456789abcdef",
    );
  });

  it("leaves unrelated packs unchanged", () => {
    const uuid =
      "Compendium.d6-system-2e.user-manual.JournalEntry.0123456789abcdef";
    expect(resolveContentPackUuid(uuid)).toBe(uuid);
  });
});
