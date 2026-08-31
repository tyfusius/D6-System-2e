import {
  D6_ALL_RULE_STRATEGY_SLOTS,
  D6_DIFFICULTY_LADDER_SLOTS,
  D6_RULES_PROFILE_CONTRACT_VERSION,
  D6_RULE_STRATEGY_SLOTS,
  D6_MATCHING_REWARD_MAX,
  healthTrackStorageKey,
  normalizeWorldHealthModel,
  validateD6MatchingEvaluator,
  type D6HealthModel,
  type D6MatchingEvaluatorV1,
  type D6MatchingRewardPolicyV1,
  type D6RulesProfileV4,
  type D6RulesAnyStrategySlot,
  type D6RulesPredicateV1,
  type D6RulesStrategySelectionV1,
  type D6RulesStrategySlot,
  type D6System2eTerminologyContribution,
  type D6System2eRulesProfileRegistry,
  type D6WorldRulesProfilesV4,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { normalizeStoredTerminologyOverrides } from "./terminology-overrides";
import {
  availableHealthModels,
  availableHealthModelsForProfile,
  healthModelForStrategy,
  OPEN_D6_LEGACY_HEALTH_MODEL_ID,
} from "./health-model-library";
import {
  OPEN_D6_SCALE_STRATEGY_ID,
  SECOND_EDITION_SCALE_STRATEGY_ID,
} from "./scale-strategy-ids";
import { profileUsesFreeD6AttributeVocabulary } from "./free-d6-profile";
import { D6MV_STRATEGY_COMPOSITION } from "./d6mv-profile";

export { profileUsesFreeD6AttributeVocabulary } from "./free-d6-profile";

export const WORLD_RULES_PROFILES_SETTING = "worldRulesProfiles" as const;
export const SECOND_EDITION_RULES_PROFILE_ID = "second-edition" as const;
export const OPEN_D6_RULES_PROFILE_ID = "open-d6" as const;
export const FREE_D6_RULES_PROFILE_ID = "free-d6" as const;
export const D6MV_RULES_PROFILE_ID = "d6mv" as const;

export const DEFAULT_DIFFICULTY_LADDER = Object.freeze([
  Object.freeze({ id: "very-easy" as const, label: "Very Easy", value: 5 }),
  Object.freeze({ id: "easy" as const, label: "Easy", value: 10 }),
  Object.freeze({ id: "moderate" as const, label: "Moderate", value: 15 }),
  Object.freeze({ id: "difficult" as const, label: "Difficult", value: 20 }),
  Object.freeze({
    id: "very-difficult" as const,
    label: "Very Difficult",
    value: 30,
  }),
  Object.freeze({ id: "heroic" as const, label: "Heroic", value: 35 }),
]);

const ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const PORTABLE_ID_PATTERN = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/u;

function normalizeMatchingReward(
  value: unknown,
): D6MatchingRewardPolicyV1 | undefined {
  const source = record(value);
  const detectorId = text(source.detectorId);
  const evaluatorId = text(source.evaluatorId);
  if (
    !detectorId ||
    !evaluatorId ||
    !PORTABLE_ID_PATTERN.test(detectorId) ||
    !PORTABLE_ID_PATTERN.test(evaluatorId)
  )
    return undefined;
  const rawAwards = record(source.awards);
  const awards = Object.fromEntries(
    Object.entries(rawAwards).flatMap(([patternId, raw]) => {
      const award = record(raw);
      const characterPoints = Number(award.characterPoints);
      const metaCurrency = Number(award.metaCurrency);
      if (
        !PORTABLE_ID_PATTERN.test(patternId) ||
        !Number.isSafeInteger(characterPoints) ||
        !Number.isSafeInteger(metaCurrency) ||
        characterPoints < 0 ||
        metaCurrency < 0 ||
        characterPoints > D6_MATCHING_REWARD_MAX ||
        metaCurrency > D6_MATCHING_REWARD_MAX
      )
        return [];
      return [
        [
          patternId,
          Object.freeze({
            characterPoints,
            enabled: award.enabled === true,
            metaCurrency,
            patternLabel: text(award.patternLabel, patternId),
            sourceLabel: text(award.sourceLabel),
          }),
        ],
      ];
    }),
  );
  return Object.freeze({
    awards: Object.freeze(awards),
    enabled: source.enabled === true,
    evaluatorId,
    detectorId,
    version: 1,
  });
}

function normalizeMatchingRewards(
  value: unknown,
): readonly D6MatchingRewardPolicyV1[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const policies = value.flatMap((entry) => {
    const policy = normalizeMatchingReward(entry);
    return policy === undefined ? [] : [policy];
  });
  const keys = new Set<string>();
  if (
    policies.some(({ evaluatorId, detectorId }) => {
      const key = `${detectorId}\u0000${evaluatorId}`;
      if (keys.has(key)) return true;
      keys.add(key);
      return false;
    })
  )
    return undefined;
  return Object.freeze(policies);
}

export const RULES_PROFILE_EXPORT_KIND = "d6-system-2e.rules-profile" as const;
export const HEALTH_MODEL_EXPORT_KIND = "d6-system-2e.health-model" as const;

export interface RulesProfileExportV1 {
  readonly kind: typeof RULES_PROFILE_EXPORT_KIND;
  readonly profile: D6RulesProfileV4;
  readonly version: typeof D6_RULES_PROFILE_CONTRACT_VERSION;
}

export interface WorldHealthModelReference {
  readonly id: string;
  readonly label: string;
}

export interface WorldHealthStateImpact {
  readonly actorCount: number;
  readonly actorNames: readonly string[];
  readonly stateId: string;
}

export type HealthStateReplacementMap = Readonly<Record<string, string>>;

export interface DeleteWorldHealthModelPlan {
  readonly modelId: string;
  readonly replacementModelId: string;
  readonly stateReplacements: HealthStateReplacementMap;
}

export interface HealthModelExportV1 {
  readonly kind: typeof HEALTH_MODEL_EXPORT_KIND;
  readonly model: D6HealthModel;
  readonly version: 1;
}

export type RulesProfileDiagnosticCode =
  "constraint-failed" | "unavailable-strategy";

export interface RulesProfileDiagnostic {
  readonly code: RulesProfileDiagnosticCode;
  readonly message: string;
  readonly slot?: D6RulesAnyStrategySlot;
}

const SECOND_EDITION_STRATEGIES: D6RulesStrategySelectionV1 = Object.freeze({
  actionEconomy: "d6e2.action-economy.segmented",
  activeDefenses: "d6e2.defenses.static",
  advancement: "d6e2.advancement.configured",
  attributes: "d6e2.attributes.campaign-profile",
  health: "d6e2.health.condition-track",
  initiative: "d6e2.initiative.contextual",
  movement: "d6e2.movement.segmented",
  metaCurrency: "d6e2.meta-currency.hero-points",
  pips: "d6e2.pips.configured",
  retries: "d6e2.retries.doubling-down",
  scale: SECOND_EDITION_SCALE_STRATEGY_ID,
  successEvaluator: "d6e2.success.strictly-greater",
  wildDie: "d6e2.wild-die.advantage-complication",
  consequenceSuite: "d6e2.consequences.physical-only",
  creation: "d6e2.creation.fixed-budgets",
  featureEconomy: "d6e2.features.second-edition-ranked",
});

const OPEN_D6_STRATEGIES: D6RulesStrategySelectionV1 = Object.freeze({
  actionEconomy: "open-d6.action-economy.flexible",
  activeDefenses: "open-d6.defenses.active",
  advancement: "open-d6.advancement.character-points",
  attributes: "open-d6.attributes.six-attribute",
  health: "open-d6.health.wounds-or-body-points",
  initiative: "open-d6.initiative.perception",
  movement: "open-d6.movement.relative",
  metaCurrency: "open-d6.meta-currency.character-and-fate-points",
  pips: "open-d6.pips.classic",
  retries: "open-d6.retries.no-general-reroll",
  scale: OPEN_D6_SCALE_STRATEGY_ID,
  successEvaluator: "open-d6.success.meets-or-exceeds",
  wildDie: "open-d6.wild-die.critical-one",
  consequenceSuite: "open-d6.consequences.physical-only",
  creation: "open-d6.creation.attribute-skill-dice",
  featureEconomy: "open-d6.features.none",
});

const FREE_D6_STRATEGIES: D6RulesStrategySelectionV1 = Object.freeze({
  ...OPEN_D6_STRATEGIES,
  attributes: "d6e2.attributes.campaign-profile",
  consequenceSuite: "free-d6.consequences.physical-and-fatigue",
  creation: "free-d6.creation.creation-points",
  featureEconomy: "free-d6.features.merits-flaws",
});

const D6MV_STRATEGIES: D6RulesStrategySelectionV1 = Object.freeze({
  ...D6MV_STRATEGY_COMPOSITION,
});

const OPEN_D6_STRATEGY_BY_SLOT: Readonly<Record<D6RulesStrategySlot, string>> =
  OPEN_D6_STRATEGIES;

const moduleProfiles = new Map<string, ReadonlyMap<string, D6RulesProfileV4>>();

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireGameMaster(): void {
  if (game.user?.isGM !== true) {
    throw new Error("D6E2.Settings.HealthModel.GMRequired");
  }
}

function embeddedHealthModelOwnerId(value: unknown): string {
  const id = text(record(value).id).toLocaleLowerCase();
  const marker = ".health.";
  const markerIndex = id.indexOf(marker);
  const ownerId = markerIndex > 0 ? id.slice(0, markerIndex) : "";
  if (!ID_PATTERN.test(ownerId)) {
    throw new TypeError(`Invalid world health model id: ${id}`);
  }
  return ownerId;
}

function normalizeEmbeddedHealthModel(value: unknown): D6HealthModel {
  return normalizeWorldHealthModel(value, embeddedHealthModelOwnerId(value));
}

function localized(key: string): string {
  try {
    return game.i18n.localize(key);
  } catch {
    return key;
  }
}

function localizedDifficultyLadder() {
  return DEFAULT_DIFFICULTY_LADDER.map((entry) => {
    const key = `D6E2.Settings.RulesProfile.Difficulty.${entry.id}`;
    const translated = localized(key);
    return Object.freeze({
      ...entry,
      label: translated === key ? entry.label : translated,
    });
  });
}

export function bundledRulesProfiles(): readonly D6RulesProfileV4[] {
  return Object.freeze([
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.SecondEditionHelp"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      healthModels: Object.freeze([]),
      matchingEvaluators: Object.freeze([]),
      homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
      id: SECOND_EDITION_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.SecondEdition"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: SECOND_EDITION_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.D6MVHelp"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      healthModels: Object.freeze([]),
      matchingEvaluators: Object.freeze([]),
      homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
      id: D6MV_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.D6MV"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: D6MV_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.OpenD6Help"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      healthModels: Object.freeze([]),
      matchingEvaluators: Object.freeze([]),
      homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
      id: OPEN_D6_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.OpenD6"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: OPEN_D6_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.FreeD6Help"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      healthModels: Object.freeze([]),
      matchingEvaluators: Object.freeze([]),
      homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
      id: FREE_D6_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.FreeD6"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: FREE_D6_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
  ]);
}

export function normalizeRulesProfile(
  value: unknown,
  fallbackId = "world-rules",
): D6RulesProfileV4 {
  const source = record(value);
  const idCandidate = text(source.id, fallbackId).toLocaleLowerCase();
  const id = ID_PATTERN.test(idCandidate) ? idCandidate : fallbackId;
  const rawStrategies = record(source.strategies);
  const strategies = Object.fromEntries(
    D6_ALL_RULE_STRATEGY_SLOTS.filter(
      (slot) =>
        D6_RULE_STRATEGY_SLOTS.includes(slot as D6RulesStrategySlot) ||
        slot === "scale" ||
        Object.hasOwn(rawStrategies, slot),
    ).map((slot) => [
      slot,
      text(rawStrategies[slot], SECOND_EDITION_STRATEGIES[slot]),
    ]),
  ) as unknown as D6RulesStrategySelectionV1;
  const rawDifficulty = Array.isArray(source.difficultyLadder)
    ? source.difficultyLadder
    : [];
  const difficultyById = new Map(
    rawDifficulty.map((entry) => {
      const candidate = record(entry);
      return [text(candidate.id), candidate] as const;
    }),
  );
  const difficultyDefaults = localizedDifficultyLadder();
  const difficultyLadder = D6_DIFFICULTY_LADDER_SLOTS.map((id, index) => {
    const fallback =
      difficultyDefaults[index] ?? DEFAULT_DIFFICULTY_LADDER[index];
    if (!fallback) throw new Error(`Missing difficulty ladder slot: ${id}`);
    const candidate = difficultyById.get(id) ?? {};
    const numeric = Number(candidate.value);
    return Object.freeze({
      id,
      label: text(candidate.label, fallback.label),
      value: Number.isFinite(numeric) ? Math.trunc(numeric) : fallback.value,
    });
  });
  const rawSource = record(source.source);
  const sourceKind = rawSource.kind;
  const normalizedSource =
    sourceKind === "module" && ID_PATTERN.test(text(rawSource.ownerId))
      ? Object.freeze({
          kind: "module" as const,
          ownerId: text(rawSource.ownerId),
          ...(text(rawSource.ownerVersion)
            ? { ownerVersion: text(rawSource.ownerVersion) }
            : {}),
        })
      : sourceKind === "bundled"
        ? Object.freeze({ kind: "bundled" as const })
        : Object.freeze({ kind: "world" as const });
  const constraints = Array.isArray(source.constraints)
    ? source.constraints.flatMap((raw) => {
        const constraint = record(raw);
        const assertion = normalizeRulesPredicate(constraint.assertion);
        const id = text(constraint.id);
        const message = text(constraint.message);
        return assertion && ID_PATTERN.test(id) && message
          ? [Object.freeze({ assertion, id, message })]
          : [];
      })
    : [];
  const healthModels = Array.isArray(source.healthModels)
    ? source.healthModels.flatMap((raw) => {
        try {
          return [normalizeEmbeddedHealthModel(raw)];
        } catch {
          return [];
        }
      })
    : [];
  const matchingEvaluators: D6MatchingEvaluatorV1[] = Array.isArray(
    source.matchingEvaluators,
  )
    ? source.matchingEvaluators.flatMap((raw) => {
        try {
          const evaluator = structuredClone(raw) as D6MatchingEvaluatorV1;
          validateD6MatchingEvaluator(evaluator);
          return [Object.freeze(evaluator)];
        } catch {
          return [];
        }
      })
    : [];
  const rawHomebrew = record(source.homebrew);
  const matchingRewards = normalizeMatchingRewards(rawHomebrew.matchingRewards);
  return Object.freeze({
    constraints: Object.freeze(constraints),
    description: text(source.description),
    difficultyLadder: Object.freeze(difficultyLadder),
    healthModels: Object.freeze(healthModels),
    homebrew: Object.freeze({
      ...(matchingRewards === undefined ? {} : { matchingRewards }),
      tyfusiusD8ExplosiveDeviation:
        rawHomebrew.tyfusiusD8ExplosiveDeviation === true,
    }),
    matchingEvaluators: Object.freeze(matchingEvaluators),
    id,
    label: text(source.label, id),
    source: normalizedSource,
    strategies: Object.freeze(strategies),
    terminology: Object.freeze(
      normalizeStoredTerminologyOverrides(source.terminology),
    ),
    version: D6_RULES_PROFILE_CONTRACT_VERSION,
  });
}

function normalizeRulesPredicate(
  value: unknown,
  depth = 0,
): D6RulesPredicateV1 | null {
  if (depth > 8) return null;
  const source = record(value);
  if (source.kind === "strategy") {
    const slot = text(source.slot) as D6RulesAnyStrategySlot;
    if (!D6_ALL_RULE_STRATEGY_SLOTS.includes(slot) || !text(source.equals))
      return null;
    return Object.freeze({
      equals: text(source.equals),
      kind: "strategy",
      slot,
    });
  }
  if (source.kind === "setting") {
    const equals = source.equals;
    if (
      !text(source.key) ||
      !["boolean", "number", "string"].includes(typeof equals)
    )
      return null;
    return Object.freeze({
      equals: equals as boolean | number | string,
      key: text(source.key),
      kind: "setting",
    });
  }
  if (source.kind === "all" || source.kind === "any") {
    const predicates = (
      Array.isArray(source.predicates) ? source.predicates : []
    )
      .map((predicate) => normalizeRulesPredicate(predicate, depth + 1))
      .filter(
        (predicate): predicate is D6RulesPredicateV1 => predicate !== null,
      );
    if (predicates.length === 0) return null;
    return Object.freeze({
      kind: source.kind,
      predicates: Object.freeze(predicates),
    });
  }
  if (source.kind === "not") {
    const predicate = normalizeRulesPredicate(source.predicate, depth + 1);
    return predicate ? Object.freeze({ kind: "not", predicate }) : null;
  }
  return null;
}

export function evaluateRulesPredicate(
  predicate: D6RulesPredicateV1,
  profile: D6RulesProfileV4 = currentConfiguredRulesProfile(),
  readSetting: (key: string) => unknown = (key) =>
    game.settings.get(SYSTEM_ID, key),
): boolean {
  if (predicate.kind === "strategy")
    return profile.strategies[predicate.slot] === predicate.equals;
  if (predicate.kind === "setting")
    return readSetting(predicate.key) === predicate.equals;
  if (predicate.kind === "all")
    return predicate.predicates.every((entry) =>
      evaluateRulesPredicate(entry, profile, readSetting),
    );
  if (predicate.kind === "any")
    return predicate.predicates.some((entry) =>
      evaluateRulesPredicate(entry, profile, readSetting),
    );
  if ("predicate" in predicate)
    return !evaluateRulesPredicate(predicate.predicate, profile, readSetting);
  return false;
}

export function rulesProfileConstraintFailures(
  profile: D6RulesProfileV4,
  readSetting?: (key: string) => unknown,
): readonly D6RulesProfileV4["constraints"][number][] {
  return Object.freeze(
    profile.constraints.filter(
      ({ assertion }) =>
        !evaluateRulesPredicate(assertion, profile, readSetting),
    ),
  );
}

export function rulesProfileDiagnostics(
  profile: D6RulesProfileV4,
  readSetting?: (key: string) => unknown,
): readonly RulesProfileDiagnostic[] {
  const supported = new Set(
    Object.values(bundledRulesStrategyChoices).flatMap((choices) => choices),
  );
  for (const model of availableHealthModels()) supported.add(model.id);
  for (const model of profile.healthModels) supported.add(model.id);
  supported.add(OPEN_D6_LEGACY_HEALTH_MODEL_ID);
  supported.add(SECOND_EDITION_SCALE_STRATEGY_ID);
  supported.add(OPEN_D6_SCALE_STRATEGY_ID);
  for (const strategy of Object.values(D6MV_STRATEGIES)) {
    supported.add(strategy);
  }
  const diagnostics: RulesProfileDiagnostic[] =
    D6_ALL_RULE_STRATEGY_SLOTS.flatMap((slot) => {
      const strategy = profile.strategies[slot];
      return strategy === undefined || supported.has(strategy)
        ? []
        : [
            Object.freeze({
              code: "unavailable-strategy" as const,
              message: `${slot}: ${strategy}`,
              slot,
            }),
          ];
    });
  diagnostics.push(
    ...rulesProfileConstraintFailures(profile, readSetting).map(({ message }) =>
      Object.freeze({ code: "constraint-failed" as const, message }),
    ),
  );
  return Object.freeze(diagnostics);
}

export function normalizeWorldRulesProfiles(
  value: unknown,
): D6WorldRulesProfilesV4 {
  const source = record(value);
  const profiles: Record<string, D6RulesProfileV4> = {};
  for (const [key, raw] of Object.entries(record(source.profiles))) {
    const profile = normalizeRulesProfile(raw, key);
    if (profile.source.kind !== "world" || profiles[profile.id]) continue;
    profiles[profile.id] = profile;
  }
  const requested = text(
    source.activeProfileId,
    SECOND_EDITION_RULES_PROFILE_ID,
  );
  return Object.freeze({
    // Preserve a valid module-owned selection while that module is still
    // starting up. Resolution falls back safely until its ready hook registers.
    activeProfileId: ID_PATTERN.test(requested)
      ? requested
      : SECOND_EDITION_RULES_PROFILE_ID,
    profiles: Object.freeze(profiles),
    version: D6_RULES_PROFILE_CONTRACT_VERSION,
  });
}

function storedValue(): unknown {
  try {
    return game.settings.get(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING);
  } catch {
    return undefined;
  }
}

export function storedWorldRulesProfiles(): D6WorldRulesProfilesV4 {
  return normalizeWorldRulesProfiles(storedValue());
}

function assertHealthModelIdentities(
  models: readonly D6HealthModel[],
  replacingProfileId?: string,
): void {
  const externalModels = new Map(
    availableHealthModels().map((model) => [model.id, model]),
  );
  const world = storedWorldRulesProfiles();
  for (const model of models) {
    if (externalModels.has(model.id)) {
      throw new RangeError(
        `Bundled or module health model ID is reserved: ${model.id}`,
      );
    }
    for (const existingProfile of Object.values(world.profiles)) {
      if (existingProfile.id === replacingProfileId) continue;
      const existing = existingProfile.healthModels.find(
        ({ id }) => id === model.id,
      );
      if (existing && canonicalJson(existing) !== canonicalJson(model)) {
        throw new RangeError(
          `Health model ${model.id} has a different stored definition. Fork it with a new stable ID before editing.`,
        );
      }
    }
  }
}

export function worldHealthModelReferences(
  modelId: string,
): readonly WorldHealthModelReference[] {
  return Object.freeze(
    availableRulesProfiles()
      .filter(({ strategies }) => strategies.health === modelId)
      .map(({ id, label }) => Object.freeze({ id, label })),
  );
}

export function availableWorldHealthModels(): readonly D6HealthModel[] {
  const models = new Map<string, D6HealthModel>();
  for (const profile of Object.values(storedWorldRulesProfiles().profiles)) {
    for (const model of profile.healthModels) {
      if (!models.has(model.id)) models.set(model.id, model);
    }
  }
  return Object.freeze([...models.values()]);
}

function personalActors(): readonly FoundryActorDocument[] {
  return (game.actors?.contents ?? []).filter((actor) =>
    ["character", "creature", "npc"].includes(actor.type),
  );
}

function actorTrackState(
  actor: FoundryActorDocument,
  modelId: string,
): string | null {
  const health = record(actor.system.health);
  const tracks = record(health.tracks);
  const stateId = record(
    tracks[healthTrackStorageKey(modelId)] ?? tracks[modelId],
  ).stateId;
  return typeof stateId === "string" ? stateId : null;
}

export function worldHealthStateImpacts(
  modelId: string,
): readonly WorldHealthStateImpact[] {
  const actorsByState = new Map<string, string[]>();
  for (const actor of personalActors()) {
    const stateId = actorTrackState(actor, modelId);
    if (!stateId) continue;
    const names = actorsByState.get(stateId) ?? [];
    names.push(actor.name);
    actorsByState.set(stateId, names);
  }
  return Object.freeze(
    [...actorsByState.entries()].map(([stateId, names]) =>
      Object.freeze({
        actorCount: names.length,
        actorNames: Object.freeze(
          names.sort((left, right) => left.localeCompare(right)),
        ),
        stateId,
      }),
    ),
  );
}

async function updateActorTrackState(
  actor: FoundryActorDocument,
  modelId: string,
  stateId: string,
): Promise<void> {
  const health = record(actor.system.health);
  const tracks = structuredClone(record(health.tracks));
  const storageKey = healthTrackStorageKey(modelId);
  tracks[storageKey] = {
    ...record(tracks[storageKey] ?? tracks[modelId]),
    stateId,
  };
  await actor.update({ "system.health.tracks": tracks });
}

export async function saveWorldHealthModel(
  ownerProfileId: string,
  value: unknown,
  stateReplacements: HealthStateReplacementMap = {},
): Promise<D6HealthModel> {
  requireGameMaster();
  const model = normalizeEmbeddedHealthModel(value);
  if (model.kind !== "track") {
    throw new TypeError("World health models require a track.");
  }
  const world = storedWorldRulesProfiles();
  const owner = world.profiles[ownerProfileId];
  if (!owner) {
    throw new RangeError(`Rules Profile is not world-owned: ${ownerProfileId}`);
  }
  assertHealthModelIdentities([model], ownerProfileId);
  const previous = Object.values(world.profiles)
    .flatMap(({ healthModels }) => healthModels)
    .find(({ id }) => id === model.id);
  const nextStateIds = new Set(model.track.states.map(({ id }) => id));
  const removedStateIds =
    previous?.kind === "track"
      ? previous.track.states
          .map(({ id }) => id)
          .filter((id) => !nextStateIds.has(id))
      : [];
  const affectedActors = personalActors().flatMap((actor) => {
    const stateId = actorTrackState(actor, model.id);
    return stateId && removedStateIds.includes(stateId)
      ? [{ actor, stateId }]
      : [];
  });
  for (const { stateId } of affectedActors) {
    const replacement = stateReplacements[stateId];
    if (!replacement || !nextStateIds.has(replacement)) {
      throw new RangeError(
        `Health state ${stateId} requires an explicit Actor replacement mapping.`,
      );
    }
  }
  const profiles = Object.fromEntries(
    Object.entries(world.profiles).map(([profileId, profile]) => {
      const contains = profile.healthModels.some(({ id }) => id === model.id);
      if (!contains && profileId !== ownerProfileId)
        return [profileId, profile];
      const healthModels = contains
        ? profile.healthModels.map((entry) =>
            entry.id === model.id ? model : entry,
          )
        : [...profile.healthModels, model];
      return [
        profileId,
        Object.freeze({
          ...profile,
          healthModels: Object.freeze(healthModels),
        }),
      ];
    }),
  );
  const updatedActors: { actor: FoundryActorDocument; stateId: string }[] = [];
  try {
    for (const affected of affectedActors) {
      await updateActorTrackState(
        affected.actor,
        model.id,
        stateReplacements[affected.stateId] ?? model.track.initialStateId,
      );
      updatedActors.push(affected);
    }
    await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
      ...world,
      profiles,
    });
  } catch (error) {
    for (const affected of updatedActors.reverse()) {
      try {
        await updateActorTrackState(affected.actor, model.id, affected.stateId);
      } catch {
        // Preserve the original failure; rollback is best-effort at this boundary.
      }
    }
    throw error;
  }
  Hooks.callAll?.("d6e2HealthModelsChanged");
  return model;
}

