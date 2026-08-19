import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_SETTINGS,
} from "./settings-catalog";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const styles = read("../../../../styles/d6-system-2e.css");
const template = read("../../../../templates/settings/edition-settings.hbs");
const english = JSON.parse(read("../../../../lang/en.json")) as Record<
  string,
  string
>;

const summarySettings = [
  ...FIRST_EDITION_SETTINGS,
  ...SECOND_EDITION_SETTINGS,
].filter(({ type }) => type === "boolean");

const ruleBody = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s").exec(styles)?.[1] ?? "";
};

describe("Settings at a Glance layout", () => {
  it("audits every First and Second Edition summary-card label", () => {
    expect(summarySettings).toHaveLength(37);

    const labels = summarySettings.map(({ name }) => english[name]);
    expect(
      labels.every((label) => typeof label === "string" && label.length > 0),
    ).toBe(true);
    expect(labels).toContain("Track accumulating stuns (legacy compatibility)");
  });

  it("keeps cards content-driven for long and expanded localized labels", () => {
    const button = ruleBody(
      "body.system-d6-system-2e .d6e2-settings-summary-grid button",
    );
    const label = ruleBody(
      "body.system-d6-system-2e .d6e2-settings-summary-grid strong",
    );

    expect(button).toContain("grid-template-rows: 1fr auto;");
    expect(button).toContain("height: auto;");
    expect(button).toContain("min-height: 46px;");
    expect(label).toContain("overflow-wrap: anywhere;");
    expect(label).toContain("white-space: normal;");
    expect(styles).toContain("container-name: d6e2-settings;");
    expect(styles).toContain("container-type: inline-size;");
    expect(styles).toContain("@container d6e2-settings (max-width: 720px)");
    expect(styles).toContain("@container d6e2-settings (max-width: 420px)");

    const expandedLabels = summarySettings.map(
      ({ name }) => `${english[name]} — ${english[name]}`,
    );
    expect(
      Math.max(...expandedLabels.map((labelText) => labelText.length)),
    ).toBeGreaterThan(80);
  });

  it("preserves the separate status row and native button semantics", () => {
    const status = ruleBody(
      "body.system-d6-system-2e .d6e2-settings-summary-grid span",
    );

    expect(status).toContain("grid-column: 2;");
    expect(status).toContain("align-self: end;");
    expect(status).toContain("padding-top: 3px;");
    expect(template).toContain('<button\n              type="button"');
    expect(template).toContain('aria-pressed="{{setting.active}}"');
    expect(template).toContain('data-setting-summary-key="{{setting.key}}"');
  });
});
