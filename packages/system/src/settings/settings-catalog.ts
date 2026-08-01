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
export type SecondEditionModuleGenre =
  "core" | "fantasy" | "science-fiction" | "superheroic";
export type SecondEditionModuleSupport =
  "available" | "configurable" | "partial" | "planned";

export interface SecondEditionSettingGroupDefinition {
  readonly hint: string;
  readonly icon: string;
  readonly id: string;
  readonly kind: SecondEditionSettingGroupKind;
  readonly name: string;
  readonly pageReference: string;
  readonly settingKeys: readonly string[];
}

export interface SecondEditionModuleCatalogEntry {
  readonly dependencyIds?: readonly string[];
  readonly genre: SecondEditionModuleGenre;
  readonly hint: string;
  readonly id: string;
  readonly incompatibilityFamily?:
    "advancement" | "hero-points" | "initiative" | "wild-die";
  readonly name: string;
  readonly pageReference: string;
  readonly settingGroupId?: string;
  readonly support: SecondEditionModuleSupport;
}

export const SHARED_SETTING_KEYS = Object.freeze({
  actionDeclarationAssistance: "actionDeclarationAssistance",
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
  chasesModule: "secondEditionChasesModule",
  environmentsModule: "secondEditionEnvironmentsModule",
  fantasySkillsModule: "secondEditionFantasySkillsModule",
  freeformMagicModule: "secondEditionFreeformMagicModule",
  noDodgeDefenseModule: "secondEditionNoDodgeDefenseModule",
  hyperLethalKillingBlows: "secondEditionHyperLethalKillingBlows",
  hyperLethalMaximumArmor: "secondEditionHyperLethalMaximumArmor",
  hyperLethalRemoveStunned: "secondEditionHyperLethalRemoveStunned",
  hyperLethalRemoveWounded: "secondEditionHyperLethalRemoveWounded",
  equipmentEra: "secondEditionEquipmentEra",
  advancementStrategy: "secondEditionAdvancementStrategy",
  autoHeroPoints: "secondEditionAutoHeroPoints",
  heroPointStrategy: "secondEditionHeroPointStrategy",
  initiativeStrategy: "secondEditionInitiativeStrategy",
  heroicHeroPointsCarryOver: "secondEditionHeroicHeroPointsCarryOver",
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
  wildDieStrategy: "secondEditionWildDieStrategy",
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
  shared(
    SHARED_SETTING_KEYS.actionDeclarationAssistance,
    "string",
    "optional",
    {
      choices: {
        optional: "D6E2.Settings.Shared.actionDeclarationAssistance.Optional",
        enforced: "D6E2.Settings.Shared.actionDeclarationAssistance.Enforced",
        manual: "D6E2.Settings.Shared.actionDeclarationAssistance.Manual",
      },
    },
  ),
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
  shared(SHARED_SETTING_KEYS.showPcQuickbar, "boolean", true),
  shared(SHARED_SETTING_KEYS.showActiveTasksQuickbar, "boolean", true),
]);