export async function deleteWorldHealthModel(modelId: string): Promise<void> {
  requireGameMaster();
  const references = worldHealthModelReferences(modelId);
  if (references.length > 0) {
    throw new RangeError(
      `Health model ${modelId} is referenced by ${references.map(({ label }) => label).join(", ")}.`,
    );
  }
  const world = storedWorldRulesProfiles();
  const exists = Object.values(world.profiles).some(({ healthModels }) =>
    healthModels.some(({ id }) => id === modelId),
  );
  if (!exists) throw new RangeError(`Unknown world health model: ${modelId}`);
  const profiles = Object.fromEntries(
    Object.entries(world.profiles).map(([id, profile]) => [
      id,
      Object.freeze({
        ...profile,
        healthModels: Object.freeze(
          profile.healthModels.filter((model) => model.id !== modelId),
        ),
      }),
    ]),
  );
  await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
    ...world,
    profiles,
  });
  Hooks.callAll?.("d6e2HealthModelsChanged");
}

/** Atomically rebind references and Actor states before deleting a world model. */
export async function deleteWorldHealthModelWithReassignment(
  plan: DeleteWorldHealthModelPlan,
): Promise<void> {
  requireGameMaster();
  if (plan.modelId === plan.replacementModelId) {
    throw new RangeError("A Health Model cannot replace itself.");
  }
  const world = storedWorldRulesProfiles();
  const source = Object.values(world.profiles)
    .flatMap(({ healthModels }) => healthModels)
    .find(({ id }) => id === plan.modelId);
  const replacement = [
    ...availableHealthModels(),
    ...availableWorldHealthModels(),
  ].find(({ id }) => id === plan.replacementModelId);
  if (source?.kind !== "track") {
    throw new RangeError(`Unknown world health model: ${plan.modelId}`);
  }
  if (replacement?.kind !== "track") {
    throw new RangeError(
      `Replacement must be an available track model: ${plan.replacementModelId}`,
    );
  }
  const replacementIds = new Set(replacement.track.states.map(({ id }) => id));
  const affectedActors = personalActors().flatMap((actor) => {
    const stateId = actorTrackState(actor, source.id);
    return stateId ? [{ actor, stateId }] : [];
  });
  for (const { stateId } of affectedActors) {
    const mapped = plan.stateReplacements[stateId];
    if (!mapped || !replacementIds.has(mapped)) {
      throw new RangeError(
        `Health state ${stateId} requires an explicit Actor replacement mapping.`,
      );
    }
  }
  const profiles = Object.fromEntries(
    Object.entries(world.profiles).map(([profileId, profile]) => [
      profileId,
      Object.freeze({
        ...profile,
        healthModels: Object.freeze(
          profile.healthModels.filter(({ id }) => id !== source.id),
        ),
        strategies:
          profile.strategies.health === source.id
            ? Object.freeze({
                ...profile.strategies,
                health: replacement.id,
              })
            : profile.strategies,
      }),
    ]),
  );
  const updated: {
    actor: FoundryActorDocument;
    tracks: Record<string, unknown>;
  }[] = [];
  try {
    for (const { actor, stateId } of affectedActors) {
      const health = record(actor.system.health);
      const previousTracks = structuredClone(record(health.tracks));
      const sourceKeys = new Set([healthTrackStorageKey(source.id), source.id]);
      const tracks = Object.fromEntries(
        Object.entries(structuredClone(previousTracks)).filter(
          ([key]) => !sourceKeys.has(key),
        ),
      );
      tracks[healthTrackStorageKey(replacement.id)] = {
        ...record(
          tracks[healthTrackStorageKey(replacement.id)] ??
            tracks[replacement.id],
        ),
        stateId: plan.stateReplacements[stateId],
      };
      await actor.update({ "system.health.tracks": tracks });
      updated.push({ actor, tracks: previousTracks });
    }
    await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
      ...world,
      profiles,
    });
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const { actor, tracks } of updated.reverse()) {
      try {
        await actor.update({ "system.health.tracks": tracks });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Health Model deletion failed and Actor rollback was incomplete.",
      );
    }
    throw error;
  }
  Hooks.callAll?.("d6e2HealthModelsChanged");
  Hooks.callAll?.("d6e2RulesProfilesChanged");
}

