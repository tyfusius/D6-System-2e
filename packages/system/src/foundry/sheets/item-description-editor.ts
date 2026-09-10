interface ItemDescriptionEnrichmentOptions {
  readonly relativeTo: object;
  readonly secrets: boolean;
}

type EnrichHtml = (
  html: string,
  options: ItemDescriptionEnrichmentOptions,
) => Promise<string>;

type CleanHtml = (html: string) => string;

export interface ItemDescriptionEditorElement extends Element {
  readonly value: unknown;
}

const namedEditors = new WeakSet<HTMLElement>();

export function bindItemDescriptionEditorName(root: ParentNode): void {
  const editor = root.querySelector<HTMLElement>(
    'prose-mirror[data-d6e2-item-description-editor][name="system.description"]',
  );
  if (!editor) return;

  const synchronizeName = (): void => {
    const name = editor.getAttribute("aria-label");
    if (!name?.trim()) return;
    for (const input of Array.from(
      editor.querySelectorAll<HTMLElement>(
        ":scope > .editor-container > .editor-content[contenteditable], :scope > code-mirror.source-editor .cm-content[contenteditable]",
      ),
    )) {
      input.setAttribute("role", "textbox");
      input.setAttribute("aria-multiline", "true");
      input.setAttribute("aria-label", name);
    }
  };

  // Foundry 14 creates the editing surface asynchronously and does not forward
  // the host's accessible name. The native menu wraps it in .editor-container.
  // Its source-code control creates and focuses a
  // separate CodeMirror surface. Both remain entirely stock editors.
  if (!namedEditors.has(editor)) {
    editor.addEventListener("open", synchronizeName);
    editor.addEventListener("focusin", synchronizeName);
    namedEditors.add(editor);
  }
  synchronizeName();
}

export async function enrichItemDescription(
  item: object,
  canViewSecrets: boolean,
  source: string,
  enrichHtml: EnrichHtml,
  cleanHtml: CleanHtml,
): Promise<Readonly<{ html: string; value: string }>> {
  const value = cleanHtml(source);
  const html = await enrichHtml(value, {
    relativeTo: item,
    secrets: canViewSecrets,
  });
  return Object.freeze({ html, value });
}

export function itemDescriptionEditorValue(root: ParentNode): string | null {
  const editor = root.querySelector<ItemDescriptionEditorElement>(
    'prose-mirror[data-d6e2-item-description-editor][name="system.description"]',
  );
  return editor && typeof editor.value === "string" ? editor.value : null;
}
