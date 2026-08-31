import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(
  new URL("./sheets/hideout-sheet.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL("../../../../templates/actor/hideout-sheet.hbs", import.meta.url),
  "utf8",
);
const model = readFileSync(
  new URL("./data-models/hideout.ts", import.meta.url),
  "utf8",
);
const english = JSON.parse(
  readFileSync(new URL("../../../../lang/en.json", import.meta.url), "utf8"),
) as Record<string, string>;

describe("Hidden Bases and Hideouts UI", () => {
  it("registers a standalone persistent location, roster, features, and timing model", () => {
    expect(model).toContain("export class HideoutDataModel");
    expect(model).toContain("locationType");
    expect(model).toContain("features: new ArrayField");
    expect(model).toContain("members: new ArrayField");
    expect(model).toContain("monthsCompleted");
  });

  it("exposes owner authoring and separate GM timing controls", () => {
    expect(template).toContain('data-action="addCustomFeature"');
    expect(template).toContain('data-action="addCatalogFeature"');
    expect(template).toContain('data-action="addMember"');
    expect(template).toContain('name="system.featureLimit"');
    expect(template).toContain("{{disabled (not gm)}}");
    expect(template).toContain("D6E2.Hideout.OwnershipHelp");
    expect(sheet).toContain(
      "currentSecondEditionCampaignProfile().hiddenBases",
    );
    expect(sheet).toContain("hideoutRelocationPlan");
    expect(template).toContain('type="submit"');
    expect(template).toContain("D6E2.SaveChanges");
    expect(sheet).toContain("form: applicationV2FormOptions({");
    expect(sheet).not.toContain("submitOnClose");
  });

  it("keeps inactive data visible and names the exact GM activation path", () => {
    expect(template).toContain("D6E2.Hideout.InactiveHelp");
    expect(english["D6E2.Hideout.InactiveHelp"]).toContain(
      "Game Settings → D6 System → Rules & Mechanics → Configure → Rules & Modules",
    );
    expect(english["D6E2.Hideout.InactiveHelp"]).toContain(
      "enable Hidden Bases & Hideouts and Save",
    );
    expect(english["D6E2.Hideout.InactiveHelp"]).toContain(
      "offer to enable any missing Pips and Perks, Flaws & Talents prerequisites together",
    );
    expect(template).toContain("{{disabled (not canEdit)}}");
    expect(template).toContain("{{disabled (not gm)}}");
  });
});
