import type { D6SettingProfileFontDefinitionV1 } from "@d6-system-2e/core";
import { MODULE_ID } from "./module";

export const DISPLAY_FONT_ID = "bleeding-cowboys";
export const DISPLAY_FONT_REF = `module/${MODULE_ID}/${DISPLAY_FONT_ID}`;

/** The website's heading face; ordinary controls and prose keep the body role. */
export const WESTERN1876_DISPLAY_FONT = Object.freeze({
  version: 1,
  id: DISPLAY_FONT_ID,
  label: "Bleeding Cowboys",
  path: `modules/${MODULE_ID}/art/fonts/Bleeding_Cowboys.ttf`,
  roles: Object.freeze(["display"] as const),
}) satisfies D6SettingProfileFontDefinitionV1;
