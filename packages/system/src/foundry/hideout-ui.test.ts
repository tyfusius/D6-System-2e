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
});
