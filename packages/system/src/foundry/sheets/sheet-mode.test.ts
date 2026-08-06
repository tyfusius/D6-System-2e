import { describe, expect, it } from "vitest";
import {
  effectiveCharacterSheetMode,
  maySelectCharacterSheetMode,
} from "./sheet-mode";

describe("character sheet modes", () => {
  it("keeps normal and advance available to players", () => {
    expect(effectiveCharacterSheetMode("normal", false)).toBe("normal");
    expect(effectiveCharacterSheetMode("advance", false)).toBe("advance");
  });

  it("forces a stored Free Edit mode to Normal for non-GMs", () => {
    expect(effectiveCharacterSheetMode("freeedit", false)).toBe("normal");
  });

  it("allows Free Edit only for GMs", () => {
    expect(maySelectCharacterSheetMode("freeedit", true)).toBe(true);
    expect(maySelectCharacterSheetMode("freeedit", false)).toBe(false);
  });

  it("falls back safely for an unknown stored mode", () => {
    expect(effectiveCharacterSheetMode("legacy-mode", true)).toBe("normal");
    expect(maySelectCharacterSheetMode("legacy-mode", true)).toBe(false);
  });
});
