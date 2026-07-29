import {
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
} from "./rules-compatibility";

export type SettingCategory = "first-edition" | "second-edition" | "shared";
export type SettingScope = "client" | "world";
export type SettingValueType = "boolean" | "number" | "string";

export interface SystemSettingDefinition {
  readonly category: SettingCategory;
  readonly choices?: Readonly<Record<string, string>>;
  readonly default: boolean | number | string;
  readonly hint: string;
  readonly key: string;
  readonly max?: number;
  readonly min?: number;
  readonly name: string;
  readonly requiresReload?: boolean;
  readonly scope: SettingScope;
  readonly step?: number;
  readonly type: SettingValueType;
}

export type SecondEditionSettingGroupKind = "core" | "module";

export interface SecondEditionSettingGroupDefinition {
  readonly hint: string;
  readonly icon: string;
  readonly id: string;
  readonly kind: SecondEditionSettingGroupKind;
  readonly name: string;
  readonly pageReference: string;
  readonly settingKeys: readonly string[];
}

export const SHARED_SETTING_KEYS = Object.freeze({
  defaultDifficulty: "defaultDifficulty",
  defaultRollMode: "defaultRollMode",
  showAdvantagesDisadvantages: "showAdvantagesDisadvantages",
  showDifficultyControls: "showDifficultyControls",
  showModifierControls: "showModifierControls",
  showOppositionControls: "showOppositionControls",
  showPcQuickbar: "showPcQuickbar",
  showActiveTasksQuickbar: "showActiveTasksQuickbar",
  showSpecializations: "showSpecializations",
  userTheme: "userTheme",
  worldTheme: "worldTheme",
} as const);

export const FIRST_EDITION_OPTION_KEYS = Object.freeze({
  allowSecondEditionAdvancedSkills:
    "firstEditionAllowSecondEditionAdvancedSkills",
  advanceCostAttribute: "firstEditionAdvanceCostAttribute",
  advanceCostSkill: "firstEditionAdvanceCostSkill",
  advanceCostSpecialization: "firstEditionAdvanceCostSpecialization",
  bodyPoints: "firstEditionBodyPoints",
  characterPointAttributeLimit: "firstEditionCharacterPointAttributeLimit",
  characterPointSkillLimit: "firstEditionCharacterPointSkillLimit",
  characterPointSpecializationLimit:
    "firstEditionCharacterPointSpecializationLimit",
  diceForScale: "firstEditionDiceForScale",
  initialAttributePips: "firstEditionInitialAttributePips",
  initialCharacterPoints: "firstEditionInitialCharacterPoints",
  initialFatePoints: "firstEditionInitialFatePoints",
  initialMove: "firstEditionInitialMove",
  initialSkillPips: "firstEditionInitialSkillPips",
  metaphysicsAttributeOptional: "firstEditionMetaphysicsAttributeOptional",
  specializationDice: "firstEditionSpecializationDice",
  trackStuns: "firstEditionTrackStuns",
  wildOneStrategy: "firstEditionWildOneStrategy",
} as const);

export const SECOND_EDITION_OPTION_KEYS = Object.freeze({
  advancementStrategy: "secondEditionAdvancementStrategy",
  autoHeroPoints: "secondEditionAutoHeroPoints",
  optionalCharm: "secondEditionOptionalCharm",
  optionalMagic: "secondEditionOptionalMagic",
  optionalMechanical: "secondEditionOptionalMechanical",
  optionalMysticism: "secondEditionOptionalMysticism",
  optionalTechnical: "secondEditionOptionalTechnical",
  optionalSkillModuleCount: "secondEditionOptionalSkillModuleCount",
  perksFlawsTalentsModule: "secondEditionPerksFlawsTalentsModule",
  skillSpecializationModule: "secondEditionSkillSpecializationModule",
  startingHeroPoints: "secondEditionStartingHeroPoints",
  troublesAssetsModule: "secondEditionTroublesAssetsModule",
  pipsModule: "secondEditionPipsModule",
} as const);

