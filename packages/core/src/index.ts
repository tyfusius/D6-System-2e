export { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV1 } from "./contracts/api";
export { D6_CAMPAIGN_PACKAGE_CONTRACT_VERSION } from "./contracts/campaign-packages";
export { D6_CONTENT_PACKAGE_CONTRACT_VERSION } from "./contracts/content-packages";
export type {
  D6ContentPackageManifestV1,
  D6OfficialContentFamily,
  D6ResolvedContentPackageV1,
  D6RulesSelectionV1,
  D6System2eContentPackageRegistry,
} from "./contracts/content-packages";
export { D6_FIRST_EDITION_GENRE_PROFILE_CONTRACT_VERSION } from "./contracts/first-edition-genre-profiles";
export type {
  D6FirstEditionAttributeV1,
  D6FirstEditionGenreProfileV1,
  D6FirstEditionSkillV1,
  D6ResolvedFirstEditionGenreProfileV1,
  D6System2eFirstEditionGenreProfileRegistry,
} from "./contracts/first-edition-genre-profiles";
export type {
  D6CampaignPackageDiagnosticCode,
  D6CampaignPackageDiagnosticV1,
  D6CampaignPackageKind,
  D6CampaignPackageManifestV1,
  D6CampaignPackageResolutionV1,
  D6CampaignPackageSourceV1,
  D6CampaignRulesFamily,
  D6ResolvedCampaignPackageV1,
  D6System2eCampaignPackageRegistry,
} from "./contracts/campaign-packages";
export {
  D6_HIDEOUT_LOCATION_TYPES,
  D6_HIDEOUT_STATES,
  hideoutRelocationPlan,
} from "./domain/hideouts";
export type {
  D6HideoutLocationType,
  D6HideoutRelocationPlan,
  D6HideoutState,
} from "./domain/hideouts";
export { D6_HIDEOUT_FEATURE_CONTRACT_VERSION } from "./contracts/hideouts";
export type {
  D6HideoutFeatureCatalogV1,
  D6HideoutFeatureV1,
  D6ResolvedHideoutFeatureCatalogV1,
  D6System2eHideoutFeatureRegistry,
} from "./contracts/hideouts";
export {
  D6_CYBERPUNK_SOURCE_PAGES,
  augmentationAcquisitionDifficulty,
  augmentationCapacity,
  augmentationFirewall,
  augmentationInstallDifficulty,
  augmentationInstallMinutes,
  cyberwareDisableTurns,
  hackingConsequence,
  personalFirewall,
} from "./domain/cyberpunk";
export type { D6AugmentationKind, D6HackConsequence } from "./domain/cyberpunk";
export {
  D6_FIRST_EDITION_FANTASY_MAGIC_CONTRACT_VERSION,
  D6_FREEFORM_MAGIC_CONTRACT_VERSION,
  D6_MAGIC_POINTS_CONTRACT_VERSION,
} from "./contracts/magic";
export type {
  D6FirstEditionFantasyMagicCastResultV1,
  D6FirstEditionFantasyMagicDesignV1,
  D6FirstEditionFantasyMagicTradition,
  D6FreeformMagicCastResultV1,
  D6FreeformMagicDesignV1,
  D6FreeformMagicDifficultyV1,
  D6FreeformMagicResistance,
  D6FreeformMagicSchool,
  D6MagicCastResultV1,
  D6MagicPointCastResultV1,
  D6MagicPointPoolV1,
  D6System2eMagicApi,
} from "./contracts/magic";
export {
  D6_PSIONIC_DISCIPLINES,
  D6_PSIONICS_CONTRACT_VERSION,
} from "./contracts/psionics";
export type {
  D6PsionicDiscipline,
  D6PsionicDisciplineStateV1,
  D6PsionicPowerCatalogV1,
  D6PsionicPowerRollOptionsV1,
  D6PsionicPowerStateV1,
  D6PsionicPowerV1,
  D6PsionicsStateV1,
  D6PsionicTrainingMethod,
  D6ResolvedPsionicPowerCatalogV1,
  D6System2ePsionicPowerRegistry,
  D6System2ePsionicsApi,
} from "./contracts/psionics";
export {
  freeformMagicDifficulty,
  freeformMagicResistancePower,
  freeformMagicUntrainedPenalty,
  magicPointCastingCost,
  magicPointMaximum,
  magicPointPool,
  recoverMagicPoints,
} from "./domain/freeform-magic";
export { firstEditionStrengthDamageScore } from "./domain/first-edition-strength-damage";
export {
  D6_ACTIVE_RESPONSIVE_COMBAT_CONTRACT_VERSION,
  canSecondEditionActionFeint,
  canSecondEditionActionRiposte,
  secondEditionAutofirePlan,
  secondEditionFeintDefensePenalty,
  secondEditionFullDefensePlan,
} from "./domain/active-responsive-combat";
export type {
  SecondEditionAutofirePlan,
  SecondEditionFullDefensePlan,
} from "./domain/active-responsive-combat";
export { D6_CHARACTER_TEMPLATE_CONTRACT_VERSION } from "./contracts/character-templates";
export type {
  D6CharacterTemplateApplicationV1,
  D6CharacterTemplateCatalogV1,
  D6CharacterTemplateIssueCode,
  D6CharacterTemplateItemKind,
  D6CharacterTemplateItemV1,
  D6CharacterTemplatePreviewV1,
  D6CharacterTemplateSuperheroicV1,
  D6CharacterTemplateSuperpowerV1,
  D6CharacterTemplateV1,
  D6ResolvedCharacterTemplateCatalogV1,
  D6System2eCharacterTemplateApi,
  D6System2eCharacterTemplateRegistry,
} from "./contracts/character-templates";
export { D6_BESTIARY_CONTRACT_VERSION } from "./contracts/bestiary";
export type {
  D6BestiaryCatalogV1,
  D6BestiaryCreationV1,
  D6BestiaryEntryV1,
  D6BestiaryIssueCode,
  D6BestiaryItemKind,
  D6BestiaryItemV1,
  D6BestiaryPreviewV1,
  D6ResolvedBestiaryCatalogV1,
  D6System2eBestiaryApi,
  D6System2eBestiaryRegistry,
} from "./contracts/bestiary";
export type {
  D6AdvancementResultV1,
  D6MilestoneBalanceV1,
  D6NarrativeAdvancementResultV1,
  D6NarrativeArcProposalV1,
  D6System2eAdvancementApi,
} from "./contracts/advancement";
export { D6_ACTOR_READ_MODEL_VERSION } from "./contracts/actor-read-model";
export type {
  D6ActorAttributeReadModelV1,
  D6ActorFeatureReadModelV1,
  D6ActorFeatureType,
  D6ActorReadModelV1,
  D6ActorRollableItemMode,
  D6ActorRollableItemReadModelV1,
  D6ActorSkillReadModelV1,
  D6MachineReadModelV1,
  D6System2eReadApi,
} from "./contracts/actor-read-model";
export {
  FIRST_EDITION_DAMAGE_MODES,
  applyFirstEditionBodyPointDamage,
  firstEditionBodyPointHealingPlan,
  firstEditionBodyPointMaximum,
  firstEditionBodyPointRescueMinimum,
  firstEditionBodyPointSkillLossDice,
  firstEditionBodyPointWound,
  normalizeFirstEditionBodyPoints,
  recoverFirstEditionBodyPoints,
} from "./domain/first-edition-body-points";
export type {
  FirstEditionBodyPointHealingPlan,
  FirstEditionBodyPointState,
  FirstEditionDamageMode,
} from "./domain/first-edition-body-points";
export {
  FIRST_EDITION_ACCUMULATING_STUNS_VERSION,
  applyFirstEditionAccumulatingStun,
  emptyFirstEditionAccumulatingStuns,
  firstEditionAccumulatingStunThreshold,
  normalizeFirstEditionAccumulatingStuns,
  recoverFirstEditionAccumulatingStunsAtRoundStart,
} from "./domain/first-edition-accumulating-stuns";
export type {
  FirstEditionAccumulatingStunApplication,
  FirstEditionAccumulatingStunState,
} from "./domain/first-edition-accumulating-stuns";
export {
  D6_FEATURE_SESSION_CONTRACT_VERSION,
  D6_FEATURE_SESSION_MAX_USES,
} from "./contracts/features";
export { D6_FEATURE_CATALOG_CONTRACT_VERSION } from "./contracts/feature-catalogs";
export type {
  D6FeatureCatalogApplicationV1,
  D6FeatureCatalogIssueCode,
  D6FeatureCatalogPreviewV1,
  D6FeatureCatalogV1,
  D6FeatureDefinitionV1,
  D6FeatureMechanicApplication,
  D6FeatureMechanicKind,
  D6FeatureMechanicV1,
  D6RankedFeatureKind,
  D6ResolvedFeatureCatalogV1,
  D6System2eFeatureCatalogApi,
  D6System2eFeatureCatalogRegistry,
} from "./contracts/feature-catalogs";
export type {
  D6FeatureCommandResultV1,
  D6FeatureInvocationV1,
  D6FeatureSessionStateV1,
  D6NarrativeFeatureChoice,
  D6System2eFeatureApi,
} from "./contracts/features";
export type {
  D6System2eApiV1,
  D6System2eCapability,
  D6System2eCapabilitySet,
  D6System2eRulesPresetResult,
} from "./contracts/api";
export type {
  D6EquipmentEra,
  D6EquipmentEraSelection,
  D6EquipmentKind,
  D6System2eEquipmentCatalogDefinition,
  D6System2eEquipmentCatalogEntry,
  D6System2eEquipmentCatalogRegistry,
  D6System2eResolvedEquipmentCatalog,
  D6System2eResolvedTerminology,
  D6System2eTerminologyContribution,
  D6System2eTerminologyRegistry,
  D6System2eThemeDefinition,
  D6System2eThemeDiceDefinition,
  D6System2eThemeRegistry,
} from "./contracts/contributions";
export { D6_EQUIPMENT_ERAS } from "./contracts/contributions";
export type {
  D6ConditionCommandOptions,
  D6ConditionCommandResultV1,
  D6FirstEditionWoundCommandResultV1,
  D6PostureCommandResultV1,
  D6System2eHealthApi,
} from "./contracts/health";
export { D6_COMBAT_CONTRACT_VERSION } from "./contracts/combat";
export type {
  D6CombatActionForfeitureV1,
  D6CombatActionKind,
  D6CombatCommandResultV1,
  D6CombatantRoundReadModelV1,
  D6CombatantRoundStateV1,
  D6CombatDeclarationV1,
  D6DeclaredCombatActionV1,
  D6FirstEditionActionCommitmentV1,
  D6FirstEditionActionDeclarationV1,
  D6FirstEditionActiveDefenseResultV1,
  D6FirstEditionActiveDefenseV1,
  D6FirstEditionSegmentMovementV1,
  D6SecondEditionFeintV1,
  D6SecondEditionFullDefenseV1,
  D6System2eCombatApi,
} from "./contracts/combat";
export { D6_ROLL_CONTRACT_VERSION } from "./contracts/roll";
export { D6_CHASE_CONTRACT_VERSION } from "./contracts/chase";
export type {
  D6ChaseExchangeV1,
  D6ChaseParticipantV1,
  D6ChaseResolveV1,
  D6ChaseRollV1,
  D6ChaseSide,
  D6ChaseStartV1,
  D6ChaseStateV1,
  D6ChaseStatus,
  D6System2eChaseApi,
} from "./contracts/chase";
export {
  createD6Chase,
  resolveD6ChaseExchange,
  submitD6ChaseRoll,
} from "./domain/chase";
export type {
  D6ActionEconomyRollContext,
  D6AdvancedSkillRollContext,
  D6DoublingDownRollContext,
  D6EnvironmentRollContext,
  D6FirstEditionActiveDefenseRollContext,
  D6FirstEditionMovementRollContext,
  D6MachineCrewRollContext,
  D6RollContextV1,
  D6ResistanceRollContext,
  D6ScaleRollApplication,
  D6ScaleRollContext,
  D6RollKind,
  D6HeroPointUse,
  D6RollInvocationOptionsV1,
  D6RollMode,
  D6RollPool,
  D6RollRequestV1,
  D6RollResultV1,
  D6RollOpposition,
  D6RollSource,
  D6RequestedRollContextV1,
  D6RequestedRollVisibility,
  D6System2eRollApi,
  D6WeaponAttackRollContext,
  D6WildDieChoice,
  D6WildDieOutcome,
  D6WildDiePolicy,
} from "./contracts/roll";
export { canDoubleDown, doublingDownRequest } from "./domain/doubling-down";
export {
  D6_ENVIRONMENT_EFFECT_VERSION,
  environmentBreathRounds,
  environmentThreat,
  recoverEnvironmentCondition,
  resolveEnvironmentFailure,
  severeEnvironmentPromotesStunned,
} from "./domain/environment";
export type {
  D6EnvironmentEffectV1,
  D6EnvironmentFailureResolution,
  D6EnvironmentHazard,
  D6EnvironmentSeverity,
  D6EnvironmentThreat,
} from "./domain/environment";
export {
  ACTION_DECLARATION_ASSISTANCE_MODES,
  actionEconomyRollPlan,
  firstEditionActionCommitment,
  spendFirstEditionCommittedAction,
} from "./domain/action-economy";
export type {
  ActionDeclarationAssistanceMode,
  ActionEconomyRollPlan,
  ActionEconomyRollPlanInput,
  ActionPenaltySource,
  FirstEditionActionCommitment,
  FirstEditionDefenseCommitment,
} from "./domain/action-economy";
export {
  firstEditionActiveDefensePlan,
  firstEditionMovementPlan,
} from "./domain/first-edition-combat";
export type {
  FirstEditionActiveDefenseKind,
  FirstEditionActiveDefenseMode,
  FirstEditionActiveDefensePlan,
  FirstEditionMovementPlan,
  FirstEditionMovementPlanInput,
  FirstEditionMovementType,
} from "./domain/first-edition-combat";
export { evaluateDifficulty } from "./domain/check";
export type { DifficultyEvaluation, SuccessEvaluator } from "./domain/check";
export {
  FIRST_EDITION_WOUND_LEVELS,
  firstEditionAssistedHealingDifficulty,
  firstEditionAssistedHealingResolution,
  firstEditionDamageResolution,
  firstEditionIncapacitationCheck,
  firstEditionMortalityResolution,
  firstEditionMortalityElapsedMinutes,
  firstEditionNaturalHealingResolution,
  firstEditionNaturalHealingRule,
  firstEditionStunDamageResolution,
  firstEditionWoundPenaltyScore,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  multipleActionPenaltyScore,
  SECOND_EDITION_CONDITIONS,
  secondEditionAttackHits,
  secondEditionConditionAllowsActions,
  secondEditionConditionPenaltyScore,
  secondEditionCoverDefensePlan,
  secondEditionDamageResolution,
  secondEditionDeclarationPlan,
  secondEditionDefenseForPosture,
  secondEditionDefenseKind,
  secondEditionDodgeDefense,
  secondEditionFlyingGuidance,
  secondEditionMovementPlan,
  secondEditionNoDodgeDefensePlan,
  secondEditionRangeForDistance,
  secondEditionResistancePlan,
  secondEditionRoundStartCondition,
  secondEditionScaleInteraction,
  secondEditionStaticDefense,
  secondEditionWeaponAttackKind,
} from "./domain/combat";
export {
  secondEditionMachineRepairPlan,
  secondEditionMachineResistancePlan,
  secondEditionMachineWeaponAttackPlan,
} from "./domain/machine-combat";
export type {
  SecondEditionMachineRepairPlan,
  SecondEditionMachineResistancePlan,
  SecondEditionMachineWeaponAttackInput,
  SecondEditionMachineWeaponAttackPlan,
} from "./domain/machine-combat";
export type {
  FirstEditionDamageOutcome,
  FirstEditionDamageResolution,
  FirstEditionHealingOutcome,
  FirstEditionHealingResolution,
  FirstEditionNaturalHealingRule,
  FirstEditionStunDamageResolution,
  FirstEditionStunOutcome,
  FirstEditionWoundLevel,
  SecondEditionArmorContribution,
  SecondEditionAttackKind,
  SecondEditionCondition,
  SecondEditionCoverDefensePlan,
  SecondEditionDamageOutcome,
  SecondEditionDamageResolution,
  SecondEditionHyperLethalOptions,
  SecondEditionDeclarationPlan,
  SecondEditionDeclarationPoolPlan,
  SecondEditionDeclaredPool,
  SecondEditionDefenseKind,
  SecondEditionDodgeBasis,
  SecondEditionFlyingGuidance,
  SecondEditionMovementMode,
  SecondEditionMovementPlan,
  SecondEditionNoDodgeDefensePlan,
  SecondEditionPosture,
  SecondEditionRangeBand,
  SecondEditionRangeResolution,
  SecondEditionResistancePlan,
  SecondEditionScaleInteraction,
  SecondEditionWeaponRanges,
} from "./domain/combat";
export {
  combatRoundActionPenaltyScore,
  combatRoundMovementSkillPenaltyScore,
  combatRoundPenaltyLabel,
  combatRoundPenaltyScore,
  commitFirstEditionActions,
  completeNextCombatAction,
  createCombatantRoundState,
  currentCombatAction,
  declareCombatActions,
  enterSecondEditionFullDefense,
  recordSecondEditionFeint,
  clearSecondEditionFeint,
  forfeitRemainingCombatActions,
  grantSuperheroicCombatAction,
  firstEditionCommitmentFromState,
  recordFirstEditionActiveDefense,
  recordFirstEditionSegmentMovement,
  spendFirstEditionAction,
} from "./domain/combat-round";
export { firstEditionSegmentMovementPlan } from "./domain/first-edition-segment-movement";
export type {
  FirstEditionSegmentMovementInput,
  FirstEditionSegmentMovementPlan,
} from "./domain/first-edition-segment-movement";
export {
  D6_SECOND_EDITION_CAMPAIGN_PROFILE_VERSION,
  resolveSecondEditionCampaignProfile,
  SECOND_EDITION_CORE_ATTRIBUTE_IDS,
  SECOND_EDITION_OPTIONAL_ATTRIBUTE_IDS,
} from "./domain/campaign-profile";
export type {
  SecondEditionCampaignProfileId,
  SecondEditionCampaignProfileInput,
  SecondEditionCampaignProfileV1,
} from "./domain/campaign-profile";
export {
  EDITION_CAPABILITY_PROFILE_VERSION,
  resolveEditionCapabilityProfile,
} from "./domain/edition-capabilities";
export type {
  EditionCapabilityDecision,
  EditionCapabilityOptions,
  EditionCapabilityOwner,
  EditionCapabilityProfileV1,
  EditionCapabilityState,
} from "./domain/edition-capabilities";
export {
  advancedSkillAugmentedScore,
  nextSecondEditionCreationScore,
  secondEditionCreationProgress,
  specializationScore,
  validateAdvancedSkill,
} from "./domain/character-creation";
export type {
  AdvancedSkillIssue,
  AdvancedSkillValidationInput,
  SecondEditionCreationInput,
  SecondEditionCreationFeature,
  SecondEditionCreationIssue,
  SecondEditionCreationProgress,
  SecondEditionCreationSkill,
  SecondEditionCreationSkillKind,
} from "./domain/character-creation";
export {
  advancementCost,
  secondEditionExperienceAdvancement,
  secondEditionMilestoneSpend,
  secondEditionNarrativeArcValidation,
  secondEditionSpecializationAcquisition,
  type AdvancementCostMultipliers,
  type AdvancementCostOptions,
  type AdvancementKind,
  type SecondEditionAdvancementKind,
  type SecondEditionAdvancementStrategy,
  type SecondEditionExperienceAdvancement,
  type SecondEditionMilestoneBalance,
  type SecondEditionMilestoneSpend,
  type SecondEditionNarrativeArc,
  type SecondEditionNarrativeArcStatus,
  type SecondEditionNarrativeArcStep,
  type SecondEditionNarrativeArcValidation,
  type SecondEditionNarrativeRewardKind,
  type SecondEditionSpecializationAcquisition,
} from "./domain/advancement";
export {
  addDieCodes,
  addPipScores,
  dieCode,
  dieCodeFromPipScore,
  formatDieCode,
  formatPipScore,
  normalizeDieCode,
  pipScore,
  pipScoreFromDieCode,
  PIPS_PER_DIE,
} from "./domain/die-code";
export type { DieCode } from "./domain/die-code";
export {
  addEffectivePipScores,
  effectivePipScore,
  isWholeDieScore,
  pipRulesStrategy,
  usesPips,
} from "./domain/pip-rules";
export type { PipRulesStrategy } from "./domain/pip-rules";
export {
  SUPERPOWER_CREATION_DICE,
  superpowerTalentCostPlan,
  clearSecretIdentityName,
  gainSecretIdentitySuspicion,
  initialSecretIdentityState,
  makeSecretIdentityPublic,
  reinforceSecretIdentity,
  spendSecretIdentityHeroPoint,
  SUPERHEROIC_DIE_CODE_CAPS,
  superheroicEquipmentRebuildDays,
  superheroicEquipmentStateAfterComplication,
  superheroicEquipmentUsePenaltyScore,
  superheroicDieCodeCapPlan,
  nemesisEncounterPointPool,
  nemesisExperienceAward,
} from "./domain/superheroic";
export type {
  SecretIdentityState,
  SecretIdentityStatus,
  SuperheroicDieCodeCap,
  SuperheroicDieCodeCapPlan,
  SuperheroicEquipmentPowerSnapshot,
  SuperheroicEquipmentState,
  SuperpowerCampaignLevel,
  SuperpowerTalentCostPlan,
} from "./domain/superheroic";
export {
  canPreventBecomingStunned,
  canRerollFailedRoll,
  heroPointBalanceAfter,
  heroPointSpendLimit,
  heroPointRerollRequest,
  secondEditionHeroPointStrategy,
  type SecondEditionHeroPointStrategy,
} from "./domain/hero-points";
export { evaluateOpposedRoll } from "./domain/opposed";
export type {
  D6OpposedEvaluation,
  D6OpposedEvaluationInput,
  D6OpposedTieBreak,
  D6OpposedWinner,
  D6ParticipantKind,
} from "./domain/opposed";
export {
  firstEditionExplosiveRangeForDistance,
  firstEditionGrenadeTargetingDifficulty,
  firstEditionStrengthAdjustedThrowRanges,
  secondEditionBrawnAdjustedThrowRanges,
  secondEditionExplosiveRangeForDistance,
} from "./domain/explosives";
export type {
  D6ExplosiveRangeResolution,
  D6ExplosiveThrowRanges,
} from "./domain/explosives";
export { firstEditionSegmentPlan } from "./domain/first-edition-action-segments";
export type {
  FirstEditionSegmentParticipant,
  FirstEditionSegmentPlan,
} from "./domain/first-edition-action-segments";
export {
  basicInitiativeDeclarationOrder,
  firstEditionInitiativeFormula,
  nextNarrativeInitiativeOrder,
  orderedInitiativeIds,
  secondEditionInitiativeStrategy,
} from "./domain/initiative";
export type {
  FirstEditionInitiativeFormula,
  FirstEditionInitiativeOptions,
  SecondEditionInitiativeStrategy,
} from "./domain/initiative";
export {
  acceptedWildDieChoice,
  buildD6RollPool,
  effectiveD6RollScore,
  resolveD6Roll,
} from "./domain/roll";
export type { ResolveD6RollInput } from "./domain/roll";
export {
  compatibilityPreset,
  OPEN_D6_COMPATIBILITY,
  resolveRulesProfile,
  RULES_COMPATIBILITY_KEYS,
  SECOND_EDITION_COMPATIBILITY,
} from "./domain/rules-profile";
export type {
  RulesCompatibility,
  RulesCompatibilityKey,
  RulesProfile,
  RulesProfileId,
} from "./domain/rules-profile";
export { MigrationRunner } from "./migrations/migration-runner";
export type {
  ActorSource,
  ItemSource,
  Migration,
  MigrationContext,
  MigrationMetadata,
  MigrationReport,
  MigrationResult,
  SystemDataSource,
} from "./migrations/migration";
