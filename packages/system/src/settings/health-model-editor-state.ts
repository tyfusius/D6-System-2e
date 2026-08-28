import {
  diffHealthTransitions,
  proposeMonotonicHealthTransitions,
  type D6HealthModel,
  type D6HealthSimulationResultV1,
  type D6HealthTrackStateV2,
  type D6HealthTransitionDiffV1,
} from "@d6-system-2e/core";

export type EditableHealthModel = Extract<
  D6HealthModel,
  { readonly kind: "track" }
>;

export interface HealthTransitionProposal {
  readonly changes: readonly D6HealthTransitionDiffV1[];
  readonly transitions: EditableHealthModel["track"]["damageTransitions"];
}

export interface HealthSimulationInputState {
  readonly currentStateId: string;
  readonly damage: string;
  readonly incomingResultId: string;
  readonly resistance: string;
}

export interface HealthSimulationInputProjection {
  readonly currentStateId: string;
  readonly damage: number | string;
  readonly incomingResultId?: string;
  readonly resistance: number | string;
}

export interface HealthModelCloseGuardInput {
  readonly committedSaveClose: boolean;
  readonly deletionCompleted: boolean;
  readonly readCurrentFingerprint: () => string;
  readonly savedFingerprint: string;
}

/** A successful durable save or deletion closes without rereading stale rendered form state. */
export function healthModelCloseRequiresDiscardConfirmation({
  committedSaveClose,
  deletionCompleted,
  readCurrentFingerprint,
  savedFingerprint,
}: HealthModelCloseGuardInput): boolean {
  if (committedSaveClose || deletionCompleted) return false;
  return readCurrentFingerprint() !== savedFingerprint;
}

export class HealthOutcomeRenderBoundary {
  #tail: Promise<void> = Promise.resolve();

  enqueue(operation: () => Promise<void> | void): Promise<void> {
    const run = this.#tail.then(operation);
    this.#tail = run.catch(() => undefined);
    return run;
  }

  settled(): Promise<void> {
    return this.#tail;
  }
}

interface HealthOutcomeFocusable {
  readonly disabled?: boolean;
  focus(): void;
}

export interface HealthOutcomeFocusHost {
  querySelector(selector: string): HealthOutcomeFocusable | null;
}

export type HealthOutcomeFocusPlan =
  | { readonly index: number; readonly kind: "rekey" }
  | {
      readonly direction: "down" | "up";
      readonly kind: "move";
      readonly outcomeId: string;
    }
  | { readonly kind: "remove"; readonly survivorIndex: number | null };

/** Restore keyboard focus to the logical outcome after an awaited rerender. */
export function restoreHealthOutcomeFocus(
  host: HealthOutcomeFocusHost,
  plan: HealthOutcomeFocusPlan,
): boolean {
  const selectors =
    plan.kind === "rekey"
      ? [`[name="result.${plan.index}.id"]`]
      : plan.kind === "remove"
        ? [
            ...(plan.survivorIndex === null
              ? []
              : [`[name="result.${plan.survivorIndex}.label"]`]),
            '[data-action="addDamageResult"]',
          ]
        : [
            `[data-outcome-id="${plan.outcomeId}"][data-action="moveDamageResult"][data-direction="${plan.direction}"]`,
            `[data-outcome-id="${plan.outcomeId}"][data-action="moveDamageResult"]:not(:disabled)`,
          ];
  for (const selector of selectors) {
    const target = host.querySelector(selector);
    if (!target || target.disabled === true) continue;
    target.focus();
    return true;
  }
  return false;
}

/** Bundled and contributed localization keys become editable human text once copied. */
export function localizeHealthModelEditorDraft(
  model: EditableHealthModel,
  localize: (value: string) => string,
): EditableHealthModel {
  const draft = structuredClone(model);
  return {
    ...draft,
    ...(draft.description ? { description: localize(draft.description) } : {}),
    track: {
      ...draft.track,
      damageResults: draft.track.damageResults.map((result) => ({
        ...result,
        ...(result.description
          ? { description: localize(result.description) }
          : {}),
      })),
      states: draft.track.states.map((state) => ({
        ...state,
        ...(state.description
          ? { description: localize(state.description) }
          : {}),
      })),
    },
  };
}

/** Preview inputs remain authoritative presentation state even when evaluation fails. */
export function healthSimulationInputProjection(
  model: EditableHealthModel,
  input: HealthSimulationInputState | null,
  result: D6HealthSimulationResultV1 | null,
): HealthSimulationInputProjection {
  const requestedCurrentStateId =
    input?.currentStateId ?? result?.currentStateId;
  const currentStateId =
    model.track.states.find(({ id }) => id === requestedCurrentStateId)?.id ??
    model.track.initialStateId;
  const requestedIncomingResultId =
    input === null
      ? result?.incomingResultId
      : input.incomingResultId === ""
        ? undefined
        : input.incomingResultId;
  const incomingResultId = model.track.damageResults.find(
    ({ id }) => id === requestedIncomingResultId,
  )?.id;
  return {
    currentStateId,
    damage: input?.damage ?? result?.damage ?? 0,
    ...(incomingResultId ? { incomingResultId } : {}),
    resistance: input?.resistance ?? result?.resistance ?? 0,
  };
}

