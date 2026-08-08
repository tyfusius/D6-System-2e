import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
vi.stubGlobal("game", {
  settings: { get: (_system: string, key: string) => values.get(key) },
});

import { currentRulesSelection } from "./rules-selection";
import { normalizeRulesProfile } from "./rules-profile-library";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "./settings-catalog";

describe("primary rules profile and imported mechanics", () => {
  beforeEach(() => values.clear());

  it("keeps the primary baseline separate from compatible imported mechanics", () => {
    const profile = normalizeRulesProfile({
      id: "table-rules",
      strategies: { movement: "open-d6.movement.relative" },
    });
    values.set("worldRulesProfiles", {
      activeProfileId: profile.id,
      profiles: { [profile.id]: profile },
      version: 1,
    });
    const selection = currentRulesSelection();
    expect(selection.primaryProfileId).toBe("table-rules");
    expect(selection.resolvedProfileId).toBe("table-rules");
    expect(selection.importedMechanicIds).toContain("movement");
  });

  it("reports an explicitly retained Second Edition extension under an Open D6 primary profile", () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "open-d6",
      profiles: {},
      version: 1,
    });
    values.set(
      FIRST_EDITION_OPTION_KEYS.allowSecondEditionAdvancedSkills,
      true,
    );
    values.set(SECOND_EDITION_OPTION_KEYS.skillSpecializationModule, true);

    const selection = currentRulesSelection();

    expect(selection.primaryProfileId).toBe("open-d6");
    expect(selection.resolvedProfileId).toBe("open-d6");
    expect(selection.importedMechanicIds).toEqual(["advanced-skills"]);
  });
});