export function exportWorldHealthModel(
  model: D6HealthModel,
): HealthModelExportV1 {
  return Object.freeze({
    kind: HEALTH_MODEL_EXPORT_KIND,
    model,
    version: 1 as const,
  });
}

export async function importWorldHealthModel(
  ownerProfileId: string,
  value: unknown,
): Promise<D6HealthModel> {
  requireGameMaster();
  const envelope = record(value);
  if (envelope.kind !== HEALTH_MODEL_EXPORT_KIND || envelope.version !== 1) {
    throw new TypeError("Unsupported Health Model export.");
  }
  const normalized = normalizeEmbeddedHealthModel(envelope.model);
  if (
    canonicalJson(envelope.model) !== canonicalJson(normalized) &&
    record(envelope.model).version !== 2
  ) {
    throw new TypeError("Invalid Health Model contract.");
  }
  return saveWorldHealthModel(ownerProfileId, normalized);
}

export async function duplicateWorldHealthModel(
  ownerProfileId: string,
  sourceModelId: string,
  newModelId: string,
): Promise<D6HealthModel> {
  requireGameMaster();
  const source = Object.values(storedWorldRulesProfiles().profiles)
    .flatMap(({ healthModels }) => healthModels)
    .find(({ id }) => id === sourceModelId);
  if (source?.kind !== "track") {
    throw new RangeError(`Unknown world health model: ${sourceModelId}`);
  }
  return saveWorldHealthModel(ownerProfileId, {
    ...structuredClone(source),
    id: newModelId,
    label: `${source.label} · Copy`,
  });
}

