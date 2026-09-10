import { describe, expect, it } from "vitest";
import {
  create1876Preset,
  create1876RulesProfile,
  create1876SettingProfile,
} from "./profiles";
import { LOGO_PATH, MODULE_ID } from "./module";
import { DISPLAY_FONT_REF, WESTERN1876_DISPLAY_FONT } from "./font";
import translations from "../lang/en.json";

const localize = (key: string) =>
  translations.WESTERN1876[
    key.replace("WESTERN1876.", "") as keyof typeof translations.WESTERN1876
  ];

describe("1876 initial profiles", () => {
  it("selects the local website heading face only for display typography", () => {
    expect(WESTERN1876_DISPLAY_FONT).toMatchObject({
      version: 1,
      label: "Bleeding Cowboys",
      roles: ["display"],
      path: `modules/${MODULE_ID}/art/fonts/Bleeding_Cowboys.ttf`,
    });
    expect(create1876SettingProfile(localize).typography).toEqual({
      display: DISPLAY_FONT_REF,
      body: "system/d6-interface",
    });
    expect(DISPLAY_FONT_REF).toBe(`module/${MODULE_ID}/bleeding-cowboys`);
    expect(create1876SettingProfile(localize).palette).toEqual({
      background: "#0b0b0a",
      text: "#e8dcc6",
      accent: "#c7a264",
      accentBright: "#e8dcc6",
      muted: "#c0aa85",
    });
  });
  it("offers an explicit paired selection with only the approved working-draft scope", () => {
    const rules = create1876RulesProfile(localize);
    const setting = create1876SettingProfile(localize);
    expect(create1876Preset(localize).selection).toEqual({
      version: 1,
      rulesProfileId: rules.id,
      settingProfileId: setting.id,
    });
    expect(rules).toMatchObject({
      version: 5,
      source: { kind: "module", ownerId: MODULE_ID },
      healthModels: [],
      matchingEvaluators: [],
      terminology: {},
    });
    expect(rules.strategies).toMatchObject({
      actionEconomy: "open-d6.action-economy.segmented",
      initiative: "open-d6.initiative.perception-reflexes",
      attributes: "open-d6.attributes.six-attribute",
      health: "open-d6.health.wounds-or-body-points",
      movement: "open-d6.movement.relative",
      creation: "open-d6.creation.attribute-skill-dice",
      featureEconomy: "open-d6.features.none",
    });
    expect(rules.homebrew).toEqual({ tyfusiusD8ExplosiveDeviation: false });
    expect(rules.difficultyLadder.map(({ value }) => value)).toEqual([
      5, 10, 15, 20, 25, 30,
    ]);
    expect(rules.description).toContain(
      "base Reflexes only if Perception also ties",
    );
    expect(rules.description).toContain(
      "If an attribute needed at that step is unavailable",
    );
    expect(create1876Preset(localize).description).toContain(
      "base Reflexes only if Perception also ties",
    );
    expect(rules.description).not.toContain("both attributes");
    expect(rules.description).toContain("hit locations");
    expect(rules.description).toContain("not automated");
  });

  it("keeps full Setting vocabulary while Rules genre binding owns activation", () => {
    const setting = create1876SettingProfile(localize);
    expect(setting.attributes).toHaveLength(17);
    expect(setting.attributes).toContainEqual({
      id: "perception",
      label: "Perception",
    });
    expect(setting.attributes).toContainEqual({
      id: "reflexes",
      label: "Reflexes",
    });
    expect(setting.attributes).toContainEqual({
      id: "agility",
      label: "Agility",
    });
    expect(
      setting.attributes.every((attribute) => !("active" in attribute)),
    ).toBe(true);
    expect(setting).toMatchObject({
      healthLabels: {},
      terminology: {},
      logo: LOGO_PATH,
      logoAsWatermark: false,
    });
    expect(setting.logo).toBe(
      `modules/${MODULE_ID}/art/branding/1876-logo.png`,
    );
    expect(JSON.parse(JSON.stringify(setting))).toEqual(setting);
    expect(Object.isFrozen(setting.attributes[0])).toBe(true);
  });
});
