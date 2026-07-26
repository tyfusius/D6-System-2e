export const CHARACTER_SHEET_MODES = ["normal", "advance", "freeedit"] as const;

export type CharacterSheetMode = (typeof CHARACTER_SHEET_MODES)[number];

export function isCharacterSheetMode(
  value: unknown,
): value is CharacterSheetMode {
  return CHARACTER_SHEET_MODES.includes(value as CharacterSheetMode);
}

export function effectiveCharacterSheetMode(
  storedMode: unknown,
  isGM: boolean,
): CharacterSheetMode {
  const mode = isCharacterSheetMode(storedMode) ? storedMode : "normal";
  return mode === "freeedit" && !isGM ? "normal" : mode;
}

export function maySelectCharacterSheetMode(
  mode: unknown,
  isGM: boolean,
): mode is CharacterSheetMode {
  return isCharacterSheetMode(mode) && (mode !== "freeedit" || isGM);
}