const shared = (
  key: string,
  type: SettingValueType,
  defaultValue: boolean | number | string,
  options: Partial<SystemSettingDefinition> = {},
): SystemSettingDefinition => ({
  category: "shared",
  default: defaultValue,
  hint: `D6E2.Settings.Shared.${key}.Hint`,
  key,
  name: `D6E2.Settings.Shared.${key}.Name`,
  scope: "world",
  type,
  ...options,
});

const firstEdition = (
  key: string,
  type: SettingValueType,
  defaultValue: boolean | number | string,
  options: Partial<SystemSettingDefinition> = {},
): SystemSettingDefinition => ({
  category: "first-edition",
  default: defaultValue,
  hint: `D6E2.Settings.FirstEdition.Options.${key}.Hint`,
  key,
  name: `D6E2.Settings.FirstEdition.Options.${key}.Name`,
  scope: "world",
  type,
  ...options,
});

const secondEdition = (
  key: string,
  type: SettingValueType,
  defaultValue: boolean | number | string,
  options: Partial<SystemSettingDefinition> = {},
): SystemSettingDefinition => ({
  category: "second-edition",
  default: defaultValue,
  hint: `D6E2.Settings.SecondEdition.Options.${key}.Hint`,
  key,
  name: `D6E2.Settings.SecondEdition.Options.${key}.Name`,
  scope: "world",
  type,
  ...options,
});

export const SHARED_SETTINGS = Object.freeze([
  shared(SHARED_SETTING_KEYS.worldTheme, "string", "classic", {
    choices: { classic: "D6E2.Settings.Theme.Classic" },
  }),
  shared(SHARED_SETTING_KEYS.userTheme, "string", "inherit", {
    choices: {
      classic: "D6E2.Settings.Theme.Classic",
      inherit: "D6E2.Settings.Theme.Inherit",
    },
    scope: "client",
  }),
  shared(SHARED_SETTING_KEYS.defaultRollMode, "string", "publicroll", {
    choices: {
      blindroll: "D6E2.Roll.Mode.Blind",
      gmroll: "D6E2.Roll.Mode.Gm",
      publicroll: "D6E2.Roll.Mode.Public",
      selfroll: "D6E2.Roll.Mode.Self",
    },
    scope: "client",
  }),
  shared(SHARED_SETTING_KEYS.defaultDifficulty, "number", 0, {
    min: 0,
    step: 1,
  }),
  shared(SHARED_SETTING_KEYS.showDifficultyControls, "boolean", true),
  shared(SHARED_SETTING_KEYS.showModifierControls, "boolean", true),
  shared(SHARED_SETTING_KEYS.showOppositionControls, "boolean", true),
  shared(SHARED_SETTING_KEYS.showAdvantagesDisadvantages, "boolean", true),
  shared(SHARED_SETTING_KEYS.showSpecializations, "boolean", true),
  shared(SHARED_SETTING_KEYS.showPcQuickbar, "boolean", true, {
    scope: "client",
  }),
  shared(SHARED_SETTING_KEYS.showActiveTasksQuickbar, "boolean", true, {
    scope: "client",
  }),
]);

const COMPATIBILITY_LOCALIZATION: Readonly<Record<string, string>> =
  Object.freeze({
    [COMPATIBILITY_SETTING_KEYS.firstEditionActiveDefenses]: "ActiveDefenses",
    [COMPATIBILITY_SETTING_KEYS.firstEditionAdvancement]: "Advancement",
    [COMPATIBILITY_SETTING_KEYS.firstEditionAttributes]: "Attributes",
    [COMPATIBILITY_SETTING_KEYS.firstEditionDamage]: "Damage",
    [COMPATIBILITY_SETTING_KEYS.firstEditionMetaCurrency]: "MetaCurrency",
    [COMPATIBILITY_SETTING_KEYS.firstEditionPips]: "Pips",
    [COMPATIBILITY_SETTING_KEYS.firstEditionRetries]: "Retries",
    [COMPATIBILITY_SETTING_KEYS.firstEditionSuccessEvaluator]:
      "SuccessEvaluator",
    [COMPATIBILITY_SETTING_KEYS.firstEditionWildDie]: "WildDie",
  });

