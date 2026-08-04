import { describe, expect, it } from "vitest";
import { aliasExtractedFirstEditionCoreUuids } from "./046-alias-extracted-first-edition-core-uuids";

describe("schema 46 First Edition Core Content extraction", () => {
  it("rewrites nested legacy UUIDs idempotently", () => {
    const source = {
      flags: {
        example: {
          uuid: "Compendium.d6-system-2e.open-d6-skills.Item.0123456789abcdef",
        },
      },
      system: {
        references: [
          "Compendium.d6-system-2e.open-d6-skills.Item.abcdef0123456789",
        ],
      },
      type: "item-group",
    };
    aliasExtractedFirstEditionCoreUuids(source);
    aliasExtractedFirstEditionCoreUuids(source);
    expect(source.flags.example.uuid).toBe(
      "Compendium.open-d6-core-content-d6-system-2e.open-d6-skills.Item.0123456789abcdef",
    );
    expect(source.system.references[0]).toBe(
      "Compendium.open-d6-core-content-d6-system-2e.open-d6-skills.Item.abcdef0123456789",
    );
  });
});
