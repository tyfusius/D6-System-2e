import {
  difficultyScaleErrors,
  isDefaultDifficultyId,
  type D6DifficultyLadderEntryV2,
} from "@d6-system-2e/core";

/** Draft text is retained verbatim, including blank/invalid numbers, across
 * ApplicationV2 rerenders. Persistence receives only the separately validated scale.
 */
export class DifficultyScaleEditor {
  #showErrors = false;
  #newIds = new Set<string>();
  #rows: { id: string; label: string; value: string }[];
  constructor(scale: readonly D6DifficultyLadderEntryV2[]) {
    this.#rows = scale.map((e) => ({ ...e, value: String(e.value) }));
    this.#showErrors = this.hasErrors;
  }
  validate(): void {
    this.#showErrors = true;
    this.#newIds.clear();
  }
  #visibleErrors(): readonly string[] {
    return this.#showErrors
      ? difficultyScaleErrors(this.scale()).filter(
          (error) =>
            ![...this.#newIds].some((id) => error.startsWith(`${id}.`)),
        )
      : [];
  }
  scale(): readonly D6DifficultyLadderEntryV2[] {
    return this.#rows.map((e) => ({
      ...e,
      label: e.label.trim(),
      value: e.value.trim() ? Number(e.value) : NaN,
    }));
  }
  get hasErrors(): boolean {
    return difficultyScaleErrors(this.scale()).length > 0;
  }
  capture(form: ParentNode, errorId: string): readonly HTMLInputElement[] {
    const fields = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name^="difficulty."]'),
    );
    for (const row of this.#rows)
      for (const field of ["label", "value"] as const) {
        const input = fields.find(
          (i) => i.name === `difficulty.${row.id}.${field}`,
        );
        if (input) row[field] = input.value;
      }
    const errors = this.#visibleErrors();
    const invalid = fields.filter(
      (i) =>
        errors.includes(i.name.slice("difficulty.".length)) ||
        errors.includes("scale"),
    );
    for (const field of fields) {
      if (invalid.includes(field)) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-errormessage", errorId);
      } else {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-errormessage");
      }
    }
    const error = Array.from(
      form.querySelectorAll<HTMLElement>('[role="alert"]'),
    ).find((e) => e.id === errorId);
    if (error) {
      error.dataset.errors = String(errors.length > 0);
      error.textContent =
        errors.length > 0
          ? game.i18n.localize("D6E2.Settings.RulesProfile.DifficultyInvalid")
          : "";
    }
    return invalid;
  }
  add(id: string): void {
    if (this.#rows.some((e) => e.id === id) || isDefaultDifficultyId(id))
      throw new Error("Duplicate difficulty ID");
    const values = this.scale()
      .map((e) => e.value)
      .filter(Number.isSafeInteger);
    const next =
      values.reduce((maximum, value) => Math.max(maximum, value), 0) + 1;
    this.#newIds.add(id);
    this.#rows.push({
      id,
      label: "",
      value: Number.isSafeInteger(next) ? String(next) : "",
    });
  }
  remove(id: string): boolean {
    if (isDefaultDifficultyId(id)) return false;
    const before = this.#rows.length;
    this.#rows = this.#rows.filter((e) => e.id !== id);
    this.#newIds.delete(id);
    return before !== this.#rows.length;
  }
  context(errorId: string) {
    const errors = this.#visibleErrors();
    return {
      difficultyErrorId: errorId,
      difficultyError:
        errors.length > 0
          ? game.i18n.localize("D6E2.Settings.RulesProfile.DifficultyInvalid")
          : "",
      hasDifficultyErrors: errors.length > 0,
      rows: this.#rows
        .toSorted((a, b) => {
          const av = a.value.trim() ? Number(a.value) : Infinity;
          const bv = b.value.trim() ? Number(b.value) : Infinity;
          return av - bv || a.id.localeCompare(b.id);
        })
        .map((e) => ({
          ...e,
          isDefault: isDefaultDifficultyId(e.id),
          canDelete: !isDefaultDifficultyId(e.id) && game.user?.isGM === true,
          labelInvalid: errors.includes(`${e.id}.label`),
          valueInvalid: errors.includes(`${e.id}.value`),
        })),
    };
  }
}