export const FIRST_EDITION_SETTINGS = Object.freeze([
  {
    category: "first-edition",
    default: false,
    hint: "D6E2.Settings.UseOpenD6Rules.Hint",
    key: OPEN_D6_MASTER_SETTING,
    name: "D6E2.Settings.UseOpenD6Rules.Name",
    scope: "world",
    type: "boolean",
  } satisfies SystemSettingDefinition,
  ...Object.values(COMPATIBILITY_SETTING_KEYS).map(
    (key): SystemSettingDefinition => ({
      category: "first-edition",
      default: false,
      hint: `D6E2.Settings.FirstEdition.${COMPATIBILITY_LOCALIZATION[key]}.Hint`,
      key,
      name: `D6E2.Settings.FirstEdition.${COMPATIBILITY_LOCALIZATION[key]}.Name`,
      scope: "world",
      type: "boolean",
    }),
  ),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.allowSecondEditionAdvancedSkills,
    "boolean",
    false,
  ),
  firstEdition(FIRST_EDITION_OPTION_KEYS.bodyPoints, "boolean", false),
  firstEdition(FIRST_EDITION_OPTION_KEYS.trackStuns, "boolean", false),
  firstEdition(FIRST_EDITION_OPTION_KEYS.specializationDice, "boolean", false),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.metaphysicsAttributeOptional,
    "boolean",
    false,
  ),
  firstEdition(FIRST_EDITION_OPTION_KEYS.diceForScale, "boolean", false),
  firstEdition(FIRST_EDITION_OPTION_KEYS.initialAttributePips, "number", 54, {
    min: 0,
    step: 1,
  }),
  firstEdition(FIRST_EDITION_OPTION_KEYS.initialSkillPips, "number", 21, {
    min: 0,
    step: 1,
  }),
  firstEdition(FIRST_EDITION_OPTION_KEYS.initialCharacterPoints, "number", 5, {
    min: 0,
    step: 1,
  }),
  firstEdition(FIRST_EDITION_OPTION_KEYS.initialFatePoints, "number", 1, {
    min: 0,
    step: 1,
  }),
  firstEdition(FIRST_EDITION_OPTION_KEYS.initialMove, "number", 10, {
    min: 0,
    step: 1,
  }),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.characterPointAttributeLimit,
    "number",
    2,
    { min: 0, step: 1 },
  ),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.characterPointSkillLimit,
    "number",
    2,
    { min: 0, step: 1 },
  ),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.characterPointSpecializationLimit,
    "number",
    5,
    { min: 0, step: 1 },
  ),
  firstEdition(FIRST_EDITION_OPTION_KEYS.advanceCostAttribute, "number", 10, {
    min: 0,
    step: 0.5,
  }),
  firstEdition(FIRST_EDITION_OPTION_KEYS.advanceCostSkill, "number", 1, {
    min: 0,
    step: 0.5,
  }),
  firstEdition(
    FIRST_EDITION_OPTION_KEYS.advanceCostSpecialization,
    "number",
    0.5,
    { min: 0, step: 0.5 },
  ),
  firstEdition(FIRST_EDITION_OPTION_KEYS.wildOneStrategy, "string", "prompt", {
    choices: {
      complication: "D6E2.Settings.FirstEdition.WildOne.Complication",
      prompt: "D6E2.Settings.FirstEdition.WildOne.Prompt",
      removeHighest: "D6E2.Settings.FirstEdition.WildOne.RemoveHighest",
    },
  }),
]);

export const SECOND_EDITION_SETTINGS = Object.freeze([
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.advancementStrategy,
    "string",
    "unselected",
    {
      choices: {
        unselected:
          "D6E2.Settings.SecondEdition.AdvancementStrategy.Unselected",
        "experience-points":
          "D6E2.Settings.SecondEdition.AdvancementStrategy.ExperiencePoints",
        milestone: "D6E2.Settings.SecondEdition.AdvancementStrategy.Milestone",
        narrative: "D6E2.Settings.SecondEdition.AdvancementStrategy.Narrative",
      },
    },
  ),
  secondEdition(SECOND_EDITION_OPTION_KEYS.pipsModule, "boolean", false),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.optionalMechanical,
    "boolean",
    false,
  ),
  secondEdition(SECOND_EDITION_OPTION_KEYS.optionalTechnical, "boolean", false),
  secondEdition(SECOND_EDITION_OPTION_KEYS.optionalCharm, "boolean", false),
  secondEdition(SECOND_EDITION_OPTION_KEYS.optionalMagic, "boolean", false),
  secondEdition(SECOND_EDITION_OPTION_KEYS.optionalMysticism, "boolean", false),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.skillSpecializationModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.troublesAssetsModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount,
    "number",
    0,
    {
      min: 0,
      step: 1,
    },
  ),
  secondEdition(SECOND_EDITION_OPTION_KEYS.startingHeroPoints, "number", 1, {
    min: 0,
    step: 1,
  }),
  secondEdition(SECOND_EDITION_OPTION_KEYS.autoHeroPoints, "boolean", true),
]);

