import {
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS,
  D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS,
  defaultHealthDamageResults,
  generateMonotonicDamageTransitions,
  healthDamageOutcomes,
  healthSimulationRuleSource,
  normalizeWorldHealthModel,
  simulateHealthModelDamage,
  validateHealthDamageResults,
  type D6HealthDamageStrategyId,
  type D6HealthModel,
  type D6HealthSimulationResultV1,
  type D6HealthTrackStateV2,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";
import { availableHealthModels } from "./health-model-library";
import type {
  DeleteWorldHealthModelPlan,
  HealthStateReplacementMap,
} from "./rules-profile-library";
import {
  availableRulesProfiles,
  availableWorldHealthModels,
  worldHealthStateImpacts,
  worldHealthModelReferences,
} from "./rules-profile-library";
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
  healthModelPresentationWarnings,
  proposeHealthTransitionGeneration,
  rekeyHealthDamageResult,
  reorderHealthDamageResultPreservingRuleSlots,
  restoreHealthOutcomeFocus,
  withHealthDamageResultsPreservingTransitions,
  withHealthStatesPreservingTransitions,
  withoutHealthDamageResultPreservingTransitions,
  withoutHealthStatePreservingTransitions,
  type HealthSimulationInputState,
  type HealthOutcomeFocusPlan,
  type HealthTransitionProposal,
} from "./health-model-editor-state";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

type TrackModel = Extract<D6HealthModel, { readonly kind: "track" }>;
type SaveHealthModel = (
  model: TrackModel,
  replacements: HealthStateReplacementMap,
) => Promise<void> | void;
type DeleteHealthModel = (
  plan: DeleteWorldHealthModelPlan,
) => Promise<void> | void;

interface HealthModelValidationError {
  readonly message: string;
  readonly targetId: string;
}

