import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync(
  new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);

describe("roll chat-card setting logo presentation", () => {
  it("renders the decorative logo outside the actor portrait image treatment", () => {
    expect(template).toContain(
      '<span class="d6e2-setting-logo" aria-hidden="true"></span>',
    );
    expect(template).not.toContain(
      '<img class="d6e2-setting-logo" src="{{settingLogo}}" alt="" />',
    );
    expect(service).toContain(
      "settingLogo: resolveSettingLogo(currentSettingProfile().logo)",
    );
    expect(template).not.toContain("fa-cube");
  });

  it("colors the vanilla system mark from the selected presentation theme", () => {
    expect(styles).toMatch(
      /data-d6-system2e-setting-branding="neutral"[\s\S]*?\.d6e2-setting-logo\s*\{[^}]*background-color: var\(--od6-accent\);[^}]*mask: var\(--d6e2-setting-logo-image\)/s,
    );
  });

  it("colors the Star Wars wordmark from the selected presentation theme", () => {
    expect(styles).toContain(
      'html[data-d6-system2e-setting-profile^="star-wars-d6"]',
    );
    expect(styles).toContain("background-color: var(--od6-accent-bright)");
    expect(styles).toContain("mask-image: var(--d6e2-setting-logo-image)");
    expect(styles).toContain(
      "-webkit-mask-image: var(--d6e2-setting-logo-image)",
    );
    expect(styles).toContain("grid-template-columns: 42px minmax(0, 1fr) 46px");
    expect(styles).toContain("width: 52px");
    expect(styles).toContain("height: 30px");
    expect(styles).toContain("justify-self: center");
  });
});
