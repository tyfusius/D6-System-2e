import { describe, expect, it } from "vitest";
import { migrationRunner } from "./index";

const context = Object.freeze({
  foundryVersion: "14.365",
  systemVersion: "0.1.0-alpha.32",
});

describe("modular content upgrade acceptance", () => {
  it("upgrades every extracted legacy compendium namespace from schema 43", async () => {
    const source = {
      _id: "upgrade-fixture",
      flags: {
        example: {
          core: "Compendium.d6-system-2e.second-edition-skills.Item.1111111111111111",
          fantasy:
            "Compendium.d6-system-2e.second-edition-fantasy-templates.Item.2222222222222222",
          firstEdition:
            "Compendium.d6-system-2e.open-d6-skills.Item.3333333333333333",
        },
      },
      system: {
        _migration: {
          foundry: "14.365",
          schema: 43,
          system: "0.1.0-alpha.24",
        },
        references: [
          "Compendium.d6-system-2e.second-edition-equipment.Item.4444444444444444",
          "Compendium.d6-system-2e.second-edition-fantasy-creatures.Actor.5555555555555555",
        ],
      },
      type: "item-group",
    };

    const result = await migrationRunner.migrateItem(source, context);

    expect(result.report).toEqual({
      applied: [44, 45, 46, 47, 48, 49, 50, 51],
      fromVersion: 43,
      toVersion: 51,
    });
    const flags = result.source.flags as {
      example: Record<string, string>;
    };
    expect(flags.example).toEqual({
      core: "Compendium.d6-system-2e-core-content.second-edition-skills.Item.1111111111111111",
      fantasy:
        "Compendium.d6-system-2e-fantasy.second-edition-fantasy-templates.Item.2222222222222222",
      firstEdition:
        "Compendium.open-d6-core-content-d6-system-2e.open-d6-skills.Item.3333333333333333",
    });
    expect(result.source.system.references).toEqual([
      "Compendium.d6-system-2e-core-content.second-edition-equipment.Item.4444444444444444",
      "Compendium.d6-system-2e-fantasy.second-edition-fantasy-creatures.Actor.5555555555555555",
    ]);
    expect(result.source.system._migration).toEqual({
      foundry: "14.365",
      schema: 51,
      system: "0.1.0-alpha.32",
    });
  });
});