function ownerId(modelId: string, fallback: string): string {
  const marker = modelId.indexOf(".health.");
  return marker > 0 ? modelId.slice(0, marker) : fallback;
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function defaultModel(profileId: string, modelId: string): TrackModel {
  const states = [
    {
      allowsActions: true,
      description: "",
      id: "healthy",
      label: "Healthy",
      penaltyScore: 0,
      terminal: false,
    },
    {
      allowsActions: false,
      description: "",
      id: "dead",
      label: "Dead",
      penaltyScore: 0,
      terminal: true,
    },
  ] as const;
  const damageStrategyId = "d6e2.damage.conditions" as const;
  return normalizeWorldHealthModel(
    {
      damageStrategyId,
      description: "",
      id: modelId,
      kind: "track",
      label: game.i18n.localize("D6E2.Settings.HealthModel.PersonalHealth"),
      source: { kind: "world" },
      track: {
        damageTransitions: generateMonotonicDamageTransitions(
          states,
          healthDamageOutcomes(damageStrategyId),
        ),
        initialStateId: "healthy",
        states,
      },
      version: D6_HEALTH_MODEL_CONTRACT_VERSION,
    },
    profileId,
  ) as TrackModel;
}

function sameTransitionCells(
  left: TrackModel["track"]["damageTransitions"],
  right: TrackModel["track"]["damageTransitions"],
): boolean {
  const leftStates = Object.keys(left);
  const rightStates = Object.keys(right);
  if (
    leftStates.length !== rightStates.length ||
    leftStates.some((stateId) => !(stateId in right))
  ) {
    return false;
  }
  return leftStates.every((stateId) => {
    const leftRow = left[stateId] ?? {};
    const rightRow = right[stateId] ?? {};
    const leftOutcomes = Object.keys(leftRow);
    return (
      leftOutcomes.length === Object.keys(rightRow).length &&
      leftOutcomes.every((outcome) => leftRow[outcome] === rightRow[outcome])
    );
  });
}

export class D6System2eHealthModelApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/health-model.hbs`,
    },
  };

  #profileId = "world-rules";
  #draft = defaultModel(this.#profileId, `${this.#profileId}.health.personal`);
  #originalStateIds = new Set<string>();
  #originalOutcomeIds = new Set<string>();
  #originalStateLabels = new Map<string, string>();
  #advanced = false;
  #advancedOpen = false;
  #proposal: HealthTransitionProposal | null = null;
  #simulation: D6HealthSimulationResultV1 | null = null;
  #simulationInput: HealthSimulationInputState | null = null;
  #errors: HealthModelValidationError[] = [];
  #announcement = "";
  #onSave: SaveHealthModel = () => undefined;
  #onDelete: DeleteHealthModel = () => undefined;
  #savedFingerprint = "";
  #deleteReplacementModelId = "";
  #deletionCompleted = false;
  #committedSaveClose = false;
  readonly #outcomeRenderBoundary = new HealthOutcomeRenderBoundary();

  readonly #validateField = (event: Event): void => {
    const field = (event.target as HTMLElement).closest<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[aria-errormessage]");
    if (!field) return;
    const errorId = field.getAttribute("aria-errormessage");
    const error = errorId
      ? this.element.querySelector<HTMLElement>(`#${errorId}`)
      : null;
    const invalid = !field.checkValidity();
    field.toggleAttribute("aria-invalid", invalid);
    if (error) {
      error.hidden = !invalid;
      error.textContent = invalid ? field.validationMessage : "";
    }
  };

  readonly #validationLinkClick = (event: Event): void => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      '.d6e2-rules-profile-diagnostics a[href^="#"]',
    );
    if (!link) return;
    const id = link.getAttribute("href")?.slice(1);
    if (!id) return;
    const target = this.element.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    event.preventDefault();
    target.closest<HTMLDetailsElement>("details")?.setAttribute("open", "");
    target.scrollIntoView({ block: "center" });
    target.focus();
  };

  readonly #selectionChange = (event: Event): void => {
    const field = event.target as HTMLSelectElement;
    if (field.name === "model.damageStrategyId") {
      this.#readForm();
      this.#proposal = proposeHealthTransitionGeneration(this.#draft);
      this.#simulation = null;
      void this.render({ force: true });
    } else if (field.name === "delete.replacementModel") {
      this.#readForm();
      this.#deleteReplacementModelId = field.value;
      void this.render({ force: true });
    }
  };

  readonly #outcomeIdChange = (event: Event): void => {
    const field = (event.target as HTMLElement).closest<HTMLInputElement>(
      'input[name^="result."][name$=".id"]',
    );
    if (!field) return;
    const match = /^result\.(\d+)\.id$/u.exec(field.name);
    const resultIndex = Number(match?.[1]);
    const previous = this.#draft.track.damageResults[resultIndex];
    const nextId = field.value.trim().toLocaleLowerCase();
    if (
      !previous ||
      previous.id === nextId ||
      this.#originalOutcomeIds.has(previous.id)
    ) {
      return;
    }
    this.#draft = rekeyHealthDamageResult(this.#draft, resultIndex, nextId);
    this.#readForm();
    this.#proposal = null;
    this.#simulation = null;
    this.#advanced = true;
    this.#advancedOpen = true;
    void this.#renderWithOutcomeFocus({
      index: resultIndex,
      kind: "rekey",
    });
  };

  withModel(
    profileId: string,
    model: TrackModel | null,
    onSave: SaveHealthModel,
    onDelete: DeleteHealthModel = () => undefined,
    options: { readonly isNew?: boolean; readonly modelId?: string } = {},
  ): this {
    this.#profileId = profileId;
    this.#draft = localizeHealthModelEditorDraft(
      model ??
        defaultModel(
          profileId,
          options.modelId ?? `${profileId}.health.personal`,
        ),
      (value) => game.i18n.localize(value),
    );
    this.#originalStateIds = new Set(
      options.isNew === true
        ? []
        : (model?.track.states.map(({ id }) => id) ?? []),
    );
    this.#originalOutcomeIds = new Set(
      options.isNew === true
        ? []
        : (model?.track.damageResults.map(({ id }) => id) ?? []),
    );
    this.#originalStateLabels = new Map(
      model?.track.states.map(({ id, label }) => [
        id,
        game.i18n.localize(label),
      ]) ?? [],
    );
    this.#onSave = onSave;
    this.#onDelete = onDelete;
    this.#deleteReplacementModelId = "";
    this.#deletionCompleted = false;
    this.#committedSaveClose = false;
    this.#proposal = null;
    this.#simulation = null;
    this.#simulationInput = null;
    this.#savedFingerprint = JSON.stringify(this.#draft);
    return this;
  }

  #readForm(): void {
    const form = this.element as HTMLFormElement;
    const value = (name: string): string => {
      const fields = Array.from(
        form.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >(`[name="${name}"]`),
      );
      return (
        (
          fields.find((field) => field.offsetParent !== null) ?? fields[0]
        )?.value.trim() ?? ""
      );
    };
    const checked = (name: string): boolean =>
      form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ===
      true;
    const damageStrategyId = value(
      "model.damageStrategyId",
    ) as D6HealthDamageStrategyId;
    const states = this.#draft.track.states.map((state, index) => {
      const stateId = value(`state.${index}.id`) || state.id;
      const roundStartStateId = value(`state.${index}.roundStartStateId`);
      return {
        allowsActions: checked(`state.${index}.allowsActions`),
        description: value(`state.${index}.description`),
        id: stateId,
        label: value(`state.${index}.label`) || state.label,
        penaltyScore: Number(value(`state.${index}.penaltyScore`)),
        ...(roundStartStateId ? { roundStartStateId } : {}),
        terminal: checked(`state.${index}.terminal`),
      } satisfies D6HealthTrackStateV2;
    });
    const strategyChanged = damageStrategyId !== this.#draft.damageStrategyId;
    const damageResults = strategyChanged
      ? defaultHealthDamageResults(damageStrategyId)
      : this.#draft.track.damageResults.map((result, index) => {
          const label = value(`result.${index}.label`);
          const description = value(`result.${index}.description`);
          const id = value(`result.${index}.id`);
          if (result.rule.kind !== "difference-band") {
            return { ...result, description, id, label };
          }
          const minimumValue = value(`result.${index}.minimum`);
          const maximumValue = value(`result.${index}.maximum`);
          return {
            ...result,
            description,
            id,
            label,
            rule: {
              band: {
                minimum: Number(minimumValue),
                ...(index === this.#draft.track.damageResults.length - 1
                  ? {}
                  : { maximum: Number(maximumValue) }),
              },
              kind: "difference-band" as const,
            },
          };
        });
    const outcomes = damageResults.map(({ id }) => id);
    const hasTransitionFields =
      form.querySelector('[name^="transition."]') !== null;
    const readTransitions = hasTransitionFields
      ? Object.fromEntries(
          states.map((state) => [
            state.id,
            Object.fromEntries(
              outcomes.map((outcome) => [
                outcome,
                value(`transition.${state.id}.${outcome}`),
              ]),
            ),
          ]),
        )
      : this.#draft.track.damageTransitions;
    const damageTransitions = sameTransitionCells(
      readTransitions,
      this.#draft.track.damageTransitions,
    )
      ? this.#draft.track.damageTransitions
      : readTransitions;
    const rulesChanged =
      strategyChanged ||
      JSON.stringify(damageTransitions) !==
        JSON.stringify(this.#draft.track.damageTransitions) ||
      JSON.stringify(damageResults) !==
        JSON.stringify(this.#draft.track.damageResults);
    const ruleProvenance = rulesChanged
      ? this.#draft.track.ruleProvenance === "authored"
        ? "authored"
        : "mixed"
      : this.#draft.track.ruleProvenance;
    this.#draft = {
      damageStrategyId,
      description: value("model.description"),
      id: value("model.id").toLocaleLowerCase(),
      kind: "track",
      label: value("model.label"),
      source: { kind: "world" },
      track: {
        damageResults,
        damageTransitions,
        initialStateId: value("model.initialStateId"),
        ruleProvenance,
        states,
      },
      version: D6_HEALTH_MODEL_CONTRACT_VERSION,
    };
  }

  #errorTarget(message: string): string {
    const lower = message.toLocaleLowerCase();
    if (lower.includes("generated rules are unresolved")) {
      return "d6e2-health-generation-review";
    }
    if (lower.includes("health model id")) return "d6e2-health-model-id";
    if (lower.includes("initial health state")) {
      return "d6e2-health-model-initial-state";
    }
    if (lower.includes("terminal state")) {
      return "d6e2-health-state-0-terminal";
    }
    const damageResultTarget = healthDamageResultErrorTarget(
      this.#draft,
      message,
    );
    if (damageResultTarget) return damageResultTarget;
    const transitionTarget = healthTransitionErrorTarget(message);
    if (transitionTarget) return transitionTarget;
    if (lower.includes("unique")) {
      const seen = new Set<string>();
      const duplicateIndex = this.#draft.track.states.findIndex(({ id }) => {
        if (seen.has(id)) return true;
        seen.add(id);
        return false;
      });
      return `d6e2-health-state-${Math.max(0, duplicateIndex)}-id`;
    }
    const invalidState = /Invalid health state:\s*([^\s]+)/iu.exec(
      message,
    )?.[1];
    if (invalidState) {
      const index = this.#draft.track.states.findIndex(
        ({ id }) => id === invalidState,
      );
      return `d6e2-health-state-${Math.max(0, index)}-id`;
    }
    const transitionState = /(?:transition|target):\s*([^\s/]+)/iu.exec(
      message,
    )?.[1];
    if (lower.includes("round-start") && transitionState) {
      const index = this.#draft.track.states.findIndex(
        ({ id }) => id === transitionState,
      );
      return `d6e2-health-state-${Math.max(0, index)}-round-start`;
    }
    const replacement = /Health state\s+([^\s]+)\s+/iu.exec(message)?.[1];
    if (lower.includes("replacement") && replacement) {
      return `d6e2-health-replacement-${replacement}`;
    }
    if (lower.includes("transition") || lower.includes("damage outcome")) {
      return "d6e2-health-model-advanced";
    }
    return "d6e2-health-model-label";
  }

  async #renderAndRestoreFocus(
    stateId: string,
    direction: "down" | "up",
  ): Promise<void> {
    await this.render({ force: true });
    const preferred = this.element.querySelector<HTMLButtonElement>(
      `[data-state-id="${stateId}"][data-action="moveState"][data-direction="${direction}"]`,
    );
    const fallback = this.element.querySelector<HTMLButtonElement>(
      `[data-state-id="${stateId}"][data-action="moveState"]:not(:disabled)`,
    );
    (preferred?.disabled ? fallback : preferred)?.focus();
  }

  async #renderModeAndRestoreContext(
    action: "advancedMode" | "basicMode",
  ): Promise<void> {
    const scrollOwner = this.element.querySelector<HTMLElement>(
      ".d6e2-setting-profile-scroll",
    );
    const scrollTop = scrollOwner?.scrollTop ?? 0;
    await this.render({ force: true });
    const restoredScrollOwner = this.element.querySelector<HTMLElement>(
      ".d6e2-setting-profile-scroll",
    );
    if (restoredScrollOwner) restoredScrollOwner.scrollTop = scrollTop;
    this.element
      .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
      ?.focus({ preventScroll: true });
  }

  async #renderWithOutcomeFocus(plan: HealthOutcomeFocusPlan): Promise<void> {
    await this.#outcomeRenderBoundary.enqueue(async () => {
      await this.render({ force: true });
      restoreHealthOutcomeFocus(
        {
          querySelector: (selector) =>
            this.element.querySelector<HTMLElement>(selector),
        },
        plan,
      );
    });
  }

  static readonly #addDamageResult = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    await this.#outcomeRenderBoundary.settled();
    this.#readForm();
    const results = this.#draft.track.damageResults;
    if (
      results.length >= D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS ||
      !results.every(({ rule }) => rule.kind === "difference-band")
    ) {
      return;
    }
    const used = new Set(results.map(({ id }) => id));
    let id = "new-result";
    let suffix = 2;
    while (used.has(id)) id = `new-result-${suffix++}`;
    const previous = results.at(-1);
    if (previous?.rule.kind !== "difference-band") return;
    const minimum = Math.max(1, previous.rule.band.minimum + 1);
    const updatedPrevious = {
      ...previous,
      rule: {
        band: { maximum: minimum - 1, minimum: previous.rule.band.minimum },
        kind: "difference-band" as const,
      },
    };
    this.#draft = withHealthDamageResultsPreservingTransitions(this.#draft, [
      ...results.slice(0, -1),
      updatedPrevious,
      {
        description: "",
        id,
        label: game.i18n.localize("D6E2.Settings.HealthModel.NewDamageResult"),
        rule: {
          band: { minimum },
          kind: "difference-band" as const,
        },
      },
    ]);
    this.#proposal = null;
    this.#advanced = true;
    this.#advancedOpen = true;
    this.#simulation = null;
    await this.#renderWithOutcomeFocus({
      index: this.#draft.track.damageResults.length - 1,
      kind: "rekey",
    });
  };

  static readonly #removeDamageResult = async function (
    this: D6System2eHealthModelApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    await this.#outcomeRenderBoundary.settled();
    this.#readForm();
    if (
      !canChangeHealthDamageResultCount(this.#draft) ||
      this.#draft.track.damageResults.length <=
        D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS
    ) {
      return;
    }
    const resultIndex = Number(target.dataset.outcomeIndex);
    const matchedIndex = this.#draft.track.damageResults.findIndex(
      ({ id }) => id === target.dataset.outcomeId,
    );
    const currentIndex =
      matchedIndex >= 0
        ? matchedIndex
        : Number.isInteger(resultIndex)
          ? resultIndex
          : -1;
    const existing = this.#draft.track.damageResults[currentIndex];
    if (!existing) return;
    const outcomeId = existing.id;
    if (this.#originalOutcomeIds.has(outcomeId)) {
      const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
        buttons: [
          {
            action: "cancel",
            callback: () => false,
            default: true,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "remove",
            callback: () => true,
            class: "is-destructive",
            label: game.i18n.localize("D6E2.Settings.HealthModel.RemoveResult"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
        content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Settings.HealthModel.RemoveResultConfirm", { count: this.#draft.track.states.filter(({ id }) => this.#draft.track.damageTransitions[id]?.[outcomeId] !== undefined).length, result: escaped(game.i18n.localize(existing.label)) })}</p></div>`,
        modal: true,
        position: { width: 520 },
        rejectClose: false,
        window: {
          title: game.i18n.localize("D6E2.Settings.HealthModel.RemoveResult"),
        },
      });
      if (!confirmed) return;
    }
    this.#draft = withoutHealthDamageResultPreservingTransitions(
      this.#draft,
      outcomeId,
    );
    this.#proposal = null;
    this.#advanced = true;
    this.#advancedOpen = true;
    this.#simulation = null;
    const survivorIndex =
      this.#draft.track.damageResults.length === 0
        ? null
        : Math.min(currentIndex, this.#draft.track.damageResults.length - 1);
    await this.#renderWithOutcomeFocus({ kind: "remove", survivorIndex });
  };

  static readonly #moveDamageResult = async function (
    this: D6System2eHealthModelApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    await this.#outcomeRenderBoundary.settled();
    this.#readForm();
    const outcomeId = target.dataset.outcomeId ?? "";
    const resultIndex = Number(target.dataset.outcomeIndex);
    const results = this.#draft.track.damageResults;
    const matchedIndex = results.findIndex(({ id }) => id === outcomeId);
    const index = matchedIndex >= 0 ? matchedIndex : resultIndex;
    const offset = target.dataset.direction === "up" ? -1 : 1;
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= results.length) return;
    const result = results[index];
    if (!result) return;
    this.#draft = reorderHealthDamageResultPreservingRuleSlots(
      this.#draft,
      index,
      destination,
    );
    this.#proposal = null;
    this.#simulation = null;
    this.#announcement = game.i18n.format(
      "D6E2.Settings.HealthModel.ResultMoved",
      {
        label: game.i18n.localize(result.label),
        position: destination + 1,
        total: this.#draft.track.damageResults.length,
      },
    );
    await this.#renderWithOutcomeFocus({
      direction: target.dataset.direction === "up" ? "up" : "down",
      kind: "move",
      outcomeId: result.id,
    });
  };

  static readonly #addState = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    if (this.#draft.track.states.length >= 20) return;
    const used = new Set(this.#draft.track.states.map(({ id }) => id));
    let id = "new-state";
    let suffix = 2;
    while (used.has(id)) id = `new-state-${suffix++}`;
    const states = [
      ...this.#draft.track.states,
      {
        allowsActions: true,
        description: "",
        id,
        label: game.i18n.localize("D6E2.Settings.HealthModel.NewState"),
        penaltyScore: 0,
        terminal: false,
      },
    ];
    this.#draft = withHealthStatesPreservingTransitions(this.#draft, states);
    this.#proposal = proposeHealthTransitionGeneration(this.#draft);
    this.#simulation = null;
    await this.render({ force: true });
    this.element
      .querySelector<HTMLInputElement>(`[data-state-id="${id}"] input`)
      ?.focus();
  };

  static readonly #removeState = async function (
    this: D6System2eHealthModelApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    if (this.#draft.track.states.length <= 2) return;
    const stateId = target.dataset.stateId;
    const states = this.#draft.track.states.filter(({ id }) => id !== stateId);
    if (states.length === this.#draft.track.states.length) return;
    const initialStateId = states.some(
      ({ id }) => id === this.#draft.track.initialStateId,
    )
      ? this.#draft.track.initialStateId
      : (states[0]?.id ?? "");
    this.#draft = withoutHealthStatePreservingTransitions(
      this.#draft,
      stateId ?? "",
      states,
      initialStateId,
    );
    this.#proposal = proposeHealthTransitionGeneration(this.#draft);
    this.#simulation = null;
    await this.render({ force: true });
  };

  static readonly #moveState = async function (
    this: D6System2eHealthModelApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    const stateId = target.dataset.stateId ?? "";
    const states = [...this.#draft.track.states];
    const index = states.findIndex(({ id }) => id === stateId);
    const offset = target.dataset.direction === "up" ? -1 : 1;
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= states.length) return;
    const [state] = states.splice(index, 1);
    if (!state) return;
    states.splice(destination, 0, state);
    this.#announcement = game.i18n.format("D6E2.Settings.HealthModel.Moved", {
      label: game.i18n.localize(state.label),
      position: destination + 1,
      total: states.length,
    });
    this.#draft = withHealthStatesPreservingTransitions(this.#draft, states);
    this.#proposal = proposeHealthTransitionGeneration(this.#draft);
    this.#simulation = null;
    await this.#renderAndRestoreFocus(
      stateId,
      target.dataset.direction === "up" ? "up" : "down",
    );
  };

  static readonly #advancedMode = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    this.#advanced = true;
    this.#advancedOpen = true;
    await this.#renderModeAndRestoreContext("advancedMode");
  };

  static readonly #viewReferences = function (
    this: D6System2eHealthModelApplication,
  ): void {
    this.element
      .querySelector<HTMLElement>("#d6e2-health-model-references")
      ?.focus();
  };

  static readonly #openRulesProfile = async function (
    this: D6System2eHealthModelApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const profile = availableRulesProfiles().find(
      ({ id }) => id === target.dataset.profileId,
    );
    if (profile?.source.kind !== "world") return;
    const { D6System2eRulesProfileApplication } =
      await import("./rules-profile-application");
    new D6System2eRulesProfileApplication().withDraft(profile).render(true);
  };

  static readonly #deleteModel = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    const form = this.element as HTMLFormElement;
    const replacementModelId =
      form.querySelector<HTMLSelectElement>('[name="delete.replacementModel"]')
        ?.value ?? "";
    const stateReplacements = Object.fromEntries(
      this.#draft.track.states.map(({ id }) => [
        id,
        form.querySelector<HTMLSelectElement>(`[name="delete.state.${id}"]`)
          ?.value ?? "",
      ]),
    );
    if (!replacementModelId) {
      this.#errors = [
        {
          message: game.i18n.localize(
            "D6E2.Settings.HealthModel.DeleteReplacementRequired",
          ),
          targetId: "d6e2-health-delete-replacement",
        },
      ];
      await this.render({ force: true });
      this.element
        .querySelector<HTMLElement>("#d6e2-health-delete-replacement")
        ?.focus();
      return;
    }
    const missingState = this.#draft.track.states.find(({ id }) => {
      const impact = worldHealthStateImpacts(this.#draft.id).find(
        ({ stateId }) => stateId === id,
      );
      return (impact?.actorCount ?? 0) > 0 && !stateReplacements[id];
    });
    if (missingState) {
      const targetId = `d6e2-health-delete-state-${missingState.id}`;
      this.#errors = [
        {
          message: game.i18n.format(
            "D6E2.Settings.HealthModel.DeleteStateReplacementRequired",
            { state: game.i18n.localize(missingState.label) },
          ),
          targetId,
        },
      ];
      await this.render({ force: true });
      this.element.querySelector<HTMLElement>(`#${targetId}`)?.focus();
      return;
    }
    const replacementModel = [
      ...availableHealthModels(),
      ...availableWorldHealthModels(),
    ].find(({ id }) => id === replacementModelId);
    if (replacementModel?.kind !== "track") return;
    const referenceLabels = worldHealthModelReferences(this.#draft.id).map(
      ({ label }) => game.i18n.localize(label),
    );
    const mappingLines = worldHealthStateImpacts(this.#draft.id)
      .filter(({ actorCount }) => actorCount > 0)
      .map((impact) => {
        const source = this.#draft.track.states.find(
          ({ id }) => id === impact.stateId,
        );
        const target = replacementModel.track.states.find(
          ({ id }) => id === stateReplacements[impact.stateId],
        );
        return `<li>${escaped(
          game.i18n.format("D6E2.Settings.HealthModel.DeleteMappingSummary", {
            count: impact.actorCount,
            source: game.i18n.localize(
              source?.label ?? "D6E2.Settings.HealthModel.Unresolved",
            ),
            target: game.i18n.localize(
              target?.label ?? "D6E2.Settings.HealthModel.Unresolved",
            ),
          }),
        )}</li>`;
      });
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          default: true,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "delete",
          callback: () => true,
          class: "is-destructive",
          label: game.i18n.localize("D6E2.Settings.HealthModel.Delete"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Settings.HealthModel.DeleteConfirm", { model: escaped(game.i18n.localize(this.#draft.label)), replacement: escaped(game.i18n.localize(replacementModel.label)) })}</p><p><strong>${escaped(game.i18n.localize("D6E2.Settings.HealthModel.ReferencingProfiles"))}</strong> ${escaped(referenceLabels.join(", ") || game.i18n.localize("D6E2.Settings.HealthModel.None"))}</p>${mappingLines.length > 0 ? `<ul>${mappingLines.join("")}</ul>` : ""}</div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Settings.HealthModel.Delete"),
      },
    });
    if (!confirmed) return;
    await this.#onDelete({
      modelId: this.#draft.id,
      replacementModelId,
      stateReplacements,
    });
    this.#deletionCompleted = true;
    this.#savedFingerprint = JSON.stringify(this.#draft);
    await this.close();
  };

  static readonly #revealDeleteFlow = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    const flow = this.element.querySelector<HTMLDetailsElement>(
      "#d6e2-health-delete-flow",
    );
    if (!flow) return;
    flow.open = true;
    await Promise.resolve();
    flow.querySelector<HTMLElement>("#d6e2-health-delete-replacement")?.focus();
  };

  static readonly #basicMode = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    this.#advanced = false;
    await this.#renderModeAndRestoreContext("basicMode");
  };

  static readonly #generateRules = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    this.#proposal = proposeHealthTransitionGeneration(this.#draft);
    this.#simulation = null;
    await this.render({ force: true });
    this.element
      .querySelector<HTMLElement>("#d6e2-health-generation-review")
      ?.focus();
  };

  static readonly #keepExactRules = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#proposal = null;
    await this.render({ force: true });
  };

  static readonly #applyGeneratedRules = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    if (!this.#proposal) return;
    const changeCount = this.#proposal.changes.length;
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          default: true,
          label: game.i18n.localize("D6E2.Settings.HealthModel.KeepExact"),
        },
        {
          action: "apply",
          callback: () => true,
          class: "is-destructive",
          label: game.i18n.format(
            "D6E2.Settings.HealthModel.ApplyGeneratedCount",
            { count: changeCount },
          ),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Settings.HealthModel.ApplyGeneratedConfirm", { count: changeCount })}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Settings.HealthModel.GeneratedReview"),
      },
    });
    if (!confirmed) return;
    this.#draft = applyHealthTransitionProposalIfConfirmed(
      this.#draft,
      this.#proposal,
      confirmed,
    );
    this.#proposal = null;
    this.#simulation = null;
    await this.render({ force: true });
  };

  static readonly #duplicateGeneratedRules = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    if (!this.#proposal) return;
    this.#draft = applyHealthTransitionProposal(
      {
        ...this.#draft,
        id: `${this.#draft.id}-generated-copy`,
        label: game.i18n.format(
          "D6E2.Settings.HealthModel.GeneratedCopyLabel",
          { label: game.i18n.localize(this.#draft.label) },
        ),
      },
      this.#proposal,
    );
    this.#originalStateIds = new Set();
    this.#proposal = null;
    this.#simulation = null;
    await this.render({ force: true });
    this.element
      .querySelector<HTMLInputElement>("#d6e2-health-model-id")
      ?.focus();
  };

  static readonly #simulate = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    const form = this.element as HTMLFormElement;
    const number = (name: string): number =>
      Number(form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value);
    const currentStateId =
      form.querySelector<HTMLSelectElement>('[name="simulation.current"]')
        ?.value ?? this.#draft.track.initialStateId;
    const incomingValue = form.querySelector<HTMLSelectElement>(
      '[name="simulation.incoming"]',
    )?.value;
    const incomingResultId = incomingValue === "" ? undefined : incomingValue;
    this.#simulationInput = {
      currentStateId,
      damage:
        form.querySelector<HTMLInputElement>('[name="simulation.damage"]')
          ?.value ?? "",
      incomingResultId: incomingValue ?? "",
      resistance:
        form.querySelector<HTMLInputElement>('[name="simulation.resistance"]')
          ?.value ?? "",
    };
    try {
      const model = normalizeWorldHealthModel(
        this.#draft,
        ownerId(this.#draft.id, this.#profileId),
      );
      if (model.kind !== "track") {
        throw new TypeError(
          game.i18n.localize("D6E2.Settings.HealthModel.TrackRequired"),
        );
      }
      this.#simulation =
        healthSimulationRuleSource(model) === "difference-band"
          ? simulateHealthModelDamage(model, {
              currentStateId,
              damage: number("simulation.damage"),
              resistance: number("simulation.resistance"),
            })
          : simulateHealthModelDamage(model, {
              currentStateId,
              ...(incomingResultId ? { incomingResultId } : {}),
            });
      this.#errors = [];
    } catch (error) {
      this.#simulation = null;
      this.#errors = [
        {
          message: error instanceof Error ? error.message : String(error),
          targetId: "d6e2-health-simulator",
        },
      ];
    }
    await this.render({ force: true });
  };

  static readonly #submit = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    const form = this.element as HTMLFormElement;
    const replacements = Object.fromEntries(
      [...this.#originalStateIds]
        .filter(
          (id) => !this.#draft.track.states.some((state) => state.id === id),
        )
        .map((id) => [
          id,
          form.querySelector<HTMLSelectElement>(`[name="replacement.${id}"]`)
            ?.value ?? "",
        ]),
    );
    try {
      if (this.#proposal) {
        throw new TypeError(
          game.i18n.localize(
            "D6E2.Settings.HealthModel.GeneratedRulesUnresolved",
          ),
        );
      }
      const damageResultErrors = validateHealthDamageResults(
        this.#draft.track.damageResults,
        this.#draft.damageStrategyId,
      );
      if (damageResultErrors[0]) throw new TypeError(damageResultErrors[0]);
      const model = normalizeWorldHealthModel(
        this.#draft,
        ownerId(this.#draft.id, this.#profileId),
      );
      if (model.kind !== "track") {
        throw new TypeError(
          game.i18n.localize("D6E2.Settings.HealthModel.TrackRequired"),
        );
      }
      await this.#onSave(model, replacements);
      this.#draft = model;
      this.#savedFingerprint = JSON.stringify(model);
      this.#committedSaveClose = true;
      try {
        await this.close();
      } finally {
        this.#committedSaveClose = false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nativeInvalid = form.querySelector<HTMLElement>(":invalid");
      const transitionError = message
        .toLocaleLowerCase()
        .includes("transition");
      const proposalError = message
        .toLocaleLowerCase()
        .includes("generated rules are unresolved");
      const targetId = nativeInvalid?.id ?? this.#errorTarget(message);
      this.#errors = [{ message, targetId }];
      if (transitionError || proposalError) this.#advancedOpen = true;
      await this.render({ force: true });
      const targeted = this.element.querySelector<HTMLElement>(`#${targetId}`);
      const invalid =
        targeted ??
        (transitionError
          ? Array.from(
              this.element.querySelectorAll<HTMLElement>(
                '[name^="transition."]',
              ),
            ).find((field) => field.offsetParent !== null)
          : null);
      invalid?.setAttribute("aria-invalid", "true");
      const errorId = invalid?.getAttribute("aria-errormessage");
      if (errorId) {
        const fieldError = this.element.querySelector<HTMLElement>(
          `#${errorId}`,
        );
        if (fieldError) {
          fieldError.hidden = false;
          fieldError.textContent = message;
        }
      }
      invalid?.focus();
    }
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      addDamageResult: this.#addDamageResult,
      addState: this.#addState,
      advancedMode: this.#advancedMode,
      applyGeneratedRules: this.#applyGeneratedRules,
      basicMode: this.#basicMode,
      deleteModel: this.#deleteModel,
      duplicateGeneratedRules: this.#duplicateGeneratedRules,
      generateRules: this.#generateRules,
      keepExactRules: this.#keepExactRules,
      moveState: this.#moveState,
      moveDamageResult: this.#moveDamageResult,
      openRulesProfile: this.#openRulesProfile,
      revealDeleteFlow: this.#revealDeleteFlow,
      removeState: this.#removeState,
      removeDamageResult: this.#removeDamageResult,
      simulate: this.#simulate,
      viewReferences: this.#viewReferences,
    },
    classes: ["d6e2", "d6e2-health-model-builder"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    }),
    id: "d6e2-health-model-builder",
    position: { height: 720, width: 920 },
    tag: "form",
    window: {
      icon: "fa-solid fa-heart-pulse",
      resizable: true,
      title: "D6E2.Settings.HealthModel.Title",
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    this.element.removeEventListener("click", this.#validationLinkClick);
    this.element.addEventListener("click", this.#validationLinkClick);
    this.element.removeEventListener("change", this.#validateField);
    this.element.addEventListener("change", this.#validateField);
    this.element.removeEventListener("change", this.#selectionChange);
    this.element.addEventListener("change", this.#selectionChange);
    this.element.removeEventListener("change", this.#outcomeIdChange);
    this.element.addEventListener("change", this.#outcomeIdChange);
    this.element.removeEventListener("blur", this.#validateField, true);
    this.element.addEventListener("blur", this.#validateField, true);
  }

  override async close(): Promise<void> {
    const requiresDiscardConfirmation =
      healthModelCloseRequiresDiscardConfirmation({
        committedSaveClose: this.#committedSaveClose,
        deletionCompleted: this.#deletionCompleted,
        readCurrentFingerprint: () => {
          if (this.rendered) this.#readForm();
          return JSON.stringify(this.#draft);
        },
        savedFingerprint: this.#savedFingerprint,
      });
    if (requiresDiscardConfirmation) {
      const discard = await foundry.applications.api.DialogV2.wait<boolean>({
        buttons: [
          {
            action: "keep-editing",
            callback: () => false,
            default: true,
            label: game.i18n.localize("D6E2.Settings.HealthModel.KeepEditing"),
          },
          {
            action: "discard",
            callback: () => true,
            class: "is-destructive",
            label: game.i18n.localize("D6E2.Settings.HealthModel.Discard"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
        content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
          "D6E2.Settings.HealthModel.UnsavedClose",
        )}</p></div>`,
        modal: true,
        rejectClose: false,
        window: {
          title: game.i18n.localize("D6E2.Settings.HealthModel.Title"),
        },
      });
      if (!discard) return;
    }
    return super.close();
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const outcomes = this.#draft.track.damageResults.map(({ id }) => id);
    const localize = (value: string): string => game.i18n.localize(value);
    const stateLabel = (id: string | undefined): string =>
      localize(
        this.#draft.track.states.find((state) => state.id === id)?.label ??
          "D6E2.Settings.HealthModel.Unresolved",
      );
    const outcomeLabel = (id: string): string =>
      localize(
        this.#draft.track.damageResults.find((result) => result.id === id)
          ?.label ?? "D6E2.Settings.HealthModel.Unresolved",
      );
    const simulationRuleSource = healthSimulationRuleSource(this.#draft);
    const removedStateIds = [...this.#originalStateIds].filter(
      (id) => !this.#draft.track.states.some((state) => state.id === id),
    );
    const references = worldHealthModelReferences(this.#draft.id).map(
      (reference) => ({
        ...reference,
        label: localize(reference.label),
      }),
    );
    const replacementModels = [
      ...availableHealthModels(),
      ...availableWorldHealthModels(),
    ].filter(
      (model, index, models) =>
        model.kind === "track" &&
        model.id !== this.#draft.id &&
        models.findIndex(({ id }) => id === model.id) === index,
    );
    const replacementModel = replacementModels.find(
      ({ id }) => id === this.#deleteReplacementModelId,
    );
    const impacts = worldHealthStateImpacts(this.#draft.id);
    const warnings = healthModelPresentationWarnings(
      this.#draft,
      localize,
      (key, data) => game.i18n.format(key, data),
    );
    const simulationInput = healthSimulationInputProjection(
      this.#draft,
      this.#simulationInput,
      this.#simulation,
    );
    const simulationCurrentStateId = simulationInput.currentStateId;
    const simulationIncomingResultId = simulationInput.incomingResultId;
    const canChangeDamageResultCount = canChangeHealthDamageResultCount(
      this.#draft,
    );
    return Promise.resolve({
      advanced: this.#advanced,
      advancedOpenAttribute: this.#advancedOpen ? "open" : "",
      modeHelp: localize(
        this.#advanced
          ? "D6E2.Settings.HealthModel.AdvancedModeHelp"
          : "D6E2.Settings.HealthModel.GuidedModeHelp",
      ),
      announcement: this.#announcement,
      canAddState: this.#draft.track.states.length < 20,
      canAddDamageResult:
        this.#draft.track.damageResults.length <
          D6_HEALTH_MODEL_MAX_DAMAGE_RESULTS && canChangeDamageResultCount,
      damageResultSetHelp: localize(
        canChangeDamageResultCount
          ? "D6E2.Settings.HealthModel.AddDamageResultHelp"
          : "D6E2.Settings.HealthModel.PredicateResultSetHelp",
      ),
      errors: this.#errors.map(({ message, targetId }, index) => ({
        id: `d6e2-health-model-error-${index}`,
        message,
        targetId,
      })),
      model: {
        ...this.#draft,
        label: localize(this.#draft.label),
      },
      unsaved: JSON.stringify(this.#draft) !== this.#savedFingerprint,
      provenance: localize(
        {
          authored: "D6E2.Settings.HealthModel.ProvenanceAuthored",
          generated: "D6E2.Settings.HealthModel.ProvenanceGenerated",
          mixed: "D6E2.Settings.HealthModel.ProvenanceMixed",
          preset: "D6E2.Settings.HealthModel.ProvenancePreset",
        }[this.#draft.track.ruleProvenance],
      ),
      ownershipHelp: localize("D6E2.Settings.HealthModel.OwnershipHelp"),
      damageStrategyOptions: [
        {
          label: localize("D6E2.Settings.HealthModel.StrategySecondEdition"),
          selectedAttribute:
            this.#draft.damageStrategyId === "d6e2.damage.conditions"
              ? "selected"
              : "",
          value: "d6e2.damage.conditions",
        },
        {
          label: localize("D6E2.Settings.HealthModel.StrategyOpenD6"),
          selectedAttribute:
            this.#draft.damageStrategyId === "open-d6.damage.wounds"
              ? "selected"
              : "",
          value: "open-d6.damage.wounds",
        },
      ],
      outcomes: outcomes.map((id) => ({ id, label: outcomeLabel(id) })),
      outcomeCount: outcomes.length,
      damageResults: this.#draft.track.damageResults.map((result, index) => ({
        ...result,
        developerId: result.id,
        displayLabel: localize(result.label),
        label: localize(result.label),
        index,
        idErrorId: `d6e2-health-result-${index}-id-error`,
        idId: `d6e2-health-result-${index}-id`,
        labelErrorId: `d6e2-health-result-${index}-label-error`,
        labelId: `d6e2-health-result-${index}-label`,
        canRemove:
          canChangeHealthDamageResultCount(this.#draft) &&
          this.#draft.track.damageResults.length >
            D6_HEALTH_MODEL_MIN_DAMAGE_RESULTS,
        first: index === 0,
        last: index === this.#draft.track.damageResults.length - 1,
        published: this.#originalOutcomeIds.has(result.id),
        moveUpLabel: game.i18n.format(
          "D6E2.Settings.HealthModel.MoveResultUp",
          {
            label: localize(result.label),
            position: index + 1,
            total: this.#draft.track.damageResults.length,
          },
        ),
        moveDownLabel: game.i18n.format(
          "D6E2.Settings.HealthModel.MoveResultDown",
          {
            label: localize(result.label),
            position: index + 1,
            total: this.#draft.track.damageResults.length,
          },
        ),
        minimumErrorId: `d6e2-health-result-${index}-minimum-error`,
        minimumId: `d6e2-health-result-${index}-minimum`,
        maximumErrorId: `d6e2-health-result-${index}-maximum-error`,
        maximumId: `d6e2-health-result-${index}-maximum`,
        isBand: result.rule.kind === "difference-band",
        lowerOpenEnded:
          result.rule.kind === "difference-band" &&
          index === 0 &&
          result.rule.band.minimum === Number.MIN_SAFE_INTEGER,
        maximum:
          result.rule.kind === "difference-band"
            ? result.rule.band.maximum
            : undefined,
        minimum:
          result.rule.kind === "difference-band"
            ? result.rule.band.minimum
            : undefined,
        openEnded:
          result.rule.kind === "difference-band" &&
          index === this.#draft.track.damageResults.length - 1 &&
          result.rule.band.maximum === undefined,
        predicate:
          result.rule.kind === "strategy" ? result.rule.predicateId : "",
        ruleSummary: localize(
          result.rule.kind === "difference-band"
            ? "D6E2.Settings.HealthModel.RuleDifferenceBand"
            : "D6E2.Settings.HealthModel.RuleStrategy",
        ),
      })),
      generation: this.#proposal
        ? {
            changeCount: this.#proposal.changes.length,
            applyLabel: game.i18n.format(
              "D6E2.Settings.HealthModel.ApplyGeneratedCount",
              { count: this.#proposal.changes.length },
            ),
            changes: this.#proposal.changes.map((change) => ({
              description: game.i18n.format(
                "D6E2.Settings.HealthModel.GeneratedChange",
                {
                  current: stateLabel(change.currentStateId),
                  from: stateLabel(change.from),
                  outcome: outcomeLabel(change.outcomeId),
                  to: stateLabel(change.to),
                },
              ),
            })),
          }
        : null,
      simulation: this.#simulation
        ? {
            appliedRule: localize(
              this.#simulation.ruleSource === "difference-band"
                ? "D6E2.Settings.HealthModel.AppliedDifferenceBand"
                : "D6E2.Settings.HealthModel.AppliedExactTransition",
            ),
            currentState: stateLabel(this.#simulation.currentStateId),
            hasDifference: this.#simulation.difference !== undefined,
            ...(this.#simulation.difference === undefined
              ? {}
              : {
                  difference: game.i18n.format(
                    "D6E2.Settings.HealthModel.DifferenceTrace",
                    {
                      damage: this.#simulation.damage ?? 0,
                      difference: this.#simulation.difference,
                      resistance: this.#simulation.resistance ?? 0,
                    },
                  ),
                }),
            incomingResult: outcomeLabel(this.#simulation.incomingResultId),
            nextState: stateLabel(this.#simulation.nextStateId),
          }
        : null,
      simulationStates: this.#draft.track.states.map((state) => ({
        ...state,
        label: localize(state.label),
        selectedAttribute:
          state.id === simulationCurrentStateId ? "selected" : "",
      })),
      simulationDamage: simulationInput.damage,
      simulationOutcomes: this.#draft.track.damageResults.map((result) => ({
        ...result,
        label:
          simulationRuleSource === "strategy" &&
          result.id === "mortally-wounded"
            ? game.i18n.format(
                "D6E2.Settings.HealthModel.ComplicationOutcome",
                { result: localize(result.label) },
              )
            : simulationRuleSource === "strategy" && result.id === "dead"
              ? game.i18n.format(
                  "D6E2.Settings.HealthModel.KillingBlowOutcome",
                  { result: localize(result.label) },
                )
              : localize(result.label),
        selectedAttribute:
          result.id === simulationIncomingResultId ? "selected" : "",
      })),
      simulationResistance: simulationInput.resistance,
      simulationUsesDifference: simulationRuleSource === "difference-band",
      simulationStrategyHelp:
        simulationRuleSource === "strategy"
          ? localize("D6E2.Settings.HealthModel.StrategySimulatorHelp")
          : "",
      warnings,
      publishedModel: this.#originalStateIds.size > 0,
      references,
      deletion: {
        actorCount: impacts.reduce(
          (total, impact) => total + impact.actorCount,
          0,
        ),
        replacementModelId: replacementModel?.id ?? "",
        replacementModels: replacementModels.map((model) => ({
          id: model.id,
          label: game.i18n.localize(model.label),
          selectedAttribute:
            model.id === replacementModel?.id ? "selected" : "",
        })),
        stateMappings: this.#draft.track.states.flatMap((state) => {
          const impact = impacts.find(({ stateId }) => stateId === state.id);
          if (!impact || impact.actorCount === 0) return [];
          return [
            {
              ...state,
              label: localize(state.label),
              actorCount: impact.actorCount,
              actorNames: impact.actorNames.join(", "),
              options:
                replacementModel?.kind === "track"
                  ? replacementModel.track.states.map((candidate) => ({
                      ...candidate,
                      label: localize(candidate.label),
                      selectedAttribute: "",
                    }))
                  : [],
            },
          ];
        }),
      },
      removedStates: removedStateIds.map((id) => {
        const impact = worldHealthStateImpacts(this.#draft.id).find(
          ({ stateId }) => stateId === id,
        );
        return {
          actorCount: impact?.actorCount ?? 0,
          actorNames: impact?.actorNames.join(", ") ?? "",
          id,
          label:
            this.#originalStateLabels.get(id) ??
            localize("D6E2.Settings.HealthModel.Unresolved"),
          replacementId: `d6e2-health-replacement-${id}`,
          replacementOptions: this.#draft.track.states.map((state) => ({
            ...state,
            label: localize(state.label),
          })),
        };
      }),
      states: this.#draft.track.states.map((state, index) => ({
        ...state,
        displayLabel: localize(state.label),
        label: localize(state.label),
        first: index === 0,
        index,
        last: index === this.#draft.track.states.length - 1,
        moveDownLabel: game.i18n.format("D6E2.Settings.HealthModel.MoveDown", {
          label: localize(state.label),
          position: index + 1,
          total: this.#draft.track.states.length,
        }),
        moveUpLabel: game.i18n.format("D6E2.Settings.HealthModel.MoveUp", {
          label: localize(state.label),
          position: index + 1,
          total: this.#draft.track.states.length,
        }),
        published: this.#originalStateIds.has(state.id),
        canRemove: this.#draft.track.states.length > 2,
        initialSelectedAttribute:
          state.id === this.#draft.track.initialStateId ? "selected" : "",
        roundStartOptions: this.#draft.track.states.map((candidate) => ({
          ...candidate,
          label: localize(candidate.label),
          selected: candidate.id === state.roundStartStateId,
          selectedAttribute:
            candidate.id === state.roundStartStateId ? "selected" : "",
        })),
        transitions: outcomes.map((outcome) => {
          const localizedOutcomeLabel = outcomeLabel(outcome);
          const targetId =
            this.#draft.track.damageTransitions[state.id]?.[outcome];
          const targetLabel = this.#draft.track.states.find(
            ({ id }) => id === targetId,
          )?.label;
          const controlId = healthTransitionControlId(state.id, outcome);
          return {
            controlId,
            errorId: `${controlId}-error`,
            outcome,
            outcomeLabel: localizedOutcomeLabel,
            semanticLabel: `${localize(state.label)} + ${localizedOutcomeLabel} → ${stateLabel(targetId)}`,
            unresolved: targetLabel === undefined,
            options: this.#draft.track.states.map((candidate) => ({
              ...candidate,
              label: localize(candidate.label),
              selected: targetId === candidate.id,
              selectedAttribute: targetId === candidate.id ? "selected" : "",
            })),
          };
        }),
      })),
    });
  }
}