export async function activateWorldHealthModel(
  profileId: string,
  modelId: string,
): Promise<D6RulesProfileV4> {
  requireGameMaster();
  const world = storedWorldRulesProfiles();
  const profile = world.profiles[profileId];
  if (!profile) {
    throw new RangeError(`Rules Profile is not world-owned: ${profileId}`);
  }
  if (
    !availableHealthModelsForProfile(profile).some(({ id }) => id === modelId)
  ) {
    throw new RangeError(`Unknown health model: ${modelId}`);
  }
  return saveWorldRulesProfile({
    ...profile,
    strategies: { ...profile.strategies, health: modelId },
  });
}

export function availableRulesProfiles(): readonly D6RulesProfileV4[] {
  const world = storedWorldRulesProfiles();
  const merged = new Map(
    bundledRulesProfiles().map((profile) => [profile.id, profile]),
  );
  for (const profiles of moduleProfiles.values()) {
    for (const [id, profile] of profiles)
      if (!merged.has(id)) merged.set(id, profile);
  }
  for (const [id, profile] of Object.entries(world.profiles)) {
    if (!merged.has(id)) merged.set(id, profile);
  }
  return Object.freeze([...merged.values()]);
}

export function currentConfiguredRulesProfile(): D6RulesProfileV4 {
  const world = storedWorldRulesProfiles();
  const bundled = bundledRulesProfiles();
  return (
    availableRulesProfiles().find(({ id }) => id === world.activeProfileId) ??
    bundled.find(({ id }) => id === SECOND_EDITION_RULES_PROFILE_ID) ??
    normalizeRulesProfile({ id: SECOND_EDITION_RULES_PROFILE_ID })
  );
}

