import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const application = readFileSync(
  new URL("./health-model-application.ts", import.meta.url),
  "utf8",
);
const editorState = readFileSync(
  new URL("./health-model-editor-state.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL("templates/settings/health-model.hbs", root),
  "utf8",
);
const libraryApplication = readFileSync(
  new URL("./health-model-library-application.ts", import.meta.url),
  "utf8",
);
const libraryTemplate = readFileSync(
  new URL("templates/settings/health-model-library.hbs", root),
  "utf8",
);
const styles = readFileSync(new URL("styles/d6-system-2e.css", root), "utf8");
const translations = JSON.parse(
  readFileSync(new URL("lang/en.json", root), "utf8"),
) as Record<string, string>;

Handlebars.registerHelper("localize", (key: string) => key);
Handlebars.registerHelper("disabled", (value: boolean) =>
  value ? "disabled" : "",
);
Handlebars.registerHelper("checked", (value: boolean) =>
  value ? "checked" : "",
);
Handlebars.registerHelper("not", (value: boolean) => !value);

describe("Dynamic Health Model editor UI contract", () => {
  it("is a dedicated responsive ApplicationV2 with a sticky save boundary", () => {
    expect(application).toContain("ApplicationV2");
    expect(application).toContain("width: 920");
    expect(template).toContain("d6e2-health-model-shell");
    expect(template).toContain('class="d6e2-setting-profile-scroll"');
    expect(template).toContain('type="submit"');
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s*\{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/s,
    );
    expect(styles).toContain(".d6e2-health-model-builder");
  });

  it("lets native ApplicationV2 resizing control a viewport-safe Builder", () => {
    const builderRule =
      /body\.system-d6-system-2e \.application\.d6e2-health-model-builder\s*\{(?<declarations>[^}]*)\}/u.exec(
        styles,
      )?.groups?.declarations;

    expect(application).toContain("position: { height: 720, width: 920 }");
    expect(application).toContain("resizable: true");
    expect(builderRule).toBeTruthy();
    expect(builderRule).toContain("min-width: min(520px, calc(100vw - 32px))");
    expect(builderRule).toContain("max-width: calc(100vw - 32px)");
    expect(builderRule).toContain("min-height: min(480px, calc(100vh - 48px))");
    expect(builderRule).toContain("max-height: calc(100vh - 48px)");
    expect(builderRule).not.toContain("!important");
    expect(application).not.toMatch(
      /game\.settings\.(?:get|set)[^]*geometry/iu,
    );

    const clampSize = (
      requested: { height: number; width: number },
      viewport: { height: number; width: number },
    ): { height: number; width: number } => {
      const maxWidth = viewport.width - 32;
      const maxHeight = viewport.height - 48;
      return {
        height: Math.min(
          Math.max(requested.height, Math.min(480, maxHeight)),
          maxHeight,
        ),
        width: Math.min(
          Math.max(requested.width, Math.min(520, maxWidth)),
          maxWidth,
        ),
      };
    };

    expect(
      clampSize({ height: 720, width: 920 }, { height: 768, width: 1366 }),
    ).toEqual({ height: 720, width: 920 });
    expect(
      clampSize({ height: 600, width: 700 }, { height: 768, width: 1366 }),
    ).toEqual({ height: 600, width: 700 });
    expect(
      clampSize({ height: 180, width: 320 }, { height: 768, width: 1366 }),
    ).toEqual({ height: 480, width: 520 });
    expect(
      clampSize({ height: 720, width: 920 }, { height: 384, width: 683 }),
    ).toEqual({ height: 336, width: 651 });
  });

  it("reflows Builder-only controls from its resized container, not the viewport", () => {
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-model-shell\s+\.d6e2-setting-profile-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-section-heading\s*\{[^}]*flex-wrap: wrap/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell > footer\s*\{[^}]*flex-wrap: wrap/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 520px\)[^]*:is\(\.d6e2-health-field--inline, \.d6e2-health-field--matrix\)[^}]*grid-template-columns: minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(
      /\.application\.d6e2-health-model-builder\s+\.window-content\s*\{[^}]*overflow: hidden/s,
    );
    expect(styles).toMatch(
      /\.d6e2-setting-profile-scroll\s*\{[^}]*overflow-x: hidden;[^}]*overflow-y: auto/s,
    );
    expect(styles).not.toMatch(
      /\.d6e2-health-model-(?:advanced|damage-results|delete-flow|simulator|transition-matrix)[^{]*\{[^}]*overflow-[xy]: auto/s,
    );
  });

  it("keeps stable ordered states operable without drag precision", () => {
    expect(template).toContain("<ol");
    expect(template).toContain('data-direction="up"');
    expect(template).toContain('data-direction="down"');
    expect(template).toContain('aria-live="polite"');
    expect(application).toContain("D6E2.Settings.HealthModel.Moved");
    expect(application).toContain("#renderAndRestoreFocus");
    expect(styles).toMatch(
      /:is\(\.d6e2-health-result-order, \.d6e2-health-model-state-order\)[^{]*button\s*\{[^}]*width:\s*var\(--d6e2-health-order-control-size\);[^}]*height:\s*var\(--d6e2-health-order-control-size\)/s,
    );
    expect(template).toContain("{{disabled state.published}}");
    expect(template).toContain('name="state.{{state.index}}.description"');
    expect(template).toContain(">{{state.description}}</textarea>");
    expect(template).not.toContain("{{{state.description}}}");
    expect(application).toContain(
      "description: value(`state.${index}.description`)",
    );
  });

  it("keeps Guided and Exact views nondestructive with explicit generation review", () => {
    expect(application).not.toMatch(
      /this\.#advanced\s*\?[^:]+:\s*generateMonotonicDamageTransitions/s,
    );
    expect(application).toContain("withHealthStatesPreservingTransitions");
    expect(application).toContain("sameTransitionCells");
    expect(application).toContain("proposeHealthTransitionGeneration");
    for (const action of [
      "generateRules",
      "keepExactRules",
      "applyGeneratedRules",
      "duplicateGeneratedRules",
    ]) {
      expect(template).toContain(`data-action="${action}"`);
    }
    expect(template).toContain("d6e2-health-model-advanced");
    expect(template).toContain("d6e2-health-model-transition-matrix");
    expect(template).toContain("d6e2-health-model-transition-rows");
    expect(styles).toMatch(
      /@container \(max-width: 920px\)[^]*\.d6e2-health-model-transition-head\s*\{[^}]*display: none[^]*\.d6e2-health-model-transition-rows fieldset\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^]*@container \(max-width: 720px\)[^]*\.d6e2-health-model-transition-rows fieldset\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s,
    );
    expect(application).toContain("ApplyGeneratedConfirm");
    expect(application).toContain("changeCount");
    expect(template).toContain("{{generation.applyLabel}}");
    expect(template).toContain('class="d6e2-generated-apply"');
    expect(styles).toContain(".d6e2-generated-apply");
    expect(template).toContain("{{change.description}}");
    expect(template).not.toContain("change.currentStateId");
    expect(template).not.toContain("change.outcomeId");
  });

  it("switches transition modes without losing scroll or focus context", () => {
    expect(application).toContain("#renderModeAndRestoreContext");
    expect(application).toMatch(
      /querySelector<HTMLElement>\(\s*"\.d6e2-setting-profile-scroll",?\s*\)/s,
    );
    expect(application).toContain(
      "const scrollTop = scrollOwner?.scrollTop ?? 0",
    );
    expect(application).toContain("restoredScrollOwner.scrollTop = scrollTop");
    expect(application).toContain("focus({ preventScroll: true })");
    expect(application).toContain(
      'await this.#renderModeAndRestoreContext("basicMode")',
    );
    expect(application).toContain(
      'await this.#renderModeAndRestoreContext("advancedMode")',
    );

    expect(template).toMatch(
      /class="d6e2-health-model-mode-switch"\s+role="group"/s,
    );
    expect(template).toMatch(
      /aria-label="\{\{localize\s+'D6E2\.Settings\.HealthModel\.TransitionMode'\}\}"/s,
    );
    expect(
      template.match(/aria-controls="d6e2-health-model-mode-content"/gu),
    ).toHaveLength(2);
    expect(template).toContain(
      'aria-describedby="d6e2-health-model-mode-help"',
    );
    expect(template).toContain('id="d6e2-health-model-mode-help"');
    expect(template).toContain('id="d6e2-health-model-mode-content"');
    expect(template).toContain('class="d6e2-health-model-proposal-action"');

    expect(styles).toMatch(
      /\.d6e2-health-model-mode-switch\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    const selectedModeRule =
      /\.d6e2-health-model-mode-switch\s+button\[aria-pressed="true"\]\s*\{(?<declarations>[^}]*)\}/s.exec(
        styles,
      )?.groups?.declarations;
    expect(selectedModeRule).toContain("font-weight: 800");
    expect(selectedModeRule).toContain("box-shadow:");
    expect(styles).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-health-model-proposal-action\s*\{[^}]*width:\s*100%/s,
    );

    expect(translations["D6E2.Settings.HealthModel.AdvancedTransitions"]).toBe(
      "Transition rules",
    );
    expect(translations["D6E2.Settings.HealthModel.TransitionMode"]).toBe(
      "Transition editing mode",
    );
    expect(translations["D6E2.Settings.HealthModel.GuidedModeHelp"]).toMatch(
      /hides the cell-by-cell matrix/i,
    );
    expect(translations["D6E2.Settings.HealthModel.AdvancedModeHelp"]).toMatch(
      /every current-state and damage-result transition/i,
    );
  });

  it("exposes damage bands, provenance, and a preview-only live simulator", () => {
    expect(template).toContain("d6e2-health-damage-results");
    expect(template).toContain('name="result.{{result.index}}.minimum"');
    expect(template).toContain("result.openEnded");
    expect(template).toContain("d6e2-health-model-provenance");
    expect(template).toContain('data-action="simulate"');
    expect(template).toContain('aria-live="polite"');
    expect(application).toContain("simulateHealthModelDamage");
    expect(application).toContain("healthSimulationRuleSource");
    expect(template).toContain("simulationUsesDifference");
    expect(template).toContain("simulation.currentState");
    expect(template).toContain("simulation.incomingResult");
    expect(template).toContain("simulation.appliedRule");
    expect(template).toContain("simulation.nextState");
    expect(template).not.toContain('name="simulation.complication"');
    expect(template).not.toContain('name="simulation.killingBlow"');
  });

  it("authors 2–8 ordered damage results without drag precision or implicit matrix generation", () => {
    for (const action of [
      "addDamageResult",
      "moveDamageResult",
      "removeDamageResult",
    ]) {
      expect(template).toContain(`data-action="${action}"`);
      expect(application).toContain(`${action}: this.#${action}`);
    }
    expect(template).toContain('name="result.{{result.index}}.id"');
    expect(template).toContain("{{disabled result.published}}");
    expect(application).toContain(
      "withHealthDamageResultsPreservingTransitions",
    );
    expect(application).toContain(
      "withoutHealthDamageResultPreservingTransitions",
    );
    expect(application).toContain("D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS");
    expect(application).toContain("D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS");
    expect(styles).toContain("--d6e2-health-order-control-size: 2.25rem;");
    expect(application).toContain("this.#proposal = null");
  });

  it.each([2, 8])(
    "renders one ordered result and Exact matrix surface for %i authored outcomes",
    (outcomeCount) => {
      const damageResults = Array.from(
        { length: outcomeCount },
        (_, index) => ({
          canRemove: true,
          developerId: `result-${index + 1}`,
          displayLabel: `Result ${index + 1}`,
          first: index === 0,
          idErrorId: `id-error-${index}`,
          idId: `id-${index}`,
          index,
          isBand: true,
          label: `Result ${index + 1}`,
          labelErrorId: `label-error-${index}`,
          labelId: `label-${index}`,
          last: index === outcomeCount - 1,
          lowerOpenEnded: index === 0,
          maximum: index === outcomeCount - 1 ? undefined : index,
          maximumErrorId: `max-error-${index}`,
          maximumId: `max-${index}`,
          minimum: index === 0 ? Number.MIN_SAFE_INTEGER : index,
          minimumErrorId: `min-error-${index}`,
          minimumId: `min-${index}`,
          openEnded: index === outcomeCount - 1,
          published: false,
        }),
      );
      const html = Handlebars.compile(template)({
        advanced: true,
        damageResults,
        deletion: { replacementModels: [], stateMappings: [] },
        errors: [],
        model: { track: {} },
        outcomeCount,
        outcomes: damageResults.map(({ developerId, displayLabel }) => ({
          id: developerId,
          label: displayLabel,
        })),
        references: [],
        removedStates: [],
        simulationOutcomes: [],
        simulationStates: [],
        states: [],
        warnings: [],
      });
      expect(html.match(/data-outcome-id="result-/gu)).toHaveLength(
        outcomeCount * 4,
      );
      expect(html.match(/name="result\.\d+\.label"/gu)).toHaveLength(
        outcomeCount,
      );
      expect(html.match(/name="result\.\d+\.id"/gu)).toHaveLength(outcomeCount);
    },
  );

  it("renders only simulator controls consumed by the selected strategy", () => {
    const render = (simulationUsesDifference: boolean): string =>
      Handlebars.compile(template)({
        advanced: false,
        damageResults: [],
        deletion: { replacementModels: [], stateMappings: [] },
        errors: [],
        model: { track: {} },
        outcomes: [],
        publishedModel: false,
        references: [],
        removedStates: [],
        simulationOutcomes: [{ id: "wounded", label: "Wounded" }],
        simulationStates: [
          {
            id: "healthy",
            label: "Healthy",
            selectedAttribute: "selected",
          },
        ],
        simulationDamage: 7,
        simulationResistance: 7,
        simulationUsesDifference,
        states: [],
        warnings: [],
      });
    const band = render(true);
    expect(band).toContain('name="simulation.damage"');
    expect(band).toContain('name="simulation.resistance"');
    expect(band).toContain('value="7"');
    expect(band).toMatch(/value="healthy"\s+selected/u);
    expect(band).not.toContain('name="simulation.incoming"');
    const strategy = render(false);
    expect(strategy).toContain('name="simulation.incoming"');
    expect(strategy).not.toContain('name="simulation.damage"');
    expect(strategy).not.toContain('name="simulation.resistance"');
  });

  it("preserves simulator selections and renders an exact zero difference", () => {
    const html = Handlebars.compile(template)({
      advanced: false,
      damageResults: [],
      deletion: { replacementModels: [], stateMappings: [] },
      errors: [],
      model: { track: {} },
      outcomes: [],
      publishedModel: false,
      references: [],
      removedStates: [],
      simulation: {
        appliedRule: "Exact transition matrix",
        currentState: "Wounded",
        difference: "Damage 7 − Resistance 7 = 0",
        hasDifference: true,
        incomingResult: "Wounded",
        nextState: "Critical",
      },
      simulationDamage: 7,
      simulationOutcomes: [],
      simulationResistance: 7,
      simulationStates: [
        { id: "healthy", label: "Healthy", selectedAttribute: "" },
        { id: "wounded", label: "Wounded", selectedAttribute: "selected" },
      ],
      simulationUsesDifference: true,
      states: [],
      warnings: [],
    });
    expect(html).toContain('name="simulation.damage"');
    expect(html).toContain('value="7"');
    expect(html).toMatch(/value="wounded"\s+selected/u);
    expect(html).toMatch(/Damage 7 − Resistance 7 .* 0/u);
  });

  it("preserves attempted simulator inputs when Preview reports an error", () => {
    expect(application).toContain("#simulationInput");
    expect(application).toMatch(
      /this\.#simulationInput\s*=\s*\{[^}]*currentStateId[^}]*damage[^}]*incomingResultId[^}]*resistance[^}]*\};[^]*try\s*\{/s,
    );
    expect(application).toContain("healthSimulationInputProjection");
    expect(editorState).toContain("input?.currentStateId");
    expect(editorState).toContain("input?.damage");
    expect(editorState).toContain("input.incomingResultId");
    expect(editorState).toContain("input?.resistance");

    const html = Handlebars.compile(template)({
      advanced: false,
      damageResults: [],
      deletion: { replacementModels: [], stateMappings: [] },
      errors: [
        {
          id: "d6e2-health-model-error-0",
          message: "Damage and Resistance must be integers.",
          targetId: "d6e2-health-simulator",
        },
      ],
      model: { track: {} },
      outcomes: [],
      publishedModel: false,
      references: [],
      removedStates: [],
      simulation: null,
      simulationDamage: "7.5",
      simulationOutcomes: [
        { id: "wounded", label: "Wounded", selectedAttribute: "selected" },
      ],
      simulationResistance: "7",
      simulationStates: [
        { id: "healthy", label: "Healthy", selectedAttribute: "" },
        { id: "wounded", label: "Wounded", selectedAttribute: "selected" },
      ],
      simulationUsesDifference: true,
      states: [],
      warnings: [],
    });
    expect(html).toContain('name="simulation.damage"');
    expect(html).toContain('value="7.5"');
    expect(html).toContain('name="simulation.resistance"');
    expect(html).toContain('value="7"');
    expect(html).toMatch(/value="wounded"\s+selected/u);
    expect(html).toContain("Damage and Resistance must be integers.");
  });

  it("keeps stable IDs and predicate tokens inside Developer details", () => {
    expect(template).toMatch(
      /<details class="d6e2-health-model-developer">[^]*<code>\{\{result\.developerId\}\}<\/code>/s,
    );
    expect(template).toMatch(
      /<details class="d6e2-health-model-developer">[^]*name="state\.\{\{state\.index\}\}\.id"/s,
    );
    expect(template).not.toContain(
      "<strong><code>{{result.id}}</code></strong>",
    );
    expect(template).not.toContain(
      '<p class="d6e2-health-result-predicate">{{result.predicate}}</p>',
    );
  });

  it("localizes ordinary ownership, strategy, warning, and deletion copy", () => {
    for (const key of [
      "D6E2.Settings.HealthModel.OwnershipHelp",
      "D6E2.Settings.HealthModel.StrategySecondEdition",
      "D6E2.Settings.HealthModel.StrategyOpenD6",
      "D6E2.Settings.HealthModel.WarningUnreachable",
      "D6E2.Settings.HealthModel.WarningSkipsStates",
      "D6E2.Settings.HealthModel.DeleteMappingSummary",
      "D6E2.Settings.HealthModel.GeneratedCopyLabel",
      "D6E2.Settings.HealthModel.NewState",
    ]) {
      expect(translations[key]).toBeTruthy();
      expect(`${application}\n${editorState}`).toContain(key);
    }
    expect(application).not.toContain(
      '"Health Models own mechanics; Rules Profiles select a model; Setting Profiles override presentation labels only."',
    );
    expect(application).not.toContain('label: "Second Edition outcomes"');
    expect(application).not.toContain('label: "Open D6 outcomes"');
    expect(application).not.toContain(
      "is unreachable from damage transitions.",
    );
    expect(application).not.toContain("has a transition that skips states.");
    expect(application).toMatch(/localize\(\s*source\?\.label/s);
    expect(application).toMatch(/localize\(\s*target\?\.label/s);
  });

  it("surfaces validation and explicit published-state replacements", () => {
    expect(template).toContain('role="alert"');
    expect(template).toContain("aria-errormessage");
    expect(template).toContain('name="replacement.{{removed.id}}"');
    expect(application).toContain('querySelector<HTMLElement>(":invalid")');
    expect(application).toContain("#advancedOpen = true");
    expect(application).toContain("worldHealthModelReferences");
    expect(application).toContain("DialogV2.wait<boolean>");
    expect(application).toContain("worldHealthStateImpacts");
    expect(template).toContain('data-action="viewReferences"');
    expect(template).toContain("reference.label");
    expect(template).toContain("removed.actorCount");
    expect(template).toContain("d6e2-health-delete-flow");
    expect(template).toContain('name="delete.replacementModel"');
    expect(template).toContain('name="delete.state.{{state.id}}"');
    expect(template).toContain('data-action="revealDeleteFlow"');
    expect(application).toContain("#revealDeleteFlow");
    expect(application).toContain(
      "healthModelCloseRequiresDiscardConfirmation",
    );
    expect(application).toContain(
      "committedSaveClose: this.#committedSaveClose",
    );
    expect(application).toContain("readCurrentFingerprint");
    expect(application).toContain("referenceLabels.join");
    expect(application).toContain("mappingLines.join");
    expect(application).toContain("DeleteStateReplacementRequired");
    expect(application).not.toMatch(
      /replacementModels\.find\([^]*\)\s*\?\?\s*replacementModels\[0\]/s,
    );
  });

  it("keeps the collapsed deletion workflow out of ordinary Save validation", () => {
    const html = Handlebars.compile(template)({
      advanced: false,
      damageResults: [],
      deletion: {
        replacementModels: [
          {
            id: "replacement.health.model",
            label: "Replacement",
            selectedAttribute: "",
          },
        ],
        stateMappings: [
          {
            actorCount: 1,
            id: "healthy",
            label: "Healthy",
            options: [
              {
                id: "healthy",
                label: "Healthy",
                selectedAttribute: "",
              },
            ],
          },
        ],
      },
      errors: [],
      model: { track: {} },
      outcomes: [],
      publishedModel: true,
      references: [{ label: "QA Rules Profile" }],
      removedStates: [],
      simulationOutcomes: [],
      simulationStates: [],
      states: [],
      warnings: [],
    });
    const replacement =
      /<select[^>]*name="delete\.replacementModel"[^>]*>/u.exec(html)?.[0];
    const mapping = /<select[^>]*name="delete\.state\.healthy"[^>]*>/u.exec(
      html,
    )?.[0];

    expect(replacement).toBeTruthy();
    expect(mapping).toBeTruthy();
    expect(replacement).toContain('aria-required="true"');
    expect(mapping).toContain('aria-required="true"');
    expect(replacement).not.toMatch(/(?:^|\s)required(?:\s|=|>)/u);
    expect(mapping).not.toMatch(/(?:^|\s)required(?:\s|=|>)/u);
    expect(application).toContain("if (!replacementModelId)");
    expect(application).toContain("if (missingState)");
  });

  it("links each editable damage-band boundary to its exact error target", () => {
    expect(template).toContain('id="{{result.minimumId}}"');
    expect(template).toContain('aria-errormessage="{{result.minimumErrorId}}"');
    expect(template).toContain('id="{{result.maximumId}}"');
    expect(template).toContain('aria-errormessage="{{result.maximumErrorId}}"');
    expect(application).toContain("healthDamageResultErrorTarget");
    expect(application).toContain('return "d6e2-health-generation-review"');
    expect(template).toContain('id="{{transition.controlId}}"');
    expect(template).toContain('aria-errormessage="{{transition.errorId}}"');
    expect(application).toContain("healthTransitionErrorTarget");
    expect(application).toContain("healthTransitionControlId");
    expect(application).toContain(
      "this.element.querySelector<HTMLElement>(`#${targetId}`)",
    );
  });

  it("keeps predicate result counts engine-owned and explains the disabled controls", () => {
    expect(application).toContain("canChangeHealthDamageResultCount");
    expect(application).toMatch(
      /canRemove:\s*canChangeHealthDamageResultCount\(this\.#draft\)/s,
    );
    expect(template).toContain("damageResultSetHelp");
    expect(
      translations["D6E2.Settings.HealthModel.PredicateResultSetHelp"],
    ).toMatch(/rename and reorder.*cannot be added or removed/iu);
  });

  it("rerenders an explicit unpublished outcome rekey before later actions", () => {
    expect(application).toContain("#outcomeIdChange");
    expect(application).toContain("rekeyHealthDamageResult");
    expect(application).toContain("target.dataset.outcomeIndex");
    expect(template).toContain('data-outcome-index="{{result.index}}"');
  });

  it("keeps one scroll owner and gives builder actions a 44px target", () => {
    expect(styles).not.toMatch(
      /\.d6e2-health-generation-review ul\s*\{[^}]*(?:max-height|overflow:\s*auto)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s+:where\(button, select, input:not\(\[type="hidden"\]\):not\(\[type="checkbox"\]\)\)\s*\{[^}]*min-height:\s*var\(--d6e2-health-control-min-size\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell summary\s*\{[^}]*min-height:\s*var\(--d6e2-health-control-min-size\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-state-checks\s+input\[type="checkbox"\]\s*\{[^}]*appearance:\s*auto;[^}]*width:\s*var\(--d6e2-health-checkbox-size\);[^}]*height:\s*var\(--d6e2-health-checkbox-size\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-state-checks\s+label\.is-check\s*\{[^}]*min-height:\s*var\(--d6e2-health-control-min-size\)/s,
    );
  });

  it("uses one measured repeated-row grammar for results and states", () => {
    for (const className of [
      "d6e2-health-result-content",
      "d6e2-health-result-fields",
      "d6e2-health-state-primary",
      "d6e2-health-state-properties",
      "d6e2-health-state-checks",
      "d6e2-health-state-remove",
    ]) {
      expect(template).toContain(className);
    }
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s*> \.d6e2-setting-profile-scroll\s*\{[^}]*gap:\s*0/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell[^}]*> \.d6e2-settings-section:not\(\.d6e2-health-delete-flow\)\s*\{[^}]*border:\s*0;[^}]*border-top:\s*1px solid var\(--od6-line\);[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s+\.d6e2-setting-profile-grid\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent/s,
    );
    expect(styles).toMatch(
      /:is\(\s*\.d6e2-health-damage-results\s*> ol > li,\s*\.d6e2-health-model-states\s*> li\s*\)\s*\{[^}]*border:\s*0;[^}]*border-top:\s*1px solid var\(--od6-line\);[^}]*border-radius:\s*0;[^}]*background:\s*transparent/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s*\{[^}]*--d6e2-health-field-gap:\s*0\.5rem;[^}]*--d6e2-health-control-min-size:\s*2\.75rem;[^}]*--d6e2-health-component-gap:\s*0\.75rem;[^}]*--d6e2-health-row-padding-block:\s*0\.875rem;[^}]*--d6e2-health-order-control-size:\s*2\.25rem/s,
    );
    expect(styles).toMatch(
      /:is\(\.d6e2-health-damage-results > ol > li, \.d6e2-health-model-states > li\)\s*\{[^}]*grid-template-columns:\s*var\(--d6e2-health-order-control-size\) minmax\(0, 1fr\);[^}]*column-gap:\s*var\(--d6e2-health-component-gap\);[^}]*padding:\s*var\(--d6e2-health-row-padding-block\) 0\.125rem/s,
    );
    expect(styles).toMatch(
      /:is\(\.d6e2-health-result-order, \.d6e2-health-model-state-order\)\s+button\s*\{[^}]*width:\s*var\(--d6e2-health-order-control-size\);[^}]*min-width:\s*var\(--d6e2-health-order-control-size\);[^}]*height:\s*var\(--d6e2-health-order-control-size\);[^}]*min-height:\s*var\(--d6e2-health-order-control-size\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-field\s*\{[^}]*display:\s*grid[^}]*row-gap:\s*var\(--d6e2-health-field-gap\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-field\s*>\s*:is\([^}]*input:not\(\[type="checkbox"\]\):not\(\[type="hidden"\]\)[^}]*select[^}]*textarea[^}]*output[^}]*\)\s*\{[^}]*padding:\s*var\(--d6e2-health-control-padding-block\)\s+var\(--d6e2-health-control-padding-inline\)/s,
    );

    const fieldLabels = [
      ...template.matchAll(/<label(?:\s+class="([^"]*)")?\s*>/gu),
    ];
    expect(fieldLabels.length).toBeGreaterThan(20);
    for (const [, classNames = ""] of fieldLabels) {
      expect(classNames).toMatch(
        /(?:^|\s)(?:d6e2-health-field|is-check)(?:\s|$)/u,
      );
    }
    expect(styles).toMatch(
      /\.d6e2-health-result-content\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto;[^}]*gap:\s*var\(--d6e2-health-field-gap\) var\(--d6e2-health-component-gap\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-result-fields\s*\{[^}]*grid-template-columns:\s*minmax\(160px, 1fr\)\s*repeat\(2, minmax\(88px, 112px\)\)\s*minmax\(220px, 1\.35fr\);[^}]*gap:\s*var\(--d6e2-health-component-gap\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-state-primary\s*\{[^}]*grid-template-columns:\s*minmax\(180px, 0\.7fr\) minmax\(260px, 1\.3fr\) auto;[^}]*gap:\s*var\(--d6e2-health-component-gap\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-state-properties\s*\{[^}]*grid-template-columns:\s*88px\s*minmax\(200px, 0\.9fr\)\s*minmax\(240px, 1\.1fr\)\s*auto;[^}]*gap:\s*var\(--d6e2-health-component-gap\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-state-penalty\s+input\s*\{[^}]*width:\s*var\(--d6e2-health-compact-field-width\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-developer\s*> summary\s*\{[^}]*border:\s*1px solid var\(--od6-line\);[^}]*border-radius:\s*6px;[^}]*font-size:\s*0\.78rem/s,
    );
    expect(styles).not.toMatch(
      /\.d6e2-health-model-developer\s*> summary\s*\{[^}]*text-transform:\s*uppercase/s,
    );
  });

  it("uses one valid responsive Exact control set without hidden required duplicates", () => {
    expect(styles).toMatch(
      /\.d6e2-health-model-transition-head[^}]*position: sticky/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 920px\)[^]*\.d6e2-health-model-transition-head\s*\{[^}]*display: none/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-state-primary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-state-properties\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\) auto/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-state-checks\s*\{[^}]*grid-column:\s*1 \/ 3/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-model-developer\s*\{[^}]*grid-column:\s*3/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-health-state-properties\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-health-state-properties[^]*:is\(\.d6e2-health-state-checks, \.d6e2-health-model-developer\)\s*\{[^}]*grid-column:\s*1 \/ -1/s,
    );
    expect(styles).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-health-result-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s,
    );
    expect(template).toContain(
      "--d6e2-health-outcome-columns: {{outcomeCount}}",
    );
    expect(styles).toContain(
      "repeat(var(--d6e2-health-outcome-columns), minmax(0, 1fr))",
    );
    expect(styles).not.toMatch(
      /\.d6e2-health-model-transition-(?:head|rows)[^}]*repeat\(5,/s,
    );
    expect(styles).not.toMatch(
      /\.d6e2-health-model-transition-matrix\s*\{[^}]*overflow:\s*clip/s,
    );
  });

  it("composes identity, disclosure, and simulator from explicit layout variants", () => {
    expect(template).toContain(
      'class="d6e2-setting-profile-grid d6e2-health-identity-grid"',
    );
    expect(template).toContain(
      'class="d6e2-setting-profile-grid d6e2-health-simulator-controls"',
    );
    expect(styles).toMatch(
      /\.d6e2-health-identity-grid\s*>\s*\.d6e2-health-model-developer\s*\{[^}]*justify-self:\s*end/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-advanced\s*>\s*summary\s*\{[^}]*justify-content:\s*space-between;[^}]*padding:\s*var\(--d6e2-health-field-gap\) var\(--d6e2-health-component-gap\);[^}]*list-style:\s*none/s,
    );
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s+\.d6e2-health-simulator-controls\s*\{[^}]*grid-template-columns:\s*minmax\(16rem, 1fr\)\s*repeat\(2, minmax\(var\(--d6e2-health-compact-field-width\), 10rem\)\)/s,
    );
  });

  it.each([2, 5, 6, 8])(
    "renders one unclipped Exact control surface for %i outcomes above and below 720px",
    (outcomeCount) => {
      const outcomes = Array.from({ length: outcomeCount }, (_, index) => ({
        id: `outcome-${index}`,
        label: `Outcome ${index + 1}`,
      }));
      const state = {
        displayLabel: "Healthy",
        id: "healthy",
        transitions: outcomes.map((outcome) => ({
          outcome: outcome.id,
          options: [
            {
              id: "healthy",
              label: "Healthy",
              selectedAttribute: "selected",
            },
          ],
          semanticLabel: `Healthy + ${outcome.label} → Healthy`,
          unresolved: false,
        })),
      };
      const html = Handlebars.compile(template)({
        advanced: true,
        damageResults: [],
        deletion: { replacementModels: [], stateMappings: [] },
        errors: [],
        model: { track: {} },
        outcomeCount,
        outcomes,
        publishedModel: false,
        references: [],
        removedStates: [],
        simulationOutcomes: [],
        simulationStates: [state],
        states: [state],
        warnings: [],
      });

      expect(html).toContain(`--d6e2-health-outcome-columns: ${outcomeCount}`);
      expect(html.match(/d6e2-health-model-transition-matrix/gu)).toHaveLength(
        1,
      );
      expect(html.match(/name="transition\.healthy\./gu)).toHaveLength(
        outcomeCount,
      );
      for (const width of [921, 920, 720]) {
        const layout =
          width > 920
            ? /\.d6e2-health-model-transition-head\s*\{[^}]*repeat\(var\(--d6e2-health-outcome-columns\), minmax\(0, 1fr\)\)/s
            : width > 720
              ? /@container \(max-width: 920px\)[^]*\.d6e2-health-model-transition-rows fieldset\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s
              : /@container \(max-width: 720px\)[^]*\.d6e2-health-model-transition-rows fieldset\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s;
        expect(styles).toMatch(layout);
        expect(html.match(/d6e2-health-model-transition-rows/gu)).toHaveLength(
          1,
        );
      }
    },
  );

  it("renders seven-state exact semantics without relying on proportional row indexes", () => {
    const outcomes = [
      "staggered",
      "stunned",
      "wounded",
      "mortally-wounded",
      "dead",
    ];
    const states = [
      "Healthy",
      "Bruised",
      "Wounded",
      "Serious",
      "Critical",
      "Incapacitated",
      "Dead",
    ].map((label, index) => ({
      canRemove: true,
      displayLabel: label,
      id: label.toLocaleLowerCase(),
      index,
      label,
      transitions: outcomes.map((outcome) => ({
        outcome,
        semanticLabel: `${label} + ${outcome} → Wounded`,
        unresolved: label === "Critical",
        options: [
          {
            id: "wounded",
            label: "Wounded",
            selectedAttribute: label === "Critical" ? "" : "selected",
          },
        ],
      })),
    }));
    const html = Handlebars.compile(template)({
      advanced: true,
      damageResults: [],
      deletion: { replacementModels: [], stateMappings: [] },
      errors: [],
      model: { track: {} },
      outcomes: outcomes.map((id) => ({ id, label: id })),
      references: [],
      removedStates: [],
      simulationOutcomes: [],
      simulationStates: states,
      states,
      warnings: [],
    });
    expect(html).toContain('aria-label="Wounded + wounded → Wounded"');
    expect(html).toMatch(/<legend\s*>Critical<\/legend>/u);
    expect(html.match(/name="transition\.critical\.wounded"/gu)).toHaveLength(
      1,
    );
    expect(
      html.match(/name="transition\.critical\.wounded"[^>]*required/gu),
    ).toHaveLength(1);
    expect(html).toMatch(
      /name="transition\.critical\.wounded"[^>]*required[^]*value=""[^]*selected/u,
    );
    for (const width of [721, 720]) {
      const resolved = html.replace(
        /(<select[^>]*name="transition\.critical\.wounded"[^>]*>)[^]*?(<\/select>)/u,
        `$1<option value="wounded" selected>Wounded</option>$2`,
      );
      expect(width).toBeGreaterThan(0);
      expect(
        resolved.match(/name="transition\.critical\.wounded"/gu),
      ).toHaveLength(1);
      expect(resolved).toMatch(
        /name="transition\.critical\.wounded"[^>]*required[^]*value="wounded" selected/u,
      );
    }
    expect(template).not.toContain("d6e2-health-model-transition-table");
    expect(html).not.toContain("proportional");
  });

  it("exposes every health model through a dedicated world library", () => {
    const libraryRule =
      /\.application\.d6e2-health-model-library\s*\{(?<declarations>[^}]*)\}/u.exec(
        styles,
      )?.groups?.declarations;

    expect(libraryApplication).toContain("availableHealthModels");
    expect(libraryApplication).toContain("#allModels");
    expect(libraryApplication).toContain("#uniqueModelId");
    expect(libraryApplication).toContain("saveWorldHealthModel");
    expect(libraryApplication).toContain("deleteWorldHealthModel");
    for (const action of ["createModel", "editModel", "duplicateModel"]) {
      expect(libraryTemplate).toContain(`data-action="${action}"`);
    }
    expect(libraryTemplate).toContain("missingSelected");
    expect(libraryTemplate).toContain("model.referenceCount");
    expect(styles).toContain(".d6e2-health-model-library-row");
    expect(libraryApplication).toContain(
      "position: { height: 720, width: 920 }",
    );
    expect(libraryApplication).toContain("resizable: true");
    expect(libraryApplication).not.toMatch(
      /game\.settings\.(?:get|set)[^]*geometry/iu,
    );
    expect(libraryRule).toContain("min-width: min(520px, calc(100vw - 32px))");
    expect(libraryRule).toContain("max-width: calc(100vw - 32px)");
    expect(libraryRule).toContain("min-height: min(480px, calc(100vh - 48px))");
    expect(libraryRule).toContain("max-height: calc(100vh - 48px)");
    expect(libraryRule).not.toContain("!important");
    expect(styles).toMatch(
      /\.d6e2-health-model-library-shell\s*\{[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s,
    );
    expect(styles).toMatch(
      /\.d6e2-rules-profile-shell\s*\{[^}]*height: 100%;[^}]*min-height: 0/s,
    );
  });

  it("reuses the fixed-id ApplicationV2 editor after close and reopen", () => {
    expect(libraryApplication).toContain(
      "#editor: D6System2eHealthModelApplication | null = null",
    );
    expect(libraryApplication).toContain(
      "this.#editor ??= new D6System2eHealthModelApplication()",
    );
    expect(libraryApplication).toContain("render({ force: true })");
    expect(libraryApplication).not.toMatch(
      /new D6System2eHealthModelApplication\(\)[\s\S]*?\.render\(true\)/u,
    );
  });
});