/** Metadata and state edits never reinterpret the exact authored matrix. */
export function withHealthStatesPreservingTransitions(
  model: EditableHealthModel,
  states: readonly D6HealthTrackStateV2[],
  initialStateId = model.track.initialStateId,
): EditableHealthModel {
  return {
    ...model,
    track: {
      ...model.track,
      initialStateId,
      states,
    },
  };
}

/** Explicit state removal drops only that state's row; every other cell is retained. */
export function withoutHealthStatePreservingTransitions(
  model: EditableHealthModel,
  stateId: string,
  states: readonly D6HealthTrackStateV2[],
  initialStateId: string,
): EditableHealthModel {
  return {
    ...withHealthStatesPreservingTransitions(model, states, initialStateId),
    track: {
      ...model.track,
      damageTransitions: Object.fromEntries(
        Object.entries(model.track.damageTransitions).filter(
          ([currentStateId]) => currentStateId !== stateId,
        ),
      ),
      initialStateId,
      states,
    },
  };
}

/** Outcome edits preserve cells by stable result ID and leave new cells unresolved. */
export function withHealthDamageResultsPreservingTransitions(
  model: EditableHealthModel,
  damageResults: EditableHealthModel["track"]["damageResults"],
): EditableHealthModel {
  const outcomeIds = new Set(damageResults.map(({ id }) => id));
  return {
    ...model,
    track: {
      ...model.track,
      damageResults,
      damageTransitions: Object.fromEntries(
        Object.entries(model.track.damageTransitions).map(([stateId, row]) => [
          stateId,
          Object.fromEntries(
            Object.entries(row).filter(([outcomeId]) =>
              outcomeIds.has(outcomeId),
            ),
          ),
        ]),
      ),
    },
  };
}

/** Only authored difference bands may change count; strategy predicates are engine-owned. */
export function canChangeHealthDamageResultCount(
  model: EditableHealthModel,
): boolean {
  return model.track.damageResults.every(
    ({ rule }) => rule.kind === "difference-band",
  );
}

/**
 * Reorder outcome identities without moving positional difference-band boundaries.
 * Matrix columns remain keyed to their stable outcome IDs.
 */
export function reorderHealthDamageResultPreservingRuleSlots(
  model: EditableHealthModel,
  sourceIndex: number,
  destinationIndex: number,
): EditableHealthModel {
  const results = [...model.track.damageResults];
  if (
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    sourceIndex >= results.length ||
    destinationIndex >= results.length ||
    sourceIndex === destinationIndex
  ) {
    return model;
  }
  const positionalRules = results.map(({ rule }) => rule);
  const [moved] = results.splice(sourceIndex, 1);
  if (!moved) return model;
  results.splice(destinationIndex, 0, moved);
  const reordered = results.every(({ rule }) => rule.kind === "difference-band")
    ? results.map((result, index) => ({
        ...result,
        rule: positionalRules[index] ?? result.rule,
      }))
    : results;
  return withHealthDamageResultsPreservingTransitions(model, reordered);
}

/**
 * An unpublished ID edit creates a new identity. The old matrix column is
 * retired and the new column intentionally remains unresolved until authored.
 */
export function rekeyHealthDamageResult(
  model: EditableHealthModel,
  resultIndex: number,
  nextId: string,
): EditableHealthModel {
  const previous = model.track.damageResults[resultIndex];
  if (!previous || previous.id === nextId) return model;
  const damageResults = model.track.damageResults.map((result, index) =>
    index === resultIndex ? { ...result, id: nextId } : result,
  );
  return {
    ...model,
    track: {
      ...model.track,
      damageResults,
      damageTransitions: Object.fromEntries(
        Object.entries(model.track.damageTransitions).map(([stateId, row]) => [
          stateId,
          Object.fromEntries(
            Object.entries(row).filter(
              ([outcomeId]) => outcomeId !== previous.id,
            ),
          ),
        ]),
      ),
    },
  };
}