export function strategyUsesOpenD6(
  profile: D6RulesProfileV4,
  slot: D6RulesStrategySlot,
): boolean {
  const strategy = profile.strategies[slot];
  if (slot === "health") {
    const model = healthModelForStrategy(strategy);
    return model?.damageStrategyId.startsWith("open-d6.") ?? false;
  }
  if (slot === "attributes" && profileUsesFreeD6AttributeVocabulary(profile)) {
    return true;
  }
  return strategy === OPEN_D6_STRATEGY_BY_SLOT[slot];
}

/**
 * FreeD6 deliberately reuses the proven OpenD6 mechanics slots while sourcing
 * its seven Attribute vocabulary from the active Setting Profile. Keeping this
 * as an exact composition test avoids classifying by a user-facing label or
 * profile id, and keeps world copies of the bundled profile functional.
 */
export function rulesProfileSettingsWorkspace(
  profile: D6RulesProfileV4,
): "open-d6" | "second-edition" {
  const openD6Selections = D6_RULE_STRATEGY_SLOTS.map((slot) =>
    strategyUsesOpenD6(profile, slot),
  );
  if (openD6Selections.every(Boolean)) return "open-d6";
  if (openD6Selections.every((selected) => !selected)) return "second-edition";
  return strategyUsesOpenD6(profile, "attributes")
    ? "open-d6"
    : "second-edition";
}

