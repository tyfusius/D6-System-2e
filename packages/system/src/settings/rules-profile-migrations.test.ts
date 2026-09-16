import { describe, expect, it } from "vitest";

import { migrateRulesProfileSettings } from "./rules-profile-migrations.js";

describe("Rules Profile migration 7", () => {
  it("adds disabled encumbrance without changing existing strategies", () => {
    const migrated = migrateRulesProfileSettings(
      {
        activeProfileId: "world-a",
        profiles: {
          "world-a": {
            id: "world-a",
            strategies: { health: "custom.health" },
            version: 6,
          },
        },
        version: 6,
      },
      [],
    );

    expect(migrated).toMatchObject({
      activeProfileId: "world-a",
      version: 7,
      profiles: {
        "world-a": {
          version: 7,
          strategies: {
            health: "custom.health",
            encumbrance: "disabled",
          },
        },
      },
    });
  });

  it("rejects a future profile setting version", () => {
    expect(() => migrateRulesProfileSettings({ version: 8 }, [])).toThrow(
      /future Rules Profile/,
    );
  });
});