function healthTransitionDomToken(value: string): string {
  return Array.from(value, (character) =>
    /^[a-z0-9-]$/iu.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16) ?? "0"}_`,
  ).join("");
}

export function healthTransitionControlId(
  stateId: string,
  outcomeId: string,
): string {
  return `d6e2-health-transition-${healthTransitionDomToken(stateId)}--${healthTransitionDomToken(outcomeId)}`;
}

/** Parse the structured normalization error without treating portable dots as separators. */
export function healthTransitionErrorTarget(message: string): string | null {
  const match =
    /Missing or invalid transition\s+([a-z][a-z0-9.-]*)\/([a-z][a-z0-9.-]*)/iu.exec(
      message,
    );
  return match?.[1] && match[2]
    ? healthTransitionControlId(match[1], match[2])
    : null;
}

export function withoutHealthDamageResultPreservingTransitions(
  model: EditableHealthModel,
  outcomeId: string,
): EditableHealthModel {
  const remaining = model.track.damageResults.filter(
    ({ id }) => id !== outcomeId,
  );
  const damageResults = remaining.map((result, index) => {
    if (result.rule.kind !== "difference-band") return result;
    return {
      ...result,
      rule: {
        band: {
          minimum:
            index === 0 ? Number.MIN_SAFE_INTEGER : result.rule.band.minimum,
          ...(index === remaining.length - 1
            ? {}
            : { maximum: result.rule.band.maximum }),
        },
        kind: "difference-band" as const,
      },
    };
  });
  return withHealthDamageResultsPreservingTransitions(model, damageResults);
}

export function proposeHealthTransitionGeneration(
  model: EditableHealthModel,
): HealthTransitionProposal {
  const transitions = proposeMonotonicHealthTransitions(
    model.track.states,
    model.track.damageResults.map(({ id }) => id),
  );
  return Object.freeze({
    changes: diffHealthTransitions(model.track.damageTransitions, transitions),
    transitions,
  });
}

export function applyHealthTransitionProposal(
  model: EditableHealthModel,
  proposal: HealthTransitionProposal,
): EditableHealthModel {
  return {
    ...model,
    track: {
      ...model.track,
      damageTransitions: structuredClone(proposal.transitions),
      ruleProvenance:
        model.track.ruleProvenance === "preset" ? "generated" : "mixed",
    },
  };
}

export function applyHealthTransitionProposalIfConfirmed(
  model: EditableHealthModel,
  proposal: HealthTransitionProposal,
  confirmed: boolean,
): EditableHealthModel {
  return confirmed ? applyHealthTransitionProposal(model, proposal) : model;
}

export function transitionMatrixFingerprint(
  model: EditableHealthModel,
): string {
  return JSON.stringify(model.track.damageTransitions);
}

export function healthDamageResultErrorTarget(
  model: EditableHealthModel,
  message: string,
): string | null {
  const lower = message.toLocaleLowerCase();
  if (lower.includes("first damage-result band")) {
    return "d6e2-health-result-0-minimum";
  }
  if (lower.includes("last damage-result band")) {
    return `d6e2-health-result-${Math.max(
      0,
      model.track.damageResults.length - 1,
    )}-maximum`;
  }
  if (lower.includes("damage result ids must be unique")) {
    const seen = new Set<string>();
    const duplicate = model.track.damageResults.findIndex(({ id }) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    return `d6e2-health-result-${Math.max(0, duplicate)}-id`;
  }
  if (lower.includes("damage result labels must be unique")) {
    const seen = new Set<string>();
    const duplicate = model.track.damageResults.findIndex(({ label }) => {
      const key = label.trim().toLocaleLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    return `d6e2-health-result-${Math.max(0, duplicate)}-label`;
  }
  if (lower.includes("portable id")) {
    const index = model.track.damageResults.findIndex(
      ({ id }) => !/^[a-z][a-z0-9.-]*$/u.test(id),
    );
    return `d6e2-health-result-${Math.max(0, index)}-id`;
  }
  const continuousBands =
    /Damage-result bands\s+([^\s]+)\s+and\s+([^\s]+)\s+/iu.exec(message);
  const resultId =
    continuousBands?.[2] ?? /Damage result\s+([^\s]+)\s+/iu.exec(message)?.[1];
  if (!resultId) return null;
  const index = model.track.damageResults.findIndex(
    ({ id }) => id === resultId,
  );
  if (index < 0) return null;
  const boundary = message.toLocaleLowerCase().includes("inverted")
    ? "maximum"
    : "minimum";
  return `d6e2-health-result-${index}-${boundary}`;
}

export function healthModelPresentationWarnings(
  model: EditableHealthModel,
  localize: (value: string) => string,
  format: (
    key: string,
    data: Readonly<Record<string, string | number>>,
  ) => string,
): readonly string[] {
  const warnings: string[] = [];
  const transitionTargets = new Set(
    Object.values(model.track.damageTransitions).flatMap((row) =>
      Object.values(row),
    ),
  );
  for (const [index, state] of model.track.states.entries()) {
    const stateLabel = localize(state.label);
    if (
      state.id !== model.track.initialStateId &&
      !transitionTargets.has(state.id)
    ) {
      warnings.push(
        format("D6E2.Settings.HealthModel.WarningUnreachable", {
          state: stateLabel,
        }),
      );
    }
    const row = model.track.damageTransitions[state.id];
    if (
      row &&
      Object.values(row).some((targetId) => {
        const targetIndex = model.track.states.findIndex(
          ({ id }) => id === targetId,
        );
        return targetIndex > index + 1;
      })
    ) {
      warnings.push(
        format("D6E2.Settings.HealthModel.WarningSkipsStates", {
          state: stateLabel,
        }),
      );
    }
  }
  return Object.freeze(warnings);
}
