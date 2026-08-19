import {
  D6_ALL_RULE_STRATEGY_SLOTS,
  D6_DIFFICULTY_LADDER_SLOTS,
  D6_RULES_PROFILE_CONTRACT_VERSION,
  D6_RULE_STRATEGY_SLOTS,
  type D6RulesProfileV2,
  type D6RulesAnyStrategySlot,
  type D6RulesPredicateV1,
  type D6RulesStrategySelectionV1,
  type D6RulesStrategySlot,
  type D6System2eTerminologyContribution,
  type D6System2eRulesProfileRegistry,
  type D6WorldRulesProfilesV2,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { normalizeStoredTerminologyOverrides } from "./terminology-overrides";
import {
  availableHealthModels,
  healthModelForStrategy,
  OPEN_D6_LEGACY_HEALTH_MODEL_ID,
} from "./health-model-library";
import {
  OPEN_D6_SCALE_STRATEGY_ID,
  SECOND_EDITION_SCALE_STRATEGY_ID,
} from "./scale-strategy-ids";

export const WORLD_RULES_PROFILES_SETTING = "worldRulesProfiles" as const;
export const SECOND_EDITION_RULES_PROFILE_ID = "second-edition" as const;
export const OPEN_D6_RULES_PROFILE_ID = "open-d6" as const;

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

export const RULES_PROFILE_EXPORT_KIND = "d6-system-2e.rules-profile" as const;

export interface RulesProfileExportV1 {
  readonly kind: typeof RULES_PROFILE_EXPORT_KIND;
  readonly profile: D6RulesProfileV2;
  readonly version: typeof D6_RULES_PROFILE_CONTRACT_VERSION;
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
});

const OPEN_D6_STRATEGY_BY_SLOT: Readonly<Record<D6RulesStrategySlot, string>> =
  OPEN_D6_STRATEGIES;

const moduleProfiles = new Map<string, ReadonlyMap<string, D6RulesProfileV2>>();

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

export function bundledRulesProfiles(): readonly D6RulesProfileV2[] {
  return Object.freeze([
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.SecondEditionHelp"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      id: SECOND_EDITION_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.SecondEdition"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: SECOND_EDITION_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
    Object.freeze({
      constraints: Object.freeze([]),
      description: localized("D6E2.Settings.RulesProfile.OpenD6Help"),
      difficultyLadder: Object.freeze(localizedDifficultyLadder()),
      id: OPEN_D6_RULES_PROFILE_ID,
      label: localized("D6E2.Settings.GameMode.OpenD6"),
      source: Object.freeze({ kind: "bundled" as const }),
      strategies: OPEN_D6_STRATEGIES,
      terminology: Object.freeze({}),
      version: D6_RULES_PROFILE_CONTRACT_VERSION,
    }),
  ]);
}