export interface SelectRulesProfileResult {
  readonly profile: D6RulesProfileV4;
}

export async function selectRulesProfile(
  id: string,
): Promise<SelectRulesProfileResult> {
  const profile = availableRulesProfiles().find((entry) => entry.id === id);
  if (!profile) throw new RangeError(`Unknown Rules Profile: ${id}`);
  const diagnostics = rulesProfileDiagnostics(profile);
  if (diagnostics.length > 0) {
    throw new RangeError(diagnostics.map(({ message }) => message).join(" "));
  }
  const world = storedWorldRulesProfiles();
  await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
    ...world,
    activeProfileId: profile.id,
  });
  Hooks.callAll?.("d6e2RulesProfileChanged", profile.id);
  return Object.freeze({ profile });
}

const LEGACY_GAME_MODE_SETTING = "gameMode" as const;
const LEGACY_OPEN_D6_MASTER_SETTING = "useOpenD6Rules" as const;
const LEGACY_COMPATIBILITY_SETTINGS = Object.freeze({
  actionEconomy: "useFirstEditionActionEconomy",
  activeDefenses: "useFirstEditionActiveDefenses",
  advancement: "useFirstEditionAdvancement",
  attributes: "useFirstEditionAttributes",
  health: "useFirstEditionDamage",
  initiative: "useFirstEditionInitiative",
  movement: "useFirstEditionMovement",
  metaCurrency: "useFirstEditionMetaCurrency",
  pips: "useFirstEditionPips",
  retries: "useFirstEditionRetries",
  successEvaluator: "useFirstEditionSuccessEvaluator",
  wildDie: "useFirstEditionWildDie",
} satisfies Readonly<Record<D6RulesStrategySlot, string>>);

function legacyWorldSetting(key: string): unknown {
  try {
    const settingsStorage: unknown = Reflect.get(game.settings, "storage");
    if (!hasStringKeyLookup(settingsStorage))
      throw new Error("No settings storage");
    const storage = settingsStorage.get("world");
    if (!hasStringKeyLookup(storage))
      throw new Error("No world settings storage");
    const stored = storage.get(`${SYSTEM_ID}.${key}`);
    if (stored && typeof stored === "object" && "value" in stored)
      return Reflect.get(stored, "value");
    if (stored !== undefined) return stored;
  } catch {
    // Fall through to registered-setting access for older Foundry/test gateways.
  }
  try {
    return game.settings.get(SYSTEM_ID, key);
  } catch {
    return undefined;
  }
}

