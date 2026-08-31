import { formatPipScore, type D6RulesProfileV4 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";
import {
  SECOND_EDITION_MODULE_CATALOG,
  SHARED_SETTINGS,
  SHARED_SETTING_KEYS,
  secondEditionSettingsByGroup,
  settingsForCategory,
  type SecondEditionModuleGenre,
  type SettingCategory,
  type SystemSettingDefinition,
  SECOND_EDITION_OPTION_KEYS,
  FIRST_EDITION_OPTION_KEYS,
  TYFUSIUS_HOMEBREW_SETTING_KEYS,
  tyfusiusHomebrewSettingsForEdition,
} from "./settings-catalog";
import { currentSecondEditionCampaignProfile } from "./campaign-profile";
import { currentRulesRuntime } from "./rules-runtime";
import {
  configuredSecondEditionHeroPointStrategy,
  heroicHeroPointsCarryOver,
} from "./hero-points";
import { refreshHeroicHeroPointsForNewSession } from "../foundry/hero-point-service";
import { currentFirstEditionDamageMode } from "./setting-values";
import { campaignPackageRegistry } from "../registries/campaign-packages";
import { contentPackageRegistry } from "../registries/content-packages";
import {
  FIRST_EDITION_COMPANION_PACKAGE_SETTING,
  FIRST_EDITION_GENRE_PACKAGE_SETTING,
  currentFirstEditionCampaignPackages,
} from "./campaign-packages";
import { currentRulesSelection } from "./rules-selection";
import { restoreRecommendedEditionDefaults } from "./edition-defaults";
import {
  bundledRulesStrategyChoices,
  createWorldRulesProfile,
  currentConfiguredRulesProfile,
  evaluateRulesPredicate,
  rulesProfileDiagnostics,
  saveNewWorldRulesProfile,
  saveWorldRulesProfile,
  selectRulesProfile,
} from "./rules-profile-library";
import { availableHealthModelsForProfile } from "./health-model-library";
import { D6System2eHealthModelLibraryApplication } from "./health-model-library-application";
import { D6System2eMatchingEvaluatorApplication } from "./matching-evaluator-application";
import {
  applyRulesProfileEditorFields,
  RULES_PROFILE_EDITABLE_MECHANIC_SLOTS,
} from "./rules-profile-editing";
import {
  buildMatchingHomebrewContext,
  captureMatchingRewardFields,
} from "./rules-profile-matching-editing";
import {
  D6_NEXUS_MATCHING_DETECTOR_ID,
  matchingDetectorForProfile,
  worldMatchingDetectorId,
} from "../registries/matching-evaluators";
import {
  persistSystemSettingsSave,
  type SystemSettingSaveEntry,
} from "./settings-save";
import {
  HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY,
  HIDEOUT_PREREQUISITE_SETTING_KEY,
  HIDEOUT_SETTING_KEY,
  resolveHideoutSettingsDependency,
  type HideoutDependencyAction,
} from "./hideout-settings-dependency";
import { pipsRuntimeStrategy } from "./pip-rules";

const RULES_STRATEGY_LABELS: Readonly<
  Record<(typeof RULES_PROFILE_EDITABLE_MECHANIC_SLOTS)[number], string>
> = Object.freeze({
  actionEconomy: "ActionEconomy",
  activeDefenses: "ActiveDefenses",
  advancement: "Advancement",
  attributes: "Attributes",
  health: "Health",
  initiative: "Initiative",
  movement: "Movement",
  metaCurrency: "MetaCurrency",
  pips: "Pips",
  retries: "Retries",
  scale: "Scale",
  successEvaluator: "SuccessEvaluator",
  wildDie: "WildDie",
});

const CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "action-economy": "ActionEconomy",
  "advanced-skills": "AdvancedSkills",
  chases: "Chases",
  advancement: "Advancement",
  attributes: "Attributes",
  damage: "Damage",
  defenses: "Defenses",
  environments: "Environments",
  initiative: "Initiative",
  "meta-currency": "MetaCurrency",
  movement: "Movement",
  "narrative-features": "NarrativeFeatures",
  pips: "Pips",
  "ranked-features": "RankedFeatures",
  retries: "Retries",
  "success-evaluator": "SuccessEvaluator",
  "wild-die": "WildDie",
});

const CAPABILITY_STRATEGIES: Readonly<Record<string, string>> = Object.freeze({
  "d6e2.action-economy.segmented": "SecondEditionActionSegments",
  "d6e2.advancement.experience-points": "SecondEditionExperiencePoints",
  "d6e2.advancement.milestone": "SecondEditionMilestone",
  "d6e2.advancement.narrative": "SecondEditionNarrative",
  "d6e2.advancement.unselected": "SecondEditionAdvancementUnselected",
  "d6e2.attributes.campaign-profile": "SecondEditionAttributes",
  "d6e2.damage.conditions": "SecondEditionDamage",
  "d6e2.defenses.no-dodge": "NoDodgeRangeDifficulties",
  "d6e2.defenses.static": "StaticDefenses",
  "d6e2.initiative.basic": "SecondEditionBasicInitiative",
  "d6e2.initiative.contextual": "SecondEditionContextualInitiative",
  "d6e2.initiative.narrative": "SecondEditionNarrativeInitiative",
  "d6e2.initiative.simple": "SecondEditionSimpleInitiative",
  "d6e2.meta-currency.basic-hero-points": "BasicHeroPoints",
  "d6e2.meta-currency.classic-hero-points": "ClassicHeroPoints",
  "d6e2.meta-currency.heroic-hero-points": "HeroicHeroPoints",
  "d6e2.movement.segmented": "SecondEditionSegmentMovement",
  "d6e2.pips.module": "SecondEditionPipsModule",
  "d6e2.pips.whole-dice": "SecondEditionWholeDice",
  "d6e2.retries.doubling-down": "SecondEditionDoublingDown",
  "d6e2.success.strictly-greater": "StrictlyGreater",
  "d6e2.wild-die.advantage-complication": "SecondEditionWildDie",
  "d6e2.wild-die.basic": "SecondEditionBasicWildDie",
  "d6e2.wild-die.classic": "SecondEditionClassicWildDie",
  "d6e2.wild-die.simple": "SecondEditionSimpleWildDie",
  "open-d6.action-economy.flexible": "OpenD6FlexibleActionAllotment",
  "open-d6.action-economy.segmented": "OpenD6FlexibleActionAllotment",
  "open-d6.advancement.character-points": "CharacterPointAdvancement",
  "open-d6.attributes.six-attribute": "OpenD6Attributes",
  "open-d6.damage.body-points": "OpenD6Damage",
  "open-d6.damage.body-points-with-wounds": "OpenD6Damage",
  "open-d6.damage.wounds": "OpenD6Damage",
  "open-d6.defenses.active": "ActiveDefenseScheduler",
  "open-d6.initiative.perception": "OpenD6PerceptionInitiative",
  "open-d6.meta-currency.character-and-fate-points":
    "CharacterPointsFatePoints",
  "open-d6.movement.relative": "OpenD6RelativeMovement",
  "open-d6.movement.segmented": "OpenD6RelativeMovement",
  "open-d6.pips.classic": "OpenD6ClassicPips",
  "open-d6.retries.no-general-reroll": "OpenD6NoGeneralDoubleDown",
  "open-d6.success.meets-or-exceeds": "MeetsOrExceeds",
  "open-d6.wild-die.critical-one": "OpenD6WildDie",
  "second-edition-distance-track": "SecondEditionChases",
  "second-edition-environment-hazards": "SecondEditionEnvironments",
  "second-edition-contextual": "SecondEditionAdvancedSkills",
  "second-edition-contextual-extension": "SecondEditionAdvancedSkillsExtension",
  "second-edition-perks-flaws-talents": "SecondEditionRankedFeatures",
  "second-edition-troubles-assets": "SecondEditionNarrativeFeatures",
  "stored-inactive": "StoredInactive",
});

