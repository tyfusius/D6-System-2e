export { D6_SYSTEM_2E_API_VERSION, isD6System2eApiV1 } from "./contracts/api";
export type {
  D6AdvancementResultV1,
  D6System2eAdvancementApi,
} from "./contracts/advancement";
export { D6_ACTOR_READ_MODEL_VERSION } from "./contracts/actor-read-model";
export type {
  D6ActorAttributeReadModelV1,
  D6ActorFeatureReadModelV1,
  D6ActorFeatureType,
  D6ActorReadModelV1,
  D6ActorSkillReadModelV1,
  D6MachineReadModelV1,
  D6System2eReadApi,
} from "./contracts/actor-read-model";
export {
  D6_FEATURE_SESSION_CONTRACT_VERSION,
  D6_FEATURE_SESSION_MAX_USES,
} from "./contracts/features";
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
  D6System2eResolvedTerminology,
  D6System2eTerminologyContribution,
  D6System2eTerminologyRegistry,
  D6System2eThemeDefinition,
  D6System2eThemeDiceDefinition,
  D6System2eThemeRegistry,
} from "./contracts/contributions";
export type {
  D6ConditionCommandOptions,
  D6ConditionCommandResultV1,
  D6System2eHealthApi,
} from "./contracts/health";
export { D6_COMBAT_CONTRACT_VERSION } from "./contracts/combat";
export type {
  D6CombatActionKind,
  D6CombatCommandResultV1,
  D6CombatantRoundReadModelV1,
  D6CombatantRoundStateV1,
  D6CombatDeclarationV1,
  D6DeclaredCombatActionV1,
  D6System2eCombatApi,
} from "./contracts/combat";
export { D6_ROLL_CONTRACT_VERSION } from "./contracts/roll";
export type {
  D6ActionEconomyRollContext,
  D6AdvancedSkillRollContext,
  D6DoublingDownRollContext,
  D6RollKind,
  D6HeroPointUse,
  D6RollContextV1,
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
  D6WildDieChoice,
  D6WildDieOutcome,
  D6WildDiePolicy,
} from "./contracts/roll";
export { canDoubleDown, doublingDownRequest } from "./domain/doubling-down";
export { evaluateDifficulty } from "./domain/check";
export type { DifficultyEvaluation, SuccessEvaluator } from "./domain/check";
export {
  isSecondEditionCondition,
  multipleActionPenaltyScore,
  SECOND_EDITION_CONDITIONS,
  secondEditionStaticDefense,
} from "./domain/combat";
export type { SecondEditionCondition } from "./domain/combat";
export {
  combatRoundPenaltyLabel,
  combatRoundPenaltyScore,
  completeNextCombatAction,
  createCombatantRoundState,
  currentCombatAction,
  declareCombatActions,
} from "./domain/combat-round";
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
  type AdvancementCostMultipliers,
  type AdvancementCostOptions,
  type AdvancementKind,
  type SecondEditionAdvancementKind,
  type SecondEditionAdvancementStrategy,
  type SecondEditionExperienceAdvancement,
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
  canPreventBecomingStunned,
  canRerollFailedRoll,
  heroPointBalanceAfter,
  heroPointRerollRequest,
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
  acceptedWildDieChoice,
  buildD6RollPool,
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
