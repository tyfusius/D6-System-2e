import type { ActorSource } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { addCharacterSheetModeMigration } from "./002-add-character-sheet-mode";

function character(system: ActorSource["system"]): ActorSource {
  return { items: [], system, type: "character" };
}

describe("schema 2 character sheet mode migration", () => {
  it("adds Normal mode while preserving unknown data", async () => {
    const source = character({ campaignField: { retained: true } });
    await addCharacterSheetModeMigration.updateActor?.(source);
    expect(source.system).toEqual({
      campaignField: { retained: true },
      sheetMode: { value: "normal" },
    });
  });

  it("is idempotent and preserves an existing selection", async () => {
    const source = character({ sheetMode: { value: "advance" } });
    await addCharacterSheetModeMigration.updateActor?.(source);
    await addCharacterSheetModeMigration.updateActor?.(source);
    expect(source.system.sheetMode).toEqual({ value: "advance" });
  });

  it("does not add character presentation state to other actor types", async () => {
    const source: ActorSource = { items: [], system: {}, type: "npc" };
    await addCharacterSheetModeMigration.updateActor?.(source);
    expect(source.system.sheetMode).toBeUndefined();
  });
});
