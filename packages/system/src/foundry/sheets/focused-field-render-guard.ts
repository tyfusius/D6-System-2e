type EditableField = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

function isEditableField(value: unknown): value is EditableField {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    (value instanceof HTMLElement &&
      (value.tagName === "PROSE-MIRROR" ||
        value.closest("prose-mirror") !== null))
  );
}

export class FocusedFieldRenderGuard {
  #deferredRender = false;
  #fieldFocused = false;

  constructor(
    private readonly root: () => HTMLElement | null | undefined,
    private readonly renderAfterEditing: () => void,
  ) {}

  readonly trackFocusIn = (event: FocusEvent): void => {
    if (isEditableField(event.target)) this.#fieldFocused = true;
  };

  readonly trackFocusOut = (): void => {
    queueMicrotask(() => {
      const root = this.root();
      if (!(root instanceof HTMLElement)) {
        this.#fieldFocused = false;
        this.#deferredRender = false;
        return;
      }
      const active = root.ownerDocument.activeElement;
      this.#fieldFocused = root.contains(active) && isEditableField(active);
      if (!this.#fieldFocused && this.#deferredRender) {
        this.#deferredRender = false;
        this.renderAfterEditing();
      }
    });
  };

  deferRenderWhileEditing(): boolean {
    if (!this.#fieldFocused) {
      this.#deferredRender = false;
      return false;
    }
    this.#deferredRender = true;
    return true;
  }
}