/**
 * Rulebook-facing organization for the Second Edition settings application.
 *
 * Setting keys remain independent from presentation groups so reorganizing the
 * application never migrates persisted world settings. Names and printed-page
 * references follow D6 System: Second Edition v1.1.
 */
export const SECOND_EDITION_SETTING_GROUPS = Object.freeze([
  {
    hint: "D6E2.Settings.SecondEdition.Groups.CoreCampaign.Hint",
    icon: "fa-solid fa-book-open",
    id: "core-campaign",
    kind: "core",
    name: "D6E2.Settings.SecondEdition.Groups.CoreCampaign.Name",
    pageReference: "pp. 20, 28",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount,
      SECOND_EDITION_OPTION_KEYS.startingHeroPoints,
      SECOND_EDITION_OPTION_KEYS.autoHeroPoints,
    ],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.AdditionalAttributes.Hint",
    icon: "fa-solid fa-diagram-project",
    id: "additional-attributes",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.AdditionalAttributes.Name",
    pageReference: "pp. 62-68",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.optionalCharm,
      SECOND_EDITION_OPTION_KEYS.optionalMechanical,
      SECOND_EDITION_OPTION_KEYS.optionalTechnical,
      SECOND_EDITION_OPTION_KEYS.optionalMysticism,
      SECOND_EDITION_OPTION_KEYS.optionalMagic,
    ],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.Advancement.Hint",
    icon: "fa-solid fa-arrow-trend-up",
    id: "advancement",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Advancement.Name",
    pageReference: "pp. 86-93",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.advancementStrategy],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.Pips.Hint",
    icon: "fa-solid fa-dice",
    id: "pips",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Pips.Name",
    pageReference: "pp. 94-95",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.pipsModule],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.AdvancedSkills.Hint",
    icon: "fa-solid fa-code-branch",
    id: "skill-specializations-advanced-skills",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.AdvancedSkills.Name",
    pageReference: "pp. 96-100",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.skillSpecializationModule],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.CharacterFeatures.Hint",
    icon: "fa-solid fa-star",
    id: "character-features",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.CharacterFeatures.Name",
    pageReference: "pp. 101-131",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule,
      SECOND_EDITION_OPTION_KEYS.troublesAssetsModule,
    ],
  },
] as const satisfies readonly SecondEditionSettingGroupDefinition[]);

export const SYSTEM_SETTINGS = Object.freeze([
  ...SHARED_SETTINGS,
  ...FIRST_EDITION_SETTINGS,
  ...SECOND_EDITION_SETTINGS,
]);

export function settingsForCategory(
  category: Exclude<SettingCategory, "shared">,
): readonly SystemSettingDefinition[] {
  return SYSTEM_SETTINGS.filter((setting) => setting.category === category);
}

export function secondEditionSettingsByGroup(): readonly {
  readonly definition: SecondEditionSettingGroupDefinition;
  readonly settings: readonly SystemSettingDefinition[];
}[] {
  const settingsByKey = new Map(
    SECOND_EDITION_SETTINGS.map((setting) => [setting.key, setting]),
  );
  return SECOND_EDITION_SETTING_GROUPS.map((definition) => ({
    definition,
    settings: definition.settingKeys.map((key) => {
      const setting = settingsByKey.get(key);
      if (!setting) {
        throw new Error(
          `Second Edition setting group ${definition.id} references unknown setting ${key}.`,
        );
      }
      return setting;
    }),
  }));
}