function pipsDependencySatisfied(
  strategyId: string,
  configuredModuleEnabled: boolean,
): boolean {
  return strategyId === "d6e2.pips.configured"
    ? configuredModuleEnabled
    : pipsRuntimeStrategy(strategyId).dependencies.rankedFeatures ===
        "satisfied";
}

const SettingsApplicationBase =
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
  );

interface SettingView {
  readonly available: boolean;
  readonly checked: boolean;
  readonly choices: readonly {
    readonly label: string;
    readonly selected: boolean;
    readonly value: string;
  }[];
  readonly hint: string;
  readonly inputType: "checkbox" | "number" | "text";
  readonly key: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly step?: number;
  readonly value: boolean | number | string;
  readonly unavailableReason: string;
  readonly homebrewCombinedActions: boolean;
  readonly homebrewSegmentedActions: boolean;
}

interface SecondEditionSettingGroupView {
  readonly className: string;
  readonly hint: string;
  readonly icon: string;
  readonly id: string;
  readonly kindLabel: string;
  readonly label: string;
  readonly pageReference: string;
  readonly settings: readonly SettingView[];
}

interface SecondEditionModuleCatalogEntryView {
  readonly dependencyLabel?: string;
  readonly familyLabel?: string;
  readonly hint: string;
  readonly id: string;
  readonly label: string;
  readonly pageReference: string;
  readonly settingGroupId?: string;
  readonly support: string;
  readonly supportLabel: string;
}

interface SecondEditionModuleCatalogGenreView {
  readonly entries: readonly SecondEditionModuleCatalogEntryView[];
  readonly id: SecondEditionModuleGenre;
  readonly label: string;
}

interface SettingsSummaryView {
  readonly active: boolean;
  readonly className: "is-active" | "is-inactive";
  readonly key: string;
  readonly label: string;
  readonly stateLabel: string;
}

interface SettingsTabView {
  readonly active: boolean;
  readonly className: string;
  readonly icon: string;
  readonly id: string;
  readonly label: string;
  readonly tabIndex: number;
}

interface VisibleSettingsFormContext {
  readonly focusedName: string;
  readonly focusedValue: string;
  readonly scrollTop: number;
  readonly values: FormData;
}

function settingView(definition: SystemSettingDefinition): SettingView {
  const storedValue = game.settings.get(SYSTEM_ID, definition.key) as
    boolean | number | string;
  const value =
    definition.key === FIRST_EDITION_OPTION_KEYS.bodyPoints
      ? currentFirstEditionDamageMode()
      : storedValue;
  const available = definition.availability
    ? evaluateRulesPredicate(
        definition.availability.assertion,
        currentConfiguredRulesProfile(),
      )
    : true;
  return {
    available,
    checked: value === true,
    choices: Object.entries(definition.choices ?? {}).map(
      ([choiceValue, label]) => ({
        label: game.i18n.localize(label),
        selected: String(value) === choiceValue,
        value: choiceValue,
      }),
    ),
    hint: game.i18n.localize(definition.hint),
    inputType:
      definition.type === "boolean"
        ? "checkbox"
        : definition.type === "number"
          ? "number"
          : "text",
    key: definition.key,
    label: game.i18n.localize(definition.name),
    homebrewCombinedActions:
      definition.key ===
      TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions,
    homebrewSegmentedActions:
      definition.key ===
      TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions,
    ...(definition.max === undefined ? {} : { max: definition.max }),
    ...(definition.min === undefined ? {} : { min: definition.min }),
    ...(definition.step === undefined ? {} : { step: definition.step }),
    value,
    unavailableReason: definition.availability
      ? game.i18n.localize(definition.availability.message)
      : "",
  };
}

function valueFromForm(
  definition: SystemSettingDefinition,
  object: Record<string, unknown>,
): boolean | number | string {
  const value = object[definition.key];
  if (definition.type === "boolean") return value === true;
  if (definition.type === "number") {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : Number(definition.default);
  }
  return typeof value === "string" ? value : String(definition.default);
}

