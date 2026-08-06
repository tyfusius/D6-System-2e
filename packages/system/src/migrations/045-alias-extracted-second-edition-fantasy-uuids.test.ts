import { describe, expect, it } from "vitest";
import { aliasExtractedSecondEditionFantasyUuids } from "./045-alias-extracted-second-edition-fantasy-uuids";

describe("schema 45 extracted Second Edition Fantasy UUID aliases", () => {
  it("rewrites nested Actor and template references idempotently", () => {
    const source = {
      flags: {
        sourceUuid:
          "Compendium.d6-system-2e.second-edition-fantasy-creatures.Actor.abcdef0123456789",
      },
      system: {
        members: [
          {
            uuid: "Compendium.d6-system-2e.second-edition-fantasy-templates.Item.0123456789abcdef",
          },
        ],
      },
      type: "item-group",
    };
    aliasExtractedSecondEditionFantasyUuids(source);
    aliasExtractedSecondEditionFantasyUuids(source);
    expect(source.flags.sourceUuid).toBe(
      "Compendium.d6-system-2e-fantasy.second-edition-fantasy-creatures.Actor.abcdef0123456789",
    );
    expect(source.system.members[0]?.uuid).toBe(
      "Compendium.d6-system-2e-fantasy.second-edition-fantasy-templates.Item.0123456789abcdef",
    );
  });
});
