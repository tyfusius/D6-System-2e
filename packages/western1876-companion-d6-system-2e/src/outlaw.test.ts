import { describe, expect, it } from "vitest";
import translations from "../lang/en.json";
import { create1876SettingProfile, create1876Preset } from "./profiles";
import { create1876OutlawSettingProfile, OUTLAW_LOGO_PATH } from "./outlaw";
import { SETTING_PROFILE_ID, RULES_PROFILE_ID } from "./module";

const localize = (key: string) =>
  translations.WESTERN1876[
    key.replace("WESTERN1876.", "") as keyof typeof translations.WESTERN1876
  ];

describe("1876 Outlaw appearance", () => {
  it("changes only identity, description, logo and palette while sharing the complete catalogue", () => {
    const gold = create1876SettingProfile(localize);
    const outlaw = create1876OutlawSettingProfile(localize);
    const appearanceKeys = new Set([
      "id",
      "label",
      "description",
      "logo",
      "palette",
    ]);
    const common = (profile: typeof gold) =>
      Object.fromEntries(
        Object.entries(profile).filter(([key]) => !appearanceKeys.has(key)),
      );
    expect(common(outlaw)).toEqual(common(gold));
    expect(outlaw.skills).toBe(gold.skills);
    expect(outlaw.skills).toHaveLength(44);
    expect(outlaw.attributes).toHaveLength(17);
    expect(outlaw.label).toBe("1876 — Outlaw");
    expect(outlaw.logo).toBe(OUTLAW_LOGO_PATH);
    expect(outlaw.logo).toBe(
      "modules/western1876-companion-d6-system-2e/art/branding/1876-outlaw-logo.png",
    );
    expect(outlaw.id).toBe("western-1876-outlaw");
    expect(outlaw.palette).toEqual({
      background: "#090607",
      text: "#ead9d1",
      accent: "#f08c80",
      accentBright: "#f3b0a3",
      muted: "#baa69e",
    });
  });

  it("keeps the existing campaign preset paired to gold and preserves the gold appearance", () => {
    const gold = create1876SettingProfile(localize);
    expect(gold.id).toBe(SETTING_PROFILE_ID);
    expect(gold.label).toBe("1876");
    expect(gold.logo).toBe(
      "modules/western1876-companion-d6-system-2e/art/branding/1876-logo.png",
    );
    expect(gold.palette).toEqual({
      background: "#0b0b0a",
      text: "#e8dcc6",
      accent: "#c7a264",
      accentBright: "#e8dcc6",
      muted: "#c0aa85",
    });
    expect(create1876Preset(localize).selection).toEqual({
      version: 1,
      rulesProfileId: RULES_PROFILE_ID,
      settingProfileId: SETTING_PROFILE_ID,
    });
  });
});
