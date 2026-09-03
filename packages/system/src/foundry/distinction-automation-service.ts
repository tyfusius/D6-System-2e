import {
  classifyDistinctionMechanic,
  formatPipScore,
  resolveDistinctionRollEffects,
  type D6DistinctionRollEvaluationV1,
  type D6DistinctionRollScopeV1,
  type D6DistinctionSourceV1,
  type D6FeatureMechanicApplication,
  type D6FeatureMechanicKind,
  type D6FeatureMechanicV1,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { integer, record, stringValue } from "./sheets/values";

const FEATURE_TYPES = new Set(["flaw", "perk", "talent"]);
const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
const KINDS = new Set<D6FeatureMechanicKind>([
  "action-modifier",
  "advancement-lock",
  "advancement-modifier",
  "minimum-total",
  "movement-modifier",
  "narrative",
  "reroll",
  "resource",
  "roll-modifier",
  "trained-use",
  "usage-limit",
]);
const APPLICATIONS = new Set<D6FeatureMechanicApplication>([
  "all-rolls",
  "attribute",
  "damage",
  "defense",
  "initiative",
  "movement",
  "resistance",
  "skill",
  "specialization",
]);
const MAX_AUTHORED_ROLL_MODIFIER_SCORE = 62;

/** Formats an authored modifier as signed roll evidence without changing it. */
export function distinctionModifierScoreLabel(score: number): string {
  return `${score < 0 ? "−" : "+"}${formatPipScore(Math.abs(score))}`;
}

function cloneUnknown(value: unknown): unknown {
  return structuredClone(value);
}

export type D6TalentAutomationMode =
  "automatic-roll" | "contextual-roll" | "narrative";

export interface D6TalentAutomationDraftRow {
  readonly application?: D6FeatureMechanicApplication;
  readonly mode: D6TalentAutomationMode;
  readonly perRank?: boolean;
  readonly score?: number;
  readonly selector?: string;
}

export interface D6TalentAutomationIssue {
  readonly field: "application" | "mode" | "score";
  readonly index: number;
  readonly message: "application-required" | "invalid-mode" | "score-required";
}

export interface D6TalentAutomationDefinitionResult {
  readonly definition?: Readonly<Record<string, unknown>>;
  readonly issues: readonly D6TalentAutomationIssue[];
}

function editableMechanic(mechanic: D6FeatureMechanicV1): boolean {
  return mechanic.kind === "roll-modifier" || mechanic.kind === "narrative";
}

/**
 * Builds the typed flag payload used by the native Talent Item editor. Unknown
 * provider metadata and unsupported mechanics are preserved byte-for-value;
 * prose is never parsed into executable rules.
 */
export function talentAutomationDefinitionUpdate(
  itemId: string,
  currentDefinition: unknown,
  rows: readonly D6TalentAutomationDraftRow[],
): D6TalentAutomationDefinitionResult {
  const current = structuredClone(record(currentDefinition));
  const issues: D6TalentAutomationIssue[] = [];
  const authored: D6FeatureMechanicV1[] = [];
  rows.forEach((row, index) => {
    if (
      !["automatic-roll", "contextual-roll", "narrative"].includes(row.mode)
    ) {
      issues.push({ field: "mode", index, message: "invalid-mode" });
      return;
    }
    if (row.mode === "narrative") {
      authored.push(Object.freeze({ kind: "narrative" }));
      return;
    }
    if (!row.application || !APPLICATIONS.has(row.application)) {
      issues.push({
        field: "application",
        index,
        message: "application-required",
      });
    }
    if (
      !Number.isSafeInteger(row.score) ||
      row.score === 0 ||
      Math.abs(row.score ?? 0) > MAX_AUTHORED_ROLL_MODIFIER_SCORE
    ) {
      issues.push({ field: "score", index, message: "score-required" });
    }
    if (
      row.application &&
      APPLICATIONS.has(row.application) &&
      Number.isSafeInteger(row.score) &&
      row.score !== 0 &&
      Math.abs(row.score ?? 0) <= MAX_AUTHORED_ROLL_MODIFIER_SCORE
    ) {
      const score = typeof row.score === "number" ? row.score : 0;
      authored.push(
        Object.freeze({
          application: row.application,
          automatic: row.mode === "automatic-roll",
          kind: "roll-modifier",
          perRank: row.perRank === true,
          score,
          ...(row.selector?.trim() ? { selector: row.selector.trim() } : {}),
        }),
      );
    }
  });
  if (issues.length > 0)
    return Object.freeze({ issues: Object.freeze(issues) });
  const retained: unknown[] = [];
  if (Array.isArray(current.mechanics)) {
    for (const value of current.mechanics as unknown[]) {
      const mechanic = safeMechanic(value);
      if (!mechanic || !editableMechanic(mechanic)) {
        retained.push(cloneUnknown(value));
      }
    }
  }
  return Object.freeze({
    definition: Object.freeze({
      ...current,
      definitionId:
        stringValue(current.definitionId).trim() || `world.${itemId}`,
      mechanics: Object.freeze([...retained, ...authored]),
      version: Number.isSafeInteger(current.version) ? current.version : 1,
    }),
    issues: Object.freeze([]),
  });
}

export function talentAutomationDraftRows(
  definition: unknown,
): readonly D6TalentAutomationDraftRow[] {
  const source = record(definition);
  if (!Array.isArray(source.mechanics)) return Object.freeze([]);
  const rows: D6TalentAutomationDraftRow[] = [];
  for (const value of source.mechanics) {
    const mechanic = safeMechanic(value);
    if (!mechanic || !editableMechanic(mechanic)) continue;
    if (mechanic.kind === "narrative") {
      rows.push(Object.freeze({ mode: "narrative" as const }));
      continue;
    }
    rows.push(
      Object.freeze({
        ...(mechanic.application ? { application: mechanic.application } : {}),
        mode:
          mechanic.automatic === true
            ? ("automatic-roll" as const)
            : ("contextual-roll" as const),
        perRank: mechanic.perRank === true,
        ...(mechanic.score === undefined ? {} : { score: mechanic.score }),
        ...(mechanic.selector ? { selector: mechanic.selector } : {}),
      }),
    );
  }
  return Object.freeze(rows);
}

function safeMechanic(value: unknown): D6FeatureMechanicV1 | null {
  const source = record(value);
  if (
    typeof source.kind !== "string" ||
    !KINDS.has(source.kind as D6FeatureMechanicKind)
  ) {
    return null;
  }
  if (
    source.application !== undefined &&
    (typeof source.application !== "string" ||
      !APPLICATIONS.has(source.application as D6FeatureMechanicApplication))
  ) {
    return null;
  }
  if (source.score !== undefined && !Number.isSafeInteger(source.score)) {
    return null;
  }
  if (source.limit !== undefined && !Number.isSafeInteger(source.limit)) {
    return null;
  }
  return Object.freeze({
    ...(source.application === undefined
      ? {}
      : { application: source.application as D6FeatureMechanicApplication }),
    ...(typeof source.automatic === "boolean"
      ? { automatic: source.automatic }
      : {}),
    kind: source.kind as D6FeatureMechanicKind,
    ...(typeof source.limit === "number" ? { limit: source.limit } : {}),
    ...(typeof source.perRank === "boolean" ? { perRank: source.perRank } : {}),
    ...(typeof source.score === "number" ? { score: source.score } : {}),
    ...(typeof source.selector === "string" && source.selector.trim()
      ? { selector: source.selector.trim() }
      : {}),
  });
}

function featureSnapshot(
  item: FoundryItemDocument,
): D6DistinctionSourceV1 | null {
  if (!FEATURE_TYPES.has(item.type)) return null;
  const definition = record(
    item.getFlag?.(SYSTEM_ID, "featureDefinition") ??
      record(
        record(
          (item as FoundryItemDocument & { readonly flags?: unknown }).flags,
        )[SYSTEM_ID],
      ).featureDefinition,
  );
  if (!Array.isArray(definition.mechanics)) return null;
  const mechanics = definition.mechanics.flatMap((value) => {
    const mechanic = safeMechanic(value);
    return mechanic === null ? [] : [mechanic];
  });
  if (mechanics.length === 0) return null;
  const definitionId = stringValue(definition.definitionId).trim();
  return Object.freeze({
    definitionId: definitionId || `world.${item.id}`,
    itemId: item.id,
    label: item.name,
    mechanics: Object.freeze(mechanics),
    private: privateFeature(item),
    rank: Math.max(1, integer(record(item.system).rank) || 1),
  });
}

/** Reads the schema-backed, provider-neutral privacy state of a ranked feature. */
function privateFeature(item: FoundryItemDocument): boolean {
  return record(item.system).private === true;
}

export interface DistinctionItemAutomationSummary {
  readonly automatic: number;
  readonly declaration: number;
  readonly narrativeOnly: number;
  readonly storedOnly: number;
}

export interface DistinctionItemMechanicPresentation {
  readonly application?: D6FeatureMechanicApplication;
  readonly disposition: ReturnType<typeof classifyDistinctionMechanic>;
  readonly hasSelector: boolean;
  readonly kind: D6FeatureMechanicKind;
  readonly perRank: boolean;
  readonly scopeLabel?: string;
  readonly score?: number;
}

export interface DistinctionItemAutomationPresentation {
  readonly mechanics: readonly DistinctionItemMechanicPresentation[];
  readonly providerUnavailable: boolean;
  readonly provenanceLabel?: string;
  readonly source?: Readonly<{
    readonly book: string;
    readonly page?: number;
  }>;
}

export function distinctionAutomationStatusId(
  applicationScope: string,
  groupIndex: number,
  itemIndex: number,
): string {
  return `d6e2-distinction-status-${applicationScope}-${groupIndex}-${itemIndex}`;
}

function mayPresentFeature(
  item: FoundryItemDocument,
  mayViewPrivate: boolean,
): boolean {
  return !privateFeature(item) || mayViewPrivate;
}

export function distinctionItemAutomationSummary(
  item: FoundryItemDocument,
  mayViewPrivate = false,
): DistinctionItemAutomationSummary | null {
  if (!mayPresentFeature(item, mayViewPrivate)) return null;
  const snapshot = featureSnapshot(item);
  if (!snapshot) return null;
  const summary = {
    automatic: 0,
    declaration: 0,
    narrativeOnly: 0,
    storedOnly: 0,
  };
  for (const mechanic of snapshot.mechanics) {
    const disposition = classifyDistinctionMechanic(mechanic);
    if (disposition === "automatic") summary.automatic += 1;
    else if (disposition === "declaration") summary.declaration += 1;
    else if (disposition === "narrative-only") summary.narrativeOnly += 1;
    else summary.storedOnly += 1;
  }
  return Object.freeze(summary);
}

/**
 * Produces an Item-sheet presentation without returning stable definition,
 * provider, Item, or selector IDs. A selector is resolved to an owned Item
 * label when possible and otherwise remains an honest unavailable scope.
 */
export function distinctionItemAutomationPresentation(
  item: FoundryItemDocument,
  mayViewPrivate = false,
  providerLabelForId: (providerId: string) => string | undefined = () =>
    undefined,
): DistinctionItemAutomationPresentation | null {
  if (!mayPresentFeature(item, mayViewPrivate)) return null;
  const snapshot = featureSnapshot(item);
  if (!snapshot) return null;
  const source = record(item.system).source;
  const book = stringValue(record(source).book).trim();
  const page = integer(record(source).page);
  const providerId = stringValue(record(source).module).trim();
  const registeredProviderLabel = providerId
    ? providerLabelForId(providerId)?.trim()
    : undefined;
  const provenanceLabel =
    registeredProviderLabel ??
    (providerId && !MODULE_ID_PATTERN.test(providerId)
      ? providerId
      : undefined);
  return Object.freeze({
    mechanics: Object.freeze(
      snapshot.mechanics.map((mechanic) => {
        const selector = mechanic.selector?.trim();
        const target = selector
          ? item.parent?.items.get(selector)?.name.trim()
          : undefined;
        return Object.freeze({
          ...(mechanic.application === undefined
            ? {}
            : { application: mechanic.application }),
          disposition: classifyDistinctionMechanic(mechanic),
          hasSelector: Boolean(selector),
          kind: mechanic.kind,
          perRank: mechanic.perRank === true,
          ...(target ? { scopeLabel: target } : {}),
          ...(mechanic.score === undefined ? {} : { score: mechanic.score }),
        });
      }),
    ),
    providerUnavailable: Boolean(providerId && !provenanceLabel),
    ...(provenanceLabel ? { provenanceLabel } : {}),
    ...(book
      ? {
          source: Object.freeze({
            book,
            ...(page > 0 ? { page } : {}),
          }),
        }
      : {}),
  });
}

/** Reads current native Item snapshots and returns derived effects only. */
export function distinctionRollModifier(
  actor: FoundryActorDocument,
  scope: D6DistinctionRollScopeV1,
  mayChoosePrivate = false,
): D6DistinctionRollEvaluationV1 {
  const sources = actor.items.contents.flatMap((item) => {
    const snapshot = featureSnapshot(item);
    return snapshot === null ? [] : [snapshot];
  });
  const evaluation = resolveDistinctionRollEffects(sources, scope);
  if (mayChoosePrivate || evaluation.choices.every((choice) => !choice.private))
    return evaluation;
  return Object.freeze({
    ...evaluation,
    choices: Object.freeze(
      evaluation.choices.filter((choice) => !choice.private),
    ),
  });
}

/** Removes private Distinction labels and identifiers from persisted projections. */
export function privacySafeDistinctionRollResult(
  result: D6RollResultV1,
): D6RollResultV1 {
  const evidence = result.request.context?.distinctionEffects;
  if (!evidence || evidence.effects.every((effect) => !effect.private)) {
    return result;
  }
  const visible = evidence.effects.filter((effect) => !effect.private);
  return Object.freeze({
    ...result,
    request: Object.freeze({
      ...result.request,
      context: Object.freeze({
        ...result.request.context,
        distinctionEffects: Object.freeze({
          effects: Object.freeze(visible),
          privateEffectCount:
            evidence.privateEffectCount +
            evidence.effects.length -
            visible.length,
          version: 1 as const,
        }),
      }),
    }),
  });
}
