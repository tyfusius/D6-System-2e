import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { beforeAll, describe, expect, it } from "vitest";
import { distinctionAutomationStatusId } from "../distinction-automation-service";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const styles = read("../../../../../styles/d6-system-2e.css");

const labels: Readonly<Record<string, string>> = {
  "D6E2.Distinction.Application.skill": "Skill rolls",
  "D6E2.Distinction.AutomaticCount": "Automatic effects",
  "D6E2.Distinction.Classification": "Classification",
  "D6E2.Distinction.DeclarationCount": "Declaration effects",
  "D6E2.Distinction.Disposition.automatic": "Automatic",
  "D6E2.Distinction.Disposition.declaration": "Declaration required",
  "D6E2.Distinction.Disposition.narrative-only": "Narrative / GM adjudication",
  "D6E2.Distinction.Disposition.stored-only": "Not automated",
  "D6E2.Distinction.Heading": "Distinction mechanics",
  "D6E2.Distinction.Editor.Heading": "Talent automation",
  "D6E2.Distinction.Editor.Add": "Add mechanic",
  "D6E2.Distinction.Editor.Behavior": "Behavior",
  "D6E2.Distinction.Editor.DeferredHelp":
    "Deferred mechanics remain GM-adjudicated.",
  "D6E2.Distinction.Editor.Remove": "Remove mechanic",
  "D6E2.Distinction.Editor.Target": "Specific target",
  "D6E2.Distinction.Kind.roll-modifier": "Roll modifier",
  "D6E2.Distinction.Mechanic": "Mechanic",
  "D6E2.Distinction.NarrativeCount": "Narrative effects",
  "D6E2.Distinction.NotNumeric": "No numeric modifier",
  "D6E2.Distinction.PerRank": "Per rank",
  "D6E2.Distinction.Provenance": "Provenance",
  "D6E2.Distinction.ScopeHeading": "Scope",
  "D6E2.Distinction.Score": "Modifier",
  "D6E2.Distinction.Source": "Source",
  "D6E2.Distinction.StoredCount": "Not automated",
  "D6E2.Item.TraitsEyebrow": "Character distinctions",
  "D6E2.Tab.Traits": "Traits",
};

beforeAll(() => {
  Handlebars.registerHelper(
    "localize",
    (key: string, options: Handlebars.HelperOptions) => {
      const label = labels[key] ?? key;
      const count = (options.hash as Record<string, unknown>).count;
      return typeof count === "number" || typeof count === "string"
        ? `${label}: ${count}`
        : label;
    },
  );
  Handlebars.registerHelper("disabled", (value: unknown) =>
    value ? "disabled" : "",
  );
  Handlebars.registerHelper("not", (value: unknown) => !value);
  Handlebars.registerHelper("checked", (value: unknown) =>
    value ? "checked" : "",
  );
  Handlebars.registerHelper("eq", (left: unknown, right: unknown) =>
    Object.is(left, right),
  );
});

