import {
  D6_HEALTH_MODEL_CONTRACT_VERSION,
  generateMonotonicDamageTransitions,
  healthDamageOutcomes,
  normalizeWorldHealthModel,
  type D6HealthDamageStrategyId,
  type D6HealthModelV2,
  type D6HealthTrackStateV2,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";
import type { HealthStateReplacementMap } from "./rules-profile-library";
import {
  worldHealthStateImpacts,
  worldHealthModelReferences,
} from "./rules-profile-library";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

type TrackModel = Extract<D6HealthModelV2, { readonly kind: "track" }>;
type SaveHealthModel = (
  model: TrackModel,
  replacements: HealthStateReplacementMap,
) => Promise<void> | void;

interface HealthModelValidationError {
  readonly message: string;
  readonly targetId: string;
}

function ownerId(modelId: string, fallback: string): string {
  const marker = modelId.indexOf(".health.");
  return marker > 0 ? modelId.slice(0, marker) : fallback;
}

function defaultModel(profileId: string, modelId: string): TrackModel {
  const states = [
    {
      allowsActions: true,
      id: "healthy",
      label: "Healthy",
      penaltyScore: 0,
      terminal: false,
    },
    {
      allowsActions: false,
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
      label: "Personal Health",
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

export class D6System2eHealthModelApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/health-model.hbs`,
    },
  };

  #profileId = "world-rules";
  #draft = defaultModel(this.#profileId, `${this.#profileId}.health.personal`);
  #originalStateIds = new Set<string>();
  #advanced = false;
  #advancedOpen = false;
  #errors: HealthModelValidationError[] = [];
  #announcement = "";
  #onSave: SaveHealthModel = () => undefined;
  #onDelete: (modelId: string) => Promise<void> | void = () => undefined;

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

  withModel(
    profileId: string,
    model: TrackModel | null,
    onSave: SaveHealthModel,
    onDelete: (modelId: string) => Promise<void> | void = () => undefined,
    options: { readonly isNew?: boolean; readonly modelId?: string } = {},
  ): this {
    this.#profileId = profileId;
    this.#draft = structuredClone(
      model ??
        defaultModel(
          profileId,
          options.modelId ?? `${profileId}.health.personal`,
        ),
    );
    this.#originalStateIds = new Set(
      options.isNew === true
        ? []
        : (model?.track.states.map(({ id }) => id) ?? []),
    );
    this.#onSave = onSave;
    this.#onDelete = onDelete;
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
        id: stateId,
        label: value(`state.${index}.label`) || state.label,
        penaltyScore: Number(value(`state.${index}.penaltyScore`)),
        ...(roundStartStateId ? { roundStartStateId } : {}),
        terminal: checked(`state.${index}.terminal`),
      } satisfies D6HealthTrackStateV2;
    });
    const outcomes = healthDamageOutcomes(damageStrategyId);
    const damageTransitions = this.#advanced
      ? Object.fromEntries(
          states.map((state) => [
            state.id,
            Object.fromEntries(
              outcomes.map((outcome) => [
                outcome,
                value(`transition.${state.id}.${outcome}`) || state.id,
              ]),
            ),
          ]),
        )
      : generateMonotonicDamageTransitions(states, outcomes);
    this.#draft = {
      damageStrategyId,
      description: value("model.description"),
      id: value("model.id").toLocaleLowerCase(),
      kind: "track",
      label: value("model.label"),
      source: { kind: "world" },
      track: {
        damageTransitions,
        initialStateId: value("model.initialStateId"),
        states,
      },
      version: D6_HEALTH_MODEL_CONTRACT_VERSION,
    };
  }

  #errorTarget(message: string): string {
    const lower = message.toLocaleLowerCase();
    if (lower.includes("health model id")) return "d6e2-health-model-id";
    if (lower.includes("initial health state")) {
      return "d6e2-health-model-initial-state";
    }
    if (lower.includes("terminal state")) {
      return "d6e2-health-state-0-terminal";
    }
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
        id,
        label: "New state",
        penaltyScore: 0,
        terminal: false,
      },
    ];
    this.#draft = {
      ...this.#draft,
      track: {
        ...this.#draft.track,
        damageTransitions: generateMonotonicDamageTransitions(
          states,
          healthDamageOutcomes(this.#draft.damageStrategyId),
        ),
        states,
      },
    };
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
    this.#draft = {
      ...this.#draft,
      track: {
        damageTransitions: generateMonotonicDamageTransitions(
          states,
          healthDamageOutcomes(this.#draft.damageStrategyId),
        ),
        initialStateId,
        states,
      },
    };
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
      label: state.label,
      position: destination + 1,
      total: states.length,
    });
    this.#draft = {
      ...this.#draft,
      track: {
        ...this.#draft.track,
        damageTransitions: this.#advanced
          ? this.#draft.track.damageTransitions
          : generateMonotonicDamageTransitions(
              states,
              healthDamageOutcomes(this.#draft.damageStrategyId),
            ),
        states,
      },
    };
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
    await this.render({ force: true });
  };

  static readonly #viewReferences = function (
    this: D6System2eHealthModelApplication,
  ): void {
    this.element
      .querySelector<HTMLElement>("#d6e2-health-model-references")
      ?.focus();
  };

  static readonly #deleteModel = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    const references = worldHealthModelReferences(this.#draft.id);
    if (references.length > 0) {
      this.#errors = [
        {
          message: `Health model ${this.#draft.id} is referenced by ${references
            .map(({ label }) => label)
            .join(", ")}.`,
          targetId: "d6e2-health-model-references",
        },
      ];
      await this.render({ force: true });
      this.element
        .querySelector<HTMLElement>("#d6e2-health-model-references")
        ?.focus();
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
      buttons: [
        {
          action: "cancel",
          callback: () => false,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "delete",
          callback: () => true,
          class: "is-destructive",
          default: true,
          label: game.i18n.localize("D6E2.Settings.HealthModel.Delete"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-confirm-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.format("D6E2.Settings.HealthModel.DeleteConfirm", { model: this.#draft.label })}</p></div>`,
      modal: true,
      position: { width: 520 },
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Settings.HealthModel.Delete"),
      },
    });
    if (!confirmed) return;
    await this.#onDelete(this.#draft.id);
    await this.close();
  };

  static readonly #basicMode = async function (
    this: D6System2eHealthModelApplication,
  ): Promise<void> {
    this.#readForm();
    this.#advanced = false;
    this.#draft = {
      ...this.#draft,
      track: {
        ...this.#draft.track,
        damageTransitions: generateMonotonicDamageTransitions(
          this.#draft.track.states,
          healthDamageOutcomes(this.#draft.damageStrategyId),
        ),
      },
    };
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
      const model = normalizeWorldHealthModel(
        this.#draft,
        ownerId(this.#draft.id, this.#profileId),
      );
      if (model.kind !== "track") throw new TypeError("Track required");
      await this.#onSave(model, replacements);
      await this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nativeInvalid = form.querySelector<HTMLElement>(":invalid");
      const transitionError = message
        .toLocaleLowerCase()
        .includes("transition");
      const targetId = nativeInvalid?.id ?? this.#errorTarget(message);
      this.#errors = [{ message, targetId }];
      if (transitionError) this.#advancedOpen = true;
      await this.render({ force: true });
      const invalid = transitionError
        ? Array.from(
            this.element.querySelectorAll<HTMLElement>('[name^="transition."]'),
          ).find((field) => field.offsetParent !== null)
        : this.element.querySelector<HTMLElement>(`#${targetId}`);
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
      addState: this.#addState,
      advancedMode: this.#advancedMode,
      basicMode: this.#basicMode,
      deleteModel: this.#deleteModel,
      moveState: this.#moveState,
      removeState: this.#removeState,
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
    this.element.removeEventListener("blur", this.#validateField, true);
    this.element.addEventListener("blur", this.#validateField, true);
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const outcomes = healthDamageOutcomes(this.#draft.damageStrategyId);
    const removedStateIds = [...this.#originalStateIds].filter(
      (id) => !this.#draft.track.states.some((state) => state.id === id),
    );
    const references = worldHealthModelReferences(this.#draft.id);
    return Promise.resolve({
      advanced: this.#advanced,
      advancedOpenAttribute: this.#advancedOpen ? "open" : "",
      announcement: this.#announcement,
      canAddState: this.#draft.track.states.length < 20,
      errors: this.#errors.map(({ message, targetId }, index) => ({
        id: `d6e2-health-model-error-${index}`,
        message,
        targetId,
      })),
      model: this.#draft,
      damageStrategyOptions: [
        {
          label: "Second Edition outcomes",
          selectedAttribute:
            this.#draft.damageStrategyId === "d6e2.damage.conditions"
              ? "selected"
              : "",
          value: "d6e2.damage.conditions",
        },
        {
          label: "Open D6 outcomes",
          selectedAttribute:
            this.#draft.damageStrategyId === "open-d6.damage.wounds"
              ? "selected"
              : "",
          value: "open-d6.damage.wounds",
        },
      ],
      outcomes,
      publishedModel: this.#originalStateIds.size > 0,
      references,
      removedStates: removedStateIds.map((id) => {
        const impact = worldHealthStateImpacts(this.#draft.id).find(
          ({ stateId }) => stateId === id,
        );
        return {
          actorCount: impact?.actorCount ?? 0,
          actorNames: impact?.actorNames.join(", ") ?? "",
          id,
          replacementId: `d6e2-health-replacement-${id}`,
          replacementOptions: this.#draft.track.states,
        };
      }),
      states: this.#draft.track.states.map((state, index) => ({
        ...state,
        first: index === 0,
        index,
        last: index === this.#draft.track.states.length - 1,
        moveDownLabel: game.i18n.format("D6E2.Settings.HealthModel.MoveDown", {
          label: state.label,
          position: index + 1,
          total: this.#draft.track.states.length,
        }),
        moveUpLabel: game.i18n.format("D6E2.Settings.HealthModel.MoveUp", {
          label: state.label,
          position: index + 1,
          total: this.#draft.track.states.length,
        }),
        published: this.#originalStateIds.has(state.id),
        canRemove: this.#draft.track.states.length > 2,
        initialSelectedAttribute:
          state.id === this.#draft.track.initialStateId ? "selected" : "",
        roundStartOptions: this.#draft.track.states.map((candidate) => ({
          ...candidate,
          selected: candidate.id === state.roundStartStateId,
          selectedAttribute:
            candidate.id === state.roundStartStateId ? "selected" : "",
        })),
        transitions: outcomes.map((outcome) => ({
          outcome,
          options: this.#draft.track.states.map((candidate) => ({
            ...candidate,
            selected:
              this.#draft.track.damageTransitions[state.id]?.[outcome] ===
              candidate.id,
            selectedAttribute:
              this.#draft.track.damageTransitions[state.id]?.[outcome] ===
              candidate.id
                ? "selected"
                : "",
          })),
        })),
      })),
    });
  }
}
