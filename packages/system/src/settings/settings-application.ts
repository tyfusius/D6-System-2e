import { formatPipScore, RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  applyRulesCompatibilitySelection,
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
} from "./rules-compatibility";
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
} from "./settings-catalog";
import { currentSecondEditionCampaignProfile } from "./campaign-profile";
import { currentEditionCapabilityProfile } from "./edition-capabilities";
import {
  configuredSecondEditionHeroPointStrategy,
  heroicHeroPointsCarryOver,
} from "./hero-points";
import { refreshHeroicHeroPointsForNewSession } from "../foundry/hero-point-service";

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
  "active-defense-scheduler": "ActiveDefenseScheduler",
  "character-point-advancement": "CharacterPointAdvancement",
  "character-points-fate-points": "CharacterPointsFatePoints",
  "heroic-hero-points": "HeroicHeroPoints",
  "basic-hero-points": "BasicHeroPoints",
  "classic-hero-points": "ClassicHeroPoints",
  "meets-or-exceeds": "MeetsOrExceeds",
  "no-dodge-range-difficulties": "NoDodgeRangeDifficulties",
  "open-d6-critical-one": "OpenD6WildDie",
  "open-d6-flexible-action-allotment": "OpenD6FlexibleActionAllotment",
  "open-d6-relative-movement": "OpenD6RelativeMovement",
  "open-d6-six-attribute": "OpenD6Attributes",
  "open-d6-wounds-or-body-points": "OpenD6Damage",
  "open-d6-classic-pips": "OpenD6ClassicPips",
  "open-d6-no-general-double-down": "OpenD6NoGeneralDoubleDown",
  "open-d6-perception-roll": "OpenD6PerceptionInitiative",
  "second-edition-advantage-complication": "SecondEditionWildDie",
  "second-edition-basic": "SecondEditionBasicWildDie",
  "second-edition-classic": "SecondEditionClassicWildDie",
  "second-edition-distance-track": "SecondEditionChases",
  "second-edition-environment-hazards": "SecondEditionEnvironments",
  "second-edition-simple": "SecondEditionSimpleWildDie",
  "second-edition-campaign-profile": "SecondEditionAttributes",
  "second-edition-action-segments": "SecondEditionActionSegments",
  "second-edition-segment-movement": "SecondEditionSegmentMovement",
  "second-edition-condition-track": "SecondEditionDamage",
  "second-edition-contextual": "SecondEditionAdvancedSkills",
  "second-edition-contextual-extension": "SecondEditionAdvancedSkillsExtension",
  "second-edition-contextual-initiative": "SecondEditionContextualInitiative",
  "second-edition-simple-initiative": "SecondEditionSimpleInitiative",
  "second-edition-basic-initiative": "SecondEditionBasicInitiative",
  "second-edition-narrative-initiative": "SecondEditionNarrativeInitiative",
  "second-edition-unselected": "SecondEditionAdvancementUnselected",
  "second-edition-experience-points": "SecondEditionExperiencePoints",
  "second-edition-milestone": "SecondEditionMilestone",
  "second-edition-narrative": "SecondEditionNarrative",
  "second-edition-perks-flaws-talents": "SecondEditionRankedFeatures",
  "second-edition-pips-module": "SecondEditionPipsModule",
  "second-edition-troubles-assets": "SecondEditionNarrativeFeatures",
  "second-edition-doubling-down": "SecondEditionDoublingDown",
  "second-edition-whole-dice": "SecondEditionWholeDice",
  "static-defenses": "StaticDefenses",
  "stored-inactive": "StoredInactive",
  "strictly-greater": "StrictlyGreater",
});

const SettingsApplicationBase =
  foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2,
  );

