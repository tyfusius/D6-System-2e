import { describe, expect, it } from "vitest";
import {
  defaultHealthDamageResults,
  normalizeWorldHealthModel,
} from "@d6-system-2e/core";
import {
  applyHealthTransitionProposal,
  applyHealthTransitionProposalIfConfirmed,
  canChangeHealthDamageResultCount,
  healthDamageResultErrorTarget,
  healthModelCloseRequiresDiscardConfirmation,
  healthTransitionControlId,
  healthTransitionErrorTarget,
  HealthOutcomeRenderBoundary,
  localizeHealthModelEditorDraft,
  healthSimulationInputProjection,
  proposeHealthTransitionGeneration,
  transitionMatrixFingerprint,
  rekeyHealthDamageResult,
  reorderHealthDamageResultPreservingRuleSlots,
  restoreHealthOutcomeFocus,
  healthModelPresentationWarnings,
  withHealthStatesPreservingTransitions,
  withoutHealthStatePreservingTransitions,
  withHealthDamageResultsPreservingTransitions,
  withoutHealthDamageResultPreservingTransitions,
  type EditableHealthModel,
} from "./health-model-editor-state";

function model(): EditableHealthModel {
  return normalizeWorldHealthModel(
    {
      damageStrategyId: "d6e2.damage.conditions",
      id: "echo.health.personal",
      kind: "track",
      label: "Echo",
      track: {
        damageResults: defaultHealthDamageResults("d6e2.damage.conditions"),
        damageTransitions: {
          healthy: {
            staggered: "healthy",
            stunned: "wounded",
            wounded: "wounded",
            "mortally-wounded": "dead",
            dead: "dead",
          },
          wounded: {
            staggered: "wounded",
            stunned: "wounded",
            wounded: "wounded",
            "mortally-wounded": "dead",
            dead: "dead",
          },
          dead: {
            staggered: "dead",
            stunned: "dead",
            wounded: "dead",
            "mortally-wounded": "dead",
            dead: "dead",
          },
        },
        initialStateId: "healthy",
        ruleProvenance: "authored",
        states: [
          {
            allowsActions: true,
            id: "healthy",
            label: "Healthy",
            penaltyScore: 0,
            terminal: false,
          },
          {
            allowsActions: true,
            id: "wounded",
            label: "Wounded",
            penaltyScore: 3,
            terminal: false,
          },
          {
            allowsActions: false,
            id: "dead",
            label: "Dead",
            penaltyScore: 0,
            terminal: true,
          },
        ],
      },
      version: 3,
    },
    "echo",
  ) as EditableHealthModel;
}