export function normalizeRulesProfile(
  value: unknown,
  fallbackId = "world-rules",
): D6RulesProfileV2 {
  const source = record(value);
  const idCandidate = text(source.id, fallbackId).toLocaleLowerCase();
  const id = ID_PATTERN.test(idCandidate) ? idCandidate : fallbackId;
  const rawStrategies = record(source.strategies);
  const strategies = Object.fromEntries(
    D6_ALL_RULE_STRATEGY_SLOTS.map((slot) => [
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
  return Object.freeze({
    constraints: Object.freeze(constraints),
    description: text(source.description),
    difficultyLadder: Object.freeze(difficultyLadder),
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
  profile: D6RulesProfileV2 = currentConfiguredRulesProfile(),
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
  profile: D6RulesProfileV2,
  readSetting?: (key: string) => unknown,
): readonly D6RulesProfileV2["constraints"][number][] {
  return Object.freeze(
    profile.constraints.filter(
      ({ assertion }) =>
        !evaluateRulesPredicate(assertion, profile, readSetting),
    ),
  );
}

export function rulesProfileDiagnostics(
  profile: D6RulesProfileV2,
  readSetting?: (key: string) => unknown,
): readonly RulesProfileDiagnostic[] {
  const supported = new Set(
    Object.values(bundledRulesStrategyChoices).flatMap((choices) => choices),
  );
  for (const model of availableHealthModels()) supported.add(model.id);
  supported.add(OPEN_D6_LEGACY_HEALTH_MODEL_ID);
  supported.add(SECOND_EDITION_SCALE_STRATEGY_ID);
  supported.add(OPEN_D6_SCALE_STRATEGY_ID);
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
): D6WorldRulesProfilesV2 {
  const source = record(value);
  const profiles: Record<string, D6RulesProfileV2> = {};
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

export function storedWorldRulesProfiles(): D6WorldRulesProfilesV2 {
  return normalizeWorldRulesProfiles(storedValue());
}

export function availableRulesProfiles(): readonly D6RulesProfileV2[] {
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

export function currentConfiguredRulesProfile(): D6RulesProfileV2 {
  const world = storedWorldRulesProfiles();
  const bundled = bundledRulesProfiles();
  return (
    availableRulesProfiles().find(({ id }) => id === world.activeProfileId) ??
    bundled.find(({ id }) => id === SECOND_EDITION_RULES_PROFILE_ID) ??
    normalizeRulesProfile({ id: SECOND_EDITION_RULES_PROFILE_ID })
  );
}

export function strategyUsesOpenD6(
  profile: D6RulesProfileV2,
  slot: D6RulesStrategySlot,
): boolean {
  const strategy = profile.strategies[slot];
  if (slot === "health") {
    const model = healthModelForStrategy(strategy);
    return model?.damageStrategyId.startsWith("open-d6.") ?? false;
  }
  return strategy === OPEN_D6_STRATEGY_BY_SLOT[slot];
}

export function rulesProfileSettingsWorkspace(
  profile: D6RulesProfileV2,
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
  readonly profile: D6RulesProfileV2;
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

function requiredBundledRulesProfile(id: string): D6RulesProfileV2 {
  const profile = bundledRulesProfiles().find(
    (candidate) => candidate.id === id,
  );
  if (!profile) throw new Error(`Missing bundled Rules Profile: ${id}`);
  return profile;
}

function legacyRulesProfileMigration(): D6RulesProfileV2 {
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

export async function ensureWorldRulesProfilesStored(): Promise<D6WorldRulesProfilesV2> {
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
  if (
    raw.version !== D6_RULES_PROFILE_CONTRACT_VERSION ||
    !raw.profiles ||
    canonicalJson(raw) !== canonicalJson(world)
  ) {
    await game.settings.set(SYSTEM_ID, WORLD_RULES_PROFILES_SETTING, world);
  }
  return world;
}

export async function saveWorldRulesProfile(
  value: unknown,
): Promise<D6RulesProfileV2> {
  const profile = normalizeRulesProfile({
    ...record(value),
    source: { kind: "world" },
  });
  const reserved = availableRulesProfiles().find(
    (entry) => entry.id === profile.id && entry.source.kind !== "world",
  );
  if (reserved)
    throw new RangeError(`Rules Profile ID is reserved: ${profile.id}`);
  const world = storedWorldRulesProfiles();
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
): Promise<D6RulesProfileV2> {
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
  source: D6RulesProfileV2 = currentConfiguredRulesProfile(),
): D6RulesProfileV2 {
  const base = `${source.id}-copy`;
  return normalizeRulesProfile({
    ...source,
    id: uniqueWorldRulesProfileId(base),
    label: `${source.label} · ${localized("D6E2.Settings.RulesProfile.Copy")}`,
    source: { kind: "world" },
  });
}

export function exportRulesProfile(
  profile: D6RulesProfileV2 = currentConfiguredRulesProfile(),
): RulesProfileExportV1 {
  return Object.freeze({
    kind: RULES_PROFILE_EXPORT_KIND,
    profile,
    version: D6_RULES_PROFILE_CONTRACT_VERSION,
  });
}

export function importRulesProfile(value: unknown): D6RulesProfileV2 {
  const envelope = record(value);
  if (
    envelope.kind !== RULES_PROFILE_EXPORT_KIND ||
    envelope.version !== D6_RULES_PROFILE_CONTRACT_VERSION
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
  const normalizedDifficulty = normalizeRulesProfile(raw).difficultyLadder;
  if (
    raw.version !== D6_RULES_PROFILE_CONTRACT_VERSION ||
    !ID_PATTERN.test(text(raw.id).toLocaleLowerCase()) ||
    !text(raw.label) ||
    typeof raw.description !== "string" ||
    !Array.isArray(raw.constraints) ||
    typeof raw.terminology !== "object" ||
    raw.terminology === null ||
    canonicalJson(raw.terminology) !== canonicalJson(normalizedTerminology) ||
    canonicalJson(raw.difficultyLadder) !==
      canonicalJson(normalizedDifficulty) ||
    !validSource
  ) {
    throw new TypeError("Invalid Rules Profile contract.");
  }
  const strategies = record(raw.strategies);
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
  return normalizeRulesProfile({
    ...profile,
    id: uniqueWorldRulesProfileId(profile.id),
    source: { kind: "world" },
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

export function createWorldRulesProfile(): D6RulesProfileV2 {
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
      Object.freeze([
        SECOND_EDITION_STRATEGIES[slot],
        OPEN_D6_STRATEGIES[slot],
      ]),
    ]),
  ) as Readonly<Record<D6RulesAnyStrategySlot, readonly [string, string]>>,
);
