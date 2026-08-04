import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
vi.stubGlobal("game", {
  settings: { get: (_system: string, key: string) => values.get(key) },
});

import { currentRulesSelection } from "./rules-selection";
import { COMPATIBILITY_SETTING_KEYS } from "./rules-compatibility";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "./settings-catalog";

describe("primary rules profile and imported mechanics", () => {
  beforeEach(() => values.clear());

  it("keeps the primary baseline separate from compatible imported mechanics", () => {
    values.set("gameMode", "second-edition");
    values.set("useFirstEditionMovement", true);
    const selection = currentRulesSelection();
    expect(selection.primaryProfileId).toBe("second-edition");
    expect(selection.resolvedProfileId).toBe("custom");
    expect(selection.importedMechanicIds).toContain("movement");
  });

  it("reports an explicitly retained Second Edition extension under an Open D6 primary profile", () => {
    values.set("gameMode", "open-d6");
    for (const key of Object.values(COMPATIBILITY_SETTING_KEYS)) {
      values.set(key, true);
    }
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
