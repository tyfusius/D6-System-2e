import { describe, expect, it } from "vitest";
import { createEchoTerminology } from "./terminology";
import { ECHO_THEME } from "./theme";
import { createEchoSettingProfile } from "./setting-profile";

describe("Echo presentation", () => {
  it("contributes the currently supported Echo terminology", () => {
    const terminology = createEchoTerminology((key) => `<${key}>`);
    expect(terminology.resources.fatePoints).toBe("<ECHOD6.EchoPoints>");
    expect(terminology.characterSheetLabel).toBe("<ECHOD6.CharacterSheet>");
    expect(terminology.details).toEqual({
      allegiance: "<ECHOD6.Allegiance>",
      currency: "<ECHOD6.Credits>",
    });
    expect(terminology.machines.interstellarDrive).toBe(
      "<ECHOD6.SlipstreamDrive>",
    );
    expect(terminology.manifestations.plural).toBe("<ECHOD6.EchoPowers>");
    expect(terminology.metaphysics.skills).toEqual({
      channel: "<ECHOD6.Harmonize>",
      sense: "<ECHOD6.Attune>",
      transform: "<ECHOD6.Project>",
    });
  });

  it("provides a complete theme with its owner-scoped pause logo", () => {
    expect(ECHO_THEME.tokens).toEqual({
      accent: "#a57443",
      accentBright: "#d2ad72",
      background: "#0b0908",
      muted: "#968777",
      text: "#e7e2d8",
    });
    expect(ECHO_THEME.pauseIcon).toBe(
      "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
    );
    expect(ECHO_THEME.dice).toEqual({
      body: "#0b0908",
      colorsetId: "d6-system-2e-echo-standard",
      edge: "#a57443",
      face: "#d2ad72",
      name: "Echo D6 dice",
      systemId: "d6-system-2e-echo",
      wildDie: {
        body: "#8a6038",
        colorsetId: "d6-system-2e-echo-wild",
        edge: "#b78652",
        face: "#090807",
      },
      wildDieLabels: [
        "1",
        "2",
        "3",
        "4",
        "5",
        "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png",
      ],
    });
  });

  it("provides an owner-safe Setting Profile through the public contract", () => {
    const profile = createEchoSettingProfile((key) => `<${key}>`);
    expect(profile).toMatchObject({
      id: "echo-d6",
      label: "Echo D6",
      logo: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
      originRulesFamily: "d6-system-second-edition",
      version: 4,
      wildDie: {
        six: {
          kind: "image",
          value: "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png",
        },
      },
    });
    expect(profile.attributes.map(({ id }) => id)).toContain("technical");
    expect(
      profile.attributes.every((attribute) => !("active" in attribute)),
    ).toBe(true);
    expect(profile.skills).toEqual([]);
  });
});