describe("Distinction presentation", () => {
  it("uses a framed section instead of a border-crossing fieldset for contextual choices", () => {
    const template = read("../../../../../templates/roll/dialog.hbs");
    const start = template.indexOf("{{#if hasDistinctionChoices}}");
    const end = template.indexOf("{{/if}}", start) + "{{/if}}".length;
    const fragment = template.slice(start, end);

    expect(fragment).toContain(
      '<section class="od6roll-section-card od6roll-distinction-choices">',
    );
    expect(fragment).toContain('<header class="od6roll-section-heading">');
    expect(fragment).toContain("<h3>");
    expect(fragment).toMatch(/class="od6roll-section-grid"\s+role="group"/u);
    expect(fragment).not.toContain("<fieldset");
    expect(fragment).not.toContain("<legend");
    expect(styles).toMatch(
      /\.od6roll-section-card\s*\{[^}]*padding:\s*12px;[^}]*border:\s*1px solid var\(--od6-line\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-section-heading\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-section-heading h3\s*\{[^}]*margin:\s*0;/s,
    );
  });

  it("keeps long contextual choices content-driven with visible keyboard focus", () => {
    expect(styles).toMatch(
      /\.od6roll-section-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*18rem\),\s*1fr\)\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-section-grid:has\(>\s*:only-child\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-distinction-choice\s*\{[^}]*grid-template-rows:\s*auto auto;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-distinction-choice\s+\.od6roll-resource-heading\s*\{[^}]*white-space:\s*normal;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-distinction-choice\s+\.od6roll-resource-heading\s*>\s*span\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-distinction-choice:has\(\.od6roll-checkbox-input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--od6-accent-bright\);/s,
    );
  });

  it("composes sparse roll inputs as reusable cards with intrinsic numeric controls", () => {
    const template = read("../../../../../templates/roll/dialog.hbs");
    const start = template.indexOf('<div class="od6roll-options');
    const end = template.indexOf("{{#if showOppositionControls}}", start);
    const fragment = template.slice(start, end);

    expect(fragment).toContain(
      '<div class="od6roll-options od6roll-primary-options">',
    );
    expect(
      fragment.match(/od6roll-option-card/gu)?.length,
    ).toBeGreaterThanOrEqual(6);
    expect(fragment).toContain(
      'class="od6roll-compact-number od6roll-map-input"',
    );
    expect(fragment).toContain(
      'class="od6roll-compact-number od6roll-dice-adjustment-input"',
    );

    expect(styles).toMatch(
      /\.od6roll-primary-options\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-option-card\s*\{[^}]*display:\s*grid;[^}]*padding:\s*10px 11px;[^}]*gap:\s*6px;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-compact-number\s*\{[^}]*display:\s*inline-grid;[^}]*grid-template-columns:\s*minmax\(6ch,\s*7ch\) auto;[^}]*justify-self:\s*start;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-primary-options\s+:is\(input,\s*select\)\s*\{[^}]*min-block-size:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-difficulty-toggle\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /@container od6roll-dialog \(max-width:\s*520px\)\s*\{[^}]*\.od6roll-primary-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
  });

  it("renders a GM Talent authoring surface with safe typed controls and no raw rule input", () => {
    const template = read("../../../../../templates/item/item-sheet.hbs");
    const start = template.indexOf("<!-- distinction-editor:start -->");
    const end = template.indexOf("<!-- distinction-editor:end -->");
    const html = Handlebars.compile(template.slice(start, end))({
      distinctionEditor: {
        applicationOptions: [
          { label: "All rolls", selected: true, value: "all-rolls" },
        ],
        help: "Author safe roll modifiers without interpreting prose.",
        mechanics: [
          {
            applicationOptions: [
              { label: "Skill rolls", selected: true, value: "skill" },
            ],
            dice: 1,
            index: 0,
            modeOptions: [
              {
                label: "Optional in roll dialog",
                selected: true,
                value: "contextual-roll",
              },
            ],
            perRank: true,
            pips: 0,
            selectorOptions: [
              {
                application: "skill",
                label: "Blaster",
                selected: true,
                value: "owned-skill-id",
              },
            ],
          },
        ],
        modeOptions: [
          {
            label: "Automatic roll modifier",
            selected: true,
            value: "automatic-roll",
          },
        ],
        scope: "sheet-safe-scope",
        selectorOptions: [
          { application: "", label: "All applicable uses", value: "" },
        ],
      },
    });

    expect(html).toContain("Talent automation");
    expect(html).toContain("Optional in roll dialog");
    expect(html).toContain("Blaster");
    expect(html).toContain('data-action="addDistinctionMechanic"');
    expect(html).toContain('data-action="removeDistinctionMechanic"');
    expect(html).toMatch(/min="-20"[\s\S]*max="20"/u);
    expect(html).not.toContain("textarea");
    expect(html).not.toContain("JSON");
    expect(html).not.toContain("system.attributes.");
  });
  it("does not ship premature Path or Node presentation keys", () => {
    const language = JSON.parse(read("../../../../../lang/en.json")) as Record<
      string,
      unknown
    >;
    expect(language).not.toHaveProperty("D6E2.Distinction.Path");
    expect(language).not.toHaveProperty("D6E2.Distinction.Node");
  });

  it("renders all four honest Character dispositions with singular-safe noun labels", () => {
    const html = Handlebars.compile(
      read("../../../../../templates/actor/character/traits.hbs"),
    )({
      editable: false,
      freeEdit: false,
      tab: { cssClass: "active" },
      traitGroups: [
        {
          canCreate: false,
          label: "Talents",
          type: "talent",
          items: [
            {
              distinctionAutomation: {
                automatic: 1,
                declaration: 1,
                narrativeOnly: 1,
                statusId: "d6e2-distinction-status-0-0",
                storedOnly: 1,
              },
              id: "talent-1",
              img: "talent.svg",
              name: "A very long authored Talent label that must remain readable",
            },
          ],
        },
      ],
    });

    expect(html).toContain("Automatic effects: 1");
    expect(html).toContain("Declaration effects: 1");
    expect(html).toContain("Narrative effects: 1");
    expect(html).toContain("Not automated: 1");
    expect(html).not.toContain("require review");
    expect(html).not.toContain("Nexus Node");
    expect(html).toContain('aria-describedby="d6e2-distinction-status-0-0"');
    expect(html).toContain('id="d6e2-distinction-status-0-0"');
  });

  it("links globally unique authorized status descriptions across simultaneous ApplicationV2 sheets", () => {
    const renderSheet = (scope: string, authorized: boolean) =>
      Handlebars.compile(
        read("../../../../../templates/actor/character/traits.hbs"),
      )({
        editable: false,
        freeEdit: false,
        tab: { cssClass: "active" },
        traitGroups: [
          {
            canCreate: false,
            label: "Talents",
            type: "talent",
            items: [
              {
                ...(authorized
                  ? {
                      distinctionAutomation: {
                        automatic: 1,
                        declaration: 0,
                        narrativeOnly: 0,
                        statusId: distinctionAutomationStatusId(scope, 0, 0),
                        storedOnly: 0,
                      },
                    }
                  : {}),
                id: "same-item-id",
                img: "one.svg",
                name: authorized ? "Authorized" : "Unauthorized Private",
              },
            ],
          },
        ],
      });

    const html = `<main>${renderSheet("sheet-alpha", true)}${renderSheet(
      "sheet-beta",
      true,
    )}</main>`;

    const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/gu)].map(
      (match) => match[1],
    );
    expect(descriptions).toEqual([
      "d6e2-distinction-status-sheet-alpha-0-0",
      "d6e2-distinction-status-sheet-beta-0-0",
    ]);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) {
      expect(html.match(new RegExp(`id="${description}"`, "gu"))).toHaveLength(
        1,
      );
    }
    const unauthorized = renderSheet("sheet-private", false);
    expect(unauthorized).not.toContain("aria-describedby");
    expect(unauthorized).not.toContain("d6e2-distinction-status-");
  });

  it("renders the Item-specific read model without stable IDs in ordinary markup", () => {
    const template = read("../../../../../templates/item/item-sheet.hbs");
    const start = template.indexOf("<!-- distinction-presentation:start -->");
    const end = template.indexOf("<!-- distinction-presentation:end -->");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const fragment = template.slice(start, end);
    const html = Handlebars.compile(fragment)({
      distinctionAutomation: {
        help: "Typed mechanics are read-only and never inferred from prose.",
        mechanics: [
          {
            applicationLabel: "Skill rolls",
            dispositionLabel: "Automatic",
            kindLabel: "Roll modifier",
            perRankLabel: "Applied once per current Item rank",
            scopeLabel:
              "A very long human-readable Skill target label that wraps safely",
            scoreLabel: "+1D",
          },
          {
            applicationLabel: "Not applicable",
            dispositionLabel: "Declaration required",
            kindLabel: "Resource use",
            scopeLabel: "All applicable uses",
          },
          {
            applicationLabel: "Not applicable",
            dispositionLabel: "Narrative / GM adjudication",
            kindLabel: "Narrative",
            scopeLabel: "All applicable uses",
          },
          {
            applicationLabel: "Not applicable",
            dispositionLabel: "Not automated",
            kindLabel: "Minimum total",
            scopeLabel: "All applicable uses",
          },
        ],
        provenanceLabel: "Provided by A Very Long Campaign Feature Library",
        sourceLabel: "Campaign reference · p. 42",
      },
    });

    expect(html).toContain("Distinction mechanics");
    for (const label of [
      "Automatic",
      "Declaration required",
      "Narrative / GM adjudication",
      "Not automated",
      "A very long human-readable Skill target label",
      "Applied once per current Item rank",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("private.definition-id");
    expect(html).not.toContain("provider.catalog-id");
    expect(html).not.toContain("data-definition-id");
    expect(html).not.toContain('aria-label="private');
  });

  it("renders page-zero imported source and human provider copy without raw provenance", () => {
    const template = read("../../../../../templates/item/item-sheet.hbs");
    const start = template.indexOf("<!-- distinction-presentation:start -->");
    const end = template.indexOf("<!-- distinction-presentation:end -->");
    const html = Handlebars.compile(template.slice(start, end))({
      distinctionAutomation: {
        help: "Typed mechanics are read-only.",
        mechanics: [],
        provenanceLabel: "Skill Tree Importer",
        sourceLabel: "Imported Skill Tree",
      },
    });

    expect(html).toContain("Imported Skill Tree");
    expect(html).toContain("Skill Tree Importer");
    expect(html).not.toContain("skill-tree");
    expect(html).not.toContain("No source reference");
  });
});
