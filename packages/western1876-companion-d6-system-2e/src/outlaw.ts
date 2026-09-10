import type { D6SettingProfileV5 } from "@d6-system-2e/core";
import { MODULE_ID } from "./module";
import { create1876SettingProfile } from "./profiles";

export const OUTLAW_SETTING_PROFILE_ID = "western-1876-outlaw";
export const OUTLAW_LOGO_PATH = `modules/${MODULE_ID}/art/branding/1876-outlaw-logo.png`;

/** Appearance-only alternative; the existing gold profile remains unchanged. */
export function create1876OutlawSettingProfile(
  localize: (key: string) => string,
): D6SettingProfileV5 {
  return Object.freeze({
    ...create1876SettingProfile(localize),
    id: OUTLAW_SETTING_PROFILE_ID,
    label: localize("WESTERN1876.OutlawName"),
    description: localize("WESTERN1876.OutlawDescription"),
    logo: OUTLAW_LOGO_PATH,
    palette: Object.freeze({
      background: "#090607",
      text: "#ead9d1",
      accent: "#f08c80",
      accentBright: "#f3b0a3",
      muted: "#baa69e",
    }),
  });
}
