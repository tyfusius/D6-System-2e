import { describe, expect, it } from "vitest";
import { aliasExtractedCoreContentUuids } from "./044-alias-extracted-core-content-uuids";

describe("schema 44 extracted content UUID aliases", () => {
  it("rewrites nested stable references idempotently", () => {
    const source = {
      flags: {},
      system: {
        members: [
          {
            uuid: "Compendium.d6-system-2e.second-edition-equipment.Item.abcdef0123456789",
          },
        ],
      },
      type: "item-group",
    };
    aliasExtractedCoreContentUuids(source);
    aliasExtractedCoreContentUuids(source);
    expect(source.system.members[0]?.uuid).toBe(
      "Compendium.d6-system-2e-core-content.second-edition-equipment.Item.abcdef0123456789",
    );
  });
});
