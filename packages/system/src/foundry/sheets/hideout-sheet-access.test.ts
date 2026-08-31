import { describe, expect, it } from "vitest";
import { hideoutSheetAccess } from "./hideout-sheet-access";

describe("Hideout sheet access", () => {
  it("locks every editor when the rules component or its prerequisites are inactive", () => {
    expect(hideoutSheetAccess(false, true, true)).toEqual({
      active: false,
      canEdit: false,
      gm: false,
    });
  });

  it("allows an owner to edit active ordinary fields without GM relocation authority", () => {
    expect(hideoutSheetAccess(true, true, false)).toEqual({
      active: true,
      canEdit: true,
      gm: false,
    });
  });

  it("allows an editable GM to edit active relocation fields", () => {
    expect(hideoutSheetAccess(true, true, true)).toEqual({
      active: true,
      canEdit: true,
      gm: true,
    });
    expect(hideoutSheetAccess(true, false, true).gm).toBe(false);
  });
});