const COMPATIBILITY_LOCALIZATION: Readonly<Record<string, string>> =
  Object.freeze({
    [COMPATIBILITY_SETTING_KEYS.firstEditionActionEconomy]: "ActionEconomy",
    [COMPATIBILITY_SETTING_KEYS.firstEditionActiveDefenses]: "ActiveDefenses",
    [COMPATIBILITY_SETTING_KEYS.firstEditionAdvancement]: "Advancement",
    [COMPATIBILITY_SETTING_KEYS.firstEditionAttributes]: "Attributes",
    [COMPATIBILITY_SETTING_KEYS.firstEditionDamage]: "Damage",
    [COMPATIBILITY_SETTING_KEYS.firstEditionInitiative]: "Initiative",
    [COMPATIBILITY_SETTING_KEYS.firstEditionMovement]: "Movement",
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
  firstEdition(FIRST_EDITION_OPTION_KEYS.bodyPoints, "string", "wounds", {
    choices: {
      wounds: "D6E2.Settings.FirstEdition.DamageMode.Wounds",
      "body-points": "D6E2.Settings.FirstEdition.DamageMode.BodyPoints",
      "body-points-with-wounds":
        "D6E2.Settings.FirstEdition.DamageMode.Combined",
    },
  }),
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
  secondEdition(SECOND_EDITION_OPTION_KEYS.chasesModule, "boolean", false),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.environmentsModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.noDodgeDefenseModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveStunned,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveWounded,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.hyperLethalMaximumArmor,
    "boolean",
    false,
  ),
  secondEdition(SECOND_EDITION_OPTION_KEYS.equipmentEra, "string", "none", {
    choices: {
      none: "D6E2.Equipment.Era.None",
      medieval: "D6E2.Equipment.Era.Medieval",
      modern: "D6E2.Equipment.Era.Modern",
      "science-fiction": "D6E2.Equipment.Era.ScienceFiction",
    },
  }),
  secondEdition(SECOND_EDITION_OPTION_KEYS.wildDieStrategy, "string", "core", {
    choices: {
      core: "D6E2.Settings.SecondEdition.WildDieStrategy.Core",
      basic: "D6E2.Settings.SecondEdition.WildDieStrategy.Basic",
      classic: "D6E2.Settings.SecondEdition.WildDieStrategy.Classic",
      simple: "D6E2.Settings.SecondEdition.WildDieStrategy.Simple",
    },
  }),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.initiativeStrategy,
    "string",
    "standard",
    {
      choices: {
        standard: "D6E2.Settings.SecondEdition.InitiativeStrategy.Standard",
        simple: "D6E2.Settings.SecondEdition.InitiativeStrategy.Simple",
        basic: "D6E2.Settings.SecondEdition.InitiativeStrategy.Basic",
        narrative: "D6E2.Settings.SecondEdition.InitiativeStrategy.Narrative",
      },
    },
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.heroPointStrategy,
    "string",
    "heroic",
    {
      choices: {
        heroic: "D6E2.Settings.SecondEdition.HeroPointStrategy.Heroic",
        basic: "D6E2.Settings.SecondEdition.HeroPointStrategy.Basic",
        classic: "D6E2.Settings.SecondEdition.HeroPointStrategy.Classic",
      },
    },
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver,
    "boolean",
    false,
  ),
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
    SECOND_EDITION_OPTION_KEYS.fantasySkillsModule,
    "boolean",
    false,
  ),
  secondEdition(
    SECOND_EDITION_OPTION_KEYS.freeformMagicModule,
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
    settingKeys: [SECOND_EDITION_OPTION_KEYS.optionalSkillModuleCount],
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
    hint: "D6E2.Settings.SecondEdition.Groups.Initiative.Hint",
    icon: "fa-solid fa-list-ol",
    id: "alternate-initiative",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Initiative.Name",
    pageReference: "pp. 69-70",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.initiativeStrategy],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.WildDie.Hint",
    icon: "fa-solid fa-dice-one",
    id: "alternate-wild-die",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.WildDie.Name",
    pageReference: "pp. 71-73",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.wildDieStrategy],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.Chases.Hint",
    icon: "fa-solid fa-route",
    id: "chases",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Chases.Name",
    pageReference: "pp. 73-74",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.chasesModule],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.HeroPoints.Hint",
    icon: "fa-solid fa-bolt",
    id: "hero-points",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.HeroPoints.Name",
    pageReference: "pp. 75-76",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.heroPointStrategy,
      SECOND_EDITION_OPTION_KEYS.startingHeroPoints,
      SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver,
      SECOND_EDITION_OPTION_KEYS.autoHeroPoints,
    ],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.Environments.Hint",
    icon: "fa-solid fa-cloud-bolt",
    id: "environments",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Environments.Name",
    pageReference: "pp. 77-78",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.environmentsModule],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.Equipment.Hint",
    icon: "fa-solid fa-toolbox",
    id: "equipment-by-genre-era",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.Equipment.Name",
    pageReference: "pp. 79-85",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.equipmentEra],
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
    hint: "D6E2.Settings.SecondEdition.Groups.HyperLethalCombat.Hint",
    icon: "fa-solid fa-skull-crossbones",
    id: "hyper-lethal-combat",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.HyperLethalCombat.Name",
    pageReference: "pp. 89-90",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveStunned,
      SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveWounded,
      SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows,
      SECOND_EDITION_OPTION_KEYS.hyperLethalMaximumArmor,
    ],
  },
  {
    hint: "D6E2.Settings.SecondEdition.Groups.NoDodgeDefense.Hint",
    icon: "fa-solid fa-bullseye",
    id: "no-dodge-defense",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.NoDodgeDefense.Name",
    pageReference: "p. 94",
    settingKeys: [SECOND_EDITION_OPTION_KEYS.noDodgeDefenseModule],
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
  {
    hint: "D6E2.Settings.SecondEdition.Groups.FantasySkillsMagic.Hint",
    icon: "fa-solid fa-wand-sparkles",
    id: "fantasy-skills-magic",
    kind: "module",
    name: "D6E2.Settings.SecondEdition.Groups.FantasySkillsMagic.Name",
    pageReference: "pp. 141-159",
    settingKeys: [
      SECOND_EDITION_OPTION_KEYS.fantasySkillsModule,
      SECOND_EDITION_OPTION_KEYS.freeformMagicModule,
    ],
  },
] as const satisfies readonly SecondEditionSettingGroupDefinition[]);

