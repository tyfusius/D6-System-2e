import { describe, expect, it, vi } from "vitest";
import { openActorSheet } from "./actor-sheet-service";

describe("public Actor sheet UI bridge", () => {
  it("opens the requested Character sheet tab", () => {
    const render = vi.fn();
    const actor = {
      sheet: {
        render,
        tabGroups: { primary: "attributes" },
      },
    };

    openActorSheet(actor, { tab: "combat" });

    expect(actor.sheet.tabGroups.primary).toBe("combat");
    expect(render).toHaveBeenCalledWith(true);
  });

  it("rejects a document without an ApplicationV2 Actor sheet", () => {
    expect(() => openActorSheet({})).toThrow("D6E2.Sheet.Error.Unavailable");
  });
});
