import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
vi.stubGlobal("game", {
  settings: { get: (_system: string, key: string) => values.get(key) },
});

import { currentRulesSelection } from "./rules-selection";

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
});