const moduleCatalogEntry = (
  id: string,
  genre: SecondEditionModuleGenre,
  pageReference: string,
  support: SecondEditionModuleSupport,
  options: Partial<SecondEditionModuleCatalogEntry> = {},
): SecondEditionModuleCatalogEntry => ({
  genre,
  hint: `D6E2.Settings.SecondEdition.Catalog.${id}.Hint`,
  id,
  name: `D6E2.Settings.SecondEdition.Catalog.${id}.Name`,
  pageReference,
  support,
  ...options,
});

/**
 * Complete printed module catalog.
 *
 * The reference-sheet worksheet on p. 249 omits several modules named by the
 * introduction and table of contents. This catalog deliberately uses the union
 * of those printed sources so every module remains visible to a Gamemaster.
 */
export const SECOND_EDITION_MODULE_CATALOG = Object.freeze([
  moduleCatalogEntry(
    "additional-attributes",
    "core",
    "pp. 62-68",
    "configurable",
    {
      settingGroupId: "additional-attributes",
    },
  ),
  moduleCatalogEntry(
    "alternate-initiative",
    "core",
    "pp. 69-70",
    "configurable",
    {
      incompatibilityFamily: "initiative",
      settingGroupId: "alternate-initiative",
    },
  ),
  moduleCatalogEntry(
    "alternate-wild-die",
    "core",
    "pp. 71-73",
    "configurable",
    {
      incompatibilityFamily: "wild-die",
      settingGroupId: "alternate-wild-die",
    },
  ),
  moduleCatalogEntry("chases", "core", "pp. 73-74", "configurable", {
    settingGroupId: "chases",
  }),
  moduleCatalogEntry("hero-points", "core", "pp. 75-76", "configurable", {
    incompatibilityFamily: "hero-points",
    settingGroupId: "hero-points",
  }),
  moduleCatalogEntry("environments", "core", "pp. 77-78", "configurable", {
    settingGroupId: "environments",
  }),
  moduleCatalogEntry(
    "equipment-by-genre-era",
    "core",
    "pp. 79-85",
    "configurable",
    { settingGroupId: "equipment-by-genre-era" },
  ),
  moduleCatalogEntry("experience-points", "core", "pp. 86-88", "configurable", {
    incompatibilityFamily: "advancement",
    settingGroupId: "advancement",
  }),
  moduleCatalogEntry(
    "hyper-lethal-combat",
    "core",
    "pp. 89-90",
    "configurable",
    {
      dependencyIds: ["hero-points"],
      settingGroupId: "hyper-lethal-combat",
    },
  ),
  moduleCatalogEntry(
    "milestone-advancement",
    "core",
    "pp. 90-91",
    "configurable",
    {
      incompatibilityFamily: "advancement",
      settingGroupId: "advancement",
    },
  ),
  moduleCatalogEntry(
    "narrative-advancement",
    "core",
    "pp. 92-93",
    "configurable",
    {
      incompatibilityFamily: "advancement",
      settingGroupId: "advancement",
    },
  ),
  moduleCatalogEntry("no-dodge-defense", "core", "p. 94", "configurable", {
    settingGroupId: "no-dodge-defense",
  }),
  moduleCatalogEntry("pips", "core", "pp. 94-95", "configurable", {
    settingGroupId: "pips",
  }),
  moduleCatalogEntry(
    "skill-specializations-advanced-skills",
    "core",
    "pp. 96-100",
    "configurable",
    { settingGroupId: "skill-specializations-advanced-skills" },
  ),
  moduleCatalogEntry("perks-flaws-talents", "core", "pp. 101-129", "partial", {
    dependencyIds: ["hero-points", "pips"],
    settingGroupId: "character-features",
  }),
  moduleCatalogEntry("troubles-assets", "core", "pp. 130-131", "configurable", {
    dependencyIds: ["hero-points"],
    settingGroupId: "character-features",
  }),
  moduleCatalogEntry("general-foes-bestiary", "core", "pp. 132-137", "partial"),
  moduleCatalogEntry("templates", "core", "pp. 138-139", "partial"),

  moduleCatalogEntry(
    "fantasy-skills",
    "fantasy",
    "pp. 141-145",
    "configurable",
    { settingGroupId: "fantasy-skills-magic" },
  ),
  moduleCatalogEntry(
    "freeform-skill-based-magic",
    "fantasy",
    "pp. 145-159",
    "configurable",
    {
      dependencyIds: [
        "additional-attributes",
        "skill-specializations-advanced-skills",
      ],
      settingGroupId: "fantasy-skills-magic",
    },
  ),
  moduleCatalogEntry(
    "magic-points-casting",
    "fantasy",
    "pp. 160-161",
    "planned",
    {
      dependencyIds: ["additional-attributes"],
    },
  ),
  moduleCatalogEntry(
    "active-responsive-combat",
    "fantasy",
    "pp. 162-164",
    "planned",
  ),
  moduleCatalogEntry("fantasy-bestiary", "fantasy", "pp. 165-167", "planned"),
  moduleCatalogEntry("fantasy-templates", "fantasy", "pp. 168-171", "planned", {
    dependencyIds: [
      "additional-attributes",
      "skill-specializations-advanced-skills",
    ],
  }),

  moduleCatalogEntry(
    "science-fiction-skills",
    "science-fiction",
    "pp. 173-175",
    "partial",
  ),
  moduleCatalogEntry(
    "starships-starship-combat",
    "science-fiction",
    "pp. 176-180",
    "available",
    { dependencyIds: ["additional-attributes", "science-fiction-skills"] },
  ),
  moduleCatalogEntry(
    "driving-vehicles",
    "science-fiction",
    "pp. 181-183",
    "available",
    {
      dependencyIds: ["additional-attributes", "science-fiction-skills"],
    },
  ),
  moduleCatalogEntry("psionics", "science-fiction", "pp. 184-190", "planned"),
  moduleCatalogEntry("cyberpunk", "science-fiction", "pp. 191-195", "planned", {
    dependencyIds: ["additional-attributes"],
  }),
  moduleCatalogEntry("scale", "science-fiction", "pp. 196-197", "available"),
  moduleCatalogEntry(
    "science-fiction-bestiary",
    "science-fiction",
    "pp. 198-199",
    "planned",
  ),
  moduleCatalogEntry(
    "science-fiction-templates",
    "science-fiction",
    "pp. 200-203",
    "planned",
    {
      dependencyIds: ["additional-attributes"],
    },
  ),

  moduleCatalogEntry(
    "superheroic-skills",
    "superheroic",
    "pp. 205-206",
    "planned",
  ),
  moduleCatalogEntry(
    "superheroic-hero-points",
    "superheroic",
    "p. 207",
    "planned",
    {
      dependencyIds: ["hero-points"],
      incompatibilityFamily: "hero-points",
    },
  ),
  moduleCatalogEntry("capping-die-codes", "superheroic", "p. 208", "planned"),
  moduleCatalogEntry(
    "secret-identities",
    "superheroic",
    "pp. 208-211",
    "planned",
    {
      dependencyIds: ["troubles-assets"],
    },
  ),
  moduleCatalogEntry("superpowers", "superheroic", "pp. 212-226", "planned", {
    dependencyIds: ["perks-flaws-talents"],
  }),
  moduleCatalogEntry("gadgets-gear", "superheroic", "pp. 227-228", "planned", {
    dependencyIds: ["equipment-by-genre-era", "superpowers"],
  }),
  moduleCatalogEntry(
    "hidden-bases-hideouts",
    "superheroic",
    "pp. 229-234",
    "planned",
    {
      dependencyIds: ["perks-flaws-talents"],
    },
  ),
  moduleCatalogEntry(
    "nemesis-companions-sidekicks",
    "superheroic",
    "pp. 235-237",
    "planned",
    {
      dependencyIds: ["perks-flaws-talents"],
    },
  ),
  moduleCatalogEntry(
    "superheroic-templates",
    "superheroic",
    "pp. 238-239",
    "planned",
    {
      dependencyIds: ["additional-attributes", "superpowers"],
    },
  ),
] as const satisfies readonly SecondEditionModuleCatalogEntry[]);

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
