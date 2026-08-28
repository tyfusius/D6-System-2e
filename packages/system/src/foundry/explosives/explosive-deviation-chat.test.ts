import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);
const service = readFileSync(
  new URL("./explosive-service.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL("templates/chat/explosive-attack-thread.hbs", root),
  "utf8",
);
const styles = readFileSync(new URL("styles/d6-system-2e.css", root), "utf8");

describe("explosive deviation chat audit", () => {
  it("appends one visibility-matched roll slice to the initiating root", () => {
    expect(service).toContain("appendD6InitiatingActionPresentation");
    expect(service).toContain("presentation: { rollMode, rolls: serialized }");
    expect(service).toContain(
      "const artifacts = await hydrateD6FoundryRolls(presentation.rolls)",
    );
    expect(service).toMatch(
      /appendD6InitiatingActionPresentation\(\{\s*artifacts,/s,
    );
    expect(service).not.toContain("ChatMessage.create");
    expect(service).not.toContain("presentation.roll.toMessage");
    expect(template).toContain("data-explosive-attack-thread");
    expect(template).toContain("data-explosive-deviation");
    expect(template).toContain("D6E2.Explosive.DeviationStatus");
    expect(template).toContain("{{deviation.directionFormula}}");
    expect(template).toContain("{{deviation.distanceFormula}}");
    expect(template).toContain("D6E2.Explosive.DirectionRelative");
    expect(template).toContain("D6E2.Explosive.FinalPoint");
  });

  it("keeps deviation values theme-readable at normal and narrow widths", () => {
    expect(styles).toMatch(
      /\.d6e2-explosive-deviation\s*\{[^}]*container-type: inline-size/s,
    );
    expect(styles).toMatch(
      /\.d6e2-explosive-deviation-details dd\s*\{[^}]*color: var\(--od6-text\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-explosive-deviation-details\s+dd\s+:is\(code, strong\)\s*\{[^}]*color: inherit[^}]*white-space: normal/s,
    );
    expect(styles).toMatch(
      /\.d6e2-explosive-deviation-details :is\(dt, dd\)[^}]*overflow-wrap: anywhere/s,
    );
  });

  it("uses the card's 276px inline size for narrow and 200% wrapping", () => {
    expect(styles).toMatch(
      /@container \(max-width: 320px\)[^]*\.d6e2-explosive-deviation-route\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s,
    );
  });
});