interface SettingView {
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
  readonly master: boolean;
  readonly max?: number;
  readonly min?: number;
  readonly step?: number;
  readonly value: boolean | number | string;
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

function settingView(definition: SystemSettingDefinition): SettingView {
  const value = game.settings.get(SYSTEM_ID, definition.key) as
    boolean | number | string;
  return {
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
    master: definition.key === OPEN_D6_MASTER_SETTING,
    ...(definition.max === undefined ? {} : { max: definition.max }),
    ...(definition.min === undefined ? {} : { min: definition.min }),
    ...(definition.step === undefined ? {} : { step: definition.step }),
    value,
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
  static readonly category: Exclude<SettingCategory, "shared">;

  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/edition-settings.hbs`,
    },
  };

  static readonly #togglePreset = function (
    this: D6System2eSettingsApplication,
    _event: Event,
    target: HTMLElement,
  ): void {
    const master = target as HTMLInputElement;
    if (master.type !== "checkbox") return;
    const form = master.closest("form");
    const inputs = form
      ? Array.from(
          form.querySelectorAll<HTMLInputElement>(
            "[data-first-edition-compatibility]",
          ),
        )
      : [];
    for (const input of inputs) {
      input.checked = master.checked;
    }
  };

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

  static readonly #submit = async function (
    this: D6System2eSettingsApplication,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const definitions = settingsForCategory(constructor.category);
    const assistanceDefinition = SHARED_SETTINGS.find(
      ({ key }) => key === SHARED_SETTING_KEYS.actionDeclarationAssistance,
    );
    const object = formData.object;

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
    }

    if (constructor.category === "first-edition") {
      const master = object[OPEN_D6_MASTER_SETTING] === true;
      const selection = Object.fromEntries(
        RULES_COMPATIBILITY_KEYS.map((key) => {
          const settingKey = COMPATIBILITY_SETTING_KEYS[key];
          return [key, master || object[settingKey] === true];
        }),
      ) as unknown as Readonly<
        Record<(typeof RULES_COMPATIBILITY_KEYS)[number], boolean>
      >;
      const result = await applyRulesCompatibilitySelection(selection);
      if (result.failed.length > 0) {
        ui.notifications.warn(game.i18n.localize("D6E2.Settings.SaveFailed"));
        return;
      }
    }

    const compatibilityKeys = new Set<string>([
      OPEN_D6_MASTER_SETTING,
      ...Object.values(COMPATIBILITY_SETTING_KEYS),
    ]);
    for (const definition of definitions) {
      if (compatibilityKeys.has(definition.key)) continue;
      await game.settings.set(
        SYSTEM_ID,
        definition.key,
        valueFromForm(definition, object),
      );
    }
    if (assistanceDefinition) {
      await game.settings.set(
        SYSTEM_ID,
        assistanceDefinition.key,
        valueFromForm(assistanceDefinition, object),
      );
    }
    await this.close();
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      refreshHeroicSession: this.#refreshHeroicSession,
      scrollToModuleSettings: this.#scrollToModuleSettings,
      togglePreset: this.#togglePreset,
    },
    classes: ["d6e2", "od6s-settings-v2", "d6e2-settings-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    },
    position: {
      height: "auto",
      width: 680,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-sliders",
      resizable: true,
    },
  };

  override _prepareContext(): Promise<Record<string, unknown>> {
    const constructor = this
      .constructor as typeof D6System2eSettingsApplication;
    const settings = settingsForCategory(constructor.category).map(settingView);
    const master = settings.find((setting) => setting.master);
    const campaign =
      constructor.category === "second-edition"
        ? currentSecondEditionCampaignProfile()
        : undefined;
    const editionCapabilities = currentEditionCapabilityProfile();
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
      if (id === "rules.pips") {
        return game.i18n.localize("D6E2.Settings.CampaignProfile.Module.Pips");
      }
      if (id === "rules.chases") {
        return game.i18n.localize(
          "D6E2.Settings.CampaignProfile.Module.Chases",
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
    return Promise.resolve({
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
        decisions: editionCapabilities.decisions.map((decision) => ({
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
        profileVersion: editionCapabilities.contractVersion,
        rulesProfileId: editionCapabilities.rulesProfileId,
      },
      catalogGenres,
      category: constructor.category,
      editionOptions: settings.filter(
        (setting) =>
          !setting.master &&
          !Object.values(COMPATIBILITY_SETTING_KEYS).includes(setting.key),
      ),
      hasMaster: master !== undefined,
      master,
      rulesCompatibility: settings.filter((setting) =>
        Object.values(COMPATIBILITY_SETTING_KEYS).includes(setting.key),
      ),
      secondEditionGroups,
      title:
        constructor.category === "first-edition"
          ? game.i18n.localize("D6E2.Settings.FirstEdition.Menu.Name")
          : game.i18n.localize("D6E2.Settings.SecondEdition.Menu.Name"),
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
      title: "D6E2.Settings.FirstEdition.Menu.Name",
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
      title: "D6E2.Settings.SecondEdition.Menu.Name",
    },
  };
}