abstract class D6System2eSettingsApplication extends SettingsApplicationBase {
  static readonly category: Extract<
    SettingCategory,
    "first-edition" | "second-edition"
  >;

  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/edition-settings.hbs`,
    },
  };

  #activeSettingsTab = "profile";
  #rulesDraft = structuredClone(currentConfiguredRulesProfile());
  #isNewRulesProfile = false;

  withRulesDraft(
    profile: D6RulesProfileV4,
    options: { readonly isNew?: boolean } = {},
  ): this {
    this.#rulesDraft = structuredClone(profile);
    this.#isNewRulesProfile = options.isNew === true;
    return this;
  }

  #captureRulesDraft(): readonly HTMLInputElement[] {
    const form = this.element as HTMLFormElement;
    const value = (name: string): string =>
      form
        .querySelector<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >(`[name="${name}"]`)
        ?.value.trim() ?? "";
    this.#rulesDraft = applyRulesProfileEditorFields(this.#rulesDraft, {
      description: value("profile.description"),
      label: value("profile.label") || this.#rulesDraft.label,
      strategies: Object.freeze({
        ...this.#rulesDraft.strategies,
        ...Object.fromEntries(
          RULES_PROFILE_EDITABLE_MECHANIC_SLOTS.map((slot) => [
            slot,
            value(`strategy.${slot}`) || this.#rulesDraft.strategies[slot],
          ]),
        ),
      }),
      tyfusiusD8ExplosiveDeviation:
        form.querySelector<HTMLInputElement>(
          '[name="profile.homebrew.tyfusiusD8ExplosiveDeviation"]',
        )?.checked === true,
    });
    const rewardCapture = captureMatchingRewardFields(this.#rulesDraft, form);
    this.#rulesDraft = structuredClone(rewardCapture.profile);
    const invalid: HTMLInputElement[] = [];
    invalid.push(...rewardCapture.invalid);
    const difficultyLadder = Object.freeze(
      this.#rulesDraft.difficultyLadder.map((entry) => {
        const labelInput = form.querySelector<HTMLInputElement>(
          `[name="difficulty.${entry.id}.label"]`,
        );
        const valueInput = form.querySelector<HTMLInputElement>(
          `[name="difficulty.${entry.id}.value"]`,
        );
        const label = labelInput?.value.trim() ?? entry.label;
        const raw = valueInput?.value.trim() ?? String(entry.value);
        const numeric = Number(raw);
        if (!label && labelInput) invalid.push(labelInput);
        if (!raw || !Number.isFinite(numeric)) {
          if (valueInput) invalid.push(valueInput);
        }
        return {
          ...entry,
          label: label || entry.label,
          value:
            raw && Number.isFinite(numeric) ? Math.trunc(numeric) : entry.value,
        };
      }),
    );
    this.#rulesDraft = { ...this.#rulesDraft, difficultyLadder };
    return invalid;
  }

  #captureVisibleFormContext(): VisibleSettingsFormContext {
    const focused = document.activeElement;
    return {
      focusedName:
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLSelectElement ||
        focused instanceof HTMLTextAreaElement
          ? focused.name
          : "",
      focusedValue:
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLSelectElement
          ? focused.value
          : "",
      scrollTop:
        this.element.querySelector<HTMLElement>(
          ".d6e2-settings-panel.is-active",
        )?.scrollTop ?? 0,
      values: new FormData(this.element as HTMLFormElement),
    };
  }

  #restoreVisibleFormContext(context: VisibleSettingsFormContext): void {
    const form = this.element as HTMLFormElement;
    for (const control of Array.from(form.elements)) {
      if (
        !(
          control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement ||
          control instanceof HTMLTextAreaElement
        ) ||
        !control.name
      ) {
        continue;
      }
      const values = context.values.getAll(control.name).map(String);
      if (
        control instanceof HTMLInputElement &&
        (control.type === "radio" || control.type === "checkbox")
      ) {
        control.checked = values.includes(control.value);
      } else if (values[0] !== undefined) {
        control.value = values[0];
      }
    }
    const panel = this.element.querySelector<HTMLElement>(
      ".d6e2-settings-panel.is-active",
    );
    if (panel) panel.scrollTop = context.scrollTop;
    const focused = Array.from(
      this.element.querySelectorAll<HTMLElement>("[name]"),
    ).find(
      (control) =>
        (control as HTMLInputElement).name === context.focusedName &&
        (context.focusedValue === "" ||
          (control as HTMLInputElement).value === context.focusedValue),
    );
    focused?.focus({ preventScroll: true });
  }

  readonly #rewardDraftChange = (event: Event): void => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      ) ||
      !target.closest("[data-matching-rewards]")
    ) {
      return;
    }
    if (
      target instanceof HTMLButtonElement &&
      target.matches("[data-remove-unavailable-reward]")
    ) {
      target
        .closest<HTMLElement>("[data-unavailable-reward]")
        ?.setAttribute("data-removed", "true");
      return;
    }
    const master = this.element.querySelector<HTMLInputElement>(
      '[name="homebrew.matchingRewards.enabled"]',
    );
    this.element
      .querySelector<HTMLElement>("[data-reward-configured]")
      ?.classList.toggle("is-collapsed", master?.checked !== true);
    const sentenceRow = target.closest<HTMLElement>(
      "[data-matching-reward-row]",
    );
    if (sentenceRow) {
      const sentence = sentenceRow.querySelector<HTMLElement>(
        "[data-reward-sentence]",
      );
      if (sentence) {
        sentence.textContent = game.i18n.format(
          "D6E2.Settings.RulesProfile.Rewards.RowSentence",
          {
            characterPointsLabel:
              sentenceRow.dataset.characterPointsLabel ?? "",
            cp:
              sentenceRow.querySelector<HTMLInputElement>("[data-reward-cp]")
                ?.value ?? "0",
            label: sentenceRow.dataset.patternLabel ?? "",
            meta:
              sentenceRow.querySelector<HTMLInputElement>("[data-reward-meta]")
                ?.value ?? "0",
            metaLabel: sentenceRow.dataset.metaLabel ?? "",
          },
        );
      }
    }
  };

  readonly #summaryChangeHandler = (): void => {
    for (const item of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-setting-summary-key]"),
    )) {
      const key = item.dataset.settingSummaryKey;
      if (!key) continue;
      const input = this.element.querySelector<HTMLInputElement>(
        `input[type="checkbox"][name="${key}"]`,
      );
      if (!input) continue;
      item.classList.toggle("is-active", input.checked);
      item.classList.toggle("is-inactive", !input.checked);
      item.setAttribute("aria-pressed", String(input.checked));
      const state = item.querySelector("span");
      if (state) {
        state.textContent = game.i18n.localize(
          input.checked
            ? "D6E2.Settings.Summary.Active"
            : "D6E2.Settings.Summary.Inactive",
        );
      }
    }
    this.#refreshAvailability();
  };

  #refreshAvailability(): void {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const definitions = [
      ...settingsForCategory(constructor.category),
      ...tyfusiusHomebrewSettingsForEdition(constructor.category),
    ];
    const byKey = new Map(
      definitions.map((definition) => [definition.key, definition]),
    );
    const readSetting = (key: string): unknown => {
      const input = this.element.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`[name="${key}"]`);
      const definition = byKey.get(key);
      if (!input || !definition) return game.settings.get(SYSTEM_ID, key);
      if (input instanceof HTMLInputElement && input.type === "checkbox")
        return input.checked;
      if (definition.type === "number") return Number(input.value);
      return input.value;
    };
    for (const definition of definitions) {
      if (!definition.availability) continue;
      const available = evaluateRulesPredicate(
        definition.availability.assertion,
        currentConfiguredRulesProfile(),
        readSetting,
      );
      const input = this.element.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`[name="${definition.key}"]`);
      if (!input) continue;
      input.disabled = !available;
      input
        .closest(".d6e2-settings-row")
        ?.classList.toggle("is-unavailable", !available);
      const requirement = this.element.querySelector<HTMLElement>(
        `#d6e2-requirement-${definition.key}`,
      );
      if (requirement) requirement.hidden = available;
    }
  }

  readonly #summaryClickHandler = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-setting-summary-key]",
    );
    const key = target?.dataset.settingSummaryKey;
    if (!key) return;
    const input = this.element.querySelector<HTMLInputElement>(
      `input[type="checkbox"][name="${key}"]`,
    );
    if (!input || input.disabled) return;
    input.click();
  };

  readonly #settingsTabClickHandler = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-settings-tab]",
    );
    const tabId = target?.dataset.settingsTab;
    if (!tabId) return;
    this.#activateSettingsTab(tabId, false);
  };

  readonly #settingsTabKeydownHandler = (event: KeyboardEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-settings-tab]",
    );
    if (!target) return;
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "button[data-settings-tab]",
      ),
    );
    const index = tabs.indexOf(target);
    if (index < 0) return;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (next?.dataset.settingsTab) {
      this.#activateSettingsTab(next.dataset.settingsTab, true);
    }
  };

  #activateSettingsTab(tabId: string, focus: boolean): void {
    const tabs = Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "button[data-settings-tab]",
      ),
    );
    const selected =
      tabs.find((tab) => tab.dataset.settingsTab === tabId) ?? tabs[0];
    const selectedId = selected?.dataset.settingsTab;
    if (!selected || !selectedId) return;
    this.#activeSettingsTab = selectedId;
    for (const tab of tabs) {
      const active = tab === selected;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-settings-panel]"),
    )) {
      const active = panel.dataset.settingsPanel === selectedId;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    }
    if (focus) selected.focus();
  }

  static readonly #scrollToModuleSettings = function (
    this: D6System2eSettingsApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const groupId = target.dataset.settingGroupId;
    if (!groupId) return;
    const form = target.closest("form");
    const destination = form?.querySelector<HTMLElement>(
      `[data-module-id="${groupId}"]`,
    );
    this.#activateSettingsTab("modules", false);
    destination?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  static readonly #refreshHeroicSession = async function (
    this: D6System2eSettingsApplication,
  ): Promise<void> {
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "refresh",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          label: game.i18n.localize("D6E2.HeroPointSession.Action"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.localize("D6E2.HeroPointSession.Confirm")}</p></div>`,
      modal: true,
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.HeroPointSession.Action") },
    });
    if (confirmed !== true) return;
    const count = await refreshHeroicHeroPointsForNewSession();
    ui.notifications.info(
      game.i18n.format("D6E2.HeroPointSession.Completed", { count }),
    );
  };

  static readonly #restoreRecommendedDefaults = async function (
    this: D6System2eSettingsApplication,
  ): Promise<void> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const edition = game.i18n.localize(
      constructor.category === "second-edition"
        ? "D6E2.Settings.GameMode.SecondEdition"
        : "D6E2.Settings.GameMode.OpenD6",
    );
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "restore",
          callback: () => true,
          class: "od6roll-submit",
          default: true,
          label: game.i18n.localize("D6E2.Settings.RecommendedDefaults.Action"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Settings.RecommendedDefaults.Confirm", { edition })}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Settings.RecommendedDefaults.Action"),
      },
    });
    if (confirmed !== true) return;
    const result = await restoreRecommendedEditionDefaults(
      constructor.category,
    );
    if (result.failed.length > 0) {
      console.error(
        `D6 System Second Edition | Failed to restore recommended defaults`,
        result.failed,
      );
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RecommendedDefaults.Failed"),
      );
    } else {
      ui.notifications.info(
        game.i18n.format("D6E2.Settings.RecommendedDefaults.Completed", {
          edition,
        }),
      );
    }
    await this.render({ force: true });
  };

  static readonly #manageHealthModels = function (
    this: D6System2eSettingsApplication,
  ): void {
    const invalid = this.#captureRulesDraft();
    if (invalid.length > 0) {
      this.#activateSettingsTab("difficulty", false);
      invalid[0]?.focus();
      return;
    }
    new D6System2eHealthModelLibraryApplication()
      .withProfile(this.#rulesDraft, {
        isNewProfile: this.#rulesDraft.source.kind !== "world",
        onChanged: (healthModels, selectedModelId) => {
          this.#rulesDraft = {
            ...this.#rulesDraft,
            healthModels: Object.freeze(healthModels),
            strategies: Object.freeze({
              ...this.#rulesDraft.strategies,
              health: selectedModelId,
            }),
          };
          const select = this.element.querySelector<HTMLSelectElement>(
            '[name="strategy.health"]',
          );
          if (select) {
            if (
              !Array.from(select.options).some(
                ({ value }) => value === selectedModelId,
              )
            ) {
              const model = availableHealthModelsForProfile(
                this.#rulesDraft,
              ).find(({ id }) => id === selectedModelId);
              select.add(
                new Option(model?.label ?? selectedModelId, selectedModelId),
              );
            }
            select.value = selectedModelId;
          }
        },
      })
      .render(true);
  };

  static readonly #reviewCombinations = function (
    this: D6System2eSettingsApplication,
  ): void {
    const visible = this.#captureVisibleFormContext();
    this.#captureRulesDraft();
    const detectorId =
      this.#rulesDraft.homebrew.matchingRewards?.find(({ enabled }) => enabled)
        ?.detectorId ??
      this.#rulesDraft.homebrew.matchingRewards?.[0]?.detectorId ??
      D6_NEXUS_MATCHING_DETECTOR_ID;
    const resolution = matchingDetectorForProfile(this.#rulesDraft, detectorId);
    if (!resolution) return;
    new D6System2eMatchingEvaluatorApplication()
      .withEvaluator(
        resolution.evaluator,
        this.#rulesDraft.matchingEvaluators,
        async (matchingEvaluators, selected) => {
          const prior = this.#rulesDraft.homebrew.matchingRewards?.find(
            (policy) => policy.detectorId === detectorId,
          );
          const replacementResolutionId = worldMatchingDetectorId(selected.id);
          this.#rulesDraft = {
            ...this.#rulesDraft,
            matchingEvaluators: Object.freeze(matchingEvaluators),
            homebrew: Object.freeze({
              ...this.#rulesDraft.homebrew,
              matchingRewards: Object.freeze([
                ...(this.#rulesDraft.homebrew.matchingRewards ?? []).filter(
                  (policy) => policy.detectorId !== detectorId,
                ),
                Object.freeze({
                  awards: prior?.awards ?? Object.freeze({}),
                  enabled: prior?.enabled ?? false,
                  evaluatorId: selected.id,
                  detectorId: replacementResolutionId,
                  version: 1 as const,
                }),
              ]),
            }),
          };
          await this.render({ force: true });
          this.#restoreVisibleFormContext(visible);
        },
      )
      .render(true);
  };

  static readonly #submit = async function (
    this: D6System2eSettingsApplication,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const definitions = [
      ...settingsForCategory(constructor.category),
      ...tyfusiusHomebrewSettingsForEdition(constructor.category),
    ];
    const assistanceDefinition = SHARED_SETTINGS.find(
      ({ key }) => key === SHARED_SETTING_KEYS.actionDeclarationAssistance,
    );
    const object = formData.object;

    const activeRulesProfile = currentConfiguredRulesProfile();
    const invalid = this.#captureRulesDraft();
    if (invalid.length > 0) {
      for (const input of invalid) input.setAttribute("aria-invalid", "true");
      this.#activateSettingsTab(
        invalid[0]?.closest("[data-matching-rewards]")
          ? "homebrew"
          : "difficulty",
        false,
      );
      invalid[0]?.focus();
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.DifficultyInvalid"),
      );
      return;
    }
    if (rulesProfileDiagnostics(this.#rulesDraft).length > 0) {
      this.#activateSettingsTab("mechanics", false);
      ui.notifications.warn(
        game.i18n.localize("D6E2.Settings.RulesProfile.DiagnosticsBlocked"),
      );
      return;
    }
    const rulesChanged =
      this.#isNewRulesProfile ||
      JSON.stringify(this.#rulesDraft) !== JSON.stringify(activeRulesProfile);

    if (constructor.category === "second-edition") {
      const submittedStrategy =
        object[SECOND_EDITION_OPTION_KEYS.heroPointStrategy];
      const strategy =
        typeof submittedStrategy === "string" ? submittedStrategy : "heroic";
      if (strategy === "classic") {
        object[SECOND_EDITION_OPTION_KEYS.wildDieStrategy] = "classic";
        object[SECOND_EDITION_OPTION_KEYS.advancementStrategy] =
          "experience-points";
      }
      if (strategy === "basic") {
        const starting = Math.trunc(
          Number(object[SECOND_EDITION_OPTION_KEYS.startingHeroPoints]) || 3,
        );
        object[SECOND_EDITION_OPTION_KEYS.startingHeroPoints] = Math.min(
          5,
          Math.max(3, starting),
        );
      }

      const submittedPips =
        object[SECOND_EDITION_OPTION_KEYS.pipsModule] === true;
      const storedPips =
        game.settings.get(SYSTEM_ID, SECOND_EDITION_OPTION_KEYS.pipsModule) ===
        true;
      const resolvedDependency = await resolveHideoutSettingsDependency(
        {
          hiddenBases:
            object[SECOND_EDITION_OPTION_KEYS.hiddenBasesModule] === true,
          perksFlawsTalents:
            object[SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule] === true,
          pips: submittedPips,
          pipsSatisfied: pipsDependencySatisfied(
            this.#rulesDraft.strategies.pips,
            submittedPips,
          ),
        },
        {
          hiddenBases:
            game.settings.get(
              SYSTEM_ID,
              SECOND_EDITION_OPTION_KEYS.hiddenBasesModule,
            ) === true,
          perksFlawsTalents:
            game.settings.get(
              SYSTEM_ID,
              SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
            ) === true,
          pips: storedPips,
          pipsSatisfied: pipsDependencySatisfied(
            activeRulesProfile.strategies.pips,
            storedPips,
          ),
        },
        async (action: HideoutDependencyAction) =>
          foundry.applications.api.DialogV2.wait<boolean | null>({
            buttons: [
              {
                action: "cancel",
                callback: () => false,
                label: game.i18n.localize("D6E2.Cancel"),
              },
              {
                action: "confirm",
                callback: () => true,
                class: "od6roll-submit",
                default: true,
                label: game.i18n.localize(
                  action === "enable-prerequisites"
                    ? "D6E2.Hideout.Dependency.EnableBoth"
                    : "D6E2.Hideout.Dependency.DisableBoth",
                ),
              },
            ],
            classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
            content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
              action === "enable-prerequisites"
                ? "D6E2.Hideout.Dependency.EnableHelp"
                : "D6E2.Hideout.Dependency.DisableHelp",
            )}</p></div>`,
            modal: true,
            position: { width: 520 },
            rejectClose: false,
            window: {
              title: game.i18n.localize("D6E2.Hideout.Dependency.Title"),
            },
          }),
        (settingKey) => {
          this.element
            .querySelector<HTMLInputElement>(
              `input[type="checkbox"][name="${settingKey}"]`,
            )
            ?.focus({ preventScroll: true });
        },
      );
      if (!resolvedDependency) return;
      object[HIDEOUT_SETTING_KEY] = resolvedDependency.hiddenBases;
      object[HIDEOUT_PREREQUISITE_SETTING_KEY] =
        resolvedDependency.perksFlawsTalents;
      object[HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY] = resolvedDependency.pips;
      for (const [key, checked] of [
        [HIDEOUT_SETTING_KEY, resolvedDependency.hiddenBases],
        [
          HIDEOUT_PREREQUISITE_SETTING_KEY,
          resolvedDependency.perksFlawsTalents,
        ],
        [HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY, resolvedDependency.pips],
      ] as const) {
        const input = this.element.querySelector<HTMLInputElement>(
          `input[type="checkbox"][name="${key}"]`,
        );
        if (input) input.checked = checked;
      }
    }

    const settings: SystemSettingSaveEntry[] = [];
    if (constructor.category === "first-edition") {
      settings.push(
        {
          key: FIRST_EDITION_GENRE_PACKAGE_SETTING,
          value:
            typeof object[FIRST_EDITION_GENRE_PACKAGE_SETTING] === "string"
              ? object[FIRST_EDITION_GENRE_PACKAGE_SETTING]
              : "",
        },
        {
          key: FIRST_EDITION_COMPANION_PACKAGE_SETTING,
          value:
            typeof object[FIRST_EDITION_COMPANION_PACKAGE_SETTING] === "string"
              ? object[FIRST_EDITION_COMPANION_PACKAGE_SETTING]
              : "",
        },
      );
    }

    for (const definition of definitions) {
      settings.push({
        key: definition.key,
        value: valueFromForm(definition, object),
      });
    }
    if (assistanceDefinition) {
      settings.push({
        key: assistanceDefinition.key,
        value: valueFromForm(assistanceDefinition, object),
      });
    }
    await persistSystemSettingsSave(settings, async () => {
      if (rulesChanged) {
        const base = this.#isNewRulesProfile
          ? this.#rulesDraft
          : activeRulesProfile.source.kind === "world"
            ? activeRulesProfile
            : createWorldRulesProfile();
        const candidate = {
          ...base,
          description: this.#rulesDraft.description,
          difficultyLadder: this.#rulesDraft.difficultyLadder,
          healthModels: this.#rulesDraft.healthModels,
          homebrew: this.#rulesDraft.homebrew,
          label:
            activeRulesProfile.source.kind === "world" ||
            this.#rulesDraft.label !== activeRulesProfile.label
              ? this.#rulesDraft.label
              : game.i18n.format("D6E2.Settings.RulesProfile.CustomizedLabel", {
                  profile: activeRulesProfile.label,
                }),
          strategies: this.#rulesDraft.strategies,
        };
        const saved = this.#isNewRulesProfile
          ? await saveNewWorldRulesProfile(candidate)
          : await saveWorldRulesProfile(candidate);
        await selectRulesProfile(saved.id);
      }
    });
    await this.close();
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      manageHealthModels: this.#manageHealthModels,
      reviewCombinations: this.#reviewCombinations,
      refreshHeroicSession: this.#refreshHeroicSession,
      restoreRecommendedDefaults: this.#restoreRecommendedDefaults,
      scrollToModuleSettings: this.#scrollToModuleSettings,
    },
    classes: ["d6e2", "od6s-settings-v2", "d6e2-settings-v2"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    }),
    position: {
      height: 800,
      width: 1100,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-sliders",
      resizable: true,
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("change", this.#summaryChangeHandler);
    this.element.addEventListener("change", this.#summaryChangeHandler);
    this.element.removeEventListener("input", this.#rewardDraftChange);
    this.element.addEventListener("input", this.#rewardDraftChange);
    this.element.removeEventListener("change", this.#rewardDraftChange);
    this.element.addEventListener("change", this.#rewardDraftChange);
    this.element.removeEventListener("click", this.#rewardDraftChange);
    this.element.addEventListener("click", this.#rewardDraftChange);
    this.element.removeEventListener("click", this.#summaryClickHandler);
    this.element.addEventListener("click", this.#summaryClickHandler);
    this.element.removeEventListener("click", this.#settingsTabClickHandler);
    this.element.addEventListener("click", this.#settingsTabClickHandler);
    this.element.removeEventListener(
      "keydown",
      this.#settingsTabKeydownHandler,
    );
    this.element.addEventListener("keydown", this.#settingsTabKeydownHandler);
    this.#activateSettingsTab(this.#activeSettingsTab, false);
    this.#refreshAvailability();
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const settings = settingsForCategory(constructor.category).map(settingView);
    const homebrewSettings = tyfusiusHomebrewSettingsForEdition(
      constructor.category,
    ).map(settingView);
    const wildTriumphKeys = new Set<string>([
      TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphAutomaticSuccess,
      TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphCharacterPointAward,
      TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphEnabled,
      TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphMetaCurrencyAward,
      TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphThreshold,
    ]);
    const wildTriumphSettings = Object.fromEntries(
      homebrewSettings
        .filter(({ key }) => wildTriumphKeys.has(key))
        .map((setting) => [setting.key, setting]),
    );
    const campaign =
      constructor.category === "second-edition"
        ? currentSecondEditionCampaignProfile()
        : undefined;
    const rulesRuntime = currentRulesRuntime();
    const assistanceDefinition = SHARED_SETTINGS.find(
      ({ key }) => key === SHARED_SETTING_KEYS.actionDeclarationAssistance,
    );
    const campaignModuleLabels = campaign?.moduleIds.map((id) => {
      if (id === "core.second-edition") {
        return game.i18n.localize("D6E2.Settings.CampaignProfile.Module.Core");
      }
      if (id === "skill.specialization-advanced-skills") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.AdvancedSkills",
        );
      }
      if (id === "skills.fantasy") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.FantasySkills",
        );
      }
      if (id === "skills.science-fiction") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.ScienceFictionSkills",
        );
      }
      if (id === "skills.superheroic") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.SuperheroicSkills",
        );
      }
      if (id === "rules.hero-points.superheroic") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.SuperheroicHeroPoints",
        );
      }
      if (id === "rules.secret-identities") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.SecretIdentities",
        );
      }
      if (id.startsWith("rules.die-code-cap.")) {
        const cap = id.slice("rules.die-code-cap.".length);
        return game.i18n.format(
          "D6E2.Settings.CampaignProfile.Module.DieCodeCap",
          { cap },
        );
      }
      if (id === "magic.freeform-skill-based") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.FreeformMagic",
        );
      }
      if (id === "magic.points-casting") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.MagicPoints",
        );
      }
      if (id === "combat.active-responsive") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.ActiveResponsiveCombat",
        );
      }
      if (id === "rules.pips") {
        return game.i18n.localize("D6E2.Settings.CampaignProfile.Module.Pips");
      }
      if (id === "rules.chases") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.Chases",
        );
      }
      if (id === "rules.cyberpunk") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.Cyberpunk",
        );
      }
      if (id === "rules.environments") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.Environments",
        );
      }
      if (id === "rules.no-dodge-defense") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.NoDodgeDefense",
        );
      }
      if (id === "rules.hyper-lethal-combat") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.HyperLethalCombat",
        );
      }
      if (id.startsWith("rules.hero-points.")) {
        const strategy = id.slice("rules.hero-points.".length);
        return game.i18n.localize(
          strategy === "basic"
            ? "D6E2.Settings.SecondEdition.HeroPointStrategy.Basic"
            : strategy === "classic"
              ? "D6E2.Settings.SecondEdition.HeroPointStrategy.Classic"
              : "D6E2.Settings.SecondEdition.HeroPointStrategy.Heroic",
        );
      }
      if (id.startsWith("rules.initiative.")) {
        const strategy = id.slice("rules.initiative.".length);
        const suffix =
          strategy === "simple"
            ? "Simple"
            : strategy === "basic"
              ? "Basic"
              : strategy === "narrative"
                ? "Narrative"
                : "Standard";
        return game.i18n.localize(
          `D6E2.Settings.SecondEdition.InitiativeStrategy.${suffix}`,
        );
      }
      if (id.startsWith("rules.equipment.")) {
        const era = id.slice("rules.equipment.".length);
        return game.i18n.format(
          "D6E2.Settings.CampaignProfile.Module.Equipment",
          {
            era: game.i18n.localize(
              era === "science-fiction"
                ? "D6E2.Equipment.Era.ScienceFiction"
                : era === "medieval"
                  ? "D6E2.Equipment.Era.Medieval"
                  : "D6E2.Equipment.Era.Modern",
            ),
          },
        );
      }
      if (id === "features.perks-flaws-talents") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.RankedFeatures",
        );
      }
      if (id === "features.troubles-assets") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.NarrativeFeatures",
        );
      }
      const attributeId = id.startsWith("attribute.")
        ? id.slice("attribute.".length)
        : "";
      const attributeLabel = attributeId
        ? game.i18n.localize(
            `D6E2.Attribute.${attributeId[0]?.toUpperCase() ?? ""}${attributeId.slice(1)}`,
          )
        : id;
      return attributeId
        ? game.i18n.format("D6E2.Settings.CampaignProfile.Module.Attribute", {
            attribute: attributeLabel,
          })
        : id;
    });
    const secondEditionGroups: readonly SecondEditionSettingGroupView[] =
      constructor.category === "second-edition"
        ? secondEditionSettingsByGroup().map(({ definition, settings }) => ({
            className: definition.kind === "module" ? "is-module" : "is-core",
            hint: game.i18n.localize(definition.hint),
            icon: definition.icon,
            id: definition.id,
            kindLabel: game.i18n.localize(
              definition.kind === "module"
                ? "D6E2.Settings.SecondEdition.Module"
                : "D6E2.Settings.SecondEdition.CoreRules",
            ),
            label: game.i18n.localize(definition.name),
            pageReference: definition.pageReference,
            settings: settings.map(settingView),
          }))
        : [];
    const catalogById = new Map(
      SECOND_EDITION_MODULE_CATALOG.map((entry) => [entry.id, entry]),
    );
    const catalogGenres: readonly SecondEditionModuleCatalogGenreView[] =
      constructor.category === "second-edition"
        ? (["core", "fantasy", "science-fiction", "superheroic"] as const).map(
            (genre) => ({
              entries: SECOND_EDITION_MODULE_CATALOG.filter(
                (entry) => entry.genre === genre,
              ).map((entry) => {
                const dependencyLabels = (entry.dependencyIds ?? []).map(
                  (dependencyId) => {
                    const dependency = catalogById.get(dependencyId);
                    return dependency
                      ? game.i18n.localize(dependency.name)
                      : dependencyId;
                  },
                );
                return {
                  ...(dependencyLabels.length > 0
                    ? {
                        dependencyLabel: game.i18n.format(
                          "D6E2.Settings.SecondEdition.ModuleCatalog.Requires",
                          { modules: dependencyLabels.join(", ") },
                        ),
                      }
                    : {}),
                  ...(entry.incompatibilityFamily
                    ? {
                        familyLabel: game.i18n.format(
                          "D6E2.Settings.SecondEdition.ModuleCatalog.ExclusiveFamily",
                          {
                            family: game.i18n.localize(
                              `D6E2.Settings.SecondEdition.ModuleCatalog.Family.${entry.incompatibilityFamily}`,
                            ),
                          },
                        ),
                      }
                    : {}),
                  hint: game.i18n.localize(entry.hint),
                  id: entry.id,
                  label: game.i18n.localize(entry.name),
                  pageReference: entry.pageReference,
                  ...(entry.settingGroupId
                    ? { settingGroupId: entry.settingGroupId }
                    : {}),
                  support: entry.support,
                  supportLabel: game.i18n.localize(
                    `D6E2.Settings.SecondEdition.ModuleCatalog.State.${entry.support}`,
                  ),
                };
              }),
              id: genre,
              label: game.i18n.localize(
                `D6E2.Settings.SecondEdition.ModuleCatalog.Genre.${genre}`,
              ),
            }),
          )
        : [];
    const settingsSummary: readonly SettingsSummaryView[] = settings
      .filter((setting) => setting.inputType === "checkbox")
      .map((setting) => ({
        active: setting.checked,
        className: setting.checked ? "is-active" : "is-inactive",
        key: setting.key,
        label: setting.label,
        stateLabel: game.i18n.localize(
          setting.checked
            ? "D6E2.Settings.Summary.Active"
            : "D6E2.Settings.Summary.Inactive",
        ),
      }));
    const packageResolution =
      constructor.category === "first-edition"
        ? currentFirstEditionCampaignPackages()
        : undefined;
    const installedPackages = campaignPackageRegistry.current();
    const activeContentPackages = contentPackageRegistry.current();
    const rulesSelection = currentRulesSelection();
    const activeRulesProfile = this.#rulesDraft;
    const rulesProfileMechanics = RULES_PROFILE_EDITABLE_MECHANIC_SLOTS.map(
      (slot) => {
        const typedSlot = slot;
        const secondEdition = bundledRulesStrategyChoices[typedSlot][0] ?? "";
        const selected =
          this.#rulesDraft.strategies[typedSlot] ?? secondEdition;
        const options =
          slot === "health"
            ? availableHealthModelsForProfile(this.#rulesDraft).map(
                (model) => ({
                  label: game.i18n.localize(model.label),
                  selected: model.id === selected,
                  value: model.id,
                }),
              )
            : bundledRulesStrategyChoices[typedSlot].map((value, index) => ({
                label: game.i18n.localize(
                  index === 0
                    ? "D6E2.Settings.GameMode.SecondEdition"
                    : index === 1
                      ? "D6E2.Settings.GameMode.OpenD6"
                      : "D6E2.Settings.GameMode.D6MV",
                ),
                selected: value === selected,
                value,
              }));
        if (
          slot === "health" &&
          !options.some(({ value }) => value === selected)
        ) {
          options.unshift({
            label: game.i18n.format(
              "D6E2.Settings.HealthModel.UnavailableSelected",
              { id: selected },
            ),
            selected: true,
            value: selected,
          });
        }
        return {
          help: game.i18n.localize(
            `D6E2.Settings.RulesProfile.Mechanic.${RULES_STRATEGY_LABELS[slot]}.Help`,
          ),
          health: slot === "health",
          label: game.i18n.localize(
            `D6E2.Settings.RulesProfile.Mechanic.${RULES_STRATEGY_LABELS[slot]}.Label`,
          ),
          options,
          slot,
        };
      },
    );
    const settingsTabs: readonly SettingsTabView[] = [
      {
        active: this.#activeSettingsTab === "profile",
        className: this.#activeSettingsTab === "profile" ? "is-active" : "",
        icon: "fa-solid fa-signature",
        id: "profile",
        label: game.i18n.localize("D6E2.Settings.RulesProfile.Identity"),
        tabIndex: this.#activeSettingsTab === "profile" ? 0 : -1,
      },
      {
        active: this.#activeSettingsTab === "mechanics",
        className: this.#activeSettingsTab === "mechanics" ? "is-active" : "",
        icon: "fa-solid fa-gears",
        id: "mechanics",
        label: game.i18n.localize("D6E2.Settings.RulesProfile.Mechanics"),
        tabIndex: this.#activeSettingsTab === "mechanics" ? 0 : -1,
      },
      {
        active: this.#activeSettingsTab === "difficulty",
        className: this.#activeSettingsTab === "difficulty" ? "is-active" : "",
        icon: "fa-solid fa-stairs",
        id: "difficulty",
        label: game.i18n.localize("D6E2.Settings.RulesProfile.DifficultyScale"),
        tabIndex: this.#activeSettingsTab === "difficulty" ? 0 : -1,
      },
      {
        active: this.#activeSettingsTab === "general",
        className: this.#activeSettingsTab === "general" ? "is-active" : "",
        icon: "fa-solid fa-gauge-high",
        id: "general",
        label: game.i18n.localize("D6E2.Settings.Tabs.General"),
        tabIndex: this.#activeSettingsTab === "general" ? 0 : -1,
      },
      constructor.category === "second-edition"
        ? {
            active: this.#activeSettingsTab === "modules",
            className: this.#activeSettingsTab === "modules" ? "is-active" : "",
            icon: "fa-solid fa-cubes",
            id: "modules",
            label: game.i18n.localize("D6E2.Settings.Tabs.Modules"),
            tabIndex: this.#activeSettingsTab === "modules" ? 0 : -1,
          }
        : {
            active: this.#activeSettingsTab === "rules",
            className: this.#activeSettingsTab === "rules" ? "is-active" : "",
            icon: "fa-solid fa-book-open",
            id: "rules",
            label: game.i18n.localize("D6E2.Settings.Tabs.Rules"),
            tabIndex: this.#activeSettingsTab === "rules" ? 0 : -1,
          },
      ...(homebrewSettings.length > 0
        ? ([
            {
              active: this.#activeSettingsTab === "homebrew",
              className:
                this.#activeSettingsTab === "homebrew" ? "is-active" : "",
              icon: "fa-solid fa-flask",
              id: "homebrew",
              label: game.i18n.localize("D6E2.Settings.Tabs.Homebrew"),
              tabIndex: this.#activeSettingsTab === "homebrew" ? 0 : -1,
            },
          ] satisfies readonly SettingsTabView[])
        : []),
      {
        active: this.#activeSettingsTab === "reference",
        className: this.#activeSettingsTab === "reference" ? "is-active" : "",
        icon: "fa-solid fa-circle-info",
        id: "reference",
        label: game.i18n.localize("D6E2.Settings.Tabs.Reference"),
        tabIndex: this.#activeSettingsTab === "reference" ? 0 : -1,
      },
    ];
    const selectedGenreId = packageResolution?.requestedGenreId ?? "";
    const selectedCompanionId = packageResolution?.requestedCompanionId ?? "";
    const genrePackages = installedPackages.filter(
      (manifest) =>
        manifest.kind === "genre" &&
        manifest.rulesFamily === "open-d6-first-edition",
    );
    const companionPackages = installedPackages.filter(
      (manifest) =>
        manifest.kind === "companion" &&
        manifest.rulesFamily === "open-d6-first-edition",
    );
    return Promise.resolve({
      firstEditionPackages:
        constructor.category === "first-edition"
          ? {
              companionChoices: [
                {
                  label: game.i18n.localize(
                    "D6E2.Settings.Packages.NoneCompanion",
                  ),
                  selected: selectedCompanionId === "",
                  value: "",
                },
                ...companionPackages.map((manifest) => ({
                  label: manifest.label,
                  selected: selectedCompanionId === manifest.id,
                  value: manifest.id,
                })),
                ...(selectedCompanionId &&
                !companionPackages.some(({ id }) => id === selectedCompanionId)
                  ? [
                      {
                        label: game.i18n.format(
                          "D6E2.Settings.Packages.UnavailableChoice",
                          { id: selectedCompanionId },
                        ),
                        selected: true,
                        value: selectedCompanionId,
                      },
                    ]
                  : []),
              ],
              companionKey: FIRST_EDITION_COMPANION_PACKAGE_SETTING,
              diagnostics: packageResolution?.diagnostics ?? [],
              genreChoices: [
                {
                  label: game.i18n.localize("D6E2.Settings.Packages.NoneGenre"),
                  selected: selectedGenreId === "",
                  value: "",
                },
                ...genrePackages.map((manifest) => ({
                  label: manifest.label,
                  selected: selectedGenreId === manifest.id,
                  value: manifest.id,
                })),
                ...(selectedGenreId &&
                !genrePackages.some(({ id }) => id === selectedGenreId)
                  ? [
                      {
                        label: game.i18n.format(
                          "D6E2.Settings.Packages.UnavailableChoice",
                          { id: selectedGenreId },
                        ),
                        selected: true,
                        value: selectedGenreId,
                      },
                    ]
                  : []),
              ],
              genreKey: FIRST_EDITION_GENRE_PACKAGE_SETTING,
              installedCount: genrePackages.length + companionPackages.length,
              valid: packageResolution?.valid ?? true,
            }
          : undefined,
      contentSelection: {
        activePackages: activeContentPackages,
        hasActivePackages: activeContentPackages.length > 0,
        importedMechanicIds: rulesSelection.importedMechanicIds,
        hasImportedMechanics: rulesSelection.importedMechanicIds.length > 0,
        primaryProfileLabel: currentConfiguredRulesProfile().label,
        resolvedProfileLabel: game.i18n.localize(
          activeRulesProfile.source.kind === "world"
            ? "D6E2.Settings.GameMode.ProfileCustom"
            : "D6E2.Settings.GameMode.ProfileBaseline",
        ),
      },
      campaignProfile: campaign
        ? {
            activeAttributeCount: campaign.activeAttributeIds.length,
            additionalSkillModuleCount: campaign.additionalSkillModuleCount,
            attributeBudgetLabel: formatPipScore(
              campaign.creation.attributeBudgetScore,
            ),
            id: campaign.id,
            label: game.i18n.localize(
              campaign.id === "core-default"
                ? "D6E2.Settings.CampaignProfile.CoreDefault"
                : "D6E2.Settings.CampaignProfile.Custom",
            ),
            moduleLabels: campaignModuleLabels,
            profileVersion: campaign.profileVersion,
            skillBudgetLabel: formatPipScore(
              campaign.creation.skillBudgetScore,
            ),
          }
        : undefined,
      canRefreshHeroicSession:
        constructor.category === "second-edition" &&
        configuredSecondEditionHeroPointStrategy() === "heroic" &&
        !heroicHeroPointsCarryOver(),
      actionDeclarationAssistance: assistanceDefinition
        ? settingView(assistanceDefinition)
        : undefined,
      capabilityProfile: {
        decisions: rulesRuntime.decisions.map((decision) => ({
          label: game.i18n.localize(
            `D6E2.Settings.Capabilities.Item.${CAPABILITY_LABELS[decision.id] ?? decision.id}`,
          ),
          ownerLabel: game.i18n.localize(
            `D6E2.Settings.Capabilities.Owner.${decision.owner === "open-d6" ? "OpenD6" : decision.owner === "second-edition" ? "SecondEdition" : "Shared"}`,
          ),
          state: decision.state,
          stateLabel: game.i18n.localize(
            `D6E2.Settings.Capabilities.State.${decision.state === "inactive-preserved" ? "InactivePreserved" : decision.state === "planned" ? "Planned" : "Active"}`,
          ),
          strategyLabel: game.i18n.localize(
            `D6E2.Settings.Capabilities.Strategy.${CAPABILITY_STRATEGIES[decision.strategy] ?? decision.strategy}`,
          ),
        })),
        profileVersion: rulesRuntime.contractVersion,
        rulesProfileId: rulesRuntime.rulesProfileId,
      },
      catalogGenres,
      category: constructor.category,
      hasHomebrewRules: homebrewSettings.length > 0,
      homebrewFirstEditionSettings:
        constructor.category === "first-edition"
          ? homebrewSettings.filter(
              (setting) =>
                !wildTriumphKeys.has(setting.key) &&
                setting.key !==
                  TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges,
            )
          : [],
      profileD8ExplosiveDeviation: {
        checked: this.#rulesDraft.homebrew.tyfusiusD8ExplosiveDeviation,
        hint: game.i18n.localize(
          "D6E2.Settings.TyfusiusHomebrew.Options.tyfusiusD8ExplosiveDeviation.Hint",
        ),
        label: game.i18n.localize(
          "D6E2.Settings.TyfusiusHomebrew.Options.tyfusiusD8ExplosiveDeviation.Name",
        ),
      },
      homebrewSecondEditionSettings:
        constructor.category === "second-edition"
          ? homebrewSettings.filter(
              (setting) => !wildTriumphKeys.has(setting.key),
            )
          : [],
      wildTriumph: {
        automaticSuccess:
          wildTriumphSettings[
            TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphAutomaticSuccess
          ],
        characterPointAward:
          wildTriumphSettings[
            TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphCharacterPointAward
          ],
        enabled:
          wildTriumphSettings[
            TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphEnabled
          ],
        metaCurrencyAward:
          wildTriumphSettings[
            TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphMetaCurrencyAward
          ],
        threshold:
          wildTriumphSettings[
            TYFUSIUS_HOMEBREW_SETTING_KEYS.wildTriumphThreshold
          ],
      },
      editionOptions: settings,
      isFirstEditionWorkspace: constructor.category === "first-edition",
      secondEditionGroups,
      settingsSummary,
      settingsTabs,
      activeSettingsTab: this.#activeSettingsTab,
      rulesProfile: this.#rulesDraft,
      rulesProfileMechanics,
      rulesProfileRollResolution: buildMatchingHomebrewContext(
        this.#rulesDraft,
      ),
      rulesProfileDifficulty: this.#rulesDraft.difficultyLadder,
      title: game.i18n.localize("D6E2.Settings.RulesProfile.ConfigureTitle"),
    });
  }
}

export class D6System2eFirstEditionSettings extends D6System2eSettingsApplication {
  static override readonly category = "first-edition" as const;
  static override DEFAULT_OPTIONS = {
    ...D6System2eSettingsApplication.DEFAULT_OPTIONS,
    id: "d6e2-first-edition-settings",
    window: {
      ...D6System2eSettingsApplication.DEFAULT_OPTIONS.window,
      title: "D6E2.Settings.RulesProfile.ConfigureTitle",
    },
  };
}

export class D6System2eSecondEditionSettings extends D6System2eSettingsApplication {
  static override readonly category = "second-edition" as const;
  static override DEFAULT_OPTIONS = {
    ...D6System2eSettingsApplication.DEFAULT_OPTIONS,
    id: "d6e2-second-edition-settings",
    window: {
      ...D6System2eSettingsApplication.DEFAULT_OPTIONS.window,
      title: "D6E2.Settings.RulesProfile.ConfigureTitle",
    },
  };
}
