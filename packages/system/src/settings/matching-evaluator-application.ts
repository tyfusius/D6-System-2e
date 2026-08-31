import {
  validateD6MatchingEvaluator,
  type D6MatchingEvaluatorV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { applicationV2FormOptions } from "../foundry/application-v2-form-options";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

type MutableEvaluator = {
  -readonly [K in keyof D6MatchingEvaluatorV1]: D6MatchingEvaluatorV1[K];
};

function copyId(base: string, used: ReadonlySet<string>): string {
  const normalized = `${base.replace(/[^a-z0-9._-]+/giu, "-").toLowerCase()}.copy`;
  let id = normalized;
  let suffix = 2;
  while (used.has(id)) id = `${normalized}-${suffix++}`;
  return id;
}

export class D6System2eMatchingEvaluatorApplication extends Base {
  static override PARTS = {
    form: {
      template: `systems/${SYSTEM_ID}/templates/settings/matching-evaluator.hbs`,
    },
  };

  #draft!: MutableEvaluator;
  #siblings: readonly D6MatchingEvaluatorV1[] = [];
  #onChanged?: (
    evaluators: readonly D6MatchingEvaluatorV1[],
    selected: D6MatchingEvaluatorV1,
  ) => Promise<void> | void;

  withEvaluator(
    evaluator: D6MatchingEvaluatorV1,
    siblings: readonly D6MatchingEvaluatorV1[],
    onChanged: (
      evaluators: readonly D6MatchingEvaluatorV1[],
      selected: D6MatchingEvaluatorV1,
    ) => Promise<void> | void,
  ): this {
    this.#draft = structuredClone(evaluator);
    this.#siblings = siblings;
    this.#onChanged = onChanged;
    return this;
  }

  #readForm(): void {
    const form = this.element as HTMLFormElement;
    const label = form
      .querySelector<HTMLInputElement>('[name="evaluator.label"]')
      ?.value.trim();
    if (label) this.#draft.label = label;
    this.#draft.patterns = Object.freeze(
      this.#draft.patterns.map((pattern) => {
        const label = form
          .querySelector<HTMLInputElement>(
            `[name="pattern.${CSS.escape(pattern.id)}.label"]`,
          )
          ?.value.trim();
        const precedence = Number(
          form.querySelector<HTMLInputElement>(
            `[name="pattern.${CSS.escape(pattern.id)}.precedence"]`,
          )?.value,
        );
        return {
          ...pattern,
          enabled:
            pattern.id === this.#draft.fallbackPatternId ||
            form.querySelector<HTMLInputElement>(
              `[name="pattern.${CSS.escape(pattern.id)}.enabled"]`,
            )?.checked === true,
          label: label ?? pattern.label,
          precedence: Number.isFinite(precedence)
            ? Math.trunc(precedence)
            : pattern.precedence,
          groups: Object.freeze(
            pattern.groups.map((group, index) => {
              const count = Number(
                form.querySelector<HTMLInputElement>(
                  `[name="pattern.${CSS.escape(pattern.id)}.group.${index}.count"]`,
                )?.value,
              );
              return {
                count: Number.isFinite(count) ? Math.trunc(count) : group.count,
                mode:
                  form.querySelector<HTMLSelectElement>(
                    `[name="pattern.${CSS.escape(pattern.id)}.group.${index}.mode"]`,
                  )?.value === "exact"
                    ? ("exact" as const)
                    : ("minimum" as const),
              };
            }),
          ),
        };
      }),
    );
  }

  async #renderAndRestoreContext(
    preferredSelector: string,
    fallbackSelector = '[data-action="addPattern"]',
  ): Promise<void> {
    const scrollOwner = this.element.querySelector<HTMLElement>(
      ".d6e2-matching-evaluator-scroll",
    );
    const scrollTop = scrollOwner?.scrollTop ?? 0;
    await this.render({ force: true });
    const restoredScrollOwner = this.element.querySelector<HTMLElement>(
      ".d6e2-matching-evaluator-scroll",
    );
    if (restoredScrollOwner) restoredScrollOwner.scrollTop = scrollTop;
    (
      this.element.querySelector<HTMLElement>(preferredSelector) ??
      this.element.querySelector<HTMLElement>(fallbackSelector)
    )?.focus({
      preventScroll: true,
    });
  }

  #validationTarget(): HTMLElement | null {
    const precedence = new Map<number, string[]>();
    for (const pattern of this.#draft.patterns) {
      const ids = precedence.get(pattern.precedence) ?? [];
      ids.push(pattern.id);
      precedence.set(pattern.precedence, ids);
    }
    const duplicate = [...precedence.values()].find((ids) => ids.length > 1);
    if (duplicate?.[0]) {
      return this.element.querySelector<HTMLElement>(
        `[name="pattern.${CSS.escape(duplicate[0])}.precedence"]`,
      );
    }
    const missingGroups = this.#draft.patterns.find(
      (pattern) =>
        pattern.id !== this.#draft.fallbackPatternId &&
        pattern.groups.length === 0,
    );
    if (missingGroups) {
      return this.element.querySelector<HTMLElement>(
        `[data-action="addGroup"][data-pattern-id="${CSS.escape(missingGroups.id)}"]`,
      );
    }
    const oversized = this.#draft.patterns.find(
      (pattern) =>
        pattern.groups.reduce((sum, group) => sum + group.count, 0) >
        this.#draft.pool.maximum,
    );
    if (oversized) {
      return this.element.querySelector<HTMLElement>(
        `[name="pattern.${CSS.escape(oversized.id)}.group.0.count"]`,
      );
    }
    return this.element.querySelector<HTMLElement>(
      "input:invalid, select:invalid",
    );
  }

  #clearValidation = (): void => {
    const summary = this.element.querySelector<HTMLElement>(
      "[data-matching-validation-summary]",
    );
    if (summary) summary.hidden = true;
    for (const control of Array.from(
      this.element.querySelectorAll<HTMLElement>(
        '[data-matching-validation-control="true"]',
      ),
    )) {
      control.removeAttribute("aria-describedby");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("data-matching-validation-control");
    }
  };

  #presentValidationError(message: string): void {
    const summary = this.element.querySelector<HTMLElement>(
      "[data-matching-validation-summary]",
    );
    const copy = summary?.querySelector<HTMLElement>(
      "[data-matching-validation-message]",
    );
    if (!summary || !copy) return;
    this.#clearValidation();
    copy.textContent = message;
    summary.hidden = false;
    const target = this.#validationTarget();
    if (target) {
      target.dataset.matchingValidationControl = "true";
      target.setAttribute("aria-describedby", summary.id);
      if (target.matches("input, select")) {
        target.setAttribute("aria-invalid", "true");
      }
    }
    (target ?? summary).focus({ preventScroll: false });
  }

  static readonly #duplicate = async function (
    this: D6System2eMatchingEvaluatorApplication,
  ): Promise<void> {
    const id = copyId(
      this.#draft.id,
      new Set(this.#siblings.map(({ id }) => id)),
    );
    const copy = Object.freeze({
      ...structuredClone(this.#draft),
      id,
      label: `${game.i18n.localize(this.#draft.label)} · ${game.i18n.localize("D6E2.Settings.RulesProfile.RollResolution.CopySuffix")}`,
      patterns: Object.freeze(
        this.#draft.patterns.map((pattern) => ({
          ...pattern,
          label: game.i18n.localize(pattern.label),
        })),
      ),
      source: Object.freeze({ kind: "world" as const }),
    });
    await this.#onChanged?.(Object.freeze([...this.#siblings, copy]), copy);
    await this.close();
  };

  static readonly #move = async function (
    this: D6System2eMatchingEvaluatorApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    const id = target.dataset.patternId;
    const direction = target.dataset.direction === "up" ? "up" : "down";
    const patterns = [...this.#draft.patterns].sort(
      (left, right) => right.precedence - left.precedence,
    );
    const index = patterns.findIndex((pattern) => pattern.id === id);
    const other = index + (direction === "up" ? -1 : 1);
    if (index < 0 || other < 0 || other >= patterns.length) return;
    const current = patterns[index];
    const neighbor = patterns[other];
    if (!current || !neighbor) return;
    const precedence = current.precedence;
    patterns[index] = {
      ...current,
      precedence: neighbor.precedence,
    };
    patterns[other] = { ...neighbor, precedence };
    this.#draft.patterns = Object.freeze(patterns);
    await this.#renderAndRestoreContext(
      `[data-action="movePattern"][data-pattern-id="${CSS.escape(id ?? "")}"][data-direction="${direction}"]`,
      `[data-action="movePattern"][data-pattern-id="${CSS.escape(id ?? "")}"]`,
    );
  };

  static readonly #add = async function (
    this: D6System2eMatchingEvaluatorApplication,
  ): Promise<void> {
    this.#readForm();
    const used = new Set(this.#draft.patterns.map(({ id }) => id));
    let id = "named-combination";
    let suffix = 2;
    while (used.has(id)) id = `named-combination-${suffix++}`;
    const fallback = this.#draft.patterns.find(
      ({ id: candidate }) => candidate === this.#draft.fallbackPatternId,
    );
    const next = this.#draft.patterns
      .filter(
        ({ id: candidate }) => candidate !== this.#draft.fallbackPatternId,
      )
      .map((pattern) => ({ ...pattern, precedence: pattern.precedence + 1 }));
    this.#draft.patterns = Object.freeze(
      [
        {
          enabled: true,
          groups: Object.freeze([{ count: 2, mode: "minimum" as const }]),
          id,
          label: "Named combination",
          precedence: 1,
        },
        ...next,
        ...(fallback ? [{ ...fallback, precedence: 0 }] : []),
      ].sort((a, b) => a.precedence - b.precedence),
    );
    await this.#renderAndRestoreContext(
      `[data-pattern-label][data-pattern-id="${CSS.escape(id)}"]`,
    );
  };

  static readonly #addGroup = async function (
    this: D6System2eMatchingEvaluatorApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    const id = target.dataset.patternId;
    if (!id || id === this.#draft.fallbackPatternId) return;
    this.#draft.patterns = Object.freeze(
      this.#draft.patterns.map((pattern) =>
        pattern.id === id
          ? {
              ...pattern,
              groups: Object.freeze([
                ...pattern.groups,
                { count: 2, mode: "minimum" as const },
              ]),
            }
          : pattern,
      ),
    );
    const index =
      this.#draft.patterns.find(({ id: patternId }) => patternId === id)?.groups
        .length ?? 1;
    await this.#renderAndRestoreContext(
      `[data-pattern-id="${CSS.escape(id)}"] [data-group-index="${Math.max(0, index - 1)}"] input`,
    );
  };

  static readonly #removeGroup = async function (
    this: D6System2eMatchingEvaluatorApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    const id = target.dataset.patternId;
    const index = Number(target.dataset.groupIndex);
    if (
      !id ||
      !Number.isSafeInteger(index) ||
      id === this.#draft.fallbackPatternId
    )
      return;
    this.#draft.patterns = Object.freeze(
      this.#draft.patterns.map((pattern) =>
        pattern.id === id
          ? {
              ...pattern,
              groups: Object.freeze(
                pattern.groups.filter((_, groupIndex) => groupIndex !== index),
              ),
            }
          : pattern,
      ),
    );
    await this.#renderAndRestoreContext(
      `[data-action="addGroup"][data-pattern-id="${CSS.escape(id)}"]`,
    );
  };

  static readonly #remove = async function (
    this: D6System2eMatchingEvaluatorApplication,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    this.#readForm();
    const id = target.dataset.patternId;
    if (!id || id === this.#draft.fallbackPatternId) return;
    const ordered = [...this.#draft.patterns].sort(
      (left, right) => right.precedence - left.precedence,
    );
    const index = ordered.findIndex((pattern) => pattern.id === id);
    const neighbor = ordered[index + 1] ?? ordered[index - 1];
    this.#draft.patterns = Object.freeze(
      this.#draft.patterns.filter((pattern) => pattern.id !== id),
    );
    await this.#renderAndRestoreContext(
      neighbor
        ? `[data-pattern-label][data-pattern-id="${CSS.escape(neighbor.id)}"]`
        : '[data-action="addPattern"]',
    );
  };

  static readonly #submit = async function (
    this: D6System2eMatchingEvaluatorApplication,
  ): Promise<void> {
    this.#readForm();
    try {
      validateD6MatchingEvaluator(this.#draft);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#presentValidationError(message);
      ui.notifications.warn(message);
      return;
    }
    const saved = Object.freeze(structuredClone(this.#draft));
    const evaluators = this.#siblings.some(({ id }) => id === saved.id)
      ? this.#siblings.map((entry) => (entry.id === saved.id ? saved : entry))
      : [...this.#siblings, saved];
    await this.#onChanged?.(Object.freeze(evaluators), saved);
    await this.close();
  };

  static override DEFAULT_OPTIONS = {
    actions: {
      addGroup: this.#addGroup,
      addPattern: this.#add,
      duplicate: this.#duplicate,
      movePattern: this.#move,
      removeGroup: this.#removeGroup,
      removePattern: this.#remove,
    },
    classes: ["d6e2", "d6e2-matching-evaluator"],
    form: applicationV2FormOptions({
      closeOnSubmit: false,
      handler: this.#submit,
      submitOnChange: false,
    }),
    id: "d6e2-matching-evaluator",
    position: { height: 680, width: 760 },
    tag: "form",
    window: {
      icon: "fa-solid fa-object-group",
      resizable: true,
      title: "D6E2.Settings.RulesProfile.RollResolution.EditorTitle",
    },
  };

  override async _onRender(
    context: Record<string, unknown>,
    options: { readonly parts: readonly string[] },
  ): Promise<void> {
    await super._onRender(context, options);
    const summary = this.element.querySelector<HTMLElement>(
      "[data-matching-validation-summary]",
    );
    if (summary && !summary.id) {
      summary.id = "d6e2-matching-evaluator-validation-summary";
    }
    this.element.removeEventListener("input", this.#clearValidation);
    this.element.addEventListener("input", this.#clearValidation);
    this.element.removeEventListener("change", this.#clearValidation);
    this.element.addEventListener("change", this.#clearValidation);
  }

  override _prepareContext(): Promise<Record<string, unknown>> {
    const readOnly = this.#draft.source.kind !== "world";
    return Promise.resolve({
      evaluator: {
        ...this.#draft,
        displayLabel: game.i18n.localize(this.#draft.label),
      },
      patterns: [...this.#draft.patterns]
        .sort((a, b) => b.precedence - a.precedence)
        .map((pattern, index, patterns) => ({
          ...pattern,
          canMoveDown:
            index < patterns.length - 1 &&
            patterns[index + 1]?.id !== this.#draft.fallbackPatternId,
          canMoveUp: index > 0,
          displayLabel: game.i18n.localize(pattern.label),
          isFallback: pattern.id === this.#draft.fallbackPatternId,
          removable: !readOnly && pattern.id !== this.#draft.fallbackPatternId,
        })),
      readOnly,
    });
  }
}