function hasStringKeyLookup(
  value: unknown,
): value is { get(key: string): unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "get") === "function"
  );
}

function requiredBundledRulesProfile(id: string): D6RulesProfileV4 {
  const profile = bundledRulesProfiles().find(
    (candidate) => candidate.id === id,
  );
  if (!profile) throw new Error(`Missing bundled Rules Profile: ${id}`);
  return profile;
}

function legacyRulesProfileMigration(): D6RulesProfileV4 {
  const master = legacyWorldSetting(LEGACY_OPEN_D6_MASTER_SETTING) === true;
  const selections = Object.fromEntries(
    D6_RULE_STRATEGY_SLOTS.map((slot) => [
      slot,
      master ||
        legacyWorldSetting(LEGACY_COMPATIBILITY_SETTINGS[slot]) === true,
    ]),
  ) as Readonly<Record<D6RulesStrategySlot, boolean>>;
  const values = Object.values(selections);
  if (values.every(Boolean))
    return requiredBundledRulesProfile(OPEN_D6_RULES_PROFILE_ID);
  if (
    values.every((selected) => !selected) &&
    legacyWorldSetting(LEGACY_GAME_MODE_SETTING) !== "open-d6"
  ) {
    return requiredBundledRulesProfile(SECOND_EDITION_RULES_PROFILE_ID);
  }
  if (values.every((selected) => !selected))
    return requiredBundledRulesProfile(OPEN_D6_RULES_PROFILE_ID);
  return normalizeRulesProfile({
    description: localized("D6E2.Settings.RulesProfile.MigratedHelp"),
    id: "migrated-rules-profile",
    label: localized("D6E2.Settings.RulesProfile.Migrated"),
    source: { kind: "world" },
    strategies: Object.fromEntries(
      D6_RULE_STRATEGY_SLOTS.map((slot) => [
        slot,
        selections[slot]
          ? OPEN_D6_STRATEGIES[slot]
          : SECOND_EDITION_STRATEGIES[slot],
      ]),
    ),
  });
}

export async function ensureWorldRulesProfilesStored(): Promise<D6WorldRulesProfilesV4> {
  const raw = record(storedValue());
  const hasExplicitSelection = typeof raw.activeProfileId === "string";
  const migrated = hasExplicitSelection
    ? undefined
    : legacyRulesProfileMigration();
  const world = normalizeWorldRulesProfiles(
    migrated
      ? {
          ...raw,
          activeProfileId: migrated.id,
          profiles:
            migrated.source.kind === "world"
              ? { ...record(raw.profiles), [migrated.id]: migrated }
              : raw.profiles,
        }
      : raw,
  );
  const legacyV3Projection =
    raw.version === 3
      ? {
          activeProfileId: world.activeProfileId,
          profiles: Object.fromEntries(
            Object.entries(world.profiles).map(([id, profile]) => {
              const legacy = { ...profile };
              Reflect.deleteProperty(legacy, "matchingEvaluators");
              const strategies = { ...legacy.strategies };
              Reflect.deleteProperty(strategies, "rollResolution");
              return [id, { ...legacy, strategies, version: 3 }];
            }),
          ),
          version: 3,
        }
      : world;
  if (
    (raw.version !== 3 && raw.version !== D6_RULES_PROFILE_CONTRACT_VERSION) ||
    !raw.profiles ||
    canonicalJson(raw) !== canonicalJson(legacyV3Projection)
  ) {
    await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, world);
  }
  return world;
}

export async function saveWorldRulesProfile(
  value: unknown,
): Promise<D6RulesProfileV4> {
  const raw = record(value);
  const rawHealthModels = Array.isArray(raw.healthModels)
    ? raw.healthModels
    : [];
  const normalizedHealthModels = rawHealthModels.map(
    normalizeEmbeddedHealthModel,
  );
  if (
    new Set(normalizedHealthModels.map(({ id }) => id)).size !==
    normalizedHealthModels.length
  ) {
    throw new TypeError("Rules Profile health model ids must be unique.");
  }
  if (
    rawHealthModels.some(
      (model, index) =>
        record(model).version !== 2 &&
        canonicalJson(model) !== canonicalJson(normalizedHealthModels[index]),
    )
  ) {
    throw new TypeError("Rules Profile health models are invalid.");
  }
  const profile = normalizeRulesProfile({
    ...raw,
    healthModels: normalizedHealthModels,
    source: { kind: "world" },
  });
  const reserved = availableRulesProfiles().find(
    (entry) => entry.id === profile.id && entry.source.kind !== "world",
  );
  if (reserved)
    throw new RangeError(`Rules Profile ID is reserved: ${profile.id}`);
  const world = storedWorldRulesProfiles();
  assertHealthModelIdentities(normalizedHealthModels, profile.id);
  await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
    activeProfileId: world.activeProfileId,
    profiles: { ...world.profiles, [profile.id]: profile },
    version: D6_RULES_PROFILE_CONTRACT_VERSION,
  });
  Hooks.callAll?.("d6e2RulesProfilesChanged");
  return profile;
}

export async function saveNewWorldRulesProfile(
  value: unknown,
): Promise<D6RulesProfileV4> {
  const source = record(value);
  const requestedId = text(source.id).toLocaleLowerCase();
  if (!ID_PATTERN.test(requestedId)) {
    throw new TypeError(`Invalid Rules Profile ID: ${requestedId}`);
  }
  if (availableRulesProfiles().some(({ id }) => id === requestedId)) {
    throw new RangeError(`Rules Profile ID already exists: ${requestedId}`);
  }
  return saveWorldRulesProfile({ ...source, id: requestedId });
}

