import { existsSync, readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string): string =>
  readFileSync(new URL(path, root), "utf8");
const translations = JSON.parse(read("lang/en.json")) as Record<string, string>;

Handlebars.registerHelper(
  "localize",
  (key: string) => translations[key] ?? key,
);

describe("additive matching-combination Homebrew contracts", () => {
  it("keeps ordinary numeric execution authoritative and has no replacement roll UI", () => {
    const service = read("packages/system/src/foundry/rolls/roll-service.ts");
    const edition = read("templates/settings/edition-settings.hbs");
    const portable = read("templates/settings/rules-profile.hbs");
    const gameSettings = read(
      "packages/system/src/settings/game-settings-root.ts",
    );
    const healthModel = read(
      "packages/system/src/settings/health-model-application.ts",
    );

    expect(
      existsSync(new URL("templates/roll/matching-roll-dialog.hbs", root)),
    ).toBe(false);
    expect(
      existsSync(new URL("templates/roll/matching-chat-card.hbs", root)),
    ).toBe(false);
    expect(
      existsSync(
        new URL(
          "packages/system/src/application/rolls/execute-matching-roll.ts",
          root,
        ),
      ),
    ).toBe(false);
    expect(service).not.toContain("executeMatchingOrdinaryRollIfConfigured");
    expect(service).not.toContain("promptForMatchingRoll");
    expect(service).toContain("const executed = await executeD6Roll(");
    expect(service).toMatch(
      /applyHeroPointTransaction\(actor, executed\.result\)[\s\S]*applyOpenD6RollResourceTransaction\(actor, executed\.result\)[\s\S]*applyWildTriumphRewards\(actor, executed\.result\)[\s\S]*appendMatchingHomebrewObservation\(\s*actor,\s*executed\.result/u,
    );
    expect(edition).not.toContain('name="strategy.rollResolution"');
    expect(portable).not.toContain('name="strategy.rollResolution"');
    expect(portable).not.toContain('data-rules-profile-tab="resolution"');
    expect(portable).not.toContain("d6e2-roll-resolution-card");
    expect(gameSettings).not.toContain("D6System2eRulesProfileApplication");
    expect(healthModel).not.toContain("D6System2eRulesProfileApplication");
    expect(gameSettings).toContain("withRulesDraft(draft, { isNew: true })");
    expect(healthModel).toContain("withRulesDraft(profile)");
  });

  it("authors detection and consequences only inside the accepted Homebrew panel", () => {
    const template = read("templates/settings/edition-settings.hbs");
    const homebrew = template.indexOf('data-settings-panel="homebrew"');
    const matching = template.indexOf("data-matching-rewards");
    const footer = template.indexOf("d6e2-settings-footer");

    expect(homebrew).toBeGreaterThanOrEqual(0);
    expect(matching).toBeGreaterThan(homebrew);
    expect(matching).toBeLessThan(footer);
    expect(template).toContain(
      "D6E2.Settings.RulesProfile.Rewards.DetectionHeading",
    );
    expect(template).toContain('data-action="reviewCombinations"');
    expect(template).toContain("data-matching-reward-row");
    expect(template).toContain("data-reward-meta");
    expect(template).toContain("data-reward-cp");
    expect(template).toContain(
      "D6E2.Settings.RulesProfile.Rewards.AdvancedFallback",
    );
  });

  it("appends audit and durably granted reward evidence to the normal numeric card", () => {
    const template = read("templates/roll/chat-card.hbs");
    const service = read("packages/system/src/foundry/rolls/roll-service.ts");

    expect(template).toContain("{{result.total}}");
    expect(template).toContain("hasMatchingObservation");
    expect(template).toContain("matchingObservation.patternLabel");
    expect(template).toContain("{{#if matchingObservation.reward}}");
    expect(template).toContain("D6E2.Roll.Matching.RewardGranted");
    expect(service).toContain(
      'matchingObservation?.reward?.status === "granted"',
    );
    expect(service).toContain("resolveD6MatchingRewardPlan");
    expect(service).toContain("applyD6MatchingReward");
  });

  it("keeps advanced recognized-result definitions typed and protected", () => {
    const template = read("templates/settings/matching-evaluator.hbs");
    const application = read(
      "packages/system/src/settings/matching-evaluator-application.ts",
    );
    expect(template).toContain('data-action="addGroup"');
    expect(template).toContain('data-action="removeGroup"');
    expect(template).toContain('name="pattern.{{pattern.id}}.enabled"');
    expect(template).toContain("D6E2.DeveloperDetails");
    expect(translations["D6E2.DeveloperDetails"]).toBe("Developer details");
    expect(template).toContain("data-matching-validation-summary");
    expect(template).not.toContain("{{selected");
    expect(template).not.toContain('name="expression"');
    expect(template).not.toContain('name="script"');
    expect(application).toContain("#renderAndRestoreContext");
    expect(application).toContain("#presentValidationError");
  });

  it("renders an accessible localized Developer details disclosure", () => {
    const html = Handlebars.compile(
      read("templates/settings/matching-evaluator.hbs"),
    )({
      evaluator: { displayLabel: "Matching combinations" },
      patterns: [
        {
          displayLabel: "No match",
          groups: [],
          id: "d6-nexus.pattern.none",
          isFallback: true,
          precedence: 0,
        },
      ],
      readOnly: true,
    });

    expect(html).toContain("<summary>Developer details</summary>");
    expect(html).not.toMatch(/D6E2\.[A-Za-z0-9_.-]+/u);
  });

  it("keeps remote response payloads free of matching evidence", () => {
    const requests = read("packages/system/src/foundry/roll-requests.ts");
    const response = requests.slice(
      requests.indexOf('readonly type: "response"'),
      requests.indexOf('readonly type: "cancel"'),
    );
    const emitter = requests.slice(
      requests.indexOf("function emitRollResponse"),
      requests.indexOf("export function registerRollRequestSocket"),
    );
    expect(response).not.toContain("matchingObservation");
    expect(emitter).not.toContain("matchingObservation");
  });
});
