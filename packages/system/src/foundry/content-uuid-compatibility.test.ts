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

  it("leaves packs scheduled for later phases unchanged", () => {
    const uuid =
      "Compendium.d6-system-2e.second-edition-fantasy-templates.Item.0123456789abcdef";
    expect(resolveContentPackUuid(uuid)).toBe(uuid);
  });
});
