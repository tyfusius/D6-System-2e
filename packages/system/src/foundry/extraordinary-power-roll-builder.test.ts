import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("extraordinary-power roll builder UI", () => {
  const source = read("./extraordinary-power-roll-builder.ts");
  const template = read(
    "../../../../templates/apps/extraordinary-power-roll-builder.hbs",
  );
  const character = read(
    "../../../../templates/actor/character/extraordinary-powers.hbs",
  );
  const styles = read("../../../../styles/d6-system-2e.css");
  const combobox = read("./rolls/difficulty-combobox.ts");
  const service = read("./extraordinary-power-service.ts");
  const summary = read("./extraordinary-power-roll-summary.ts");
  const chatTemplate = read(
    "../../../../templates/chat/extraordinary-power-roll-summary.hbs",
  );

  it("uses one staged ApplicationV2 workspace for blank, ready, and setup entry", () => {
    expect(source).toContain("HandlebarsApplicationMixin");
    expect(source).toContain("class D6ExtraordinaryPowerRollBuilder");
    expect(source).toContain("extraordinaryPowerRollBuilderInitialRows");
    expect(character).toContain('data-action="openExtraordinaryPowerBuilder"');
    expect(character).toContain("BlankRollBuilder");
    expect(character).toContain("power.rollActionLabel");
    for (const phase of [
      '"compose"',
      '"review"',
      '"executing"',
      '"complete"',
      '"interrupted"',
    ]) {
      expect(source).toContain(phase);
    }
    expect(template).toContain('data-action="reviewPlan"');
    expect(template).toContain('data-action="backToCompose"');
    expect(template).toContain('data-action="executePlan"');
  });

  it("keeps owner Force Skills on prominent accessible rolls and non-owner scores honest", () => {
    expect(character).toContain('data-action="rollExtraordinaryPowerSkill"');
    expect(character).toContain('data-item-id="{{role.itemId}}"');
    expect(character).toContain("role.scoreLabel");
    expect(character).toContain("role.available");
    expect(styles).toMatch(
      /\.d6e2-extraordinary-skill-roll\s*\{[\s\S]*?min-height:\s*44px;/u,
    );
    expect(styles).toMatch(
      /\.d6e2-extraordinary-skill-roll\s*\{[^}]*grid-template-areas:[^}]*"label score icon"[^}]*"cue score icon";[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto 28px;[^}]*width:\s*100%;[^}]*min-height:\s*76px;/su,
    );
    expect(styles).toMatch(
      /\.d6e2-force-skill-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/su,
    );
  });

  it("provides stable ordered controls and unique accessible profile comboboxes", () => {
    expect(template).toContain("<ol");
    expect(template).toContain('data-step-id="{{row.stableStepId}}"');
    expect(template).toContain('data-action="moveStepUp"');
    expect(template).toContain('data-action="moveStepDown"');
    expect(template).toContain('data-action="removeStep"');
    expect(template).toContain('type="number"');
    expect(template).toContain('inputmode="numeric"');
    expect(template).toContain('role="combobox"');
    expect(template).toContain('aria-controls="{{row.difficultyListId}}"');
    expect(template).toContain('id="{{row.difficultyListId}}"');
    expect(template).toContain('aria-errormessage="{{row.difficultyErrorId}}"');
    expect(template).toContain('aria-labelledby="{{row.difficultyLabelId}}"');
    expect(template).toContain('aria-describedby="{{row.difficultyHelpId}}"');
    expect(template).toContain('id="{{row.difficultyHelpId}}"');
    expect(template).toContain('aria-label="{{row.difficultyToggleLabel}}"');
    expect(source).toContain("difficultyLabelId: `${row.id}-difficulty-label`");
    expect(source).toContain("difficultyHelpId: `${row.id}-difficulty-help`");
    expect(source).toContain(
      "currentConfiguredRulesProfile().difficultyLadder",
    );
    expect(source).toContain("!row.difficulty.trim()");
    expect(source).toContain("bindDifficultySuggestionComboboxes");
    expect(source).not.toContain("#keydownHandler");
    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
      "Enter",
      "Escape",
      "Tab",
    ]) {
      expect(combobox).toContain(`case "${key}"`);
    }
    expect(combobox).toContain("synchronizeSelection");
    expect(template).toContain('aria-selected="{{entry.selected}}"');
    expect(template).toContain('class="d6e2-visually-hidden"');
    expect(styles).toMatch(
      /\.d6e2-force-difficulty-field[\s\S]*?\.od6roll-difficulty-listbox:not\(\[data-difficulty-placement\]\)\s*\{[^}]*min-width:\s*0;/u,
    );
    expect(styles).toMatch(
      /\.od6roll-difficulty-listbox\[data-difficulty-placement\]\s*\{[^}]*width:\s*var\(--d6e2-difficulty-listbox-width\);[^}]*min-width:\s*var\(--d6e2-difficulty-listbox-width\);[^}]*max-width:\s*var\(--d6e2-difficulty-listbox-width\);/u,
    );
    expect(styles).toMatch(
      /\.d6e2-force-difficulty-field[\s\S]*?\.od6roll-difficulty-listbox[\s\S]*?> button\s*\{[^}]*grid-template-columns:\s*3ch minmax\(0, 1fr\);[^}]*width:\s*100%;[^}]*white-space:\s*nowrap;/u,
    );
  });

  it("renders one and multiple real Handlebars rows without missing helpers", () => {
    const handlebars = Handlebars.create();
    handlebars.registerHelper("disabled", (disabled: boolean) =>
      disabled ? "disabled" : "",
    );
    handlebars.registerHelper("localize", (key: string) => key);
    handlebars.registerHelper("not", (value: unknown) => !value);
    const render = handlebars.compile(template);
    const row = (id: string, roleLabel: string) => ({
      canMoveDown: false,
      canMoveUp: false,
      difficulty: "10",
      difficultyErrorId: `${id}-error`,
      difficultyHelpId: `${id}-help`,
      difficultyInputId: `${id}-input`,
      difficultyLabelId: `${id}-label`,
      difficultyListId: `${id}-list`,
      difficultySuggestions: [
        { label: "Easy", optionId: `${id}-easy`, selected: true, value: 10 },
      ],
      difficultyToggleLabel: `Difficulty for ${roleLabel}`,
      displayIndex: 1,
      roleErrorId: `${id}-role-error`,
      roleLabel,
      roles: [
        {
          available: true,
          disabled: false,
          id: roleLabel.toLowerCase(),
          label: roleLabel,
          selected: true,
          selectedAttribute: "selected",
        },
      ],
      stableRoleId: roleLabel.toLowerCase(),
      stableStepId: id,
      status: "pending",
    });
    const context = (rows: readonly object[]) => ({
      actorLabel: "Hero",
      canAdd: true,
      frameworkLabel: "Force",
      isCompose: true,
      phase: "compose",
      phaseLabel: "Compose",
      powerLabel: "Custom",
      rows,
    });
    expect(() => render(context([row("step-1", "Control")]))).not.toThrow();
    const rendered = render(
      context([row("step-1", "Control"), row("step-2", "Sense")]),
    );
    expect(rendered).toMatch(/value="control"\s+selected/u);
    expect(rendered).toMatch(/value="sense"\s+selected/u);
  });

  it("preflights before execution and keeps interrupted rows visible", () => {
    const executeAction = source.lastIndexOf('action !== "executePlan"');
    const validate = source.indexOf("this.#validateRows()", executeAction);
    const execute = source.indexOf("await this.#execute()", validate);
    expect(executeAction).toBeGreaterThan(0);
    expect(validate).toBeGreaterThan(executeAction);
    expect(execute).toBeGreaterThan(validate);
    expect(template).toContain('role="alert"');
    expect(template).toContain('aria-invalid="{{row.hasRoleError}}"');
    expect(template).toContain('aria-invalid="{{row.hasDifficultyError}}"');
    expect(source).toContain('field: "role"');
    expect(source).toContain('field: "difficulty"');
    expect(template).toContain('data-action="resolveSetup"');
    expect(source).toContain("showExtraordinaryPowerSkills");
    expect(template).toContain("row.resultStatusLabel");
    expect(source).toContain('this.#phase === "interrupted"');
    expect(source).toContain("#submitting");
    expect(source).toContain("onProgress: (progress)");
    expect(service).toContain("await projectProgress(options,");
    expect(service).toContain('status: "finalizing"');
    expect(source).toContain('this.#progress?.status === "finalizing"');
    expect(source).toContain('progress.status === "interrupted"');
    expect(template).toContain("{{progressLabel}}");
    expect(source).toContain("resultCanBeDisclosed");
    expect(source).toContain(
      'mode !== "blindroll" || game.user?.isGM === true',
    );
  });

  it("keeps unavailable custom plans recoverable and summary retry non-authoritative", () => {
    expect(source).toContain(
      "state?.skillBindings.some(({ available }) => !available)",
    );
    expect(template).toContain('data-action="resolveSetup"');
    expect(template).toContain('data-action="retrySummary"');
    expect(source).toContain(
      "retryExtraordinaryPowerRollSummary(this.#result)",
    );
    expect(source).toContain("if (this.#summaryFailed) return");
    expect(service).toContain("summaryPresentations.set(result, summary)");
    expect(service).toContain('kind: "summary"');
    expect(summary).toContain("completedAudienceIndexes.has(audienceIndex)");
    expect(summary).toContain("completedAudienceIndexes.add(audienceIndex)");
  });

  it("retains a full-width single-scroller workspace without horizontal overflow", () => {
    expect(styles).toMatch(
      /\.application\.d6e2-force-roll-builder\s*\{[^}]*width:\s*min\(840px,[^;]*\) !important;[^}]*max-width:\s*min\(840px,[^;]*\) !important;/su,
    );
    expect(styles).toMatch(
      /\.d6e2-force-roll-builder-shell\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/su,
    );
    expect(styles).toMatch(
      /\.d6e2-force-roll-builder-content\s*\{[^}]*overflow-y:\s*auto;/su,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.d6e2-force-roll-step\s*\{[^}]*grid-template-areas:[^}]*"order skill status"[^}]*"order difficulty result"[^}]*"order actions actions";[^}]*grid-template-columns:\s*34px minmax\(0, 1fr\) auto;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.application\.d6e2-force-roll-builder\s*\{[^}]*left:\s*8px !important;[^}]*right:\s*auto !important;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width: 519px\)[\s\S]*?\.d6e2-force-roll-step\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/u,
    );
    expect(styles).toMatch(
      /@media \(max-height: 520px\)[\s\S]*?\.application\.d6e2-force-roll-builder\s*\{[^}]*top:\s*8px !important;[^}]*height:\s*calc\(100vh - 16px\) !important;[^}]*max-height:\s*calc\(100vh - 16px\) !important;/u,
    );
    expect(styles).toMatch(
      /@media \(max-height: 520px\)[\s\S]*?\.d6e2-force-roll-builder-shell\s*\{[^}]*height:\s*calc\(100vh - 56px\);[^}]*max-height:\s*calc\(100vh - 56px\);/u,
    );
    expect(template).toContain('aria-live="polite"');
    expect(styles).toContain(
      'html[data-d6e2-visual-effects-resolved="reduced"]',
    );
    expect(styles).not.toContain('data-od6s-resolved-effects="reduced"');
    expect(styles).toMatch(
      /\.d6e2-force-roll-progress[\s\S]*animation:\s*none;/u,
    );
    expect(styles).toMatch(
      /data-d6e2-visual-effects-resolved="reduced"[\s\S]*?:is\(\.application\.d6e2-force-roll-builder, \.d6e2-force-workspace\)[\s\S]*?transition:\s*none !important;/u,
    );
    expect(template.indexOf("{{#if hasResult}}")).toBeLessThan(
      template.indexOf("<ol"),
    );
    expect(template).toContain("d6e2-force-roll-builder-primary-actions");
    expect(template).toContain("d6e2-force-roll-builder-secondary-actions");
    expect(template).toContain("d6e2-force-roll-empty");
    expect(template).toContain("RollBuilderEmptyTitle");
    expect(template).toContain("{{#if rows}}");
    expect(styles).toMatch(
      /\.d6e2-force-roll-empty\s*\{[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\) auto;[^}]*min-height:\s*116px;/su,
    );
    expect(styles).toMatch(
      /@media \(max-width: 519px\)[\s\S]*?\.d6e2-force-roll-empty\s*\{[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\);/u,
    );
  });

  it("persists ordered summaries without widening private or blind results", () => {
    expect(service).toContain("postExtraordinaryPowerRollSummary(");
    expect(summary).toContain("extraordinaryPowerSummaryAudiences");
    expect(summary).toContain('mode === "blindroll"');
    expect(summary).toContain('mode === "selfroll"');
    expect(summary).toContain("recipientIds");
    expect(summary).toContain("{ disclosed: false }");
    expect(summary).toContain("await ChatMessage.create({");
    expect(chatTemplate).toContain("{{#each rows as |row|}}");
    expect(chatTemplate).toContain("{{resultCountLabel}}");
    expect(chatTemplate).toContain("d6e2-force-roll-chat-outcome");
    expect(chatTemplate).toContain("d6e2-force-roll-chat-status");
    expect(chatTemplate).toContain("d6e2-force-roll-chat-restricted");
    expect(styles).toMatch(
      /\.d6e2-force-roll-chat-summary li\s*\{[^}]*grid-template-areas:[^}]*"index skill"[^}]*"index difficulty"[^}]*"index status";/su,
    );
    expect(styles).toMatch(
      /\.d6e2-force-roll-chat-summary header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/su,
    );
    expect(summary).toContain("SummaryRestricted");
  });

  it("keeps all row actions and Force setup controls at least 44 by 44 pixels", () => {
    expect(styles).toMatch(
      /\.d6e2-force-workspace \.d6e2-subtabs button\s*\{[^}]*min-height:\s*44px;/su,
    );
    expect(styles).toMatch(
      /\.d6e2-force-roll-step-actions \.od6v2-icon-button\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*height:\s*44px;[^}]*min-height:\s*44px;/su,
    );
    expect(styles).toMatch(
      /:is\(\.d6e2-force-binding-controls, \.d6e2-force-resource-control\)[\s\S]*?> :is\(select, input, button\)\s*\{[^}]*min-height:\s*44px;/u,
    );
    expect(styles).toMatch(
      /\.application\.d6e2-character-v2[\s\S]*?:is\(\.d6e2-force-binding-controls, \.d6e2-force-resource-control\)[\s\S]*?> :is\(select, input, button\)\s*\{[^}]*min-height:\s*44px;/u,
    );
    expect(styles).toMatch(
      /\.application\.d6e2-character-v2[\s\S]*?\.d6e2-extraordinary-skill-roll\s*\{[^}]*min-height:\s*76px;/u,
    );
  });
});
