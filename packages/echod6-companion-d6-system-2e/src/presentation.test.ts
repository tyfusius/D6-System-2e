import { describe, expect, it } from "vitest";
import { createEchoTerminology } from "./terminology";
import { ECHO_THEME } from "./theme";

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
  });
});