function uniqueWorldRulesProfileId(base: string): string {
  const used = new Set(availableRulesProfiles().map(({ id }) => id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

export function duplicateRulesProfile(
  source: D6RulesProfileV4 = currentConfiguredRulesProfile(),
): D6RulesProfileV4 {
  const base = `${source.id}-copy`;
  return Object.freeze({
    ...structuredClone(source),
    id: uniqueWorldRulesProfileId(base),
    label: `${source.label} · ${localized("D6E2.Settings.RulesProfile.Copy")}`,
    source: Object.freeze({ kind: "world" as const }),
  });
}

export function exportRulesProfile(
  profile: D6RulesProfileV4 = currentConfiguredRulesProfile(),
): RulesProfileExportV1 {
  return Object.freeze({
    kind: RULES_PROFILE_EXPORT_KIND,
    profile,
    version: D6_RULES_PROFILE_CONTRACT_VERSION,
  });
}

export function importRulesProfile(value: unknown): D6RulesProfileV4 {
  const envelope = record(value);
  if (
    envelope.kind !== RULES_PROFILE_EXPORT_KIND ||
    (envelope.version !== 3 &&
      envelope.version !== D6_RULES_PROFILE_CONTRACT_VERSION)
  ) {
    throw new TypeError("Unsupported Rules Profile export.");
  }
  const raw = record(envelope.profile);
  const rawSource = record(raw.source);
  const validSource =
    rawSource.kind === "bundled" ||
    rawSource.kind === "world" ||
    (rawSource.kind === "module" &&
      ID_PATTERN.test(text(rawSource.ownerId)) &&
      (rawSource.ownerVersion === undefined ||
        typeof rawSource.ownerVersion === "string"));
  const normalizedTerminology = normalizeStoredTerminologyOverrides(
    raw.terminology,
  );
  const normalizedProfile = normalizeRulesProfile(raw);
  const normalizedDifficulty = normalizedProfile.difficultyLadder;
  if (
    (raw.version !== 3 && raw.version !== D6_RULES_PROFILE_CONTRACT_VERSION) ||
    !ID_PATTERN.test(text(raw.id).toLocaleLowerCase()) ||
    !text(raw.label) ||
    typeof raw.description !== "string" ||
    !Array.isArray(raw.constraints) ||
    typeof raw.terminology !== "object" ||
    raw.terminology === null ||
    canonicalJson(raw.terminology) !== canonicalJson(normalizedTerminology) ||
    canonicalJson(raw.difficultyLadder) !==
      canonicalJson(normalizedDifficulty) ||
    !Array.isArray(raw.healthModels) ||
    (raw.healthModels as unknown[]).some(
      (model, index) =>
        record(model).version !== 2 &&
        canonicalJson(model) !==
          canonicalJson(normalizedProfile.healthModels[index]),
    ) ||
    (raw.version === D6_RULES_PROFILE_CONTRACT_VERSION &&
      (!Array.isArray(raw.matchingEvaluators) ||
        canonicalJson(raw.matchingEvaluators) !==
          canonicalJson(normalizedProfile.matchingEvaluators))) ||
    canonicalJson(raw.homebrew) !== canonicalJson(normalizedProfile.homebrew) ||
    !validSource
  ) {
    throw new TypeError("Invalid Rules Profile contract.");
  }
  const strategies = record(raw.strategies);
  if (raw.version === 3 && strategies.rollResolution !== undefined) {
    throw new TypeError("Rules Profile v3 cannot select a roll resolution.");
  }
  if (D6_RULE_STRATEGY_SLOTS.some((slot) => !text(strategies[slot]))) {
    throw new TypeError("Rules Profile strategies are incomplete.");
  }
  const profile = normalizeRulesProfile({
    ...raw,
    terminology: normalizedTerminology,
    source: { kind: "world" },
  });
  if (profile.constraints.length !== raw.constraints.length) {
    throw new TypeError("Rules Profile constraints are invalid.");
  }
  assertHealthModelIdentities(profile.healthModels);
  return Object.freeze({
    ...profile,
    id: uniqueWorldRulesProfileId(profile.id),
    source: Object.freeze({ kind: "world" as const }),
  });
}

export async function deleteWorldRulesProfile(id: string): Promise<void> {
  const world = storedWorldRulesProfiles();
  const profile = world.profiles[id];
  if (!profile) throw new RangeError(`Rules Profile is not world-owned: ${id}`);
  if (world.activeProfileId === id) {
    throw new RangeError(`Active Rules Profile cannot be deleted: ${id}`);
  }
  const profiles = { ...world.profiles };
  Reflect.deleteProperty(profiles, id);
  await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, {
    ...world,
    profiles,
  });
  Hooks.callAll?.("d6e2RulesProfilesChanged");
}

export function createWorldRulesProfile(): D6RulesProfileV4 {
  const used = new Set(availableRulesProfiles().map(({ id }) => id));
  let id = "new-rules-profile";
  let suffix = 2;
  while (used.has(id)) id = `new-rules-profile-${suffix++}`;
  return normalizeRulesProfile({
    ...currentConfiguredRulesProfile(),
    description: "",
    id,
    label: localized("D6E2.Settings.RulesProfile.NewProfile"),
    source: { kind: "world" },
  });
}

export function registerRulesProfileContribution(
  ownerId: string,
  value: unknown,
): void {
  if (!ID_PATTERN.test(ownerId))
    throw new TypeError(`Invalid owner id: ${ownerId}`);
  const profile = normalizeRulesProfile({
    ...record(value),
    source: { kind: "module", ownerId },
  });
  const ownerProfiles = new Map(moduleProfiles.get(ownerId) ?? []);
  ownerProfiles.set(profile.id, profile);
  moduleProfiles.set(ownerId, ownerProfiles);
  Hooks.callAll?.("d6e2RulesProfilesChanged");
}

export function unregisterRulesProfileOwner(ownerId: string): void {
  moduleProfiles.delete(ownerId);
  Hooks.callAll?.("d6e2RulesProfilesChanged");
}

export function currentRulesProfileTerminology(): D6System2eTerminologyContribution {
  return currentConfiguredRulesProfile().terminology;
}

export function resetRulesProfileLibraryForTests(): void {
  moduleProfiles.clear();
}

export const rulesProfileRegistry: D6System2eRulesProfileRegistry =
  Object.freeze({
    current: availableRulesProfiles,
    register: registerRulesProfileContribution,
    unregisterOwner: unregisterRulesProfileOwner,
  });

export const bundledRulesStrategyChoices = Object.freeze(
  Object.fromEntries(
    D6_ALL_RULE_STRATEGY_SLOTS.map((slot) => [
      slot,
      Object.freeze(
        [
          SECOND_EDITION_STRATEGIES[slot],
          OPEN_D6_STRATEGIES[slot],
          FREE_D6_STRATEGIES[slot],
          D6MV_STRATEGIES[slot],
        ].filter((value): value is string => typeof value === "string"),
      ),
    ]),
  ) as Readonly<Record<D6RulesAnyStrategySlot, readonly string[]>>,
);