describe("health model editor state", () => {
  it("closes a committed save without treating normalized form shape as unsaved", () => {
    const savedFingerprint = JSON.stringify({
      states: [{ id: "healthy" }],
    });
    const projectedFormFingerprint = JSON.stringify({
      states: [{ description: "", id: "healthy" }],
    });

    let reads = 0;
    const readCurrentFingerprint = (): string => {
      reads += 1;
      return projectedFormFingerprint;
    };

    expect(
      healthModelCloseRequiresDiscardConfirmation({
        committedSaveClose: true,
        deletionCompleted: false,
        readCurrentFingerprint,
        savedFingerprint,
      }),
    ).toBe(false);
    expect(reads).toBe(0);
    expect(
      healthModelCloseRequiresDiscardConfirmation({
        committedSaveClose: false,
        deletionCompleted: false,
        readCurrentFingerprint,
        savedFingerprint,
      }),
    ).toBe(true);
    expect(reads).toBe(1);
    expect(
      healthModelCloseRequiresDiscardConfirmation({
        committedSaveClose: false,
        deletionCompleted: false,
        readCurrentFingerprint: () => savedFingerprint,
        savedFingerprint,
      }),
    ).toBe(false);
  });

  it("localizes bundled descriptions before they enter an editable duplicate", () => {
    const source = model();
    const localized = localizeHealthModelEditorDraft(
      {
        ...source,
        description: "D6E2.Settings.HealthModel.OpenD6Wounds.Description",
        track: {
          ...source.track,
          damageResults: source.track.damageResults.map((result, index) => ({
            ...result,
            ...(index === 0
              ? {
                  description:
                    "D6E2.Settings.HealthModel.ResultDescription.None",
                }
              : {}),
          })),
          states: source.track.states.map((state, index) => ({
            ...state,
            ...(index === 0
              ? {
                  description:
                    "D6E2.Settings.HealthModel.StateDescription.Healthy",
                }
              : {}),
          })),
        },
      },
      (value) =>
        ({
          "D6E2.Settings.HealthModel.OpenD6Wounds.Description":
            "An ordered OpenD6 wound track.",
          "D6E2.Settings.HealthModel.ResultDescription.None":
            "No injury is applied.",
          "D6E2.Settings.HealthModel.StateDescription.Healthy":
            "No current injury limits this character.",
        })[value] ?? value,
    );

    expect(localized.description).toBe("An ordered OpenD6 wound track.");
    expect(localized.track.damageResults[0]?.description).toBe(
      "No injury is applied.",
    );
    expect(localized.track.states[0]?.description).toBe(
      "No current injury limits this character.",
    );
    expect(transitionMatrixFingerprint(localized)).toBe(
      transitionMatrixFingerprint(source),
    );
    expect(source.description).toBe("");
  });

  it("keeps failed Preview inputs independent from a successful result", () => {
    const projection = healthSimulationInputProjection(
      model(),
      {
        currentStateId: "wounded",
        damage: "7.5",
        incomingResultId: "wounded",
        resistance: "7",
      },
      null,
    );

    expect(projection).toEqual({
      currentStateId: "wounded",
      damage: "7.5",
      incomingResultId: "wounded",
      resistance: "7",
    });
  });

  it.each(["label", "description", "penalty", "reorder"])(
    "preserves the exact matrix through %s edits",
    () => {
      const source = model();
      const before = transitionMatrixFingerprint(source);
      const [healthy, wounded, dead] = source.track.states;
      if (!healthy || !wounded || !dead)
        throw new Error("Fixture states missing");
      const edited = withHealthStatesPreservingTransitions(
        source,
        [wounded, healthy, dead].map((state, index) => ({
          ...state,
          description: `Description ${index}`,
          label: `Label ${index}`,
          penaltyScore: index,
        })),
        "healthy",
      );
      expect(transitionMatrixFingerprint(edited)).toBe(before);
      expect(edited.track.damageTransitions.healthy?.wounded).toBe("wounded");
    },
  );

  it("keeps a generated matrix separate until explicitly applied", () => {
    const source = model();
    const before = transitionMatrixFingerprint(source);
    const proposal = proposeHealthTransitionGeneration(source);
    expect(proposal.changes.length).toBeGreaterThan(0);
    expect(transitionMatrixFingerprint(source)).toBe(before);
    const applied = applyHealthTransitionProposal(source, proposal);
    expect(transitionMatrixFingerprint(applied)).not.toBe(before);
    expect(applied.track.ruleProvenance).toBe("mixed");
  });

  it("retains the exact authored matrix when final generation confirmation is cancelled", () => {
    const source = model();
    const proposal = proposeHealthTransitionGeneration(source);
    const cancelled = applyHealthTransitionProposalIfConfirmed(
      source,
      proposal,
      false,
    );
    expect(cancelled).toBe(source);
    expect(transitionMatrixFingerprint(cancelled)).toBe(
      transitionMatrixFingerprint(source),
    );
    expect(
      transitionMatrixFingerprint(
        applyHealthTransitionProposalIfConfirmed(source, proposal, true),
      ),
    ).not.toBe(transitionMatrixFingerprint(source));
  });

  it("leaves a new state's row unresolved instead of fabricating an identity", () => {
    const source = model();
    const edited = withHealthStatesPreservingTransitions(source, [
      ...source.track.states,
      {
        allowsActions: true,
        id: "critical",
        label: "Critical",
        penaltyScore: 6,
        terminal: false,
      },
    ]);
    expect(edited.track.damageTransitions.critical).toBeUndefined();
    expect(proposeHealthTransitionGeneration(edited).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentStateId: "critical" }),
      ]),
    );
  });

  it("drops only an explicitly removed state's row and retains every other cell", () => {
    const source = model();
    const states = source.track.states.filter(({ id }) => id !== "wounded");
    const edited = withoutHealthStatePreservingTransitions(
      source,
      "wounded",
      states,
      "healthy",
    );
    expect(edited.track.damageTransitions.wounded).toBeUndefined();
    expect(edited.track.damageTransitions.healthy).toEqual(
      source.track.damageTransitions.healthy,
    );
    expect(edited.track.damageTransitions.dead).toEqual(
      source.track.damageTransitions.dead,
    );
  });

  it("routes band validation to the exact failing boundary control", () => {
    const source = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds" as const,
      track: {
        ...model().track,
        damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
      },
    };
    expect(
      healthDamageResultErrorTarget(
        source,
        "Damage-result bands stunned and wounded must be continuous.",
      ),
    ).toBe("d6e2-health-result-2-minimum");
    expect(
      healthDamageResultErrorTarget(
        source,
        "Damage result stunned has an inverted range.",
      ),
    ).toBe("d6e2-health-result-1-maximum");
    expect(
      healthDamageResultErrorTarget(
        source,
        "The first damage-result band must cover all negative differences.",
      ),
    ).toBe("d6e2-health-result-0-minimum");
    expect(
      healthDamageResultErrorTarget(
        source,
        "The last damage-result band must be open-ended.",
      ),
    ).toBe("d6e2-health-result-5-maximum");
  });

  it("projects localized warning labels without raw keys or stable IDs", () => {
    const source = model();
    const localized = {
      Healthy: "Healthy",
      Wounded: "Wounded",
      Dead: "Dead",
      "D6E2.Condition.Healthy": "Healthy",
    } as Record<string, string>;
    const warnings = healthModelPresentationWarnings(
      {
        ...source,
        track: {
          ...source.track,
          states: source.track.states.map((state, index) => ({
            ...state,
            label: index === 0 ? "D6E2.Condition.Healthy" : state.label,
          })),
        },
      },
      (value) => localized[value] ?? value,
      (key, data) =>
        key === "D6E2.Settings.HealthModel.WarningUnreachable"
          ? `${String(data.state)} is unreachable from damage transitions.`
          : `${String(data.state)} has a transition that skips states.`,
    );
    expect(warnings.join(" ")).not.toContain("D6E2.Condition");
    expect(warnings.join(" ")).not.toContain("healthy");
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/Healthy|Wounded|Dead/u)]),
    );
  });

  it("adds, reorders, and removes outcomes by stable ID without remapping cells", () => {
    const source = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds" as const,
      track: {
        ...model().track,
        damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
        damageTransitions: Object.fromEntries(
          model().track.states.map(({ id }) => [
            id,
            Object.fromEntries(
              defaultHealthDamageResults("open-d6.damage.wounds").map(
                ({ id: outcomeId }) => [outcomeId, id],
              ),
            ),
          ]),
        ),
      },
    };
    const addedResult = {
      description: "",
      id: "critical",
      label: "Critical",
      rule: {
        band: { minimum: 16 },
        kind: "difference-band" as const,
      },
    };
    const added = withHealthDamageResultsPreservingTransitions(source, [
      ...source.track.damageResults,
      addedResult,
    ]);
    expect(added.track.damageTransitions.healthy?.critical).toBeUndefined();
    expect(added.track.damageTransitions.healthy?.wounded).toBe("healthy");

    const reordered = withHealthDamageResultsPreservingTransitions(added, [
      addedResult,
      ...source.track.damageResults,
    ]);
    expect(reordered.track.damageResults[0]?.id).toBe("critical");
    expect(reordered.track.damageTransitions.healthy?.wounded).toBe("healthy");

    const removed = withoutHealthDamageResultPreservingTransitions(
      reordered,
      "stunned",
    );
    expect(removed.track.damageResults.some(({ id }) => id === "stunned")).toBe(
      false,
    );
    expect(removed.track.damageTransitions.healthy).not.toHaveProperty(
      "stunned",
    );
    expect(removed.track.damageTransitions.healthy?.wounded).toBe("healthy");
  });

  it("reorders outcome identities while preserving valid positional band slots", () => {
    const results = defaultHealthDamageResults("open-d6.damage.wounds");
    const source = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds" as const,
      track: {
        ...model().track,
        damageResults: results,
        damageTransitions: Object.fromEntries(
          model().track.states.map(({ id }) => [
            id,
            Object.fromEntries(
              results.map(({ id: outcomeId }) => [outcomeId, id]),
            ),
          ]),
        ),
      },
    };
    const movedId = results.at(-1)?.id;
    expect(movedId).toBeDefined();
    const moved = reorderHealthDamageResultPreservingRuleSlots(
      source,
      results.length - 1,
      0,
    );

    expect(moved.track.damageResults[0]?.id).toBe(movedId);
    expect(moved.track.damageResults.map(({ rule }) => rule)).toEqual(
      results.map(({ rule }) => rule),
    );
    const firstRule = moved.track.damageResults[0]?.rule;
    expect(firstRule?.kind).toBe("difference-band");
    if (firstRule?.kind === "difference-band") {
      expect(firstRule.band.minimum).toBe(Number.MIN_SAFE_INTEGER);
    }
    const lastRule = moved.track.damageResults.at(-1)?.rule;
    expect(lastRule?.kind).toBe("difference-band");
    if (lastRule?.kind === "difference-band") {
      expect(lastRule.band.maximum).toBeUndefined();
    }
    expect(() => normalizeWorldHealthModel(moved, "echo")).not.toThrow();
    expect(moved.track.damageTransitions.healthy?.[movedId ?? ""]).toBe(
      "healthy",
    );
  });

  it("rekeys an unpublished outcome as a new unresolved identity before move, remove, or save", () => {
    const results = defaultHealthDamageResults("open-d6.damage.wounds");
    const source = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds" as const,
      track: {
        ...model().track,
        damageResults: results,
        damageTransitions: Object.fromEntries(
          model().track.states.map(({ id }) => [
            id,
            Object.fromEntries(
              results.map(({ id: outcomeId }) => [outcomeId, id]),
            ),
          ]),
        ),
      },
    };
    const editedIndex = 1;
    const previousId = results[editedIndex]?.id ?? "";
    const nextId = "hurt.custom";
    const rekeyed = rekeyHealthDamageResult(source, editedIndex, nextId);

    expect(rekeyed.track.damageResults[editedIndex]?.id).toBe(nextId);
    for (const row of Object.values(rekeyed.track.damageTransitions)) {
      expect(row).not.toHaveProperty(previousId);
      expect(row).not.toHaveProperty(nextId);
    }

    const moved = reorderHealthDamageResultPreservingRuleSlots(
      rekeyed,
      editedIndex,
      0,
    );
    expect(moved.track.damageResults[0]?.id).toBe(nextId);
    const removed = withoutHealthDamageResultPreservingTransitions(
      rekeyed,
      nextId,
    );
    expect(removed.track.damageResults.some(({ id }) => id === nextId)).toBe(
      false,
    );

    const ready = {
      ...rekeyed,
      track: {
        ...rekeyed.track,
        damageTransitions: Object.fromEntries(
          Object.entries(rekeyed.track.damageTransitions).map(
            ([stateId, row]) => [stateId, { ...row, [nextId]: stateId }],
          ),
        ),
      },
    };
    expect(() => normalizeWorldHealthModel(ready, "echo")).not.toThrow();
  });

  it("keeps strategy-predicate result counts engine-owned", () => {
    expect(canChangeHealthDamageResultCount(model())).toBe(false);
    expect(
      canChangeHealthDamageResultCount({
        ...model(),
        damageStrategyId: "open-d6.damage.wounds",
        track: {
          ...model().track,
          damageResults: defaultHealthDamageResults("open-d6.damage.wounds"),
        },
      }),
    ).toBe(true);
  });

  it("maps dotted portable transition identities to the exact DOM-safe cell", () => {
    const controlId = healthTransitionControlId("state.one", "hurt.custom");
    expect(controlId).toBe(
      "d6e2-health-transition-state_2e_one--hurt_2e_custom",
    );
    expect(controlId).not.toContain(".");
    expect(
      healthTransitionErrorTarget(
        "Missing or invalid transition state.one/hurt.custom",
      ),
    ).toBe(controlId);
  });

  it("serializes an ID rekey before Move and restores the current identity", async () => {
    const results = defaultHealthDamageResults("open-d6.damage.wounds");
    let draft: EditableHealthModel = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds",
      track: {
        ...model().track,
        damageResults: results,
        damageTransitions: Object.fromEntries(
          model().track.states.map(({ id }) => [
            id,
            Object.fromEntries(
              results.map(({ id: outcomeId }) => [outcomeId, id]),
            ),
          ]),
        ),
      },
    };
    const boundary = new HealthOutcomeRenderBoundary();
    const focused: string[] = [];
    const host = {
      querySelector: (selector: string) => ({
        disabled: false,
        focus: () => focused.push(selector),
      }),
    };
    let releaseRekey: (() => void) | undefined;
    const rekeyGate = new Promise<void>((resolve) => {
      releaseRekey = resolve;
    });
    draft = rekeyHealthDamageResult(draft, 1, "hurt.custom");
    const rekey = boundary.enqueue(async () => {
      await rekeyGate;
      restoreHealthOutcomeFocus(host, { index: 1, kind: "rekey" });
    });
    const move = (async () => {
      await boundary.settled();
      const currentIndex = draft.track.damageResults.findIndex(
        ({ id }) => id === "hurt.custom",
      );
      draft = reorderHealthDamageResultPreservingRuleSlots(
        draft,
        currentIndex,
        currentIndex - 1,
      );
      await boundary.enqueue(() => {
        restoreHealthOutcomeFocus(host, {
          direction: "up",
          kind: "move",
          outcomeId: draft.track.damageResults[currentIndex - 1]?.id ?? "",
        });
      });
    })();

    await Promise.resolve();
    expect(focused).toEqual([]);
    releaseRekey?.();
    await Promise.all([rekey, move]);
    expect(focused).toEqual([
      '[name="result.1.id"]',
      '[data-outcome-id="hurt.custom"][data-action="moveDamageResult"][data-direction="up"]',
    ]);
  });

  it("serializes an ID rekey before Remove and focuses its logical survivor", async () => {
    const results = defaultHealthDamageResults("open-d6.damage.wounds");
    let draft: EditableHealthModel = {
      ...model(),
      damageStrategyId: "open-d6.damage.wounds",
      track: {
        ...model().track,
        damageResults: results,
        damageTransitions: Object.fromEntries(
          model().track.states.map(({ id }) => [
            id,
            Object.fromEntries(
              results.map(({ id: outcomeId }) => [outcomeId, id]),
            ),
          ]),
        ),
      },
    };
    const boundary = new HealthOutcomeRenderBoundary();
    const focused: string[] = [];
    const host = {
      querySelector: (selector: string) => ({
        disabled: false,
        focus: () => focused.push(selector),
      }),
    };
    draft = rekeyHealthDamageResult(draft, 2, "hurt.custom");
    await boundary.enqueue(() => {
      restoreHealthOutcomeFocus(host, { index: 2, kind: "rekey" });
    });
    await boundary.settled();
    const removedIndex = draft.track.damageResults.findIndex(
      ({ id }) => id === "hurt.custom",
    );
    draft = withoutHealthDamageResultPreservingTransitions(
      draft,
      "hurt.custom",
    );
    const survivorIndex = Math.min(
      removedIndex,
      draft.track.damageResults.length - 1,
    );
    await boundary.enqueue(() => {
      restoreHealthOutcomeFocus(host, {
        kind: "remove",
        survivorIndex,
      });
    });

    expect(focused).toEqual([
      '[name="result.2.id"]',
      '[name="result.2.label"]',
    ]);
    expect(
      draft.track.damageResults.some(({ id }) => id === "hurt.custom"),
    ).toBe(false);
  });

  it("generates proposals against the authored outcome IDs rather than strategy ordinals", () => {
    const source = model();
    const custom = withHealthDamageResultsPreservingTransitions(source, [
      {
        description: "",
        id: "safe",
        label: "Safe",
        rule: {
          band: { maximum: 0, minimum: Number.MIN_SAFE_INTEGER },
          kind: "difference-band" as const,
        },
      },
      {
        description: "",
        id: "hurt",
        label: "Hurt",
        rule: {
          band: { minimum: 1 },
          kind: "difference-band" as const,
        },
      },
    ]);
    const proposal = proposeHealthTransitionGeneration(custom);
    expect(Object.keys(proposal.transitions.healthy ?? {})).toEqual([
      "safe",
      "hurt",
    ]);
    expect(proposal.changes).toContainEqual(
      expect.objectContaining({ outcomeId: "hurt" }),
    );
  });
});
